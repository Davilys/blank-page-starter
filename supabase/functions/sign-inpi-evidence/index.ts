import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const BUCKET = 'inpi-resource-evidence';

const isJpeg = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
const isPng = (bytes: Uint8Array) =>
  bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
const isWebp = (bytes: Uint8Array) =>
  bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
  bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
const isRenderableImage = (bytes: Uint8Array) => isJpeg(bytes) || isPng(bytes) || isWebp(bytes);
const looksZlibWrapped = (bytes: Uint8Array) => bytes.length > 2 && bytes[0] === 0x78;

const inferImageContentType = (bytes: Uint8Array, fallback = 'image/jpeg') => {
  if (isJpeg(bytes)) return 'image/jpeg';
  if (isPng(bytes)) return 'image/png';
  if (isWebp(bytes)) return 'image/webp';
  return fallback;
};

async function inflateZlib(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    const inflated = new Uint8Array(await new Response(stream).arrayBuffer());
    return inflated.length > 0 ? inflated : null;
  } catch (_e) {
    return null;
  }
}

async function repairIfZlibWrappedImage(admin: ReturnType<typeof createClient>, path: string) {
  const { data: file, error: downloadError } = await admin.storage.from(BUCKET).download(path);
  if (downloadError || !file) {
    return { path, repaired: false, error: downloadError?.message || 'download failed' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isRenderableImage(bytes)) return { path, repaired: false, error: null };
  if (!looksZlibWrapped(bytes)) return { path, repaired: false, error: 'not a renderable image' };

  const inflated = await inflateZlib(bytes);
  if (!inflated || !isRenderableImage(inflated)) {
    return { path, repaired: false, error: 'zlib payload is not an image' };
  }

  const contentType = inferImageContentType(inflated, file.type || 'image/jpeg');
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, inflated, {
    contentType,
    upsert: true,
  });
  return { path, repaired: !uploadError, error: uploadError?.message || null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { paths, repair = false } = await req.json();
    if (!Array.isArray(paths) || paths.length === 0) {
      return new Response(JSON.stringify({ error: 'paths[] required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const safePaths = paths
      .filter((p) => typeof p === 'string')
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && !p.includes('..'))
      .slice(0, 100);
    if (safePaths.length === 0) {
      return new Response(JSON.stringify({ error: 'valid paths[] required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const repairs = repair
      ? await Promise.all(safePaths.map((path) => repairIfZlibWrappedImage(admin, path)))
      : [];

    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrls(safePaths, 3600);
    if (error) throw error;
    return new Response(JSON.stringify({ urls: data, repairs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('sign-inpi-evidence error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});