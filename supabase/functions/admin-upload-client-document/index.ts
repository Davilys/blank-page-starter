import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeFileName(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop()!.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "bin";
  const base = parts.join(".").replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 80) || "arquivo";
  return { base, ext: ext || "bin" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Usuário não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: "Configuração do servidor ausente" }, 500);

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "Sessão inválida" }, 401);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw roleError;
    if (!roleData) return jsonResponse({ error: "Apenas administradores podem enviar anexos" }, 403);

    const formData = await req.formData();
    const clientId = String(formData.get("clientId") || "").trim();
    const file = formData.get("file");
    if (!clientId) return jsonResponse({ error: "Cliente não informado" }, 400);
    if (!(file instanceof File)) return jsonResponse({ error: "Arquivo não informado" }, 400);
    if (file.size <= 0) return jsonResponse({ error: "Arquivo vazio" }, 400);

    const { data: client, error: clientError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", clientId)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client) return jsonResponse({ error: "Cliente não encontrado" }, 404);

    const { base, ext } = sanitizeFileName(file.name);
    const storagePath = `${clientId}/clients/${clientId}/${Date.now()}_${crypto.randomUUID()}_${base}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(storagePath, bytes, {
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseAdmin.storage.from("documents").getPublicUrl(storagePath);
    const { data: document, error: documentError } = await supabaseAdmin
      .from("documents")
      .insert({
        user_id: clientId,
        name: file.name,
        file_url: publicUrlData.publicUrl,
        document_type: "anexo",
        uploaded_by: userData.user.id,
        file_size: file.size,
        mime_type: file.type || null,
      })
      .select("id, file_url")
      .single();

    if (documentError) {
      await supabaseAdmin.storage.from("documents").remove([storagePath]).catch(() => undefined);
      throw documentError;
    }

    return jsonResponse({ success: true, document, storagePath });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro inesperado ao enviar arquivo";
    console.error("admin-upload-client-document error", error);
    return jsonResponse({ error: message }, 400);
  }
});
