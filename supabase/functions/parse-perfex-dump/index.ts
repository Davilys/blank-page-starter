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

function findTableInsertStart(sql: string, table: string, fromIdx: number): { headerEnd: number; cols: string[]; nextSearchFrom: number } | null {
  const marker = `INSERT INTO \`${table}\``;
  const at = sql.indexOf(marker, fromIdx);
  if (at < 0) return null;
  const openParen = sql.indexOf('(', at);
  const closeParen = sql.indexOf(')', openParen);
  const cols = sql.substring(openParen + 1, closeParen).split(',').map(s => s.trim().replace(/`/g, ''));
  const valuesIdx = sql.indexOf('VALUES', closeParen);
  if (valuesIdx < 0) return null;
  let i = valuesIdx + 'VALUES'.length;
  while (i < sql.length && /\s/.test(sql[i])) i++;
  return { headerEnd: i, cols, nextSearchFrom: at + marker.length };
}

function* iterTableRows(sql: string, table: string): Generator<{ cols: string[]; row: string[] }> {
  let cursor = 0;
  while (true) {
    const found = findTableInsertStart(sql, table, cursor);
    if (!found) return;
    let i = found.headerEnd;
    const cols = found.cols;
    while (i < sql.length) {
      while (i < sql.length && /\s/.test(sql[i])) i++;
      if (sql[i] !== '(') break;
      i++;
      const row: string[] = [];
      let cur = '';
      let inStr = false;
      let touched = false;
      while (i < sql.length) {
        const ch = sql[i];
        if (inStr) {
          if (ch === '\\' && i + 1 < sql.length) { cur += sql[i + 1]; i += 2; continue; }
          if (ch === "'" && sql[i + 1] === "'") { cur += "'"; i += 2; continue; }
          if (ch === "'") { inStr = false; i++; continue; }
          cur += ch; i++; continue;
        }
        if (ch === "'") { inStr = true; touched = true; i++; continue; }
        if (ch === ',') {
          row.push(!touched && cur.trim() === 'NULL' ? '' : cur.trim());
          cur = ''; touched = false; i++; continue;
        }
        if (ch === ')') {
          row.push(!touched && cur.trim() === 'NULL' ? '' : cur.trim());
          i++; break;
        }
        cur += ch; i++;
      }
      yield { cols, row };
      while (i < sql.length && /\s/.test(sql[i])) i++;
      if (sql[i] === ',') { i++; continue; }
      break;
    }
    cursor = i;
  }
}

function rowToObj(cols: string[], row: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (let i = 0; i < cols.length; i++) o[cols[i]] = row[i] ?? '';
  return o;
}

async function readDumpToString(bytes: Uint8Array, name: string): Promise<string> {
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

async function uploadGz(supabase: any, path: string, lines: string[]) {
  const enc = new TextEncoder();
  const gz = gzipSync(enc.encode(lines.join('\n')));
  const { error } = await supabase.storage.from(BUCKET).upload(path, gz, {
    contentType: 'application/gzip', upsert: true,
  });
  if (error) throw new Error(`Upload ${path}: ${error.message}`);
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
    }

    console.log(`Dump bytes: ${bytes.length}`);
    let sql: string | null = await readDumpToString(bytes, nameForExt);
    // free original bytes
    // @ts-ignore
    bytes = null;
    console.log(`SQL chars: ${sql!.length}`);

    // ===== PASS 1: tblclients (small) — store minimal fields =====
    const clientByUserid = new Map<string, { company: string; vat: string; phonenumber: string; address: string; city: string; state: string; zip: string }>();
    let clientsCount = 0;
    for (const { cols, row } of iterTableRows(sql!, 'tblclients')) {
      const o = rowToObj(cols, row);
      clientsCount++;
      if (o.userid) {
        clientByUserid.set(o.userid, {
          company: o.company || '',
          vat: o.vat || '',
          phonenumber: o.phonenumber || '',
          address: o.address || o.billing_street || '',
          city: o.city || o.billing_city || '',
          state: o.state || o.billing_state || '',
          zip: o.zip || o.billing_zip || '',
        });
      }
    }
    console.log(`clients parsed=${clientsCount} mapped=${clientByUserid.size}`);

    // ===== PASS 2: tblcontacts — build primary map + emit customers NDJSON =====
    const primaryByUserid = new Map<string, { email: string; firstname: string; lastname: string }>();
    const seenEmails = new Set<string>();
    const mapping: Record<string, string> = {};
    const customerLines: string[] = [];
    let contactsCount = 0;
    for (const { cols, row } of iterTableRows(sql!, 'tblcontacts')) {
      const o = rowToObj(cols, row);
      contactsCount++;
      const email = (o.email || '').toLowerCase().trim();
      if (!o.userid || !email) continue;
      const ex = primaryByUserid.get(o.userid);
      if (!ex || o.is_primary === '1') {
        primaryByUserid.set(o.userid, { email, firstname: o.firstname || '', lastname: o.lastname || '' });
      }
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);
      const cli = clientByUserid.get(o.userid);
      const vat = digits(cli?.vat || '');
      const cust = {
        source: 'perfex',
        perfex_id: parseInt(o.id) || 0,
        perfex_client_id: parseInt(o.userid) || 0,
        email,
        full_name: `${o.firstname || ''} ${o.lastname || ''}`.trim() || cli?.company || email,
        phone: o.phonenumber || cli?.phonenumber || null,
        company_name: cli?.company || null,
        cpf: vat.length === 11 ? vat : null,
        cnpj: vat.length === 14 ? vat : null,
        cpf_cnpj: vat || null,
        address: cli?.address || null,
        neighborhood: null,
        city: cli?.city || null,
        state: cli?.state || null,
        zip_code: cli?.zip || null,
        brand_name: cli?.company || null,
        business_area: null,
      };
      customerLines.push(JSON.stringify(cust));
      if (cust.perfex_client_id) mapping[String(cust.perfex_client_id)] = email;
    }
    console.log(`contacts=${contactsCount} unique customers=${customerLines.length}`);

    await uploadGz(supabase, 'generated/customers.ndjson.gz', customerLines);
    {
      const enc = new TextEncoder();
      const { error } = await supabase.storage.from(BUCKET).upload(
        'generated/mapping.json', enc.encode(JSON.stringify(mapping)),
        { contentType: 'application/json', upsert: true },
      );
      if (error) throw new Error(`Upload mapping: ${error.message}`);
    }
    const customersTotal = customerLines.length;
    customerLines.length = 0;
    seenEmails.clear();
    clientByUserid.clear();

    // ===== PASS 3: tblcontracts =====
    const contractClientById = new Map<string, string>();
    const contractLines: string[] = [];
    let contractsTotal = 0, skippedUnsigned = 0, skippedNoClient = 0;
    for (const { cols, row } of iterTableRows(sql!, 'tblcontracts')) {
      const o = rowToObj(cols, row);
      contractsTotal++;
      if (o.id && o.client) contractClientById.set(o.id, o.client);
      const isSigned = o.signed === '1' || o.marked_as_signed === '1';
      if (!isSigned) { skippedUnsigned++; continue; }
      if (o.trash === '1') continue;
      const ct = primaryByUserid.get(o.client);
      const email = ct ? ct.email : '';
      if (!email) { skippedNoClient++; continue; }
      contractLines.push(JSON.stringify({
        perfex_id: parseInt(o.id) || 0,
        perfex_client_id: parseInt(o.client) || 0,
        client_email: email,
        subject: o.subject || `Contrato Perfex #${o.id}`,
        description: o.description || '',
        content_html: o.content || '',
        contract_value: o.contract_value ? parseFloat(o.contract_value) : null,
        start_date: toIso(o.datestart),
        end_date: toIso(o.dateend),
        signed: true,
        signed_at: toIso(o.acceptance_date) || toIso(o.dateadded),
        signature_ip: o.acceptance_ip || null,
        signatory_name: `${o.acceptance_firstname || ''} ${o.acceptance_lastname || ''}`.trim() || null,
        signatory_email: o.acceptance_email || email,
        date_added: toIso(o.dateadded),
        hash: o.hash || null,
      }));
    }
    console.log(`contracts total=${contractsTotal} kept=${contractLines.length} skipUnsigned=${skippedUnsigned} skipNoClient=${skippedNoClient}`);
    await uploadGz(supabase, 'generated/contracts.ndjson.gz', contractLines);
    const contractsKept = contractLines.length;
    contractLines.length = 0;

    // ===== PASS 4: tblfiles =====
    const fileLines: string[] = [];
    let filesTotal = 0;
    for (const { cols, row } of iterTableRows(sql!, 'tblfiles')) {
      const o = rowToObj(cols, row);
      filesTotal++;
      const relType = o.rel_type;
      if (relType !== 'customer' && relType !== 'contract') continue;
      let email = '';
      if (relType === 'customer') {
        const ct = primaryByUserid.get(o.rel_id);
        email = ct ? ct.email : '';
      } else {
        const userid = contractClientById.get(o.rel_id);
        if (userid) {
          const ct = primaryByUserid.get(userid);
          email = ct ? ct.email : '';
        }
      }
      fileLines.push(JSON.stringify({
        perfex_id: parseInt(o.id) || 0,
        rel_id: parseInt(o.rel_id) || 0,
        rel_type: relType,
        file_name: o.file_name,
        filetype: o.filetype || null,
        attachment_key: o.attachment_key || null,
        client_email: email || null,
        date_added: toIso(o.dateadded),
      }));
    }
    await uploadGz(supabase, 'generated/files.ndjson.gz', fileLines);
    const filesKept = fileLines.length;

    sql = null;

    return new Response(JSON.stringify({
      success: true,
      stats: { customers: customersTotal, contracts: contractsKept, files: filesKept },
      raw_counts: {
        contacts: contactsCount,
        clients: clientsCount,
        contracts_total: contractsTotal,
        contracts_skipped_unsigned: skippedUnsigned,
        contracts_skipped_no_client: skippedNoClient,
        files_total: filesTotal,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('parse-perfex-dump error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
