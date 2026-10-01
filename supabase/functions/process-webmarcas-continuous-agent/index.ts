//// stevo-fernanda-webhook — Fernanda (WebMarcas) ligada direto na instância Stevo.
// Ingress: Stevo instance webhook -> esta função -> estado no Supabase webmarcas ->
// resposta via Stevo API -> espelho no Inbox do Zenda (bswvuibclqpcauumvmgf).
// Auth: ?token= (FERNANDA_WEBHOOK_SECRET). Dry-run: header x-fernanda-dry-run:1.
// Admin (x-cron-secret): action=get_webhook|register_webhook|restore_webhook.


const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const digitsOf = (v: string | null | undefined) => (v || '').replace(/\D/g, '');
const NAME_JUNK = /^(y|im|n[aã]o|sim|oi|ol[aá]|ok|okay|teste|test|eu|vc|voc[eê]|null|undefined|a|o|e|é)$/i;
const firstName = (full: string | undefined | null) => {
  const f = str(full).split(/\s+/)[0].replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '') || '';
  const letters = (f.match(/[a-zA-ZÀ-ú]/g) || []).length;
  if (!f || f.length < 2 || letters < 2 || NAME_JUNK.test(f)) return '';
  return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
};

// ── env ──────────────────────────────────────────────────────────────────────
const E = {
  url: Deno.env.get('SUPABASE_URL') || '',
  key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  hookSecret: Deno.env.get('FERNANDA_WEBHOOK_SECRET') || '',
  cronSecret: Deno.env.get('FERNANDA_CRON_SECRET') || '',
  stevoKey: Deno.env.get('STEVO_API_KEY') || '',
  stevoInstance: Deno.env.get('STEVO_INSTANCE_ID') || '',
  stevoBase: (Deno.env.get('STEVO_BASE_URL') || 'https://openapi.stevo.chat').replace(/\/+$/, ''),
  zendaUrl: (Deno.env.get('ZENDA_SUPABASE_URL') || '').replace(/\/+$/, ''),
  zendaKey: Deno.env.get('ZENDA_SERVICE_ROLE_KEY') || '',
  zendaCompany: Deno.env.get('ZENDA_COMPANY_ID') || '',
  zendaChannel: Deno.env.get('ZENDA_CHANNEL_ID') || '',
  inpiBase: (Deno.env.get('INPI_API_BASE_URL') || '').replace(/\/+$/, ''),
  inpiKey: Deno.env.get('INPI_API_KEY') || '',
  phase2Live: (Deno.env.get('FERNANDA_PHASE2_LIVE') || '') === '1',
  contractSecret: Deno.env.get('BOTCONVERSA_CONTRACT_WEBHOOK_SECRET') || '',
  llmEnabled: Deno.env.get('FERNANDA_LLM_ENABLED') === '1',
  llmBaseUrl: (Deno.env.get('FERNANDA_LLM_BASE_URL') || 'https://api.openai.com/v1').replace(/\/+$/, ''),
  llmKey: Deno.env.get('FERNANDA_LLM_API_KEY') || Deno.env.get('OPENAI_API_KEY') || '',
  llmModel: Deno.env.get('FERNANDA_LLM_MODEL') || 'gpt-4o-mini',
};

const EXCLUDED_PHONES = new Set(['16508702892', '5511911120225']);
const AI_IDENTITY_RE = /(voc[eê]|vc|tu)\s+(?:é|eh|seria).{0,25}(rob[oô]|ia|intelig[eê]ncia|m[aá]quina|bot|humano|pessoa|atendente)|(é|eh)\s+(um|uma)?\s*(rob[oô]|bot|ia)|quem\s+(é|eh)\s+voc[eê]|tô falando com (rob[oô]|m[aá]quina|bot)/i;
const QUESTION_RE = /\?\s*$|^(o que|como|quando|onde|qual|quais|quanto|por\s?que|ser[aá]|seria|d[aá] pra|vocês fazem|vcs fazem)\b/i;
const THANKS_RE = /(obrigad[oa]|valeu|show de bola|maravilha|amei|muito bom|perfeito|top demais)/i;
const REACTION_LOVE = ['❤️', '🙏', '😊'];
const AUDIO_1 = 'https://prod-media-bc.s3.amazonaws.com/media/9093/9271853/184133670/FERNANDA-INICIAL-3-GABI_1.mp3';
const AUDIO_2 = 'https://prod-media-bc.s3.amazonaws.com/media/9093/9271853/184133670/FERNANDA_2025_INICIAL_2.mp3';

// ── telefone (port de zenda src/lib/identity/phone.ts) ───────────────────────
function toE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const hadPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (hadPlus) {
    if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null;
    return '+' + digits;
  }
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const ddd = Number(digits.slice(2, 4));
    if (ddd >= 11 && ddd <= 99) return '+' + digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    const ddd = Number(digits.slice(0, 2));
    if (ddd >= 11 && ddd <= 99) return '+55' + digits;
  }
  if (digits.length >= 11 && digits.length <= 15 && !digits.startsWith('0')) return '+' + digits;
  return null;
}
function brVariants(input: string | null | undefined): string[] {
  const canon = toE164(input);
  if (!canon) return input ? [String(input).trim()] : [];
  const set = new Set<string>([canon]);
  const m = canon.match(/^\+55(\d{2})(\d{8,9})$/);
  if (m) {
    if (m[2].length === 8) set.add(`+55${m[1]}9${m[2]}`);
    else if (m[2].length === 9 && m[2].startsWith('9')) set.add(`+55${m[1]}${m[2].slice(1)}`);
  }
  return [...set];
}

// ── parser Stevo (port de zenda stevo-inbound.server.ts, só inbound) ─────────
type InboundMsg = {
  provider_message_id: string; from_phone: string; contact_name: string | null;
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'reaction';
  body: string | null; media_url: string | null;
  media_metadata: Record<string, unknown> | null; from_me: boolean; is_group: boolean;
};
const asRec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? v as Record<string, unknown> : {});
const s1 = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
// chave de idempotência segura p/ header HTTP: remove acentos e qualquer byte fora de ASCII visível
// (texto BR com ã/ç/é quebrava a construção do fetch com ByteString inválido - incidente 23/set)
const idemKey = (...parts: Array<string | null | undefined>): string =>
  parts.map(p => (p ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '')
    .replace(/[^a-zA-Z0-9:_-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, ''))
    .join(':').slice(0, 180);
function jidToPhone(jid: string | null): string | null {
  if (!jid) return null;
  const d = (jid.split('@')[0]?.split(':')[0] ?? '').replace(/[^0-9]/g, '');
  return d || null;
}
function readContent(message: Record<string, unknown>) {
  const reactionNode = message.reactionMessage ?? message.ReactionMessage;
  if (reactionNode) {
    const r = asRec(reactionNode); const k = asRec(r.key ?? r.Key);
    const target = s1(k.id) ?? s1(r.messageId) ?? s1(r.targetMessageId);
    if (target) return { type: 'reaction' as const, body: s1(r.text) ?? s1(r.emoji) ?? '', media_url: null, media_metadata: { reaction_target_provider_id: target } };
  }
  const text = s1(message.conversation) ?? s1(asRec(message.extendedTextMessage).text) ?? s1(message.Conversation) ??
    s1(asRec(message.ExtendedTextMessage).text) ?? s1(message.text) ?? s1(message.body);
  if (text) return { type: 'text' as const, body: text, media_url: null, media_metadata: null };
  const kinds: Array<[string, InboundMsg['type']]> = [
    ['imageMessage', 'image'], ['ImageMessage', 'image'], ['audioMessage', 'audio'], ['AudioMessage', 'audio'],
    ['videoMessage', 'video'], ['VideoMessage', 'video'], ['documentMessage', 'file'], ['DocumentMessage', 'file'], ['stickerMessage', 'image'],
  ];
  for (const [key, type] of kinds) {
    const node = message[key];
    if (node) {
      const n = asRec(node);
      return {
        type, body: s1(n.caption) ?? s1(n.Caption),
        media_url: s1(n.url) ?? s1(n.URL) ?? s1(n.mediaUrl) ?? s1(n.directPath),
        media_metadata: {
          mimetype: s1(n.mimetype) ?? s1(n.Mimetype), filename: s1(n.fileName) ?? s1(n.FileName),
          mediaKey: s1(n.mediaKey) ?? s1(n.MediaKey), directPath: s1(n.directPath) ?? s1(n.DirectPath),
          is_voice: n.ptt === true || n.PTT === true, seconds: typeof n.seconds === 'number' ? n.seconds : null,
        },
      };
    }
  }
  return { type: 'text' as const, body: null, media_url: null, media_metadata: null };
}
function normalizeStevo(payload: unknown): InboundMsg[] {
  const root = asRec(payload);
  const candidates: unknown[] = [root.data, root.event, root.payload, root.messages,
    asRec(root.data).messages, asRec(root.event).messages, asRec(root.payload).messages];
  const items: Record<string, unknown>[] = [];
  const seen = new Set<Record<string, unknown>>();
  for (const c of candidates) {
    if (Array.isArray(c)) for (const it of c) { const r = asRec(it); if (Object.keys(r).length && !seen.has(r)) { seen.add(r); items.push(r); } }
    else if (c && typeof c === 'object' && Object.keys(asRec(c)).length && !seen.has(asRec(c))) { const r = asRec(c); seen.add(r); items.push(r); }
  }
  if (!items.length) items.push(root);
  const out: InboundMsg[] = [];
  for (const event of items) {
    const info = asRec(event.Info ?? event.info);
    const key = asRec(event.key ?? event.Key);
    const message = asRec(event.Message ?? event.message);
    const fromMe = info.IsFromMe === true || key.fromMe === true || event.fromMe === true || root.fromMe === true;
    const chatJid = s1(info.Chat) ?? s1(info.Sender) ?? s1(key.remoteJid) ?? s1(event.remoteJid) ?? s1(event.from) ?? s1(event.chatJid) ?? s1(root.remoteJid) ?? s1(root.from) ?? s1(root.chatJid);
    const senderJid = s1(info.Sender) ?? s1(key.participant) ?? s1(event.sender) ?? s1(root.sender) ?? chatJid;
    const pid = s1(info.ID) ?? s1(info.Id) ?? s1(key.id) ?? s1(event.id) ?? s1(event.messageId) ?? s1(root.id);
    let content = readContent(message);
    if (!content.body && !content.media_url && content.type !== 'reaction') {
      const fb = s1(event.body) ?? s1(event.text) ?? s1(event.content) ?? s1(root.body) ?? s1(root.text) ?? s1(root.content);
      const fm = s1(event.media_url) ?? s1(event.mediaUrl) ?? s1(event.url) ?? s1(root.media_url) ?? s1(root.mediaUrl) ?? s1(root.url);
      const rt = (s1(event.type) ?? s1(event.messageType) ?? s1(root.type) ?? 'text').toLowerCase();
      const tp: InboundMsg['type'] = rt.includes('image') ? 'image' : rt.includes('audio') ? 'audio' : rt.includes('video') ? 'video' : (rt.includes('doc') || rt.includes('file')) ? 'file' : 'text';
      if (fb || fm) content = { type: tp, body: fb, media_url: fm, media_metadata: null };
    }
    const isGroup = !!chatJid && (chatJid.includes('@g.us') || chatJid.includes('@broadcast'));
    const hasMsg = Object.keys(message).length > 0 || !!content.body || !!content.media_url || content.type === 'reaction';
    if (!hasMsg || !pid || !chatJid || isGroup) continue;
    const phone = jidToPhone(fromMe ? chatJid : (senderJid ?? chatJid));
    if (!phone) continue;
    const pushName = s1(info.PushName) ?? s1(event.pushName) ?? s1(event.pushname) ?? s1(root.pushName) ?? s1(root.pushname);
    out.push({
      provider_message_id: pid, from_phone: phone, contact_name: fromMe ? null : pushName,
      type: content.type, body: content.body, media_url: content.media_url,
      media_metadata: content.media_metadata, from_me: fromMe, is_group: false,
    });
  }
  return out;
}

// ── mídia WhatsApp (port de zenda whatsapp-media.server.ts) ──────────────────
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(bin);
}
async function decryptWaMedia(url: string, mediaKeyB64: string, kind: 'audio' | 'image' | 'video' | 'file'): Promise<Uint8Array> {
  const info: Record<string, string> = { image: 'WhatsApp Image Keys', audio: 'WhatsApp Audio Keys', video: 'WhatsApp Video Keys', file: 'WhatsApp Document Keys' };
  const res = await fetch(url);
  if (!res.ok) throw new Error(`media_download_${res.status}`);
  const enc = new Uint8Array(await res.arrayBuffer());
  if (enc.byteLength <= 10) throw new Error('media_empty');
  const hkdfKey = await crypto.subtle.importKey('raw', b64ToBytes(mediaKeyB64) as BufferSource, 'HKDF', false, ['deriveBits']);
  const expanded = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode(info[kind]) }, hkdfKey, 112 * 8));
  const aesKey = await crypto.subtle.importKey('raw', expanded.slice(16, 48) as BufferSource, { name: 'AES-CBC' }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: expanded.slice(0, 16) as BufferSource }, aesKey, enc.slice(0, enc.byteLength - 10) as BufferSource);
  return new Uint8Array(plain);
}

// ── Stevo send ───────────────────────────────────────────────────────────────
type SendSpec =
  | { kind: 'text'; text: string }
  | { kind: 'audio'; url: string; mime?: string; ptt?: boolean }
  | { kind: 'document'; url: string; filename?: string; caption?: string };
async function stevoSend(phoneDigits: string, spec: SendSpec): Promise<{ ok: boolean; id?: string; error?: string; status?: number }> {
  const to = phoneDigits.replace(/[^0-9]/g, '');
  let body: Record<string, unknown>;
  if (spec.kind === 'text') body = { to, text: spec.text };
  else {
    const mediaType = spec.kind === 'audio' ? 'audio' : 'document';
    body = { to, media_url: spec.url, mediaUrl: spec.url, url: spec.url, media_type: mediaType, mediaType };
    if (spec.kind === 'audio') {
      if (spec.ptt !== false) { body.ptt = true; body.voice = true; }
      body.mimetype = spec.mime || 'audio/mpeg'; body.mimeType = spec.mime || 'audio/mpeg';
    } else {
      if (spec.caption) body.caption = spec.caption;
      body.filename = spec.filename || 'busca-viabilidade.pdf';
    }
  }
  const r = await fetch(`${E.stevoBase}/v1/instances/${encodeURIComponent(E.stevoInstance)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${E.stevoKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: str((j as Record<string, unknown>).message) || `stevo_${r.status}`, status: r.status };
  const data = asRec((j as Record<string, unknown>).data);
  const result = asRec(data.result ?? (j as Record<string, unknown>).result);
  const info = asRec(asRec(result.data).Info ?? result.Info ?? data.Info);
  const id = s1(info.ID) ?? s1(asRec(result.key).id) ?? s1(asRec(data.key).id) ?? s1(result.id) ?? s1(data.id) ?? undefined;
  return { ok: true, id };
}

let smCache: { url: string; token: string; at: number } | null = null;
async function smServer(): Promise<{ url: string; token: string } | null> {
  if (smCache && Date.now() - smCache.at < 30 * 60_000) return smCache;
  try {
    const r = await fetch(`${E.stevoBase}/v1/instances/${encodeURIComponent(E.stevoInstance)}`, { headers: { Authorization: `Bearer ${E.stevoKey}` } });
    const dj = await r.json().catch(() => null);
    const dd = asRec(asRec(dj).data ?? dj);
    const url = (s1(dd.server_url) || '').replace(/\/+$/, '');
    const token = s1(dd.token) || '';
    if (!url || !token) return null;
    smCache = { url, token, at: Date.now() };
    return smCache;
  } catch { return null; }
}
async function stevoReact(phoneDigits: string, messageId: string, emoji: string, fromMe = false): Promise<{ ok: boolean; status: number; body: string; variant?: string }> {
  // rota oficial do servidor SM v2 (doc: POST /message/react {id, number, reaction, fromMe})
  const sm = await smServer();
  if (sm) {
    try {
      const r = await fetch(`${sm.url}/message/react`, {
        method: 'POST', headers: { apikey: sm.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: messageId, number: phoneDigits, reaction: emoji, fromMe }),
      });
      const body = (await r.text()).slice(0, 300);
      if (r.ok) return { ok: true, status: r.status, body, variant: 'sm/message/react' };
      console.error('stevo_react_failed', 'sm/message/react', r.status, body);
    } catch (e) { console.error('stevo_react_failed', 'sm/message/react', e instanceof Error ? e.message : e); }
  }
  const variants: Array<[string, Record<string, unknown>]> = [
    ['reaction.messageId', { to: phoneDigits, reaction: { messageId, emoji } }],
    ['typed', { to: phoneDigits, type: 'reaction', reaction: { messageId, emoji } }],
    ['cloud_api', { to: phoneDigits, cloud_api: { messaging_product: 'whatsapp', recipient_type: 'individual', to: phoneDigits, type: 'reaction', reaction: { message_id: messageId, emoji } } }],
    ['reaction.message_id', { to: phoneDigits, reaction: { message_id: messageId, emoji } }],
  ];
  let last = { ok: false, status: 0, body: '', variant: '' };
  for (const [name, payload] of variants) {
    try {
      const r = await fetch(`${E.stevoBase}/v1/instances/${encodeURIComponent(E.stevoInstance)}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${E.stevoKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await r.text()).slice(0, 300);
      last = { ok: r.ok, status: r.status, body, variant: name };
      if (r.ok) return last;
      console.error('stevo_react_failed', name, r.status, body);
      if (r.status !== 400) return last; // 400 = formato errado: tenta a próxima variante
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error('stevo_react_failed', name, m);
      last = { ok: false, status: 0, body: m, variant: name };
    }
  }
  return last;
}

