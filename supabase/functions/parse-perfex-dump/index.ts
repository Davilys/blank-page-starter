// Parse Perfex SQL dump uploaded to Storage and produce NDJSON.gz files
// Accepts: .sql, .sql.gz, .zip (containing one .sql)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore deno
import { unzipSync, gzipSync } from 'https://esm.sh/fflate@0.8.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET = 'perfex-import';

function digits(s: string | null | undefined): string {
  return (s || '').replace(/\D+/g, '');
}

// Very tolerant SQL value parser for `INSERT INTO ... VALUES (...),(...);`
function* iterRows(sql: string, table: string): Generator<string[]> {
  const re = new RegExp(`INSERT INTO \\\`?${table}\\\`?\\s*\\(([^)]+)\\)\\s*VALUES\\s*`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    let i = m.index + m[0].length;
    while (i < sql.length) {
      while (i < sql.length && /\s/.test(sql[i])) i++;
      if (sql[i] !== '(') break;
      i++;
      const row: string[] = [];
      let cur = '';
      let inStr = false;
      while (i < sql.length) {
        const ch = sql[i];
        if (inStr) {
          if (ch === '\\' && i + 1 < sql.length) { cur += sql[i+1]; i += 2; continue; }
          if (ch === "'") { inStr = false; i++; continue; }
          cur += ch; i++; continue;
        }
        if (ch === "'") { inStr = true; i++; continue; }
        if (ch === ',') { row.push(cur.trim()); cur = ''; i++; continue; }
        if (ch === ')') { row.push(cur.trim()); i++; break; }
        cur += ch; i++;
      }
      yield row.map(v => v === 'NULL' ? '' : v);
      while (i < sql.length && /\s/.test(sql[i])) i++;
      if (sql[i] === ',') { i++; continue; }
      if (sql[i] === ';') { i++; break; }
      break;
    }
  }
}

function getCols(sql: string, table: string): string[] {
  const m = new RegExp(`INSERT INTO \\\`?${table}\\\`?\\s*\\(([^)]+)\\)`, 'i').exec(sql);
  if (!m) return [];
  return m[1].split(',').map(s => s.trim().replace(/`/g, ''));
}

function rowsAsObjects(sql: string, table: string): Record<string, string>[] {
  const cols = getCols(sql, table);
  if (!cols.length) return [];
  const out: Record<string, string>[] = [];
  for (const row of iterRows(sql, table)) {
    const obj: Record<string, string> = {};
    cols.forEach((c, idx) => obj[c] = row[idx] ?? '');
    out.push(obj);
  }
  return out;
}

async function readDumpFromUpload(bytes: Uint8Array, name: string): Promise<string> {
  const lower = name.toLowerCase();
  if (lower.endsWith('.zip')) {
    const files = unzipSync(bytes);
    const sqlEntry = Object.entries(files).find(([n]) => n.toLowerCase().endsWith('.sql'));
    if (!sqlEntry) throw new Error('ZIP não contém arquivo .sql');
    return new TextDecoder('utf-8').decode(sqlEntry[1] as Uint8Array);
  }
  if (lower.endsWith('.gz') || lower.endsWith('.sql.gz')) {
    const ds = new DecompressionStream('gzip');
    const decompressed = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    return await decompressed.text();
  }
  return new TextDecoder('utf-8').decode(bytes);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No auth');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userData.user?.email !== 'davillys@gmail.com') {
      return new Response(JSON.stringify({ error: 'Apenas Master Admin' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { storagePath } = await req.json();
    if (!storagePath) throw new Error('storagePath obrigatório');

    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(storagePath);
    if (dlErr || !blob) throw new Error(`Falha ao baixar dump: ${dlErr?.message}`);
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const sql = await readDumpFromUpload(bytes, storagePath);

    const customersRaw = rowsAsObjects(sql, 'tblwebmarcas_customers');
    const contactsRaw = rowsAsObjects(sql, 'tblcontacts');
    const clientsRaw = rowsAsObjects(sql, 'tblclients');
    const contractsRaw = rowsAsObjects(sql, 'tblcontracts');
    const filesRaw = rowsAsObjects(sql, 'tblfiles');

    const seen = new Map<string, any>();
    const upsert = (rec: any) => {
      const key = (rec.email || digits(rec.cpf) || digits(rec.cnpj) || '').toLowerCase();
      if (!key) return;
      if (!seen.has(key)) seen.set(key, rec);
      else Object.assign(seen.get(key), Object.fromEntries(Object.entries(rec).filter(([_,v]) => v)));
    };

    for (const c of contactsRaw) {
      const cli = clientsRaw.find(x => x.userid === c.userid);
      upsert({
        perfex_id: c.id,
        client_id: c.userid,
        email: (c.email || '').toLowerCase(),
        full_name: `${c.firstname || ''} ${c.lastname || ''}`.trim(),
        phone: c.phonenumber || cli?.phonenumber || '',
        cpf: digits(cli?.vat?.length === 11 ? cli.vat : ''),
        cnpj: digits(cli?.vat?.length === 14 ? cli.vat : ''),
        address: cli?.address || '',
        city: cli?.city || '',
        state: cli?.state || '',
        zip_code: cli?.zip || '',
        brand_name: cli?.company || '',
      });
    }
    for (const c of customersRaw) {
      upsert({
        perfex_id: c.id,
        email: (c.email || '').toLowerCase(),
        full_name: c.name || '',
        phone: c.phone || '',
        cpf: c.cpf ? digits(c.cpf) : '',
        cnpj: c.cnpj ? digits(c.cnpj) : '',
        brand_name: c.brand || c.marca || '',
      });
    }

    const customers = Array.from(seen.values()).filter(r => r.email || r.cpf || r.cnpj);
    const contracts = contractsRaw.filter(c => c.signed === '1');
    const files = filesRaw.filter(f => f.rel_type === 'customer' || f.rel_type === 'contract');

    const mapping: Record<string, string> = {};
    for (const c of customers) if (c.client_id) mapping[c.client_id] = c.email;

    const enc = new TextEncoder();
    const toGz = (lines: string[]) => gzipSync(enc.encode(lines.join('\n')));

    const uploads = [
      { path: 'generated/customers.ndjson.gz', body: toGz(customers.map(c => JSON.stringify(c))) },
      { path: 'generated/contracts.ndjson.gz', body: toGz(contracts.map(c => JSON.stringify(c))) },
      { path: 'generated/files.ndjson.gz',     body: toGz(files.map(c => JSON.stringify(c))) },
      { path: 'generated/mapping.json',        body: enc.encode(JSON.stringify(mapping)) },
    ];

    for (const u of uploads) {
      const { error } = await supabase.storage.from(BUCKET).upload(u.path, u.body, {
        contentType: u.path.endsWith('.json') ? 'application/json' : 'application/gzip',
        upsert: true,
      });
      if (error) throw new Error(`Upload ${u.path}: ${error.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      stats: { customers: customers.length, contracts: contracts.length, files: files.length },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});