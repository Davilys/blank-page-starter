import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore
import { unzipSync, gzipSync } from 'https://esm.sh/fflate@0.8.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET = 'perfex-import';
const MASTER_EMAIL = 'davillys@gmail.com';
const DEFAULT_DUMP_URL = 'https://crm.webmarcas.net/u973561543_perfexcrm.sql';

function digits(s: string | null | undefined): string {
  return (s || '').replace(/\D+/g, '');
}

function* iterRows(sql: string, table: string): Generator<string[]> {
  const re = new RegExp(`INSERT INTO \\\`${table}\\\`\\s*\\(([^)]+)\\)\\s*VALUES\\s*`, 'gi');
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
          if (ch === '\\' && i + 1 < sql.length) { cur += sql[i + 1]; i += 2; continue; }
          if (ch === "'" && sql[i + 1] === "'") { cur += "'"; i += 2; continue; }
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
      break;
    }
  }
}

function getCols(sql: string, table: string): string[] {
  const m = new RegExp(`INSERT INTO \\\`${table}\\\`\\s*\\(([^)]+)\\)`, 'i').exec(sql);
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

async function readDump(bytes: Uint8Array, name: string): Promise<string> {
  const lower = name.toLowerCase();
  if (lower.endsWith('.zip')) {
    const files = unzipSync(bytes);
    const sqlEntry = Object.entries(files).find(([n]) => n.toLowerCase().endsWith('.sql'));
    if (!sqlEntry) throw new Error('ZIP não contém arquivo .sql');
    return new TextDecoder('utf-8').decode(sqlEntry[1] as Uint8Array);
  }
  if (lower.endsWith('.gz')) {
    const ds = new DecompressionStream('gzip');
    const decompressed = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    return await decompressed.text();
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function toIso(dt: string): string | null {
  if (!dt || dt === '0000-00-00' || dt === '0000-00-00 00:00:00') return null;
  const t = dt.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(t)) {
    return t.includes(' ') ? t.replace(' ', 'T') + 'Z' : t;
  }
  return t;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No auth');

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabaseAuth.auth.getUser();
    if (userData.user?.email !== MASTER_EMAIL) {
      return new Response(JSON.stringify({ error: 'Apenas Master Admin' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({} as any));
    const { storagePath, sourceUrl } = body;

    let bytes: Uint8Array;
    let nameForExt: string;

    if (storagePath) {
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(storagePath);
      if (dlErr || !blob) throw new Error(`Falha ao baixar dump do Storage: ${dlErr?.message}`);
      bytes = new Uint8Array(await blob.arrayBuffer());
      nameForExt = storagePath;
    } else {
      const url = sourceUrl || DEFAULT_DUMP_URL;
      console.log(`Baixando dump direto de ${url}`);
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${r.status}`);
      bytes = new Uint8Array(await r.arrayBuffer());
      nameForExt = url;
      // persist raw for reference
      await supabase.storage.from(BUCKET).upload(
        `uploads/latest-perfex-${Date.now()}.sql`, bytes,
        { contentType: 'application/sql', upsert: true },
      ).catch((e) => console.warn('persist raw failed:', e));
    }

    console.log(`Dump bytes: ${bytes.length}`);
    const sql = await readDump(bytes, nameForExt);
    console.log(`SQL chars: ${sql.length}`);

    const contactsRaw = rowsAsObjects(sql, 'tblcontacts');
    const clientsRaw = rowsAsObjects(sql, 'tblclients');
    const contractsRaw = rowsAsObjects(sql, 'tblcontracts');
    const filesRaw = rowsAsObjects(sql, 'tblfiles');

    console.log(`raw counts: contacts=${contactsRaw.length} clients=${clientsRaw.length} contracts=${contractsRaw.length} files=${filesRaw.length}`);

    const clientByUserid = new Map<string, Record<string, string>>();
    for (const c of clientsRaw) if (c.userid) clientByUserid.set(c.userid, c);

    const primaryContactByUserid = new Map<string, Record<string, string>>();
    for (const ct of contactsRaw) {
      if (!ct.userid || !ct.email) continue;
      const existing = primaryContactByUserid.get(ct.userid);
      if (!existing || ct.is_primary === '1') primaryContactByUserid.set(ct.userid, ct);
    }

    const customers: any[] = [];
    const seenEmails = new Set<string>();
    for (const ct of contactsRaw) {
      const email = (ct.email || '').toLowerCase().trim();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      const cli = clientByUserid.get(ct.userid) || {};
      const vat = digits(cli.vat || '');
      customers.push({
        source: 'perfex',
        perfex_id: parseInt(ct.id) || 0,
        perfex_client_id: parseInt(ct.userid) || 0,
        email,
        full_name: `${ct.firstname || ''} ${ct.lastname || ''}`.trim() || cli.company || email,
        phone: ct.phonenumber || cli.phonenumber || null,
        company_name: cli.company || null,
        cpf: vat.length === 11 ? vat : null,
        cnpj: vat.length === 14 ? vat : null,
        cpf_cnpj: vat || null,
        address: cli.address || cli.billing_street || null,
        neighborhood: null,
        city: cli.city || cli.billing_city || null,
        state: cli.state || cli.billing_state || null,
        zip_code: cli.zip || cli.billing_zip || null,
        brand_name: cli.company || null,
        business_area: null,
      });
    }

    const contracts: any[] = [];
    let contractsSkippedNoClient = 0;
    let contractsSkippedUnsigned = 0;
    for (const co of contractsRaw) {
      const isSigned = co.signed === '1' || co.marked_as_signed === '1';
      if (!isSigned) { contractsSkippedUnsigned++; continue; }
      if (co.trash === '1') continue;
      const userid = co.client;
      const ct = primaryContactByUserid.get(userid);
      const email = ct ? (ct.email || '').toLowerCase().trim() : '';
      if (!email) { contractsSkippedNoClient++; continue; }

      contracts.push({
        perfex_id: parseInt(co.id) || 0,
        perfex_client_id: parseInt(userid) || 0,
        client_email: email,
        subject: co.subject || `Contrato Perfex #${co.id}`,
        description: co.description || '',
        content_html: co.content || '',
        contract_value: co.contract_value ? parseFloat(co.contract_value) : null,
        start_date: toIso(co.datestart),
        end_date: toIso(co.dateend),
        signed: true,
        signed_at: toIso(co.acceptance_date) || toIso(co.dateadded),
        signature_ip: co.acceptance_ip || null,
        signatory_name: `${co.acceptance_firstname || ''} ${co.acceptance_lastname || ''}`.trim() || null,
        signatory_email: co.acceptance_email || email,
        date_added: toIso(co.dateadded),
        hash: co.hash || null,
      });
    }

    const contractById = new Map<string, Record<string, string>>();
    for (const co of contractsRaw) if (co.id) contractById.set(co.id, co);

    const files: any[] = [];
    for (const f of filesRaw) {
      const relType = f.rel_type;
      if (relType !== 'customer' && relType !== 'contract') continue;
      let email = '';
      if (relType === 'customer') {
        const ct = primaryContactByUserid.get(f.rel_id);
        email = ct ? (ct.email || '').toLowerCase().trim() : '';
      } else {
        const co = contractById.get(f.rel_id);
        if (co) {
          const ct = primaryContactByUserid.get(co.client);
          email = ct ? (ct.email || '').toLowerCase().trim() : '';
        }
      }
      files.push({
        perfex_id: parseInt(f.id) || 0,
        rel_id: parseInt(f.rel_id) || 0,
        rel_type: relType,
        file_name: f.file_name,
        filetype: f.filetype || null,
        attachment_key: f.attachment_key || null,
        client_email: email || null,
        date_added: toIso(f.dateadded),
      });
    }

    const mapping: Record<string, string> = {};
    for (const c of customers) if (c.perfex_client_id) mapping[String(c.perfex_client_id)] = c.email;

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
      stats: {
        customers: customers.length,
        contracts: contracts.length,
        files: files.length,
      },
      raw_counts: {
        contacts: contactsRaw.length,
        clients: clientsRaw.length,
        contracts_total: contractsRaw.length,
        contracts_skipped_unsigned: contractsSkippedUnsigned,
        contracts_skipped_no_client: contractsSkippedNoClient,
        files_total: filesRaw.length,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('parse-perfex-dump error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