// ── PostgREST mínimo (sem dependências externas) ────────────────────────────
type Pg = { base: string; key: string };
const pgH = (c: Pg) => ({ apikey: c.key, Authorization: `Bearer ${c.key}`, 'Content-Type': 'application/json' });
async function pgSelect(c: Pg, table: string, query: string): Promise<Record<string, unknown>[]> {
  const r = await fetch(`${c.base}/rest/v1/${table}?${query}`, { headers: pgH(c) });
  if (!r.ok) throw new Error(`pg_select_${table}_${r.status}:${(await r.text()).slice(0, 200)}`);
  return await r.json();
}
async function pgOne(c: Pg, table: string, query: string): Promise<Record<string, unknown> | null> {
  const rows = await pgSelect(c, table, query + '&limit=1');
  return rows[0] ?? null;
}
async function pgInsert(c: Pg, table: string, row: Record<string, unknown>, upsert = false): Promise<{ data?: Record<string, unknown>; error?: string }> {
  const r = await fetch(`${c.base}/rest/v1/${table}`, {
    method: 'POST', headers: { ...pgH(c), Prefer: upsert ? 'resolution=merge-duplicates,return=representation' : 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!r.ok) return { error: (await r.text()).slice(0, 300) };
  const j = await r.json().catch(() => null);
  return { data: Array.isArray(j) ? j[0] : j };
}
async function pgUpdate(c: Pg, table: string, query: string, patch: Record<string, unknown>): Promise<{ error?: string }> {
  const r = await fetch(`${c.base}/rest/v1/${table}?${query}`, { method: 'PATCH', headers: pgH(c), body: JSON.stringify(patch) });
  return r.ok ? {} : { error: (await r.text()).slice(0, 300) };
}
async function pgClaimInbox(c: Pg, conversationId: string): Promise<Array<{ id: string; event_id: string; message: string; message_type: string }>> {
  const { data, error } = await pgRpc(c, 'claim_webmarcas_agent_conversation_events', { p_conversation_id: conversationId });
  if (error || !Array.isArray(data)) return [];
  return (data as Array<Record<string, unknown>>)
    .map(r => ({ id: str(r.id) || '', event_id: str(r.event_id) || '', message: str(r.message) || '', message_type: str(r.message_type) || 'text' }))
    .filter(r => r.id);
}
async function pgRpc(c: Pg, fn: string, args: Record<string, unknown>): Promise<{ data?: unknown; error?: string }> {
  const r = await fetch(`${c.base}/rest/v1/rpc/${fn}`, { method: 'POST', headers: pgH(c), body: JSON.stringify(args) });
  if (!r.ok) return { error: (await r.text()).slice(0, 300) };
  return { data: await r.json().catch(() => null) };
}
const qe = (v: string) => encodeURIComponent(v);
const qIn = (vals: string[]) => `in.(${vals.map(v => qe(v)).join(',')})`;

// ── Zenda mirror ─────────────────────────────────────────────────────────────
function zd(): Pg { return { base: E.zendaUrl, key: E.zendaKey }; }
async function zFindContact(rawPhone: string, name: string | null) {
  const z = zd();
  const canon = toE164(rawPhone);
  const variants = brVariants(rawPhone);
  if (variants.length) {
    const data = await pgOne(z, 'contacts', `select=id,name&company_id=eq.${E.zendaCompany}&phone_canonical=${qIn(variants)}&deleted_at=is.null&merged_into_id=is.null&order=created_at.asc`);
    if (data) {
      if (name && (!data.name || String(data.name).startsWith('+'))) await pgUpdate(z, 'contacts', `id=eq.${data.id}`, { name });
      return { contactId: data.id as string, isNew: false };
    }
  }
  const rawVariants = [rawPhone, rawPhone.startsWith('+') ? rawPhone.slice(1) : `+${rawPhone}`, ...variants];
  const byRaw = await pgOne(z, 'contacts', `select=id,name,phone_canonical&company_id=eq.${E.zendaCompany}&phone=${qIn(rawVariants)}&deleted_at=is.null&merged_into_id=is.null&order=created_at.asc`);
  if (byRaw) {
    const patch: Record<string, unknown> = {};
    if (!byRaw.phone_canonical && canon) patch.phone_canonical = canon;
    if (name && (!byRaw.name || String(byRaw.name).startsWith('+'))) patch.name = name;
    if (Object.keys(patch).length) await pgUpdate(z, 'contacts', `id=eq.${byRaw.id}`, patch);
    return { contactId: byRaw.id as string, isNew: false };
  }
  const created = await pgInsert(z, 'contacts', { company_id: E.zendaCompany, phone: rawPhone, phone_canonical: canon, name: name ?? rawPhone });
  if (!created.error && created.data) return { contactId: created.data.id as string, isNew: true };
  if (canon) {
    const raced = await pgOne(z, 'contacts', `select=id&company_id=eq.${E.zendaCompany}&phone_canonical=eq.${qe(canon)}&deleted_at=is.null&merged_into_id=is.null`);
    if (raced) return { contactId: raced.id as string, isNew: false };
  }
  throw new Error(`zenda_contact_failed:${created.error ?? 'unknown'}`);
}
async function zFindConversation(contactId: string) {
  const z = zd();
  const selQ = `select=id,bot_paused_until,unread_count&company_id=eq.${E.zendaCompany}&contact_id=eq.${contactId}&status=${qIn(['open', 'pending'])}&merged_into_id=is.null&deleted_at=is.null&order=last_message_at.desc.nullslast`;
  const open = await pgOne(z, 'conversations', selQ);
  if (open) return { conversationId: open.id as string, pausedUntil: (open.bot_paused_until as string | null) ?? null, unread: (open.unread_count as number) ?? 0, isNew: false };
  const created = await pgInsert(z, 'conversations', { company_id: E.zendaCompany, channel_id: E.zendaChannel, contact_id: contactId, status: 'open', unread_count: 0, assigned_type: 'unassigned', assigned_agent_id: null });
  if (!created.error && created.data) return { conversationId: created.data.id as string, pausedUntil: null, unread: 0, isNew: true };
  const raced = await pgOne(z, 'conversations', selQ);
  if (raced) return { conversationId: raced.id as string, pausedUntil: (raced.bot_paused_until as string | null) ?? null, unread: (raced.unread_count as number) ?? 0, isNew: false };
  throw new Error(`zenda_conversation_failed:${created.error ?? 'unknown'}`);
}
async function zInsertMessage(args: {
  conversationId: string; direction: 'inbound' | 'outbound'; type: string; body: string | null;
  mediaUrl?: string | null; mediaMeta?: Record<string, unknown> | null; providerId: string; status?: string;
}) {
  const z = zd();
  const existing = await pgOne(z, 'messages', `select=id&conversation_id=eq.${args.conversationId}&provider_message_id=eq.${qe(args.providerId)}`);
  if (existing) return { messageId: existing.id as string, duplicate: true };
  const ins = await pgInsert(z, 'messages', {
    company_id: E.zendaCompany, conversation_id: args.conversationId, channel_id: E.zendaChannel,
    direction: args.direction, type: args.type, body: args.body,
    media_url: args.mediaUrl ?? null, media_metadata: args.mediaMeta ?? null,
    provider_message_id: args.providerId, status: args.status ?? 'delivered',
  });
  if (ins.error) return { messageId: null, duplicate: false, error: ins.error };
  return { messageId: ins.data?.id as string, duplicate: false };
}
async function zTouchConversation(conversationId: string, preview: string, incrementUnread: boolean, currentUnread: number) {
  await pgUpdate(zd(), 'conversations', `id=eq.${conversationId}`, {
    last_message_at: new Date().toISOString(), last_message_preview: preview.slice(0, 120),
    unread_count: incrementUnread ? currentUnread + 1 : currentUnread,
  });
}
async function zTouchContact(contactId: string) {
  await pgUpdate(zd(), 'contacts', `id=eq.${contactId}`, { last_inbound_channel_id: E.zendaChannel, last_interaction_at: new Date().toISOString() });
}
async function zHasJaECliente(rawPhone: string): Promise<boolean> {
  // tag "Já é cliente" (Web Conversa/crmzenda PR #7): contato marcado não recebe follow-up; tirar a tag reabilita
  try {
    const z = zd();
    const variants = [toE164(rawPhone), ...brVariants(rawPhone)];
    const c = await pgOne(z, 'contacts', `select=id&company_id=eq.${E.zendaCompany}&phone_canonical=${qIn(variants)}&deleted_at=is.null&merged_into_id=is.null&limit=1`);
    if (!c) return false;
    const links = await pgSelect(z, 'contact_tags', `select=tag_id&contact_id=eq.${qe(str(c.id))}&limit=50`);
    const ids = ((links as Record<string, unknown>[] | null) ?? []).map((r) => str(r.tag_id)).filter(Boolean);
    if (!ids.length) return false;
    const tags = await pgSelect(z, 'tags', `select=name&id=in.(${ids.join(',')})&limit=50`);
    return ((tags as Record<string, unknown>[] | null) ?? []).some((t) => str(t.name).trim().toLowerCase() === 'já é cliente');
  } catch (e) {
    console.error('ja_e_cliente_check_failed', e instanceof Error ? e.message : e);
    return false;
  }
}
async function zIsPaused(conversationId: string): Promise<boolean> {
  const data = await pgOne(zd(), 'conversations', `select=bot_paused_until&id=eq.${conversationId}`);
  return !!data?.bot_paused_until && new Date(data.bot_paused_until as string).getTime() > Date.now();
}

// ── validação / extração determinística ──────────────────────────────────────
function isValidCpf(value: string): boolean {
  const cpf = digitsOf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const check = (base: string, factor: number) => {
    const sum = base.split('').reduce((t, d, i) => t + Number(d) * (factor - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(cpf.slice(0, 9), 10) === Number(cpf[9]) && check(cpf.slice(0, 10), 11) === Number(cpf[10]);
}
function isValidCnpj(value: string): boolean {
  const cnpj = digitsOf(value);
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const check = (base: string, w: number[]) => {
    const sum = base.split('').reduce((t, d, i) => t + Number(d) * w[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return check(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[12]) &&
    check(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[13]);
}
function parsePayment(text: string): 'avista' | 'cartao6x' | 'boleto3x' | null {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/\bpix\b|a vista/.test(t)) return 'avista';
  if (/cartao|credito|\b6x\b/.test(t)) return 'cartao6x';
  if (/boleto|\b3x\b/.test(t)) return 'boleto3x';
  return null;
}
type Memory = {
  fullName?: string; brandName?: string; businessArea?: string; email?: string;
  cpf?: string; cep?: string; addressNumber?: string; cnpj?: string | null;
  paymentMethod?: 'avista' | 'cartao6x' | 'boleto3x';
  suggestedClasses?: number[]; principalClass?: number; exactSearchCompleted?: boolean;
  carolineReason?: string; firstName?: string;
};
function sweepMemory(mem: Memory, text: string): Memory {
  const m = { ...mem };
  const cpfM = text.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  if (!m.cpf && cpfM && isValidCpf(cpfM[0])) m.cpf = digitsOf(cpfM[0]);
  const cepM = text.match(/\b\d{5}-?\d{3}\b/);
  if (!m.cep && cepM) m.cep = digitsOf(cepM[0]);
  const emailM = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  if (!m.email && emailM) m.email = emailM[0].toLowerCase();
  const cnpjM = text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
  if (m.cnpj === undefined && cnpjM && isValidCnpj(cnpjM[0])) m.cnpj = digitsOf(cnpjM[0]);
  if (!m.paymentMethod) { const p = parsePayment(text); if (p) m.paymentMethod = p; }
  if (!m.fullName && m.brandName) {
    const nm = text.trim().replace(/\s+/g, ' ');
    if (/^[A-ZÀ-Ú][a-zà-ú]{1,30}(?:\s+(?:da|de|do|das|dos|e|[A-ZÀ-Ú][a-zà-ú]{1,30})){1,5}$/.test(nm) && nm.toLowerCase() !== (m.brandName || '').toLowerCase()) m.fullName = nm;
  }
  return m;
}

const COLLECTION_ORDER = ['fullName', 'cpf', 'cep', 'addressNumber', 'email', 'brandName', 'businessArea', 'cnpj', 'paymentMethod'] as const;
type Field = typeof COLLECTION_ORDER[number];
const PRICES = {
  avista: 'R$ 699',
  cartao6x: '6x de R$ 199 (R$ 1.194)',
  boleto3x: '3x de R$ 399 (R$ 1.197)',
};
function fieldQuestion(f: Field, mem: Memory): string {
  switch (f) {
    case 'fullName': return 'Qual é o seu nome completo?';
    case 'cpf': return 'Qual é o seu CPF?';
    case 'cep': return 'Qual é o CEP?';
    case 'addressNumber': return 'Qual é o número da residência?';
    case 'email': return 'Qual é o seu e-mail?';
    case 'brandName': return 'Qual é o nome da marca?';
    case 'businessArea': return 'Qual é o ramo de atividade da marca?';
    case 'cnpj': return 'A empresa tem CNPJ? Se tiver, qual é? Se não tiver, pode responder "não tenho".';
    case 'paymentMethod': return `Qual forma você prefere: ${PRICES.avista} no PIX, ${PRICES.cartao6x} no cartão ou ${PRICES.boleto3x} no boleto?`;
  }
}
function nextMissingField(mem: Memory): Field | null {
  for (const f of COLLECTION_ORDER) {
    if (f === 'cnpj') { if (mem.cnpj === undefined) return 'cnpj'; continue; }
    const v = mem[f as keyof Memory];
    if (v === undefined || v === '') return f;
  }
  return null;
}
function validateField(f: Field, text: string, mem: Memory, opts?: { skipGreetGuard?: boolean }): { ok: boolean; value?: string | null; hint?: string; confirm?: string } {
  const t = text.trim();
  switch (f) {
    case 'fullName': {
      const clean = t.replace(/\s+/g, ' ');
      if (/^(n[aã]o|sim|ok|okay|tudo|certo|obrigad|valeu|oi|ol[áa]|bom dia|boa tarde|boa noite|perfeito|show|beleza|tranquilo)\b/i.test(clean)) return { ok: false, hint: 'Pode me passar seu nome completo, por favor?' };
      if ((clean.match(/\d/g) || []).length >= 4) return { ok: false, hint: 'Preciso do seu nome completo (sem números), como no documento.' };
      if (clean.length >= 3 && clean.length <= 160 && /[a-zA-ZÀ-ú]{2,}\s+[a-zA-ZÀ-ú]{2,}/.test(clean)) return { ok: true, value: clean };
      if (clean.length >= 3 && clean.length <= 160) return { ok: true, value: clean, hint: undefined };
      return { ok: false, hint: 'Pode me passar seu nome completo, por favor?' };
    }
    case 'cpf': { const cm = t.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\b\d{11}\b/); return cm && isValidCpf(cm[0]) ? { ok: true, value: digitsOf(cm[0]) } : { ok: false, hint: 'Esse CPF não confere. Pode conferir e me mandar de novo? (só números ou com pontos)' }; }
    case 'cep': { const cepM = t.match(/\b\d{5}-?\d{3}\b/); return cepM ? { ok: true, value: digitsOf(cepM[0]) } : { ok: false, hint: 'O CEP tem 8 números (ex.: 01310-100). Pode me mandar de novo?' }; }
    case 'addressNumber': {
      const cleaned = t
        .replace(/\b\d{5}-?\d{3}\b/g, ' ')
        .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, ' ')
        .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, ' ');
      const numM = cleaned.match(/\b\d{1,6}\s*(?:[-/]?\s*[a-zA-Z]{1,3})?\b/);
      if (numM) return { ok: true, value: numM[0].replace(/\s+/g, ' ').trim() };
      return { ok: false, hint: 'Só o número da residência, por favor (ex.: 1200).' };
    }
    case 'email': { const em = t.match(/[^\s@]+@[^\s@]+\.[^\s@]+/); return em && em[0].length <= 254 ? { ok: true, value: em[0].toLowerCase() } : { ok: false, hint: 'Esse e-mail não parece certo. Pode me mandar de novo?' }; }
    case 'brandName': {
      const cleanB = t.replace(/^(?:minha\s+)?marca\s+(?:é|eh|se\s+chama|chama-se|chama)\s+|^(?:é|eh|se\s+chama|chama-se|chama|o\s+nome\s+(?:é|eh)\s+)\s*/i, '').replace(/^["'“”]+|["'“”]+$/g, '').trim();
      if (/^(oi|ol[aá]|bom dia|boa tarde|boa noite|tudo bem|tudo bom|teste|sim|n[aã]o|ok|okay|yes|no|hello|hi|hey|opa|eai|e a[ií]|boa|bem|obrigad[oa]|valeu|por favor)[\s!.]*$/i.test(cleanB)) return { ok: false, hint: T.askBrand };
      if (!opts?.skipGreetGuard && isGreetingish(cleanB)) return { ok: false, hint: T.askBrand };
      if (!(cleanB.length >= 2 && cleanB.length <= 120)) return { ok: false, hint: 'Qual é o nome exato da marca?' };
      if (brandLooksAmbiguous(cleanB)) return { ok: false, hint: T.brandConfirm(cleanB), confirm: cleanB };
      return { ok: true, value: cleanB };
    }
    case 'businessArea': return t.length >= 3 && t.length <= 240 ? { ok: true, value: t } : { ok: false, hint: 'Me conta um pouquinho mais: o que a marca vende ou que serviço ela oferece?' };
    case 'cnpj': {
      if (/^(n[aã]o|nao tenho|não tenho|nenhum|sem cnpj)/i.test(t)) return { ok: true, value: null };
      return isValidCnpj(t) ? { ok: true, value: digitsOf(t) } : { ok: false, hint: 'Esse CNPJ não confere. Se a empresa não tiver CNPJ, responde "não tenho".' };
    }
    case 'paymentMethod': {
      const p = parsePayment(t);
      return p ? { ok: true, value: p } : { ok: false, hint: `Me diz qual das três você prefere: PIX ${PRICES.avista}, cartão ${PRICES.cartao6x} ou boleto ${PRICES.boleto3x}?` };
    }
  }
}

const GREET_CORE = new Set(['oi', 'ola', 'olá', 'opa', 'hey', 'hello', 'hi', 'eae', 'dia', 'tarde', 'noite']);
const GREET_FILLER = new Set(['oi', 'ola', 'olá', 'opa', 'hey', 'hello', 'hi', 'eae', 'e', 'ai', 'aí', 'bom', 'boa', 'dia', 'tarde', 'noite', 'tudo', 'bem', 'otima', 'ótima', 'otimo', 'ótimo', 'maravilhosa', 'maravilhoso', 'excelente', 'linda', 'lindo', 'abencoada', 'abençoada', 'abencoado', 'abençoado', 'feliz', 'semana', 'segunda', 'terca', 'terça', 'quarta', 'quinta', 'sexta', 'sabado', 'sábado', 'domingo', 'feira', 'fds', 'pra', 'para', 'voce', 'você', 'vc', 'tambem', 'também', 'igualmente', 'amiga', 'amigo', 'pessoal', 'gente', 'querida', 'querido', 'deus', 'abençoe', 'hoje', 'amanha', 'amanhã', 'ceia', 'semaninha', 'meu', 'minha', 'povo', 'galera']);
// saudação completa (com ou sem votos tipo "ótima quarta-feira abençoada") nunca é nome de marca
function isGreetingish(raw: string): boolean {
  const norm = raw.toLowerCase().replace(/[\p{So}\p{Sc}\p{Sk}\p{P}]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!norm) return true;
  const toks = norm.split(' ');
  const inSet = (set: Set<string>, t: string) => set.has(t) || set.has(t.replace(/([a-zà-ú])\1+/g, '$1'));
  if (!toks.some((t) => inSet(GREET_CORE, t))) return false;
  return toks.every((t) => inSet(GREET_FILLER, t));
}

// candidato ambíguo (frase longa, ou contém token de saudação): nunca salvar direto — confirmar com o cliente antes
function brandLooksAmbiguous(cand: string): boolean {
  const toks = cand.toLowerCase().replace(/[\p{So}\p{Sc}\p{Sk}\p{P}]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (toks.length > 3) return true;
  const inSet = (set: Set<string>, t: string) => set.has(t) || set.has(t.replace(/([a-zà-ú])\1+/g, '$1'));
  return toks.some((t) => inSet(GREET_CORE, t) || inSet(GREET_FILLER, t));
}

const CAROLINE_RE = /(?:quest[aã]o|d[uú]vida).*(?:jur[ií]dic|legal)|(?:oposi[cç][aã]o|recurso|processo judicial|notifica[cç][aã]o extrajudicial|cess[aã]o de marca|licenciamento)/i;
const OPTOUT_RE = /\b(pode parar|para de me (mandar|enviar)|me tira|me remova|descadastr|sair da lista|chega de mensagem|pare de me encher|n[aã]o quero mais contato|para com isso)\b/i;

// ── templates ────────────────────────────────────────────────────────────────
const T = {
  welcome: (fn: string) => `Olá${fn ? ', ' + fn : ''}, seja bem-vindo (a)!!! 👋\nJá vamos te atender! Aguarde um minutinho... 😊`,
  askBrand: '*Qual o nome da sua marca?* Vou verificar gratuitamente se está disponível para registro.  _(ex.: WebMarcas)_',
  brandConfirm: (b: string) => `Só pra eu anotar certinho 😊 o nome da sua marca é *${b}* mesmo? (responde SIM pra confirmar, ou me manda o nome certinho)`,
  askBusiness: (brand: string) => `Perfeito! E qual o ramo de atividade da marca ${brand}?\n(ex.: moda, cosméticos, e-commerce, tecnologia, alimentação, jurídico, saúde...)`,
  searchStart: (brand: string) => `Perfeito! Vou verificar gratuitamente se a marca ${brand} está disponível para registro. Me dá um minutinho 🔎`,
  searchRunning: (brand: string) => `Já estou pesquisando a marca ${brand}, te mando o resultado em instantes 🔎`,
  searchFailed: (brand: string) => `A busca da marca ${brand} não completou agora por instabilidade. Vou tentar de novo e já te trago o resultado.`,
  searchUnavailable: (brand: string) => `O sistema do INPI está instável agora e não consegui concluir a busca da marca ${brand} 😕 Assim que normalizar eu te mando o resultado completo por aqui — vou seguir tentando, combinado?`,
  searchRecovered: (brand: string) => `A busca da marca ${brand} foi concluída ✅ Desculpa a espera!`,
  searchDoneIntro: (brand: string) => `Prontinho! A busca de viabilidade da marca ${brand} está acima em PDF 📄`,
  searchCaution: 'Importante: essa é uma busca inicial. A análise final de viabilidade é feita pelo nosso jurídico no pedido de registro, combinado?',
  classesIntro: (brand: string, descs: string[], main: number) =>
    `Para proteger a marca ${brand}, estas são as classes recomendadas no INPI:\n\n${descs.map(d => '• ' + d).join('\n')}\n\nA principal para o seu caso é a Classe ${main}.`,
  collectionOpening: 'Preciso destes dados para te enviar a proposta personalizada e, aprovando, iniciar o registro no INPI:',
  interestReAsk: 'Agora que esclareci sua dúvida, você tem interesse em iniciar o registro? 😊',
  interestReAskNeutral: 'Você tem interesse em iniciar o registro? 😊',
  caroline: 'Essa questão precisa da Caroline, do nosso jurídico. Já avisei ela por aqui e ela te responde nesta conversa, combinado? 😊',
  carolineAgain: 'A Caroline já foi acionada e vai te responder por aqui. 😊',
  optout: 'Sem problema! Vou encerrar por aqui. Se um dia quiser registrar sua marca, é só me chamar. 😊',
  contractReady: (fn: string, url: string) => `Perfeito${fn ? ', ' + fn : ''}! Seu contrato foi preparado. Revise e assine aqui: ${url}`,
  contractRetryPending: 'Tive uma instabilidade para gerar seu contrato agora. Vou tentar novamente em alguns minutos e te envio o link por aqui, combinado?',
  contractRetryStill: 'Continuo finalizando seu contrato por aqui, tá? Assim que o link sair eu te mando. 😊',
  aiIdentity: 'Sou a Fernanda, a assistente virtual da WebMarcas 🤖💚 Converso com você por aqui para agilizar tudo e, se precisar de algo mais específico, alguém do nosso time entra na conversa. Pode falar comigo normalmente!',
  faqHow: 'É bem simples: eu faço a busca de viabilidade gratuita da sua marca, você me passa alguns dados e assina o contrato. A partir daí nosso jurídico protocola o pedido no INPI e acompanha cada etapa, te atualizando por aqui. 😊',
  faqHowLate: (brand: string) => `A busca gratuita da ${brand} já foi feita por aqui 😊 O próximo passo é você me passar alguns dados pra eu montar a proposta e o contrato; depois da assinatura, nosso jurídico protocola o pedido no INPI e acompanha cada etapa, te atualizando por aqui.`,
  faqTime: 'O protocolo no INPI acontece em até 48h após a assinatura do contrato. A análise do INPI leva em média 12 meses, e a gente acompanha tudo e te mantém informada(o) de cada movimentação por aqui. 😊',
  faqGuarantee: 'Você tem garantia total: se o INPI arquivar o pedido, registramos uma nova marca pra você sem custo. 😊',
  faqCertificate: 'Ao final do processo você recebe o certificado de registro, válido por 10 anos e com direito a renovação. ®️',
  faqInpi: 'O INPI é o órgão federal responsável pelo registro de marcas no Brasil. É ele que analisa o pedido e emite o certificado que garante a exclusividade da sua marca. 😊',
  faqWhy: 'Registrar garante a exclusividade da sua marca no Brasil inteiro: ninguém pode usar nem copiar, e você não corre o risco de perder tudo o que construiu se alguém registrar antes. 🔒',
  questionDefer: 'Boa pergunta! Vou confirmar essa com o nosso time e já te respondo. Enquanto isso, vamos continuando por aqui 😊',
  multiclass: 'Boa pergunta! Não: cada classe corresponde a um processo próprio no INPI — por isso, cada classe é cobrada à parte, por se tratar de um processo separado, combinado? 😊',
  procuracaoIntro: (fn: string, url: string) => `Perfeito${fn ? ', ' + fn : ''}! Recebemos a assinatura do seu contrato ✅ Agora estou te enviando a procuração, que autoriza nosso jurídico a representar você junto ao INPI. Assine aqui: ${url}`,
  procuracaoWait: 'Assim que assinar a procuração, me avisa por aqui 😊',
  gruIssued: (valor: string) => `Procuração recebida! ✅ Emiti a GRU federal do seu pedido: ${valor} (taxa do INPI, com o desconto aplicável). Vencimento em 3 dias úteis. [GRU SIMULADA — TESTE]\nAssim que pagar, me avisa ou manda o comprovante por aqui 😊`,
  gruWait: 'Assim que o pagamento da GRU confirmar, te mando o resumo completo do pedido pra você conferir antes do protocolo 😊',
  gruPaid: 'Pagamento da GRU confirmado ✅ [SIMULAÇÃO]',
  previewAsk: 'Confere os dados acima? Se estiver tudo certo, responde *"pode protocolar"* que nosso jurídico envia o pedido ao INPI. Se algo estiver errado, me fala o que eu corrijo 😊',
  previewHold: 'Sem problema! Seguro o protocolo até você me autorizar. Qualquer ajuste, é só me falar 😊',
  protocolDone: (proto: string, data: string) => `Pedido protocolado no INPI! 🎉\nProtocolo nº ${proto} [SIMULADO — TESTE], em ${data}. Guarde esse número: ele acompanha todo o seu processo.`,
  gruIssuedLive: (valor: string) => `Procuração recebida! ✅ Aqui está a GRU federal do seu pedido: ${valor} (taxa do INPI, com o desconto aplicável). Vencimento em 3 dias úteis. Assim que pagar, me avisa ou manda o comprovante por aqui 😊`,
  gruCheckSignature: 'Recebi! Vou conferir a assinatura e já te mando a próxima etapa por aqui 😊',
  gruPaidLive: 'Pagamento da GRU confirmado ✅',
  gruWaitBank: 'Anotado! O pagamento da GRU pode levar até 2 dias úteis pra compensar no sistema do INPI. Assim que confirmar, te mando o resumo completo do pedido pra você conferir 😊',
  protocolFiling: 'Perfeito! Vou protocolar seu pedido no INPI agora. Assim que sair o número do protocolo te aviso por aqui 😊',
  protocolDoneLive: (proto: string, data: string) => `Pedido protocolado no INPI! 🎉\nProtocolo nº ${proto}, em ${data}. Guarde esse número: ele acompanha todo o seu processo.`,
  afterProtocol: 'A partir de agora o INPI analisa o pedido (em média 12 meses). Eu vigio cada movimentação e te aviso por aqui: publicação, eventuais oposições ou exigências, e a concessão com o certificado válido por 10 anos ®️',
  contractFailedFinal: 'Não consegui gerar seu contrato automaticamente agora. Já acionei nosso time e o jurídico vai te chamar por aqui ainda hoje. 😊',
  contractLinkAgain: (url: string) => `Claro! Aqui está o link do seu contrato: ${url}`,
  afterContract: 'Seu contrato já está disponível no link acima 😊 Qualquer dúvida final, nosso jurídico assume por aqui.',
  audioFail: 'Não consegui ouvir esse áudio direito 😅 Pode me escrever em texto, por favor?',
  mediaUnsupported: 'Recebi seu arquivo! Para eu te ajudar mais rápido, me conta em texto o que você precisa 😊',
  mediaImage: 'Que legal, recebi sua foto! 😊 Me conta em texto o que você precisa que eu já te ajudo!',
  followup1: (fn: string, brand?: string) => `Oi${fn ? ', ' + fn : ''}! Ficou alguma dúvida${brand ? ` sobre o registro da ${brand}` : ''}? Estou por aqui 😊`,
  followup2: (fn: string) => `${fn ? fn + ', p' : 'P'}assando para saber se posso te ajudar com o registro da sua marca. Se quiser continuar, é só responder aqui.`,
  followup3: (fn: string) => `Último contato${fn ? ', ' + fn : ''}: se ainda fizer sentido registrar sua marca, me responde que retomamos de onde paramos 😊`,
};

// ── supabase (webmarcas) ─────────────────────────────────────────────────────
function db(): Pg { return { base: E.url, key: E.key }; }
type ConvRow = {
  conversation_id: string; subscriber_id: string; phone: string; stage: string;
  summary: string; collected_data: Memory & Record<string, unknown>; pending_action: Record<string, unknown> | null;
};
async function loadConv(conversationId: string): Promise<ConvRow | null> {
  const data = await pgOne(db(), 'webmarcas_agent_conversations', `select=*&conversation_id=eq.${qe(conversationId)}`);
  return (data as ConvRow | null) ?? null;
}
async function saveConv(c: ConvRow) {
  const r = await pgInsert(db(), 'webmarcas_agent_conversations', {
    conversation_id: c.conversation_id, subscriber_id: c.subscriber_id, phone: c.phone,
    stage: c.stage, summary: c.summary, collected_data: c.collected_data,
    pending_action: c.pending_action, updated_at: new Date().toISOString(),
  }, true);
  if (r.error) throw new Error(`saveConv_failed:${r.error}`);
}
async function markInbox(inboxId: string, status: 'completed' | 'failed' | 'processing', errorCode?: string) {
  await pgUpdate(db(), 'webmarcas_agent_inbox', `id=eq.${inboxId}`, { status, error_code: errorCode ?? null, updated_at: new Date().toISOString() });
}
async function storeAssistant(conversationId: string, content: string, eventMarker?: string | null) {
  await pgInsert(db(), 'webmarcas_agent_messages', {
    conversation_id: conversationId, role: 'assistant', content,
    ...(eventMarker ? { event_id: eventMarker } : {}),
  });
}
async function scheduleFollowups(conversationId: string) {
  await pgRpc(db(), 'schedule_webmarcas_agent_followups', { p_conversation_id: conversationId });
}

// ── ferramentas ──────────────────────────────────────────────────────────────
async function transcribeAudio(bytes: Uint8Array, mime: string): Promise<string | null> {
  const r = await fetch(`${E.url}/functions/v1/transcribe-audio`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64: bytesToB64(bytes), mimeType: mime || 'audio/ogg' }),
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return s1(j?.text);
}
async function inpiStart(brand: string, activity: string, phone: string): Promise<string | null> {
  // nunca lança: falha da ferramenta cai no fluxo search_retry (avisa o cliente) em vez de
  // derrubar a passada depois dos envios e deixar o retry reenviar tudo (incidente 23/set)
  try {
    const idem = idemKey('wm', phone, brand, activity);
    const r = await fetch(`${E.inpiBase}/v1/searches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${E.inpiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idem, Accept: 'application/json' },
      body: JSON.stringify({ brand, activity, subscriber_id: phone }),
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return s1(j?.job_id) ?? s1(j?.id);
  } catch (e) {
    console.error('inpi_start_failed', e instanceof Error ? e.message : e);
    return null;
  }
}
async function inpiStatus(jobId: string): Promise<{ status: string; pdf_url: string | null; raw?: unknown } | null> {
  try {
    const r = await fetch(`${E.inpiBase}/v1/searches/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${E.inpiKey}`, Accept: 'application/json' },
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    const status = (s1(j?.status) || 'failed').toLowerCase();
    return { status, pdf_url: s1(j?.pdf_url), raw: j };
  } catch (e) {
    console.error('inpi_status_failed', e instanceof Error ? e.message : e);
    return null;
  }
}
async function suggestClasses(brand: string, area: string): Promise<{ classes: number[]; descriptions: string[] } | null> {
  const r = await fetch(`${E.url}/functions/v1/inpi-viability-check`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${E.key}`, apikey: E.key },
    body: JSON.stringify({ brandName: brand, businessArea: area, classesOnly: true }),
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const classes = Array.isArray(j?.classes) ? j.classes.filter((n: unknown) => Number.isInteger(n)) : [];
  const descriptions = Array.isArray(j?.classDescriptions) ? j.classDescriptions.filter((x: unknown) => typeof x === 'string' && x.trim()) : [];
  if (classes.length !== 3 || descriptions.length !== 3) return null;
  return { classes, descriptions };
}
async function createContract(mem: Memory, phone: string): Promise<{ url: string; number: string } | null> {
  const localPhone = phone.replace(/^55(?=\d{10,11}$)/, '');
  const body = {
    cep: mem.cep, cpf: mem.cpf, cnpj: mem.cnpj ?? null, email: mem.email,
    event_id: `contrato-${phone}-${mem.cpf}-${(mem.brandName || '').slice(0, 40)}`,
    flow_name: '1- AT FINAL SEMANA', agent_name: 'Fernanda Atendimento',
    full_name: mem.fullName, brand_name: mem.brandName, business_area: mem.businessArea,
    contact_phone: localPhone, phone: localPhone, address_number: mem.addressNumber,
    payment_method: mem.paymentMethod, suggested_classes: mem.suggestedClasses,
  };
  const r = await fetch(`${E.url}/functions/v1/create-contract-from-botconversa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-botconversa-contract-secret': E.contractSecret },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => null);
  const url = s1(j?.data?.signature_url);
  if (!r.ok || !url) return null;
  return { url, number: s1(j?.data?.contract_number) };
}

// ── pipeline de saída (send + espelho + estado) ──────────────────────────────
type Ctx = {
  conv: ConvRow; dry: boolean; zConvId: string | null; zUnread: number;
  phoneDigits: string; fn: string; sent: Array<Record<string, unknown>>;
  lastText: string; testNoGuard?: boolean;
  eventId?: string; sendSeq?: number; // guarda de idempotência por evento (retry não reenvia bolha já persistida)
};
async function reply(ctx: Ctx, spec: SendSpec, opts: { mirrorBody?: string | null; mirrorType?: string; storeText?: string; proactive?: boolean } = {}) {
  const phone = ctx.phoneDigits;
  if (spec.kind === 'text' && opts.proactive) {
    // regra dele (23/set): consultar o histórico completo antes de qualquer envio proativo
    // e nunca repetir uma mensagem já enviada nessa conversa
    try {
      const recent = await pgSelect(db(), 'webmarcas_agent_messages', `select=content&conversation_id=eq.${ctx.conv.conversation_id}&role=eq.assistant&order=created_at.desc&limit=15`);
      if (((recent as Record<string, unknown>[] | null) ?? []).some((m) => str(m.content) === spec.text)) {
        ctx.sent.push({ spec: spec.kind, ok: true, dedupe_skip: 'history' });
        console.error('dedupe_skip_history', ctx.conv.conversation_id, spec.text.slice(0, 60));
        return;
      }
    } catch (e) { console.error('dedupe_check_failed', e instanceof Error ? e.message : e); }
  }
  // guarda de idempotência por evento: se o retry re-executar a passada, as bolhas já
  // persistidas daquele evento são puladas em vez de reenviadas (incidente 23/set)
  let evMarker: string | null = null;
  if (ctx.eventId) {
    ctx.sendSeq = (ctx.sendSeq ?? 0) + 1;
    evMarker = `${ctx.eventId}:a:${ctx.sendSeq}`;
    try {
      const dup = await pgOne(db(), 'webmarcas_agent_messages', `select=id&conversation_id=eq.${qe(ctx.conv.conversation_id)}&event_id=eq.${qe(evMarker)}&limit=1`);
      if (dup) {
        ctx.sent.push({ spec: spec.kind, ok: true, dedupe_skip: 'event' });
        console.error('dedupe_skip_event', ctx.conv.conversation_id, evMarker);
        return;
      }
    } catch (e) { console.error('event_dedupe_check_failed', e instanceof Error ? e.message : e); }
  }
  let providerId = `fernanda_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let sendResult: Record<string, unknown> = { dry: true };
  if (!ctx.dry) {
    const r = await stevoSend(phone, spec);
    sendResult = r.ok ? { ok: true } : { ok: false, error: r.error };
    if (r.ok && r.id) providerId = r.id;
    if (!r.ok) {
      ctx.sent.push({ spec: spec.kind, ok: false, error: r.error });
      throw new Error(`stevo_send_failed:${r.error}`);
    }
  }
  if (spec.kind === 'text' && spec.text.replace(/\s+/g, ' ').trim() === ctx.lastText.replace(/\s+/g, ' ').trim()) {
    // nunca repete a mesma mensagem de texto em sequência
    return;
  }
  ctx.sent.push({ spec: spec.kind, ok: true, ...(ctx.dry ? { text: spec.kind === 'text' ? spec.text : (spec.url || '') } : {}) });
  if (spec.kind === 'text') ctx.lastText = spec.text;
  const textForStore = opts.storeText ?? (spec.kind === 'text' ? spec.text : (spec.kind === 'audio' ? '[áudio]' : '[documento] ' + (spec.caption || spec.url)));
  if (ctx.zConvId) {
    const mType = opts.mirrorType ?? (spec.kind === 'text' ? 'text' : spec.kind === 'audio' ? 'audio' : 'file');
    const mBody = opts.mirrorBody !== undefined ? opts.mirrorBody : (spec.kind === 'text' ? spec.text : null);
    await zInsertMessage({
      conversationId: ctx.zConvId, direction: 'outbound', type: mType, body: mBody,
      mediaUrl: spec.kind === 'text' ? null : spec.url,
      mediaMeta: spec.kind === 'audio' ? { is_voice: true } : (spec.kind === 'document' ? { filename: spec.filename || 'documento.pdf' } : null),
      providerId,
    });
    await zTouchConversation(ctx.zConvId, (mBody ?? textForStore).slice(0, 120), false, ctx.zUnread);
  }
  await storeAssistant(ctx.conv.conversation_id, textForStore, evMarker);
}

// entrega busca + classes + abre coleta (usada no fast-path e pelo cron)
async function deliverSearchAndAdvance(ctx: Ctx, pdfUrl: string | null) {
  const mem = ctx.conv.collected_data as Memory & Record<string, unknown>;
  const brand = mem.brandName || 'sua marca';
  if (mem._searchDownNotified) {
    delete mem._searchDownNotified;
    ctx.conv.collected_data = mem;
    await reply(ctx, { kind: 'text', text: T.searchRecovered(brand) });
  }
  if (pdfUrl) {
    await reply(ctx, { kind: 'document', url: pdfUrl, filename: `busca-viabilidade-${brand}.pdf`, caption: T.searchDoneIntro(brand) });
  } else {
    await reply(ctx, { kind: 'text', text: `A busca da marca ${brand} foi concluída.` });
  }
  const area = mem.businessArea || '';
  const sug = ctx.dry ? null : await suggestClasses(brand, area);
  if (sug) {
    mem.suggestedClasses = sug.classes;
    mem.principalClass = sug.classes[0];
    await reply(ctx, { kind: 'text', text: `${T.searchCaution}\n\n${T.classesIntro(brand, sug.descriptions, sug.classes[0])}` });
  } else {
    await reply(ctx, { kind: 'text', text: T.searchCaution });
  }
  mem.exactSearchCompleted = true;
  ctx.conv.collected_data = mem;
  ctx.conv.stage = 'confirm_interest';
  ctx.conv.pending_action = null;
  const f = nextMissingField(mem);
  const openQ = `Você tem interesse em iniciar o registro da marca ${brand}? 😊`;
  await reply(ctx, { kind: 'text', text: openQ });
}

async function searchUnavailable(ctx: Ctx, attempts: number) {
  const mem = ctx.conv.collected_data as Memory & Record<string, unknown>;
  ctx.conv.pending_action = { type: 'search_hourly', attempts, at: new Date().toISOString(), next_at: new Date(Date.now() + 3_600_000).toISOString() };
  await saveConv(ctx.conv);
  if (!mem._searchDownNotified) {
    mem._searchDownNotified = true;
    ctx.conv.collected_data = mem;
    await saveConv(ctx.conv);
    try { await reply(ctx, { kind: 'text', text: T.searchUnavailable(mem.brandName || 'sua marca') }); } catch (e) { console.error('search_down_notify_failed', e instanceof Error ? e.message : e); }
  }
}

function filingPreviewText(mem: Memory): string {
  const classes = (mem.suggestedClasses || []).join(', ') || '-';
  return `*Resumo do pedido de registro*${E.phase2Live ? '' : ' [SIMULAÇÃO — TESTE]'}
• Marca: ${mem.brandName || '-'}
• Titular: ${mem.fullName || '-'} — CPF ${mem.cpf || '-'}${mem.cnpj ? ' — CNPJ ' + mem.cnpj : ''}
• E-mail: ${mem.email || '-'}
• Endereço: CEP ${mem.cep || '-'}, nº ${mem.addressNumber || '-'}
• Ramo: ${mem.businessArea || '-'}
• Classes INPI: ${classes}${mem.principalClass ? ' (principal: ' + mem.principalClass + ')' : ''}
• Logotipo: ${(mem as Record<string, unknown>)._logo ? 'recebido ✓ (convertido para JPEG no protocolo)' : 'aguardando envio por aqui'}
• Natureza: pedido de registro de marca (especificação pré-aprovada)`;
}

async function advanceToPreview(ctx: Ctx, mem: Memory): Promise<void> {
  (mem as Record<string, unknown>)._gruStatus = E.phase2Live ? 'paga' : 'paga (SIMULADA)';
  ctx.conv.collected_data = mem;
  ctx.conv.stage = 'preview_sent';
  await reply(ctx, { kind: 'text', text: E.phase2Live ? T.gruPaidLive : T.gruPaid });
  await reply(ctx, { kind: 'text', text: filingPreviewText(mem) });
  await reply(ctx, { kind: 'text', text: T.previewAsk });
}

// ── procuração (CRM): template Procuração INPI - Padrão, document_type procuracao ──
const PROCURACAO_TEMPLATE_ID = 'ec1b765f-4107-47ee-80d6-baa3bb2096c0';
const escHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] || c));
const ptBrDate = (d: Date) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(d);
async function viaCep(cep: string): Promise<{ address: string; neighborhood: string; city: string; state: string } | null> {
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const j = await r.json().catch(() => null);
    if (!j || j.erro) return null;
    return { address: str(j.logradouro) || '', neighborhood: str(j.bairro) || '', city: str(j.localidade) || '', state: str(j.uf) || '' };
  } catch { return null; }
}
async function createProcuracao(mem: Memory, phone: string): Promise<{ url: string; number: string } | null> {
  try {
    const eventId = `procuracao-${phone}-${mem.cpf || ''}`;
    const existing = await pgOne(db(), 'contracts', `select=signature_token,contract_number&source_event_id=eq.${qe(eventId)}`);
    if (existing?.signature_token) return { url: `https://webmarcas.net/assinar/${existing.signature_token}`, number: str(existing.contract_number) };
    const prof = await pgOne(db(), 'profiles', `select=id,full_name,company_name&cpf_cnpj=ilike.*${mem.cpf}*`);
    if (!prof?.id) { console.error('procuracao_profile_missing', mem.cpf); return null; }
    const proc = await pgOne(db(), 'brand_processes', `select=id&user_id=eq.${prof.id}&order=created_at.desc&limit=1`);
    if (!proc?.id) { console.error('procuracao_process_missing', prof.id); return null; }
    const tpl = await pgOne(db(), 'contract_templates', `select=id,content&id=eq.${PROCURACAO_TEMPLATE_ID}`);
    if (!tpl?.content) { console.error('procuracao_template_missing'); return null; }
    const geo = await viaCep(mem.cep || '');
    const endereco = geo ? `${geo.address}, ${mem.addressNumber || ''}, ${geo.neighborhood}, ${geo.city} - ${geo.state}` : `CEP ${mem.cep}, nº ${mem.addressNumber || ''}`;
    const nome = str(prof.full_name) || mem.fullName || '';
    const values: Record<string, string> = {
      marca: escHtml(mem.brandName || ''),
      razao_social_ou_nome: escHtml(str(prof.company_name) || nome),
      endereco_empresa: escHtml(endereco),
      cidade: escHtml(geo?.city || ''), estado: escHtml(geo?.state || ''), cep: escHtml(mem.cep || ''),
      cnpj: escHtml(mem.cnpj || '-'),
      nome_representante: escHtml(nome), cpf_representante: escHtml(mem.cpf || ''),
      data_procuracao: ptBrDate(new Date()),
    };
    const html = Object.entries(values).reduce((acc, [k, v]) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v), str(tpl.content));
    const now = new Date();
    const token = crypto.randomUUID();
    const expiresAt = new Date(now); expiresAt.setDate(expiresAt.getDate() + 7);
    const number = `PROC-${now.getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const ins = await pgInsert(db(), 'contracts', {
      user_id: prof.id, process_id: proc.id, contract_number: number, contract_type: 'registro_marca',
      subject: 'PROCURAÇÃO INPI', contract_value: null, plan_type: 'essencial',
      start_date: now.toISOString().slice(0, 10), template_id: PROCURACAO_TEMPLATE_ID,
      contract_html: html, document_type: 'procuracao',
      signatory_name: nome, signatory_cpf: mem.cpf, signatory_cnpj: mem.cnpj ?? null,
      payment_method: mem.paymentMethod, signature_status: 'not_signed',
      signature_token: token, signature_expires_at: expiresAt.toISOString(),
      visible_to_client: true, suggested_classes: null, source_event_id: eventId,
    });
    if (ins.error || !ins.data?.id) { console.error('procuracao_insert_failed', ins.error); return null; }
    await pgInsert(db(), 'signature_audit_log', { contract_id: ins.data.id, event_type: 'link_generated', event_data: { source: 'fernanda', expires_at: expiresAt.toISOString() } });
    return { url: `https://webmarcas.net/assinar/${token}`, number };
  } catch (e) { console.error('procuracao_failed', e instanceof Error ? e.message : e); return null; }
}

async function finalizeContract(ctx: Ctx) {
  const mem = ctx.conv.collected_data as Memory;
  const missing = nextMissingField(mem);
  if (missing) {
    // nunca diz que o contrato falhou quando só faltam dados: pede o que falta
    ctx.conv.stage = 'collecting';
    await reply(ctx, { kind: 'text', text: `Antes de gerar o contrato, preciso só mais deste dado:\n\n${fieldQuestion(missing, mem)}` });
    return;
  }
  const contract = ctx.dry ? { url: 'https://example.invalid/assinar/TESTE', number: 'TESTE-000' } : await createContract(mem, ctx.conv.phone);
  if (contract) {
    mem.firstName = mem.firstName || firstName(mem.fullName);
    ctx.conv.collected_data = { ...mem, contract_url: contract.url, contract_number: contract.number };
    ctx.conv.stage = 'contract_link_sent';
    ctx.conv.pending_action = null;
    await reply(ctx, { kind: 'text', text: T.contractReady(mem.firstName || '', contract.url) });
  } else {
    ctx.conv.pending_action = { type: 'contract_retry', attempts: 1, at: new Date().toISOString() };
    await reply(ctx, { kind: 'text', text: T.contractRetryPending });
  }
}

// ── roteiro oficial de valores (Davilys, 21/09): áudio -> 4 blocos exatos -> 30-40s -> "ficou alguma dúvida?" ──
const PRICING_AUDIO_URL = `${E.url}/storage/v1/object/public/fernanda/valores-oficial.ogg`;
const PRICING_SCRIPT: string[] = [
  '🔰*Valores e Condições Especiais:*\nR$699,00 à vista no Pix (43% OFF)\n\nou 3x de R$399 no boleto (sem juros).\n6x de R$199 no cartão (sem juros).',
  '💰 *Taxas do INPI:*\nValor único de R$440,00 referente ao protocolo e certificado federal.',
  '✅ Incluso ®️ :\n- Registro do nome + logotipo\n- Protocolo no INPI em até 48h\n- Acompanhamento e vigilância por 12 meses\n- Garantia total: se o INPI arquivar, registramos nova marca sem custo.',
  '_Se houver exigências ou publicações extras, os custos serão cobrados conforme nosso contrato e serão publicados no Diário Oficial para garantir transparência._\n\nApós isso, você recebe o certificado válido por 10 anos, com direito a renovação.',
];

async function sendPricingScript(ctx: Ctx, extraNote?: string): Promise<void> {
  // áudio oficial quando disponível (fallback aprovado por ele: só os textos, que são obrigatórios)
  try {
    const head = await fetch(PRICING_AUDIO_URL, { method: 'HEAD' });
    if (head.ok) await reply(ctx, { kind: 'audio', url: PRICING_AUDIO_URL, mime: 'audio/ogg' });
  } catch { /* sem áudio: segue com os textos */ }
  for (const block of PRICING_SCRIPT) await reply(ctx, { kind: 'text', text: block });
  if (extraNote) await reply(ctx, { kind: 'text', text: extraNote });
  const mem = ctx.conv.collected_data as Record<string, unknown>;
  mem._pricingFlow = 'asked_duvida';
  ctx.conv.collected_data = mem;
  await saveConv(ctx.conv);
  // espera 30s pra pessoa ler; só pergunta se ninguém respondeu nesse meio-tempo (2s em dry-run)
  await new Promise(r => setTimeout(r, ctx.dry ? 2_000 : 30_000));
  const fresh = await loadConv(ctx.conv.conversation_id);
  const flow = fresh ? str((fresh.collected_data as Record<string, unknown>)._pricingFlow) : null;
  if (flow === 'asked_duvida') await reply(ctx, { kind: 'text', text: 'Até aqui, ficou alguma dúvida?' });
}

async function pricingGo(ctx: Ctx, stage: string, mem: Memory) {
  // "sim" pra dar sequência: coleta um dado por vez, sem repetir o que já tem
  const missing = nextMissingField(mem);
  if (stage === 'confirm_interest') {
    ctx.conv.stage = 'collecting';
    const openPI = missing ? `${T.collectionOpening}\n\n${fieldQuestion(missing, mem)}` : T.collectionOpening;
    await reply(ctx, { kind: 'text', text: openPI });
    return;
  }
  if (stage === 'discover_brand') { await reply(ctx, { kind: 'text', text: T.askBrand }); return; }
  if (stage === 'discover_business') { await reply(ctx, { kind: 'text', text: T.askBusiness(mem.brandName || 'sua marca') }); return; }
  if (stage === 'search_running') { await reply(ctx, { kind: 'text', text: T.searchRunning(mem.brandName || 'sua marca') }); return; }
  if (stage === 'contract_link_sent') {
    const url = str((mem as Record<string, unknown>).contract_url);
    await reply(ctx, { kind: 'text', text: url ? T.contractLinkAgain(url) : T.afterContract });
    return;
  }
  if (!missing) { await reply(ctx, { kind: 'text', text: 'Posso gerar seu contrato agora? É só me confirmar 😊' }); return; }
  ctx.conv.stage = 'collecting';
  await reply(ctx, { kind: 'text', text: `${T.collectionOpening}\n\n${fieldQuestion(missing, mem)}` });
}

async function faqAnswer(ctx: Ctx, text: string): Promise<'pricing' | true | false> {
  const t = text.toLowerCase();
  const mem = ctx.conv.collected_data as Memory;
  const stage = ctx.conv.stage || 'new';
  const searchDone = !!mem.exactSearchCompleted || ['collecting', 'ready_for_contract', 'contract_link_sent'].includes(stage);
  // valores/taxas/pagamento: resposta oficial travada (áudio + 4 textos), sem improviso
  const POST_CONTRACT = ['procuracao_sent', 'gru_issued', 'preview_sent', 'preview_hold', 'protocol_done', 'active_monitoring'];
  if (POST_CONTRACT.includes(stage)) return false; // pós-contrato: roteiro comercial de valores não se aplica; LLM responde com os fatos da fase
  const multiClass = /(todas? as classes|nas (tr[êe]s|duas|\d+) classes|\b(tr[êe]s|duas) classes\b|mais de uma classe|cada classe|por classe|classe adicional|outras? classes|cobre.{0,25}classe|inclus[oa].{0,25}classe|regist\w*.{0,25}(\d|tr[êe]s|duas) classes|quantas classes)/i.test(t);
  const strongPrice = /(quanto custa|qual (o |o')?preço|qual (o )?valor|quais (o )?valores|quanto (é|fica|sai)|valor do registro|pago (mais )?alguma coisa|pago (só|so) isso|(é|eh) (só|so) isso|tem (mais )?alguma (taxa|cobrança|custo)|custo extra|taxas? do inpi|\btaxas?\b|o que (está|ta|tá) incluso|o que inclui|exigênc|publicaç|diário oficial|formas? de pagamento|como (funciona|é) o pagamento|saber (de|sobre)( os)? valores|quero saber.*(valor|preço|custo|taxa|pagamento)|queria saber|saber.{0,30}(valor|preço|custo|taxa)|quest[aã]o d[ae]os?\w* (de |do |da |dos )?(valor|preço|custo|taxa|pagamento)|me (fala|conta|explica).{0,30}(valor|preço|custo|taxa)|tudo (que|o que) (eu )?(vou|tenho|irei) pagar|o que (eu )?vou pagar|quanto (vou|tenho que|preciso) pagar|tudo que (eu )?vou pagar|(t[aá]|est[aá]|fica) incluso|incluso n[ao] pre[cç]o|em todas as classes|nas (tr[êe]s|duas|\d+) classes|cobra (as|todas) as classes|registro nas classes|cobre (as|todas) as classes|\b(qt|qto|quanto)\b.{0,20}(custa|custo|vale|sai|fica)|\bcusta\b|cobranç|valor total|preço total|vai (me )?custar|vou gastar|orçamento|investimento|(tem|vai ter|existe|h[aá]).{0,25}(custo|taxa|cobranç)|é (de )?quanto|fica (de|por|em) quanto|sai (por|de|em) quanto)/i.test(t);
  const QUESTION_LOOSE = /(\?|\b(como|quanto|quanta|quais?|saber|queria|quero|gostaria|d[aá] pra|pago|pagar|paga|inclus[oa]|cobre|me fala|me conta|me explica|d[uú]vida|seria|ficaria)\b)/i;
  const weakPrice = /(\bvalores?\b|\bpreços?\b|\bcustos?\b|cobrança|mensalidade|investimento)/i.test(t) && QUESTION_LOOSE.test(t);
  const weakPay = /(parcela|desconto|\bmei\b|simples|juros|pagamento|boleto|cartão|cartao|\bpix\b)/i.test(t) && (QUESTION_RE.test(text) || /(como|quanto|quais?|saber|d[uú]vida|\?)/i.test(t));
  const amountAsk = /(custa|quanto|vou pagar|\bpago\b|\bpagar\b|\bsai\b|\bfica\b|cobra|\bvale\b)/i.test(t);
  if (multiClass && (strongPrice || weakPrice || weakPay) && amountAsk) { await sendPricingScript(ctx, T.multiclass); return 'pricing'; }
  if (multiClass) { await reply(ctx, { kind: 'text', text: T.multiclass }); return true; }
  if (strongPrice || weakPrice || weakPay) { await sendPricingScript(ctx); return 'pricing'; }
  if (/(certificado|validade|10 anos|renovaç)/i.test(t)) { await reply(ctx, { kind: 'text', text: T.faqCertificate }); return true; }
  if (/(quanto tempo|prazo|demora|demorado|leva quanto|quando (fica|vai ficar) pronto)/i.test(t)) { await reply(ctx, { kind: 'text', text: T.faqTime }); return true; }
  if (/(como (que )?funciona|como é o processo|como funciona o registro|como faço para registrar|o que preciso|o que precisa)/i.test(t)) {
    await reply(ctx, { kind: 'text', text: searchDone ? T.faqHowLate(mem.brandName || 'sua marca') : T.faqHow });
    return true;
  }
  if (/(garantia|e se n[aã]o der certo|indefer|arquiv|se o inpi negar)/i.test(t)) { await reply(ctx, { kind: 'text', text: T.faqGuarantee }); return true; }
  if (/(o que é o inpi|o que e o inpi|o que é inpi|para que serve o inpi|o que significa inpi)/i.test(t)) { await reply(ctx, { kind: 'text', text: T.faqInpi }); return true; }
  if (/(por que (eu )?(devo|deveria|preciso|tenho que|teria que)? ?registrar|pra que (eu )?(devo|deveria|preciso)? ?registrar|porque registrar|importância de registrar|vale a pena|vantagem de registrar|risco de não registrar)/i.test(t)) { await reply(ctx, { kind: 'text', text: T.faqWhy }); return true; }
  return false;
}

async function reAsk(ctx: Ctx, stage: string, mem: Memory) {
  // retoma o roteiro exatamente de onde parou, com ponte natural pra pergunta pendente
  if (stage === 'discover_brand') { await reply(ctx, { kind: 'text', text: `Pra eu prosseguir, qual o nome da sua marca? 😊` }); return; }
  if (stage === 'discover_business') { await reply(ctx, { kind: 'text', text: `Pra eu prosseguir, qual o ramo de atividade da marca ${mem.brandName || 'sua marca'}?` }); return; }
  if (stage === 'collecting') {
    const f = nextMissingField(mem);
    if (f) await reply(ctx, { kind: 'text', text: `Pra eu prosseguir: ${fieldQuestion(f, mem)}` });
    return;
  }
  if (stage === 'confirm_interest') { await reply(ctx, { kind: 'text', text: T.interestReAsk }); return; }
  if (stage === 'ready_for_contract') {
    await reply(ctx, { kind: 'text', text: 'Posso gerar seu contrato agora? É só me confirmar 😊' });
    return;
  }
}

// ── respostas aprendidas: defers viram pendências; respostas aprovadas são reutilizadas ──
const normQ = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
const DEFER_OUT_RE = /(vou confirmar|confirmar com (o |a )?(nosso |meu )?(time|jur[ií]dico)|verificar com (o )?(time|jur[ií]dico)|consultar (o )?(nosso )?(time|jur[ií]dico)|vou checar com)/i;
async function learnedAnswerFor(question: string): Promise<string | null> {
  try {
    const rows = await pgSelect(db(), 'webmarcas_agent_learned_answers', `select=answer&status=eq.answered&question_norm=eq.${qe(normQ(question))}&limit=1`);
    const a = rows[0]?.answer;
    return typeof a === 'string' && a.trim() ? a.trim() : null;
  } catch { return null; }
}
async function learnedContext(): Promise<string> {
  try {
    const rows = await pgSelect(db(), 'webmarcas_agent_learned_answers', 'select=question_sample,answer&status=eq.answered&order=answered_at.desc&limit=40');
    return rows.map(r => `P: ${str(r.question_sample)}\nR: ${str(r.answer)}`).join('\n');
  } catch { return ''; }
}
async function logDeferred(question: string): Promise<void> {
  try {
    const n = normQ(question);
    if (n.length < 8) return;
    const ex = await pgSelect(db(), 'webmarcas_agent_learned_answers', `select=id,asked_count&question_norm=eq.${qe(n)}&limit=1`);
    if (ex[0]) {
      await pgUpdate(db(), 'webmarcas_agent_learned_answers', `id=eq.${ex[0].id}`, { asked_count: Number(ex[0].asked_count || 1) + 1, last_asked_at: new Date().toISOString() });
    } else {
      await pgInsert(db(), 'webmarcas_agent_learned_answers', { question_norm: n, question_sample: question.slice(0, 500), source: 'defer' });
    }
  } catch (e) { console.error('learned_log_failed', e instanceof Error ? e.message : e); }
}

async function llmAnswer(ctx: Ctx, question: string): Promise<string | null> {
  if (!E.llmEnabled || !E.llmBaseUrl || !E.llmKey) return null;
  try {
    const mem = ctx.conv.collected_data as Memory & Record<string, unknown>;
    const learnedHit = await learnedAnswerFor(question);
    if (learnedHit) return learnedHit;
    const learned = await learnedContext();
    const facts = [
      `marca: ${mem.brandName || '-'}`, `ramo: ${mem.businessArea || '-'}`,
      `etapa: ${ctx.conv.stage}`,
      `preços: PIX à vista ${PRICES.avista}; cartão ${PRICES.cartao6x}; boleto ${PRICES.boleto3x}`,
      `taxa INPI (GRU): ${str(mem._gruValor) || 'R$440 com desconto PF/MEI/Simples ou R$880 sem desconto'}; situação GRU: ${str(mem._gruStatus) || '-'}`,
      `protocolo: ${str(mem._protocol) || '-'}; cada classe é um processo cobrado à parte`,
    ].join('; ');
    const messages = [
      { role: 'system', content: 'Você é a Fernanda, da equipe WebMarcas (registro de marcas no INPI). Escreve como uma pessoa real no WhatsApp: frases curtas, naturais, calorosas; usa o nome da pessoa quando ele aparece nos fatos; REAGE ao que a pessoa manda — se ela mandou foto, comenta a foto com carinho (sem fingir que viu o conteúdo); se mandou áudio, menciona que ouviu o áudio; se ela conta algo pessoal, acolhe antes de responder. Seja específica: cite detalhes do que a pessoa disse, nunca resposta genérica de robô. No máximo 1 emoji por mensagem. Responda a pergunta do cliente em até 2 frases, em português, sem inventar dados fora dos fatos dados. Nunca negue que é uma assistente virtual se perguntarem. Não fale de política de preços fora dos fatos. Se não souber, diga que vai confirmar com o time. Se o cliente fizer objeção (preço, confiança, querer pensar), acolha com empatia em 1 frase e conduza de volta ao próximo passo, sem inventar condições nem descontos. Nunca prometa isenção de taxas do INPI. Saudações ("bom dia", "boa tarde", votos, dia da semana, emoji) e conversa fiada NUNCA são nome de marca: se a marca ainda não foi informada, trate como desconhecida e nunca use saudação como marca nas respostas; quando um texto puder ou não ser marca, a Fernanda confirma com o cliente antes de anotar. Fatos: ' + facts + (learned ? '\nRespostas aprovadas pela equipe (prioridade máxima: se a pergunta do cliente equivaler a uma delas, responda com a resposta aprovada, adaptando só o tom):\n' + learned : '') },
      { role: 'user', content: question },
    ];
    // modelos novos (gpt-5/6, o-*) podem rejeitar temperature/max_tokens: tenta completo, depois mínimo
    let r = await fetch(`${E.llmBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${E.llmKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: E.llmModel, messages, max_tokens: 220, temperature: 0.4 }),
    });
    if (!r.ok) {
      r = await fetch(`${E.llmBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${E.llmKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: E.llmModel, messages, max_completion_tokens: 400 }),
      });
    }
    if (!r.ok) { console.error('llm_failed', r.status, (await r.text()).slice(0, 200)); return null; }
    const j = await r.json().catch(() => null);
    const out = s1(j?.choices?.[0]?.message?.content);
    if (out && DEFER_OUT_RE.test(out)) await logDeferred(question);
    return out && out.length >= 3 ? out.trim() : null;
  } catch (e) { console.error('llm_error', e instanceof Error ? e.message : e); return null; }
}

async function lastAssistantText(convId: string): Promise<string> {
  try {
    const row = await pgOne(db(), 'webmarcas_agent_messages', `select=content&conversation_id=eq.${encodeURIComponent(convId)}&role=eq.assistant&order=created_at.desc&limit=1`);
    return str(row?.content);
  } catch { return ''; }
}

// captura de marca com trava cerebral: saudação rejeitada; ambíguo só salva após SIM do cliente
async function captureBrand(ctx: Ctx, candidate: string): Promise<'saved' | 'confirm' | 'rejected'> {
  const mem = ctx.conv.collected_data as Memory & Record<string, unknown>;
  const v = validateField('brandName', candidate, mem, { skipGreetGuard: ctx.dry && ctx.testNoGuard === true });
  if (v.ok) {
    mem.brandName = v.value as string;
    delete mem.pendingBrand;
    ctx.conv.collected_data = mem;
    ctx.conv.stage = 'discover_business';
    await reply(ctx, { kind: 'text', text: T.askBusiness(mem.brandName) });
    return 'saved';
  }
  if (typeof v.confirm === 'string') {
    mem.pendingBrand = v.confirm;
    ctx.conv.collected_data = mem;
    await reply(ctx, { kind: 'text', text: v.hint || T.brandConfirm(v.confirm) });
    return 'confirm';
  }
  await replyWithLlm(ctx, candidate, v.hint || T.askBrand);
  return 'rejected';
}

async function replyWithLlm(ctx: Ctx, text: string, fallback: string): Promise<void> {
  const llm = await llmAnswer(ctx, text);
  if (llm) { await reply(ctx, { kind: 'text', text: llm }); await reply(ctx, { kind: 'text', text: fallback }); return; }
  await reply(ctx, { kind: 'text', text: fallback });
}

// ── motor da conversa ────────────────────────────────────────────────────────
async function processInbound(ctx: Ctx, text: string) {
  const conv = ctx.conv;
  let mem = conv.collected_data as Memory;
  const beforeMem = { ...mem };
  mem = sweepMemory(mem, text);
  const sweptKeys = (['fullName', 'cpf', 'cep', 'email', 'cnpj'] as const).filter(
    (k) => (mem as Record<string, unknown>)[k] !== (beforeMem as Record<string, unknown>)[k]
  );
  if (!mem.firstName && mem.fullName) mem.firstName = firstName(mem.fullName);
  conv.collected_data = mem;
  const stage = conv.stage || 'new';

  // confirmação de marca ambígua (cérebro): SIM/NÃO/correção antes de qualquer intercept
  if (stage === 'discover_brand') {
    const memP = mem as Memory & Record<string, unknown>;
    const pend0 = str(memP.pendingBrand);
    if (pend0) {
      const ttP = text.trim().toLowerCase();
      if (/^(sim|s|isso|isso mesmo|exato|exatamente|correto|certo|certinho|essa|essa mesma|confirmo|pode ser|ok|claro)\b[\s!.]*$/i.test(ttP)) {
        mem.brandName = pend0;
        delete memP.pendingBrand;
        conv.collected_data = mem;
        conv.stage = 'discover_business';
        await reply(ctx, { kind: 'text', text: T.askBusiness(pend0) });
        return;
      }
      if (/^(n[aã]o|nope|errado|errada)\b/i.test(ttP)) {
        delete memP.pendingBrand;
        conv.collected_data = mem;
        await reply(ctx, { kind: 'text', text: 'Sem problema! Qual é o nome exato da sua marca?' });
        return;
      }
      if (isGreetingish(text)) { await reply(ctx, { kind: 'text', text: T.brandConfirm(pend0) }); return; }
      delete memP.pendingBrand;
      conv.collected_data = mem; // texto novo = novo candidato
    }
  }

  const SOFT_NO_RE = /^(n[aã]o\b.*|agora n[aã]o.*|depois.*|ainda n[aã]o.*|sem interesse.*|talvez depois.*|deixa pra l[aá].*)$/i;
  const EARLY = ['new', 'discover_brand', 'discover_business', 'search_running', 'confirm_interest'];
  if (stage !== 'closed' && EARLY.includes(stage) && SOFT_NO_RE.test(text.trim()) && /(n[aã]o|depois|sem interesse)/i.test(text) && !QUESTION_RE.test(text) && text.trim().length < 60) {
    await reply(ctx, { kind: 'text', text: 'Sem pressa! Fico por aqui — quando quiser seguir com o registro da sua marca, é só me avisar 😊' });
    return;
  }
  if (OPTOUT_RE.test(text) && stage !== 'closed') {
    conv.stage = 'closed';
    await reply(ctx, { kind: 'text', text: T.optout });
    return;
  }
  if (stage === 'closed') return;
  if (stage === 'waiting_caroline') {
    await reply(ctx, { kind: 'text', text: T.carolineAgain });
    return;
  }
  // continuação do roteiro de valores (Davilys 21/09): dúvida? -> sequência? -> coleta
  const pricingFlow = str((mem as Record<string, unknown>)._pricingFlow || '');
  if (pricingFlow === 'asked_duvida' || pricingFlow === 'asked_go') {
    const tt = text.toLowerCase().trim();
    const isQuestion = QUESTION_RE.test(text) || /(dúvida|duvida|pergunta|explica|como assim|não entendi|nao entendi|tenho uma)/i.test(tt);
    const isNo = /^(n[aã]o\b|nada\b|nenhum[ao]?\b|sem d[uú]vida|tudo (ok|certo|bem|perfeito|tranquilo)|ok(ay)?\b|certo\b|entendi\b|perfeito\b|show\b|beleza\b|tranquilo\b)/i.test(tt);
    const isYes = /^(sim\b|bora\b|vamos\b|quero\b|claro\b|com certeza|isso\b|ok(ay)?\b|pode\b|aceito\b|tenho interesse)/i.test(tt);
    if (pricingFlow === 'asked_duvida') {
      if (!isQuestion && isYes && /(quero|bora|vamos|registr|inici|começ|sequencia|sequência|segue|pode)/i.test(tt)) {
        delete (mem as Record<string, unknown>)._pricingFlow;
        conv.collected_data = mem;
        await pricingGo(ctx, stage, mem);
        return;
      }
      if (!isQuestion && (isNo || isYes)) {
        (mem as Record<string, unknown>)._pricingFlow = 'asked_go';
        conv.collected_data = mem;
        await reply(ctx, { kind: 'text', text: 'Perfeito! Vamos dar sequência ao processo de registro?' });
        return;
      }
      delete (mem as Record<string, unknown>)._pricingFlow;
      conv.collected_data = mem;
    } else {
      if (!isQuestion && isYes) {
        delete (mem as Record<string, unknown>)._pricingFlow;
        conv.collected_data = mem;
        await pricingGo(ctx, stage, mem);
        return;
      }
      if (!isQuestion && isNo) {
        delete (mem as Record<string, unknown>)._pricingFlow;
        conv.collected_data = mem;
        await reply(ctx, { kind: 'text', text: 'Sem pressa! Fico por aqui — quando quiser seguir com o registro, é só me avisar 😊' });
        return;
      }
      delete (mem as Record<string, unknown>)._pricingFlow;
      conv.collected_data = mem;
    }
  }
  // agradecimento puro: acolhe com carinho e retoma o passo atual
  if (/^(obrigad[oa]s?|muito obrigad[oa]s?|valeu+|[aá]mei|maravilha|perfeito|show|top( demais)?|que (bom|ótimo|otimo|maravilha)|brigad[oa]ã?o)[!.,\s]*$/i.test(text.trim())) {
    await replyWithLlm(ctx, text, 'Imagina! 😊');
    await reAsk(ctx, stage, mem);
    return;
  }

  // identidade: nunca nega que é IA quando perguntada diretamente
  if (AI_IDENTITY_RE.test(text)) {
    await reply(ctx, { kind: 'text', text: T.aiIdentity });
    await reAsk(ctx, stage, mem);
    return;
  }

  // perguntas frequentes respondidas na hora, depois retoma o roteiro
  if (stage === 'new') {
    conv.stage = 'discover_brand';
    await reply(ctx, { kind: 'text', text: T.welcome(ctx.fn) });
    await reply(ctx, { kind: 'audio', url: AUDIO_1, mime: 'audio/mpeg' });
    await reply(ctx, { kind: 'audio', url: AUDIO_2, mime: 'audio/mpeg' });
    await reply(ctx, { kind: 'text', text: T.askBrand });
    const faqNew = await faqAnswer(ctx, text);
    if (faqNew) return;
    if (!QUESTION_RE.test(text)) { await captureBrand(ctx, text); return; }
    if (QUESTION_RE.test(text)) {
      const llmN = await llmAnswer(ctx, text);
      if (llmN) await reply(ctx, { kind: 'text', text: llmN });
      else {
        await logDeferred(text);
        await reply(ctx, { kind: 'text', text: T.questionDefer });
      }
      await reply(ctx, { kind: 'text', text: T.askBrand });
    }
    return;
  }
  const faq = await faqAnswer(ctx, text);
  if (faq === 'pricing') return;
  if (faq) {
    await reAsk(ctx, stage, mem);
    return;
  }

  // objeções (preço, pensar, confiança): LLM acolhe e conduz; fallback empático sem inventar condição
  const OBJECTION_RE = /(muito caro|t[aá] caro|ach[oe]i caro|preço alto|sem condiç|n[aã]o tenho (dinheiro|como)|vou pensar|deixa eu pensar|preciso pensar|pensar melhor|depois (eu )?(te )?(aviso|falo|retorno)|é golpe|ser golpe|desconfi|n[aã]o confio|confi[aá]vel|medo de)/i;
  if (OBJECTION_RE.test(text) && !['closed', 'waiting_caroline'].includes(stage)) {
    await replyWithLlm(ctx, text, 'Entendo! Fica tranquilo, sem pressa 😊 Qualquer dúvida é só me chamar por aqui.');
    return;
  }

  // outras perguntas: LLM responde quando habilitado (custo aprovado); senão, defer humano
  if (QUESTION_RE.test(text) && !['closed', 'waiting_caroline'].includes(stage) && !(stage === 'contract_link_sent' && /(link|contrato|assinatura|assinar)/i.test(text))) {
    const llm = await llmAnswer(ctx, text);
    if (llm) {
      await reply(ctx, { kind: 'text', text: llm });
      await reAsk(ctx, stage, mem);
      return;
    }
    if (['collecting', 'ready_for_contract', 'discover_brand', 'discover_business'].includes(stage)) {
      await logDeferred(text);
      await reply(ctx, { kind: 'text', text: T.questionDefer });
      await reAsk(ctx, stage, mem);
      return;
    }
  }

  if (CAROLINE_RE.test(text) && !['contract_link_sent', 'ready_for_contract'].includes(stage)) {
    mem.carolineReason = 'complex_legal_matter';
    conv.collected_data = mem;
    conv.stage = 'waiting_caroline';
    await reply(ctx, { kind: 'text', text: T.caroline });
    return;
  }

  switch (stage) {
    case 'new': {
      conv.stage = 'discover_brand';
      await reply(ctx, { kind: 'text', text: T.welcome(ctx.fn) });
      await reply(ctx, { kind: 'audio', url: AUDIO_1, mime: 'audio/mpeg' });
      await reply(ctx, { kind: 'audio', url: AUDIO_2, mime: 'audio/mpeg' });
      if (!QUESTION_RE.test(text)) {
        const outNew = await captureBrand(ctx, text);
        if (outNew === 'rejected') await reply(ctx, { kind: 'text', text: T.askBrand });
      } else {
        await reply(ctx, { kind: 'text', text: T.askBrand });
      }
      return;
    }
    case 'discover_brand': {
      await captureBrand(ctx, text);
      return;
    }
    case 'discover_business': {
      const v = validateField('businessArea', text, mem);
      if (!v.ok) { await replyWithLlm(ctx, text, v.hint || T.askBusiness(mem.brandName || 'sua marca')); return; }
      mem.businessArea = v.value as string;
      conv.collected_data = mem;
      conv.stage = 'search_running';
      await reply(ctx, { kind: 'text', text: T.searchStart(mem.brandName || '') });
      if (ctx.dry && /FALHA_BUSCA/i.test(mem.brandName || '')) { await searchUnavailable(ctx, 1); return; }
      if (ctx.dry) { await deliverSearchAndAdvance(ctx, null); return; }
      const jobId = await inpiStart(mem.brandName || '', mem.businessArea, conv.phone);
      if (!jobId) {
        conv.pending_action = { type: 'search_retry', attempts: 1, at: new Date().toISOString() };
        await reply(ctx, { kind: 'text', text: T.searchFailed(mem.brandName || '') });
        return;
      }
      const deadline = Date.now() + 35_000;
      let st: { status: string; pdf_url: string | null } | null = null;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 4000));
        st = await inpiStatus(jobId);
        if (st && ['completed', 'inconclusive', 'failed'].includes(st.status)) break;
      }
      if (st && st.status === 'completed' && st.pdf_url) {
        await deliverSearchAndAdvance(ctx, st.pdf_url);
      } else if (st && ['inconclusive', 'failed', 'completed'].includes(st.status)) {
        await searchUnavailable(ctx, 1);
      } else {
        conv.pending_action = { type: 'search_wait', job_id: jobId, at: new Date().toISOString() };
      }
      return;
    }
    case 'search_running': {
      await reply(ctx, { kind: 'text', text: T.searchRunning(mem.brandName || 'sua marca') });
      return;
    }
    case 'confirm_interest': {
      const ttI = text.toLowerCase().trim();
      const yesI = /^(sim\b|bora\b|vamos\b|quero\b|claro\b|com certeza|isso\b|ok(ay)?\b|pode\b|aceito\b|tenho interesse|pode ser|fechado\b|bora la|bora lá)/i.test(ttI);
      const noI = /^(n[aã]o\b|nada\b|agora n[aã]o|depois|ainda n[aã]o|sem interesse|n[aã]o tenho interesse)/i.test(ttI);
      if (yesI) {
        conv.stage = 'collecting';
        const fI = nextMissingField(mem);
        const openI = fI ? `${T.collectionOpening}\n\n${fieldQuestion(fI, mem)}` : T.collectionOpening;
        await reply(ctx, { kind: 'text', text: openI });
        return;
      }
      if (noI) {
        await reply(ctx, { kind: 'text', text: 'Sem pressa! Fico por aqui — quando quiser iniciar o registro, é só me avisar 😊' });
        return;
      }
      const greetOnly = /^((oi+|ol[aá]|opa|hey|hello|bom dia|boa tarde|boa noite|eae|e a[ií])\b[\s\p{P}\p{So}]*)$/iu.test(ttI);
      if (greetOnly) {
        const lastA = await lastAssistantText(ctx.conv.conversation_id);
        const resume = `Oi${mem.firstName ? ', ' + mem.firstName : ''}! Você tem interesse em seguir com o registro da marca ${mem.brandName || 'sua marca'}? 😊`;
        const alt = `Estou por aqui! Me confirma se quer seguir com o registro da ${mem.brandName || 'sua marca'} 😊`;
        await reply(ctx, { kind: 'text', text: lastA === resume ? alt : resume });
        return;
      }
      const hadDoubt = QUESTION_RE.test(text) || text.includes('?');
      await replyWithLlm(ctx, text, hadDoubt ? T.interestReAsk : T.interestReAskNeutral);
      return;
    }
    case 'collecting': {
      const field = nextMissingField(mem);
      if (!field) {
        conv.stage = 'ready_for_contract';
        await finalizeContract(ctx);
        return;
      }
      if (sweptKeys.length > 0) {
        const ack = sweptKeys.includes('fullName') && mem.firstName
          ? `Prazer, ${mem.firstName}! Anotei.`
          : 'Perfeito, anotei!';
        const nxt = nextMissingField(mem);
        if (!nxt) {
          conv.stage = 'ready_for_contract';
          await finalizeContract(ctx);
          return;
        }
        await reply(ctx, { kind: 'text', text: `${ack} ${fieldQuestion(nxt, mem)}` });
        return;
      }
      if (field === 'addressNumber' && /^\s*\d{5}-?\d{3}\s*$/.test(text)) {
        const novoCep = digitsOf(text);
        const corrigindo = mem.cep && mem.cep !== novoCep;
        mem.cep = novoCep;
        conv.collected_data = mem;
        await reply(ctx, { kind: 'text', text: `${corrigindo ? 'Atualizei seu CEP' : 'Anotei o CEP'}: ${text.trim()}! ${fieldQuestion('addressNumber', mem)}` });
        return;
      }
      const v = validateField(field, text, mem);
      if (!v.ok) { await replyWithLlm(ctx, text, v.hint || fieldQuestion(field, mem)); return; }
      (mem as Record<string, unknown>)[field] = v.value;
      if (field === 'fullName') mem.firstName = firstName(v.value as string);
      conv.collected_data = mem;
      const next = nextMissingField(mem);
      if (!next) {
        conv.stage = 'ready_for_contract';
        await finalizeContract(ctx);
        return;
      }
      await reply(ctx, { kind: 'text', text: fieldQuestion(next, mem) });
      return;
    }
    case 'ready_for_contract': {
      if (conv.pending_action && str((conv.pending_action as Record<string, unknown>).type) === 'contract_retry') {
        // já avisado da instabilidade: não repete nem dispara nova tentativa síncrona (o cron retenta)
        await reply(ctx, { kind: 'text', text: T.contractRetryStill });
        return;
      }
      await finalizeContract(ctx);
      return;
    }
    case 'contract_link_sent': {
      const url = str((conv.collected_data as Record<string, unknown>).contract_url);
      if (/(j[aá] )?assinei|assinado|terminei (de|d) assinar|contrato assinado/i.test(text)) {
        if (ctx.dry) {
          conv.stage = 'procuracao_sent';
          await reply(ctx, { kind: 'text', text: T.procuracaoIntro(firstName(mem.fullName) || ctx.fn, 'https://example.invalid/assinar/PROC-TESTE') });
          return;
        }
        if (E.phase2Live) {
          await reply(ctx, { kind: 'text', text: T.gruCheckSignature });
          return;
        }
        // produção: fase 2 ainda desligada — cai no fluxo aprovado abaixo
      }
      if (/(link|contrato|assinatura|assinar)/i.test(text) && url) {
        await reply(ctx, { kind: 'text', text: T.contractLinkAgain(url) });
      } else {
        const alt = 'Estou por aqui! O contrato já te espera no link acima 😊';
        const same = ctx.lastText.replace(/\s+/g, ' ').trim() === T.afterContract.replace(/\s+/g, ' ').trim();
        await reply(ctx, { kind: 'text', text: same ? alt : T.afterContract });
      }
      return;
    }
    case 'procuracao_sent': {
      if (/(j[aá] )?assinei|assinado|enviei (a )?procura|procura[cç][aã]o assinada/i.test(text)) {
        if (E.phase2Live && !ctx.dry) {
          await reply(ctx, { kind: 'text', text: T.gruCheckSignature });
          return;
        }
        const valor = mem.cnpj ? 'R$880,00' : 'R$440,00';
        (mem as Record<string, unknown>)._gruValor = valor;
        (mem as Record<string, unknown>)._gruStatus = 'emitida (SIMULADA)';
        conv.collected_data = mem;
        conv.stage = 'gru_issued';
        await reply(ctx, { kind: 'text', text: T.gruIssued(valor) });
        return;
      }
      await replyWithLlm(ctx, text, T.procuracaoWait);
      return;
    }
    case 'gru_issued': {
      if (/(paguei|pagamento (feito|confirmado|realizado)|quitei|liquidei|j[aá] paguei)/i.test(text)) {
        if (E.phase2Live && !ctx.dry) {
          conv.pending_action = { type: 'gru_verify', at: new Date().toISOString() };
          await reply(ctx, { kind: 'text', text: T.gruWaitBank });
          return;
        }
        await advanceToPreview(ctx, mem);
        return;
      }
      await replyWithLlm(ctx, text, T.gruWait);
      return;
    }
    case 'preview_sent': {
      const okGo = /(pode protocolar|protocolar|tudo certo|est[aá] certo|correto|confirmo|pode enviar|autorizo|de acordo)/i.test(text) && !/(n[aã]o|errad|incorret|espera|aguarda|segura)/i.test(text);
      const hold = /(n[aã]o protocola|espera|aguarda|segura|n[aã]o envia|cancela)/i.test(text);
      const fix = /(errad|incorret|trocar|mudou|corrig|atualiz|arruma)/i.test(text);
      if (hold) {
        conv.stage = 'preview_hold';
        await reply(ctx, { kind: 'text', text: T.previewHold });
        return;
      }
      if (okGo && !(mem as Record<string, unknown>)._logo) {
        await reply(ctx, { kind: 'text', text: 'Quase lá! Antes do protocolo eu preciso do logotipo da marca — me envia a imagem por aqui (qualquer formato, eu converto pra JPEG) 😊' });
        return;
      }
      if (okGo && E.phase2Live && !ctx.dry) {
        conv.pending_action = { type: 'protocol_file', at: new Date().toISOString() };
        await reply(ctx, { kind: 'text', text: T.protocolFiling });
        return;
      }
      if (okGo) {
        const proto = `900 ${String(Math.floor(100 + Math.random() * 900))} ${String(Math.floor(100 + Math.random() * 900))}`;
        const data = new Date().toLocaleDateString('pt-BR');
        (mem as Record<string, unknown>)._protocol = proto;
        (mem as Record<string, unknown>)._gruStatus = 'paga (SIMULADA)';
        conv.collected_data = mem;
        conv.stage = 'protocol_done';
        await reply(ctx, { kind: 'text', text: T.protocolDone(proto, data) });
        await reply(ctx, { kind: 'text', text: T.afterProtocol });
        conv.stage = 'active_monitoring';
        return;
      }
      if (fix) {
        const after = { ...sweepMemory(mem, text) } as Memory;
        const cepF = text.match(/\b\d{5}-?\d{3}\b/);
        if (cepF && /cep|endereç|endereco/i.test(text)) (after as Record<string, unknown>).cep = digitsOf(cepF[0]);
        const numF = text.match(/n[uú]mero\D{0,12}(\d{1,6})/i);
        if (numF) (after as Record<string, unknown>).addressNumber = numF[1];
        const emF = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
        if (emF) (after as Record<string, unknown>).email = emF[0].toLowerCase();
        const cpfF = text.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
        if (cpfF && isValidCpf(cpfF[0])) (after as Record<string, unknown>).cpf = digitsOf(cpfF[0]);
        const changed = JSON.stringify(after) !== JSON.stringify(mem);
        conv.collected_data = after;
        if (changed) {
          await reply(ctx, { kind: 'text', text: 'Ajustei aqui! Confere de novo:' });
          await reply(ctx, { kind: 'text', text: filingPreviewText(after) });
          await reply(ctx, { kind: 'text', text: T.previewAsk });
        } else {
          await replyWithLlm(ctx, text, 'Me fala qual dado está errado (nome, CPF, CEP, número, e-mail, marca ou classes) que eu corrijo já 😊');
        }
        return;
      }
      await replyWithLlm(ctx, text, T.previewAsk);
      return;
    }
    case 'preview_hold': {
      if (/(pode protocolar|protocolar|autorizo|pode enviar)/i.test(text)) {
        conv.stage = 'preview_sent';
        await reply(ctx, { kind: 'text', text: 'Perfeito! Retomando:' });
        await reply(ctx, { kind: 'text', text: filingPreviewText(mem) });
        await reply(ctx, { kind: 'text', text: T.previewAsk });
        return;
      }
      await replyWithLlm(ctx, text, T.previewHold);
      return;
    }
    case 'protocol_done':
    case 'active_monitoring': {
      await replyWithLlm(ctx, text, T.afterProtocol);
      return;
    }
    default: {
      // estágio desconhecido: retoma para coleta se houver dados, senão recomeça
      conv.stage = mem.brandName ? 'collecting' : 'discover_brand';
      await reply(ctx, { kind: 'text', text: mem.brandName ? T.collectionOpening : T.askBrand });
      if (mem.brandName) {
        const f = nextMissingField(mem);
        if (f) await reply(ctx, { kind: 'text', text: fieldQuestion(f, mem) });
      }
      return;
    }
  }
}

// ── processamento de um evento da inbox ──────────────────────────────────────
async function processEvent(ev: {
  id: string; conversation_id: string; phone: string; message_type: string; message: string;
  contact_name?: string | null; media?: { url: string; metadata: Record<string, unknown> | null } | null;
}, dry: boolean, zendaPreflight?: { convId: string; unread: number }): Promise<Record<string, unknown>> {
  const phoneDigits = digitsOf(ev.phone);
  const rawPhone = ev.phone.startsWith('+') ? ev.phone : `+${ev.phone}`;

  // 1) espelho no Zenda (contato/conversa/mensagem inbound)
  let zConvId = zendaPreflight?.convId ?? null;
  let zUnread = zendaPreflight?.unread ?? 0;
  if (!zConvId) {
    const c = await zFindContact(rawPhone, ev.contact_name ?? null);
    const cv = await zFindConversation(c.contactId);
    zConvId = cv.conversationId; zUnread = cv.unread;
    await zTouchContact(c.contactId);
  }
  const inboundPreview = ev.message_type === 'audio_transcript' ? '🎤 Áudio' : ev.message.slice(0, 120);
  await zInsertMessage({
    conversationId: zConvId, direction: 'inbound',
    type: ev.message_type === 'audio_transcript' ? 'audio' : 'text',
    body: ev.message_type === 'audio_transcript' ? ev.message : ev.message,
    mediaUrl: null, mediaMeta: ev.message_type === 'audio_transcript' ? { is_voice: true, transcript: true } : null,
    providerId: `stevo_in_${ev.id}`,
  });
  await zTouchConversation(zConvId, inboundPreview, true, zUnread);

  // 2) gate do pause do Inbox
  if (await zIsPaused(zConvId)) {
    return { processed: false, reason: 'bot_paused' };
  }

  // 3) carrega/cria conversa do agente
  let conv = await loadConv(ev.conversation_id);
  if (!conv) {
    conv = {
      conversation_id: ev.conversation_id, subscriber_id: ev.conversation_id, phone: phoneDigits,
      stage: 'new', summary: '', collected_data: {}, pending_action: null,
    };
  }
  (conv.collected_data as Record<string, unknown>)._zenda_conversation_id = zConvId;

  const ctx: Ctx = { conv, dry, zConvId, zUnread, phoneDigits, fn: firstName(ev.contact_name ?? ''), sent: [], lastText: '', eventId: ev.id, sendSeq: 0 };
  await processInbound(ctx, ev.message);
  await saveConv(ctx.conv);

  // 4) follow-ups: reancora após resposta, exceto estágios terminais
  if (!['closed', 'contract_link_sent', 'waiting_caroline'].includes(ctx.conv.stage) && !dry) {
    await scheduleFollowups(ctx.conv.conversation_id);
  }
  return { processed: true, stage: ctx.conv.stage, sent: ctx.sent };
}

// ── handler HTTP ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET') return new Response('ok', { status: 200 });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  // ações administrativas (webhook da instância) — segredo do cron
  const cronSecret = req.headers.get('x-cron-secret') || '';
  if (cronSecret) {
    if (!E.cronSecret || !safeEqual(cronSecret, E.cronSecret)) return json({ error: 'Não autorizado' }, 401);
    const b = await req.json().catch(() => ({}));
    const action = str(b.action);
    const headers = { Authorization: `Bearer ${E.stevoKey}`, 'Content-Type': 'application/json' };
    if (action === 'get_webhook') {
      const r = await fetch(`${E.stevoBase}/v1/instances/${encodeURIComponent(E.stevoInstance)}/webhook`, { headers });
      return json({ status: r.status, body: await r.json().catch(() => null) });
    }
    if (action === 'react_test') {
      const convId = str(b.conversation_id) || '';
      const emoji = str(b.emoji) === 'REMOVE' ? '' : (str(b.emoji) || '👂');
      if (!/^\d{10,15}$/.test(convId)) return json({ error: 'conversation_id inválido (só dígitos)' }, 400);
      const rows = await pgSelect(db(), 'webmarcas_agent_inbox', `select=event_id,message_type,status,created_at&conversation_id=eq.${qe(convId)}&order=created_at.desc&limit=10`);
      const target = rows.find(r => str(r.message_type) === 'audio_transcript') || rows[0];
      if (!target) return json({ error: 'nenhum evento encontrado', conversation_id: convId }, 404);
      const pid = (str(target.event_id) || '').replace(/^stevo_/, '');
      const res = await stevoReact(convId, pid, emoji);
      return json({ event_id: target.event_id, message_type: target.message_type, provider_id_used: pid, to: convId, stevo: res });
    }
    if (action === 'tag_check') {
      const ph = digitsOf(str(b.phone));
      return json({ phone: ph, ja_e_cliente: ph ? await zHasJaECliente(ph) : null });
    }
    if (action === 'llm_models') {
      if (!E.llmKey) return json({ error: 'sem chave LLM no ambiente' }, 400);
      const r = await fetch(`${E.llmBaseUrl}/models`, { headers: { Authorization: `Bearer ${E.llmKey}` } });
      const j = await r.json().catch(() => null);
      const ids = ((j?.data ?? []) as Array<Record<string, unknown>>).map(m => str(m.id)).filter(Boolean) as string[];
      const chat = ids.filter(id => /gpt|o[1-9]|chat/i.test(id) && !/audio|tts|whisper|embed|moderation|image|dall|search|transcribe|realtime.*mini/i.test(id)).sort();
      return json({ status: r.status, total: ids.length, chat_models: chat });
    }
    if (action === 'store_media') {
      const name = str(b.name) || '';
      const b64 = str(b.data_base64) || '';
      if (!/^[a-z0-9][a-z0-9.\-]{1,80}$/i.test(name) || !b64) return json({ error: 'name/data_base64 inválidos' }, 400);
      const bucket = 'fernanda';
      await fetch(`${E.url}/storage/v1/bucket`, { method: 'POST', headers: { apikey: E.key, Authorization: `Bearer ${E.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: bucket, name: bucket, public: true }) }).catch(() => null);
      const bytes = b64ToBytes(b64);
      const up = await fetch(`${E.url}/storage/v1/object/${bucket}/${name}`, { method: 'POST', headers: { apikey: E.key, Authorization: `Bearer ${E.key}`, 'Content-Type': 'audio/ogg', 'x-upsert': 'true' }, body: bytes });
      const upBody = (await up.text()).slice(0, 300);
      const pub = `${E.url}/storage/v1/object/public/${bucket}/${name}`;
      const head = await fetch(pub, { method: 'HEAD' }).catch(() => null);
      return json({ upload_status: up.status, upload_body: upBody, public_url: pub, public_ok: head ? head.ok : false, bytes: bytes.length });
    }
    if (action === 'react_probe') {
      const phone = str(b.phone).replace(/\D/g, '');
      const mid = str(b.message_id);
      const emoji = str(b.emoji) === 'REMOVE' ? '' : (str(b.emoji) || '👂');
      if (!phone || !mid) return json({ error: 'phone/message_id obrigatórios' }, 400);
      const res = await stevoReact(phone, mid, emoji, str(b.emoji) === 'REMOVE');
      return json(res);
    }
    if (action === 'search_probe') {
      const brand = str(b.brand); const activity = str(b.activity) || 'serviços';
      if (!brand) return json({ error: 'brand obrigatório' }, 400);
      const sr = await fetch(`${E.inpiBase}/v1/searches`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${E.inpiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idemKey('wm:probe', brand, activity), Accept: 'application/json' },
        body: JSON.stringify({ brand, activity, subscriber_id: 'probe-admin' }),
      });
      if (!sr.ok) return json({ ok: false, stage: 'start_failed', http: sr.status, body: (await sr.text()).slice(0, 400), base: E.inpiBase ? 'set' : 'MISSING', key: E.inpiKey ? 'set' : 'MISSING' });
      const sj = await sr.json().catch(() => null);
      const jobId = s1(sj?.job_id) ?? s1(sj?.id);
      if (!jobId) return json({ ok: false, stage: 'no_job_id', raw: sj });
      const deadline = Date.now() + 110_000;
      let st: { status: string; pdf_url: string | null; raw?: unknown } | null = null;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 6000));
        st = await inpiStatus(jobId);
        if (st && ['completed', 'inconclusive', 'failed'].includes(st.status)) break;
      }
      return json({ ok: true, job_id: jobId, final: st });
    }
    if (action === 'set_webhook') {
      const target = str(b.url);
      if (!/^https:\/\//.test(target)) return json({ error: 'url inválida' }, 400);
      // 1) detalhe da instância na API central → server_url + token do servidor SM v2
      const dr = await fetch(`${E.stevoBase}/v1/instances/${encodeURIComponent(E.stevoInstance)}`, { headers });
      const dj = await dr.json().catch(() => null);
      const dd = asRec(asRec(dj).data ?? dj);
      const serverUrl = (s1(dd.server_url) || '').replace(/\/+$/, '');
      const serverToken = s1(dd.token) || '';
      const attempts: Array<Record<string, unknown>> = [];
      // 2) rota primária: POST {server}/instance/connect com webhookUrl + subscribe
      if (serverUrl && serverToken) {
        const payload = { webhookUrl: target, webhook_url: target, url: target, immediate: true, subscribe: ['MESSAGE', 'READ_RECEIPT'], webhook: { url: target, enabled: true, events: ['MESSAGE', 'READ_RECEIPT'] } };
        const cr = await fetch(`${serverUrl}/instance/connect`, { method: 'POST', headers: { apikey: serverToken, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        attempts.push({ route: 'instance/connect', status: cr.status, body: await cr.text().then(t => t.slice(0, 200)) });
        const sr = await fetch(`${serverUrl}/webhook/set`, { method: 'POST', headers: { apikey: serverToken, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => null);
        if (sr) attempts.push({ route: 'webhook/set', status: sr.status, body: await sr.text().then(t => t.slice(0, 200)) });
      } else {
        attempts.push({ route: 'instance_detail', status: dr.status, server_url_found: !!serverUrl, token_found: !!serverToken });
      }
      // 3) verificação via API central
      const vr = await fetch(`${E.stevoBase}/v1/instances/${encodeURIComponent(E.stevoInstance)}/webhook`, { headers });
      const vj = await vr.json().catch(() => null);
      return json({ attempts, verify: vj });
    }
    if (action === 'worker' || action === '') {
      const summary = await runWorker();
      return json({ ok: true, worker: summary });
    }
    return json({ error: 'ação desconhecida' }, 400);
  }

  // webhook da Stevo — token opaco na query
  const token = url.searchParams.get('token') || req.headers.get('x-webhook-token') || '';
  if (!E.hookSecret || !safeEqual(token, E.hookSecret)) return json({ error: 'Não autorizado' }, 401);

  let payload: unknown;
  try { payload = await req.json(); } catch { return json({ error: 'Corpo JSON inválido' }, 400); }
  const dry = req.headers.get('x-fernanda-dry-run') === '1';
  const testNoGuard = dry && req.headers.get('x-fernanda-test-noguard') === '1';

  const inbound = normalizeStevo(payload).filter(m => !m.from_me && !m.is_group);
  const results: Array<Record<string, unknown>> = [];
  const batches = new Map<string, { phoneDigits: string; contactName: string | null; n: number }>();

  for (const msg of inbound) {
    try {
      // áudio: baixa, descriptografa e transcreve antes de ingerir
      let text = msg.body || '';
      let messageType = 'text';
      if (msg.type === 'audio') {
        messageType = 'audio_transcript';
        const meta = msg.media_metadata || {};
        const mediaKey = str(meta.mediaKey);
        if (msg.media_url && mediaKey && /whatsapp\.net\//i.test(msg.media_url)) {
          try {
            const bytes = await decryptWaMedia(msg.media_url, mediaKey, 'audio');
            const mime = str(meta.mimetype) || 'audio/ogg';
            text = (await transcribeAudio(bytes, mime)) || '';
          } catch (e) {
            text = '';
            console.error('audio_pipeline_failed', e instanceof Error ? e.message : e);
          }
        } else if (msg.media_url && !/whatsapp\.net\//i.test(msg.media_url)) {
          try {
            const res = await fetch(msg.media_url);
            const bytes = new Uint8Array(await res.arrayBuffer());
            text = (await transcribeAudio(bytes, str(meta.mimetype) || 'audio/ogg')) || '';
          } catch { text = ''; }
        }
      } else if (msg.type !== 'text' && msg.type !== 'reaction') {
        text = '';
      }
      if (msg.type === 'reaction') { results.push({ skipped: 'reaction' }); continue; }

      const phoneDigits = digitsOf(msg.from_phone);
      const conversationId = phoneDigits;
      if (EXCLUDED_PHONES.has(phoneDigits)) {
        // número excluído (ex.: remetente interno): espelha no Zenda, nunca aciona a Fernanda
        try {
          const c = await zFindContact(`+${phoneDigits}`, msg.contact_name);
          const cv = await zFindConversation(c.contactId);
          await zInsertMessage({
            conversationId: cv.conversationId, direction: 'inbound',
            type: msg.type === 'audio' ? 'audio' : 'text', body: text || msg.body,
            mediaUrl: null, mediaMeta: null, providerId: `stevo_${msg.provider_message_id}`,
          });
          await zTouchConversation(cv.conversationId, (text || msg.body).slice(0, 120), true, cv.unread);
        } catch (e) { console.error('excluded_mirror_failed', e instanceof Error ? e.message : String(e)); }
        results.push({ skipped: 'excluded_phone' });
        continue;
      }
      if (msg.type !== 'text' && msg.type !== 'audio') {
        // mídia não suportada: espelha e responde pedindo texto
        const c = await zFindContact(`+${phoneDigits}`, msg.contact_name);
        const cv = await zFindConversation(c.contactId);
        await zInsertMessage({
          conversationId: cv.conversationId, direction: 'inbound', type: msg.type,
          body: msg.body, mediaUrl: null, mediaMeta: msg.media_metadata, providerId: `stevo_${msg.provider_message_id}`,
        });
        await zTouchConversation(cv.conversationId, msg.type === 'image' ? '📷 Imagem' : msg.type === 'video' ? '🎬 Vídeo' : '📎 Arquivo', true, cv.unread);
        if (!(await zIsPaused(cv.conversationId))) {
          let conv = await loadConv(conversationId);
          if (!conv) conv = { conversation_id: conversationId, subscriber_id: conversationId, phone: phoneDigits, stage: 'new', summary: '', collected_data: {}, pending_action: null };
          (conv.collected_data as Record<string, unknown>)._zenda_conversation_id = cv.conversationId;
          const ctx: Ctx = { conv, dry, zConvId: cv.conversationId, zUnread: cv.unread, phoneDigits, fn: firstName(msg.contact_name ?? ''), sent: [], lastText: '' };
          if (msg.type === 'image') { if (dry) await storeAssistant(conversationId, '[reacao:❤️]'); else await stevoReact(phoneDigits, msg.provider_message_id, '❤️'); }
          if (conv.stage === 'gru_issued' && (msg.type === 'image' || msg.type === 'file')) {
            await advanceToPreview(ctx, conv.collected_data as Memory);
          } else if (conv.stage === 'preview_sent' && msg.type === 'image') {
            const memM = conv.collected_data as Memory & Record<string, unknown>;
            memM._logo = true;
            conv.collected_data = memM;
            await reply(ctx, { kind: 'text', text: 'Logotipo recebido! ✓ Confere o resumo atualizado:' });
            await reply(ctx, { kind: 'text', text: filingPreviewText(memM) });
            await reply(ctx, { kind: 'text', text: T.previewAsk });
          } else {
            await reply(ctx, { kind: 'text', text: msg.type === 'image' ? T.mediaImage : T.mediaUnsupported });
          }
          await saveConv(ctx.conv);
        }
        results.push({ processed: true, kind: 'unsupported_media' });
        continue;
      }

      if (!text && msg.type === 'audio') {
        const c = await zFindContact(`+${phoneDigits}`, msg.contact_name);
        const cv = await zFindConversation(c.contactId);
        if (!(await zIsPaused(cv.conversationId))) {
          let conv = await loadConv(conversationId);
          if (!conv) conv = { conversation_id: conversationId, subscriber_id: conversationId, phone: phoneDigits, stage: 'new', summary: '', collected_data: {}, pending_action: null };
          (conv.collected_data as Record<string, unknown>)._zenda_conversation_id = cv.conversationId;
          const ctx: Ctx = { conv, dry, zConvId: cv.conversationId, zUnread: cv.unread, phoneDigits, fn: firstName(msg.contact_name ?? ''), sent: [], lastText: '' };
          await reply(ctx, { kind: 'text', text: T.audioFail });
          await saveConv(ctx.conv);
        }
        results.push({ processed: true, kind: 'audio_untranscribed' });
        continue;
      }

      // ingere idempotente (cancela follow-ups no inbound real); processamento sai em lote por conversa
      const { data: isNew, error: ingErr } = await pgRpc(db(), 'ingest_webmarcas_agent_event', {
        p_event_id: `stevo_${msg.provider_message_id}`,
        p_conversation_id: conversationId,
        p_subscriber_id: conversationId,
        p_phone: phoneDigits,
        p_message_type: messageType,
        p_message: text,
        p_occurred_at: new Date().toISOString(),
      });
      if (ingErr) { results.push({ error: 'ingest_failed', detail: String(ingErr) }); continue; }
      if (isNew !== true) { results.push({ duplicate: true, event: msg.provider_message_id }); continue; }

      // reações imediatas (antes do debounce): 👂 SÓ em áudio; texto recebe reação por conteúdo (ou nenhuma)
      const reaction = msg.type === 'audio' ? '👂' : (THANKS_RE.test(text) ? REACTION_LOVE[msg.provider_message_id.length % REACTION_LOVE.length] : null);
      if (reaction) {
        if (dry) await storeAssistant(conversationId, `[reacao:${reaction}]`);
        else await stevoReact(phoneDigits, msg.provider_message_id, reaction);
      }

      const batch = batches.get(conversationId) ?? { phoneDigits, contactName: msg.contact_name ?? null, n: 0 };
      batch.n += 1;
      batches.set(conversationId, batch);
      results.push({ ingested: true, event: msg.provider_message_id });
    } catch (e) {
      const msgErr = e instanceof Error ? e.message : String(e);
      console.error('inbound_failed', msgErr);
      results.push({ error: msgErr });
    }
  }

  // debounce: espera o cliente terminar a sequência de mensagens e responde tudo junto
  if (batches.size && !dry) await new Promise(r => setTimeout(r, 12_000));
  const turns: Array<Record<string, unknown>> = [];
  for (const [conversationId, b] of batches) {
    try {
      turns.push({ conversation_id: conversationId, ...(await processTurn(conversationId, b.phoneDigits, b.contactName, dry, testNoGuard)) });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error('turn_failed', conversationId, m);
      turns.push({ conversation_id: conversationId, error: m });
    }
  }

  return json({ ok: true, dry_run: dry, inbound: inbound.length, results, turns });
});

// ── turno único por conversa: espelha tudo, respeita pause, responde uma vez ──
async function processTurn(conversationId: string, phoneDigits: string, contactName: string | null, dry: boolean, testNoGuard = false): Promise<Record<string, unknown>> {
  // 1) reivindica todos os eventos pendentes da conversa (outra entrega pode ter corrido na frente)
  const events = await pgClaimInbox(db(), conversationId);
  if (!events.length) return { skipped: 'already_processing_or_done' };

  // 2) Zenda: contato/conversa + espelho de CADA mensagem
  const rawPhone = `+${phoneDigits}`;
  const c = await zFindContact(rawPhone, contactName);
  const cv = await zFindConversation(c.contactId);
  const zConvId = cv.conversationId; const zUnread = cv.unread;
  await zTouchContact(c.contactId);
  for (const ev of events) {
    await zInsertMessage({
      conversationId: zConvId, direction: 'inbound',
      type: ev.message_type === 'audio_transcript' ? 'audio' : 'text',
      body: ev.message,
      mediaUrl: null, mediaMeta: ev.message_type === 'audio_transcript' ? { is_voice: true, transcript: true } : null,
      providerId: `stevo_in_${ev.event_id}`,
    });
    await zTouchConversation(zConvId, (ev.message_type === 'audio_transcript' ? '🎤 Áudio' : ev.message.slice(0, 120)), true, zUnread);
  }

  // 3) gate do pause do Inbox
  if (await zIsPaused(zConvId)) {
    for (const ev of events) await markInbox(ev.id, 'completed');
    return { processed: false, reason: 'bot_paused', events: events.length };
  }

  // 4) conversa do agente + contexto (com a última fala da Fernanda p/ nunca repetir)
  let conv = await loadConv(conversationId);
  if (!conv) {
    conv = { conversation_id: conversationId, subscriber_id: conversationId, phone: phoneDigits, stage: 'new', summary: '', collected_data: {}, pending_action: null };
  }
  (conv.collected_data as Record<string, unknown>)._zenda_conversation_id = zConvId;
  const lastRow = await pgOne(db(), 'webmarcas_agent_messages', `select=content&conversation_id=eq.${qe(conversationId)}&role=eq.assistant&order=created_at.desc&limit=1`);
  const ctx: Ctx = { conv, dry, zConvId, zUnread, phoneDigits, fn: firstName(contactName ?? ''), sent: [], lastText: str(lastRow?.content) || '', testNoGuard };

  // 5) processa cada mensagem da sequência dentro do MESMO turno
  for (const ev of events) {
    ctx.eventId = ev.id; ctx.sendSeq = 0;
    await processInbound(ctx, ev.message);
  }
  await saveConv(ctx.conv);

  // 6) follow-ups: reancora após resposta, exceto estágios terminais
  if (!['closed', 'contract_link_sent', 'waiting_caroline'].includes(ctx.conv.stage) && !dry) {
    await scheduleFollowups(ctx.conv.conversation_id);
  }
  for (const ev of events) await markInbox(ev.id, 'completed');
  return { processed: true, stage: ctx.conv.stage, events: events.length, sent: ctx.sent };
}

// ── worker (cron): follow-ups, pending actions, retry da inbox ───────────────
async function workerSend(conv: ConvRow, spec: SendSpec, opts: { mirrorBody?: string | null } = {}) {
  const zConvId = str((conv.collected_data as Record<string, unknown>)._zenda_conversation_id) || null;
  const phoneDigits = digitsOf(conv.phone);
  const ctx: Ctx = { conv, dry: false, zConvId, zUnread: 0, phoneDigits, fn: firstName((conv.collected_data as Memory).firstName ?? ''), sent: [], lastText: '' };
  await reply(ctx, spec, { ...opts, proactive: true });
  return ctx;
}
async function handlePendingAction(conv: ConvRow): Promise<string> {
  const pa = conv.pending_action as Record<string, unknown> | null;
  if (!pa) return 'none';
  const mem = conv.collected_data as Memory;
  const type = str(pa.type);
  const brand = mem.brandName || 'sua marca';
  if (type === 'gru_pending_human' || type === 'gru_verify' || type === 'protocol_file') return 'agent_owned';
  if (type === 'gru_deliver') {
    const url = str(pa.url); const valor = str(pa.valor) || 'R$440,00';
    if (!url) return 'gru_deliver_missing_url';
    const zConvId3 = str((conv.collected_data as Record<string, unknown>)._zenda_conversation_id) || null;
    const ctx3: Ctx = { conv, dry: false, zConvId: zConvId3, zUnread: 0, phoneDigits: digitsOf(conv.phone), fn: firstName(mem.fullName), sent: [], lastText: '' };
    (mem as Record<string, unknown>)._gruValor = valor;
    (mem as Record<string, unknown>)._gruStatus = 'emitida';
    (mem as Record<string, unknown>)._gruUrl = url;
    conv.collected_data = mem;
    conv.stage = 'gru_issued';
    conv.pending_action = null;
    await reply(ctx3, { kind: 'document', url, filename: 'GRU.pdf', caption: T.gruIssuedLive(valor) });
    return 'gru_delivered';
  }
  if (type === 'gru_paid_deliver') {
    const zConvId4 = str((conv.collected_data as Record<string, unknown>)._zenda_conversation_id) || null;
    const ctx4: Ctx = { conv, dry: false, zConvId: zConvId4, zUnread: 0, phoneDigits: digitsOf(conv.phone), fn: firstName(mem.fullName), sent: [], lastText: '' };
    conv.pending_action = null;
    conv.collected_data = mem;
    await advanceToPreview(ctx4, mem);
    return 'gru_paid_delivered';
  }
  if (type === 'protocol_deliver') {
    const proto = str(pa.proto); const data = str(pa.data) || new Date().toLocaleDateString('pt-BR');
    if (!proto) return 'protocol_deliver_missing_proto';
    const zConvId5 = str((conv.collected_data as Record<string, unknown>)._zenda_conversation_id) || null;
    const ctx5: Ctx = { conv, dry: false, zConvId: zConvId5, zUnread: 0, phoneDigits: digitsOf(conv.phone), fn: firstName(mem.fullName), sent: [], lastText: '' };
    (mem as Record<string, unknown>)._protocol = proto;
    conv.collected_data = mem;
    conv.pending_action = null;
    conv.stage = 'active_monitoring';
    await reply(ctx5, { kind: 'text', text: T.protocolDoneLive(proto, data) });
    await reply(ctx5, { kind: 'text', text: T.afterProtocol });
    return 'protocol_delivered';
  }
  if (type === 'procuracao_retry') {
    const link = await createProcuracao(mem, conv.phone);
    if (!link) return 'procuracao_retry_failed';
    const zConvId2 = str((conv.collected_data as Record<string, unknown>)._zenda_conversation_id) || null;
    const ctx2: Ctx = { conv, dry: false, zConvId: zConvId2, zUnread: 0, phoneDigits: digitsOf(conv.phone), fn: firstName(mem.fullName), sent: [], lastText: '' };
    (mem as Record<string, unknown>).procuracao_url = link.url;
    conv.collected_data = mem;
    conv.stage = 'procuracao_sent';
    conv.pending_action = null;
    await reply(ctx2, { kind: 'text', text: T.procuracaoIntro(firstName(mem.fullName), link.url) });
    return 'procuracao_sent';
  }
  if (type === 'search_wait') {
    const st = await inpiStatus(str(pa.job_id));
    if (!st) {
      // job morto/API fora: mesmo timeout de 15min do poll com sucesso - informa o cliente e arma retry de 1h
      const waitedNull = Date.now() - Date.parse(str(pa.at) || new Date().toISOString());
      if (waitedNull > 15 * 60 * 1000) {
        const zConvIdN = str((conv.collected_data as Record<string, unknown>)._zenda_conversation_id) || null;
        const ctxN: Ctx = { conv, dry: false, zConvId: zConvIdN, zUnread: 0, phoneDigits: digitsOf(conv.phone), fn: firstName(mem.firstName ?? ''), sent: [], lastText: '' };
        await searchUnavailable(ctxN, 1);
        return 'search_unavailable_hourly_armed';
      }
      return 'poll_failed';
    }
    const zConvId = str((conv.collected_data as Record<string, unknown>)._zenda_conversation_id) || null;
    const ctx: Ctx = { conv, dry: false, zConvId, zUnread: 0, phoneDigits: digitsOf(conv.phone), fn: firstName(mem.firstName ?? ''), sent: [], lastText: '' };
    if (st.status === 'completed' && st.pdf_url) {
      await deliverSearchAndAdvance(ctx, st.pdf_url);
      await saveConv(ctx.conv);
      return 'search_delivered';
    }
    if (st.status === 'inconclusive' || (st.status === 'completed' && !st.pdf_url)) {
      await searchUnavailable(ctx, 1);
      return 'search_unavailable_hourly_armed';
    }
    if (st.status === 'failed') {
      await searchUnavailable(ctx, 1);
      return 'search_failed_hourly_armed';
    }
    const waited = Date.now() - Date.parse(str(pa.at) || new Date().toISOString());
    if (waited > 15 * 60 * 1000) {
      await searchUnavailable(ctx, 1);
      return 'search_timeout_hourly_armed';
    }
    return 'still_running';
  }
  if (type === 'search_hourly') {
    const nextAt = Date.parse(str(pa.next_at) || '') || 0;
    if (nextAt && Date.now() < nextAt) return 'search_hourly_waiting';
    const attempts = (Number(pa.attempts) || 1) + 1;
    const zConvId2 = str((conv.collected_data as Record<string, unknown>)._zenda_conversation_id) || null;
    const ctx2: Ctx = { conv, dry: false, zConvId: zConvId2, zUnread: 0, phoneDigits: digitsOf(conv.phone), fn: firstName(mem.firstName ?? ''), sent: [], lastText: '' };
    const jobId = await inpiStart(mem.brandName || '', mem.businessArea || '', conv.phone);
    if (!jobId) {
      await searchUnavailable(ctx2, attempts);
      return 'search_hourly_restart_failed';
    }
    conv.pending_action = { type: 'search_wait', job_id: jobId, at: new Date().toISOString(), hourly_attempts: attempts };
    await saveConv(conv);
    return 'search_hourly_restarted';
  }
  if (type === 'search_retry') {
    const attempts = Number(pa.attempts) || 1;
    if (attempts > 2) {
      conv.pending_action = null;
      conv.stage = 'waiting_caroline';
      await workerSend(conv, { kind: 'text', text: `A busca da marca ${brand} não completou por instabilidade. Já acionei nosso time para verificar manualmente e te retornar por aqui. 😊` });
      return 'search_gave_up';
    }
    const jobId = await inpiStart(mem.brandName || '', mem.businessArea || '', conv.phone);
    if (!jobId) {
      conv.pending_action = { type: 'search_retry', attempts: attempts + 1, at: new Date().toISOString() };
      return 'search_retry_failed';
    }
    conv.pending_action = { type: 'search_wait', job_id: jobId, at: new Date().toISOString() };
    return 'search_restarted';
  }
  if (type === 'contract_retry') {
    const attempts = Number(pa.attempts) || 1;
    const contract = await createContract(mem, conv.phone);
    if (contract) {
      conv.collected_data = { ...mem, contract_url: contract.url, contract_number: contract.number };
      conv.stage = 'contract_link_sent';
      conv.pending_action = null;
      await workerSend(conv, { kind: 'text', text: T.contractReady(firstName(mem.fullName ?? ''), contract.url) });
      return 'contract_delivered';
    }
    if (attempts >= 3) {
      conv.pending_action = null;
      conv.stage = 'waiting_caroline';
      await workerSend(conv, { kind: 'text', text: T.contractFailedFinal });
      return 'contract_gave_up';
    }
    conv.pending_action = { type: 'contract_retry', attempts: attempts + 1, at: new Date().toISOString() };
    return 'contract_retry_scheduled';
  }
  return 'unknown';
}
async function zFindConversationByPhone(phone: string): Promise<{ conversationId: string; unread: number } | null> {
  try {
    const c = await zFindContact(`+${phone}`, null);
    const cv = await zFindConversation(c.contactId);
    return { conversationId: cv.conversationId as string, unread: (cv.unread as number) || 0 };
  } catch { return null; }
}

async function phase2SignaturePoll(): Promise<{ advanced: number; errors: string[] }> {
  const out = { advanced: 0, errors: [] as string[] };
  try {
    const convs = await pgSelect(db(), 'webmarcas_agent_conversations',
      (E.phase2Live ? `select=*&stage=in.(contract_link_sent,procuracao_sent)&limit=40` : `select=*&stage=in.(contract_link_sent,procuracao_sent)&collected_data->>_phase2_test=eq.1&limit=20`));
    for (const c of convs) {
      const mem = (c.collected_data || {}) as Memory & Record<string, unknown>;
      const cpf = str(mem.cpf);
      if (!cpf) continue;
      try {
        if (c.stage === 'contract_link_sent' && !mem._contract_signed) {
          const signed = await pgOne(db(), 'contracts',
            `select=id&signatory_cpf=eq.${cpf}&document_type=eq.contract&signature_status=eq.signed&order=created_at.desc&limit=1`);
          if (!signed?.id) continue;
          const z = await zFindConversationByPhone(c.phone as string);
          const ctx: Ctx = { conv: c as unknown as ConvRow, dry: false, zConvId: z?.conversationId ?? null, zUnread: 0, phoneDigits: c.phone as string, fn: firstName(mem.fullName), sent: [], lastText: '' };
          const link = await createProcuracao(mem, c.phone as string);
          mem._contract_signed = true;
          let msg: string;
          if (link) {
            (c as Record<string, unknown>).stage = 'procuracao_sent';
            mem.procuracao_url = link.url;
            ctx.conv.collected_data = mem; ctx.conv.stage = 'procuracao_sent';
            msg = T.procuracaoIntro(firstName(mem.fullName), link.url);
          } else {
            ctx.conv.collected_data = mem;
            (ctx.conv as ConvRow).pending_action = { type: 'procuracao_retry', attempts: 1, at: new Date().toISOString() };
            msg = 'Recebemos a assinatura do seu contrato ✅ Já estou preparando sua procuração e te envio aqui em instantes 😊';
          }
          await saveConv(ctx.conv);
          try { await reply(ctx, { kind: 'text', text: msg }); await scheduleFollowups(c.conversation_id as string); } catch (e) { console.error('phase2_send_failed', c.phone, e instanceof Error ? e.message : e); }
          out.advanced++;
        } else if (c.stage === 'procuracao_sent' && !mem._procuracao_signed) {
          const signed = await pgOne(db(), 'contracts',
            `select=id&signatory_cpf=eq.${cpf}&document_type=eq.procuracao&signature_status=eq.signed&order=created_at.desc&limit=1`);
          if (!signed?.id) continue;
          mem._procuracao_signed = true;
          const z = await zFindConversationByPhone(c.phone as string);
          const ctx: Ctx = { conv: c as unknown as ConvRow, dry: false, zConvId: z?.conversationId ?? null, zUnread: 0, phoneDigits: c.phone as string, fn: firstName(mem.fullName), sent: [], lastText: '' };
          // GRU real continua bloqueada até o OK dele: aqui só registramos o avanço e avisamos
          ctx.conv.collected_data = mem;
          (ctx.conv as ConvRow).pending_action = { type: 'gru_pending_human', at: new Date().toISOString() };
          await saveConv(ctx.conv);
          try { await reply(ctx, { kind: 'text', text: 'Procuração assinada recebida ✅ Nosso jurídico já vai emitir a guia federal (GRU) do seu pedido e te mando por aqui 😊' }); await scheduleFollowups(c.conversation_id as string); } catch (e) { console.error('phase2_send_failed', c.phone, e instanceof Error ? e.message : e); }
          out.advanced++;
        }
      } catch (e) { out.errors.push(`${c.phone}: ${e instanceof Error ? e.message : e}`); }
    }
  } catch (e) { out.errors.push(e instanceof Error ? e.message : String(e)); }
  return out;
}

async function runWorker(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { pending_actions: [], followups: [], inbox_retries: [], phase2_signatures: null };

  // 1) pending actions (busca/contrato)
  const pending = await pgSelect(db(), 'webmarcas_agent_conversations', 'select=*&pending_action=not.is.null&limit=10');
  for (const row of (pending as ConvRow[] | null) ?? []) {
    try {
      const r = await handlePendingAction(row);
      await saveConv(row);
      if (typeof r === 'string' && !['none', 'agent_owned', 'search_hourly_waiting', 'poll_failed', 'gru_deliver_missing_url', 'protocol_deliver_missing_proto', 'procuracao_retry_failed'].includes(r) && !r.startsWith('search_wait')) {
        await scheduleFollowups(row.conversation_id as string);
      }
      (out.pending_actions as unknown[]).push({ conv: row.conversation_id, result: r });
    } catch (e) {
      (out.pending_actions as unknown[]).push({ conv: row.conversation_id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // 1b) sinal público de handoffs e-INPI (pro trigger do wake do agente, sem credencial)
  try {
    const hand = await pgSelect(db(), 'webmarcas_agent_conversations', `select=pending_action&pending_action=not.is.null&limit=50`);
    const types = [...new Set(((hand as Record<string, unknown>[] | null) ?? []).map((r) => str((r.pending_action as Record<string, unknown>)?.type)).filter((t) => ['gru_pending_human', 'gru_verify', 'protocol_file'].includes(t)))];
    const flag = JSON.stringify({ pending: types.length > 0, types, at: new Date().toISOString() });
    await fetch(`${E.url}/storage/v1/object/fernanda/handoff.json`, { method: 'POST', headers: { Authorization: `Bearer ${E.key}`, apikey: E.key, 'Content-Type': 'application/json', 'x-upsert': 'true' }, body: flag });
  } catch (e) { console.error('handoff_flag_failed', e instanceof Error ? e.message : e); }

  // 2) follow-ups vencidos
  for (let i = 0; i < 8; i++) {
    const { data: fu } = await pgRpc(db(), 'claim_webmarcas_agent_followup', {});
    const row = Array.isArray(fu) ? fu[0] : fu;
    if (!row) break;
    const fid = row.id as string;
    try {
      const conv = await loadConv(row.conversation_id as string);
      if (conv && EXCLUDED_PHONES.has(digitsOf(conv.phone))) {
        await pgUpdate(db(), 'webmarcas_agent_followups', `id=eq.${fid}`, { status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        (out.followups as unknown[]).push({ id: fid, cancelled: 'excluded_phone' });
        continue;
      }
      if (conv && await zHasJaECliente(conv.phone)) {
        await pgUpdate(db(), 'webmarcas_agent_followups', `id=eq.${fid}`, { status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        (out.followups as unknown[]).push({ id: fid, cancelled: 'ja_e_cliente' });
        continue;
      }
      const zConvId = conv ? str((conv.collected_data as Record<string, unknown>)._zenda_conversation_id) : '';
      const terminal = !conv || ['closed', 'contract_link_sent', 'waiting_caroline'].includes(conv.stage);
      const paused = zConvId ? await zIsPaused(zConvId) : false;
      if (terminal || paused) {
        await pgUpdate(db(), 'webmarcas_agent_followups', `id=eq.${fid}`, { status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        (out.followups as unknown[]).push({ id: fid, cancelled: terminal ? 'terminal' : 'paused' });
        continue;
      }
      if (conv.pending_action) {
        // ela está no meio de uma tarefa (ex.: retry de busca) - nudge agora seria fora de contexto: adia 30min
        await pgUpdate(db(), 'webmarcas_agent_followups', `id=eq.${fid}`, { status: 'pending', due_at: new Date(Date.now() + 30 * 60_000).toISOString(), updated_at: new Date().toISOString() });
        (out.followups as unknown[]).push({ id: fid, postponed: 'pending_action' });
        continue;
      }
      const fn = firstName((conv.collected_data as Memory).firstName ?? '');
      const fuBrand = str((conv.collected_data as Memory).brandName ?? '');
      const text = row.step === 1 ? T.followup1(fn, fuBrand || undefined) : row.step === 2 ? T.followup2(fn) : T.followup3(fn);
      await workerSend(conv, { kind: 'text', text });
      await pgUpdate(db(), 'webmarcas_agent_followups', `id=eq.${fid}`, { status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      (out.followups as unknown[]).push({ id: fid, sent: row.step });
    } catch (e) {
      await pgUpdate(db(), 'webmarcas_agent_followups', `id=eq.${fid}`, { status: 'failed', error_code: (e instanceof Error ? e.message : String(e)).slice(0, 200), due_at: new Date(Date.now() + 15 * 60_000).toISOString(), updated_at: new Date().toISOString() });
      (out.followups as unknown[]).push({ id: fid, error: e instanceof Error ? e.message : String(e), retry_at: '+15min' });
    }
  }

  // 3) retry de eventos da inbox (falhas do fast-path)
  for (let i = 0; i < 5; i++) {
    const { data: ev } = await pgRpc(db(), 'claim_webmarcas_agent_event', {});
    const row = Array.isArray(ev) ? ev[0] : ev;
    if (!row) break;
    try {
      const outcome = await processEvent({
        id: row.id, conversation_id: row.conversation_id, phone: row.phone,
        message_type: row.message_type, message: row.message, contact_name: null,
      }, false);
      await pgUpdate(db(), 'webmarcas_agent_inbox', `id=eq.${row.id}`, {
        status: outcome.processed || outcome.reason === 'bot_paused' ? 'completed' : 'failed',
        error_code: outcome.processed ? null : String(outcome.reason ?? 'unknown').slice(0, 200),
        updated_at: new Date().toISOString(),
      });
      (out.inbox_retries as unknown[]).push({ id: row.id, processed: outcome.processed ?? false });
    } catch (e) {
      await pgUpdate(db(), 'webmarcas_agent_inbox', `id=eq.${row.id}`, { status: 'failed', error_code: (e instanceof Error ? e.message : String(e)).slice(0, 200), updated_at: new Date().toISOString() });
      (out.inbox_retries as unknown[]).push({ id: row.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  out.phase2_signatures = await phase2SignaturePoll();
  return out;
}
