import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Max new messages to fetch per folder per call (avoid CPU timeout)
const MAX_PER_FOLDER = 40;

// ============== Auto-reply ==============
const AUTO_REPLY_SUBJECT = "Recebemos seu contato – WebMarcas";
const AUTO_REPLY_HTML = `
<div style="font-family: Arial, Helvetica, sans-serif; line-height:1.6; color:#333;">
  <p>Olá,</p>
  <p>Obrigado por entrar em contato com a <strong>WebMarcas</strong>.</p>
  <p>Recebemos seu e-mail com sucesso. Esta é uma mensagem automática de confirmação de recebimento.</p>
  <p>Nossa equipe irá analisar sua solicitação e retornará o mais breve possível.</p>
  <p>⚠️ <strong>Importante:</strong><br/>
  Para um atendimento mais rápido e prioritário, nosso principal canal de atendimento é o WhatsApp:<br/>
  📲 <strong>(11) 91112-0225</strong></p>
  <p>Nossa equipe especializada está disponível para auxiliar sobre:</p>
  <ul>
    <li>Registro de Marcas</li>
    <li>Laudo de Viabilidade</li>
    <li>Acompanhamento de Processos no INPI</li>
  </ul>
  <p>Atenciosamente,<br/>
  <strong>Equipe WebMarcas</strong></p>
  <hr style="border:none; border-top:1px solid #ddd; margin:20px 0;"/>
  <p style="font-size:12px; color:#666;">
    🌐 <a href="https://www.webmarcas.net">www.webmarcas.net</a><br/>
    📧 ola@webmarcas.net<br/>
    📱 @webpatentes
  </p>
</div>`;

function isOwnDomain(email: string): boolean {
  return /@webmarcas\.net$/i.test(email || "");
}

function looksAutomated(headers: string, subject: string): boolean {
  const h = headers.toLowerCase();
  if (h.includes("auto-submitted:") && !h.includes("auto-submitted: no")) return true;
  if (h.includes("precedence: bulk") || h.includes("precedence: auto_reply") || h.includes("precedence: junk")) return true;
  if (h.includes("x-auto-response-suppress:")) return true;
  if (h.includes("list-unsubscribe:")) return true;
  const s = (subject || "").toLowerCase();
  if (s.includes("recebemos seu contato")) return true;
  if (s.startsWith("auto:") || s.includes("out of office") || s.includes("ausência") || s.includes("ausencia automática")) return true;
  return false;
}

async function sendAutoReply(
  supabase: any,
  account: any,
  toEmail: string,
  originalSubject: string,
) {
  try {
    if (!toEmail || isOwnDomain(toEmail)) return;

    // Dedup: only one auto-reply per (account, from) every 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: prev } = await supabase
      .from("email_logs")
      .select("id")
      .eq("trigger_type", "auto_reply_received")
      .eq("to_email", toEmail.toLowerCase())
      .eq("from_email", account.email_address)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();
    if (prev) return;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return;

    const displayName = account.display_name || "WebMarcas";
    const fromAddress = `${displayName} <noreply@webmarcas.net>`;
    const subject = originalSubject?.toLowerCase().startsWith("re:")
      ? AUTO_REPLY_SUBJECT
      : AUTO_REPLY_SUBJECT;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress,
        to: [toEmail],
        subject,
        html: AUTO_REPLY_HTML,
        reply_to: [account.email_address],
        headers: { "Auto-Submitted": "auto-replied", "X-Auto-Response-Suppress": "All" },
      }),
    });

    const ok = resp.ok;
    await supabase.from("email_logs").insert({
      from_email: account.email_address,
      to_email: toEmail.toLowerCase(),
      subject,
      body: "Resposta automática de recebimento",
      html_body: AUTO_REPLY_HTML,
      status: ok ? "sent" : "failed",
      trigger_type: "auto_reply_received",
    });
  } catch (e) {
    console.error("auto-reply error:", e);
  }
}

// ============== MIME helpers (decode + parse) ==============
function decodeMimeWords(input: string): string {
  if (!input || !input.includes("=?")) return input;
  return input.replace(
    /=\?([^?]+)\?(Q|B)\?([^?]*)\?=/gi,
    (_m, cs, enc, encoded) => {
      const charset = (cs || "utf-8").toLowerCase();
      try {
        if (enc.toUpperCase() === "B") {
          const b = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
          return safeDecode(b, charset);
        }
        const d = encoded.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_: string, h: string) => String.fromCharCode(parseInt(h, 16)));
        const b = new Uint8Array([...d].map(c => c.charCodeAt(0)));
        return safeDecode(b, charset);
      } catch { return encoded; }
    }
  ).replace(/\r?\n[ \t]+/g, "");
}
function safeDecode(bytes: Uint8Array, charset: string): string {
  const c = (charset || "utf-8").toLowerCase().replace(/^"|"$/g, "");
  const aliases: Record<string, string> = {
    "utf8": "utf-8",
    "us-ascii": "utf-8",
    "ascii": "utf-8",
    "latin1": "windows-1252",
    "iso-8859-1": "windows-1252",
  };
  const enc = aliases[c] || c;
  try { return new TextDecoder(enc, { fatal: false }).decode(bytes); }
  catch {
    try { return new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
    catch { return new TextDecoder("windows-1252").decode(bytes); }
  }
}
function decodeQP(input: string, charset = "utf-8"): string {
  const cleaned = input.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "=" && /^[0-9A-Fa-f]{2}$/.test(cleaned.substring(i + 1, i + 3))) {
      bytes.push(parseInt(cleaned.substring(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(cleaned.charCodeAt(i) & 0xff);
    }
  }
  return safeDecode(new Uint8Array(bytes), charset);
}
function decodeB64(input: string, charset = "utf-8"): string {
  try {
    const bytes = Uint8Array.from(atob(input.replace(/\s/g, "")), c => c.charCodeAt(0));
    return safeDecode(bytes, charset);
  } catch { return input; }
}
function getCharset(ct: string): string {
  const m = ct.match(/charset\s*=\s*"?([^";\s]+)"?/i);
  return (m?.[1] || "utf-8").toLowerCase();
}
function decodeContent(body: string, enc: string, charset = "utf-8"): string {
  const e = (enc || "7bit").trim().toLowerCase();
  if (e === "base64") return decodeB64(body, charset);
  if (e === "quoted-printable") return decodeQP(body, charset);
  // 7bit / 8bit / binary: re-interpret JS string (Latin-1 view of raw bytes) as the declared charset.
  if (charset && charset !== "utf-8" && charset !== "us-ascii") {
    const bytes = new Uint8Array([...body].map(c => c.charCodeAt(0) & 0xff));
    return safeDecode(bytes, charset);
  }
  // Default: assume UTF-8 already; if the JS string holds raw UTF-8 bytes (mojibake), fix it.
  if (/[\u0080-\u00ff]/.test(body)) {
    try {
      const bytes = new Uint8Array([...body].map(c => c.charCodeAt(0) & 0xff));
      const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return utf8;
    } catch { /* not valid UTF-8, keep original */ }
  }
  return body;
}
function getHeader(headers: string, name: string): string {
  const u = headers.replace(/\r?\n[ \t]+/g, " ");
  const m = u.match(new RegExp(`^${name}:\\s*(.+?)$`, "im"));
  return m?.[1]?.trim() || "";
}
function getBoundary(ct: string): string | null {
  const m = ct.match(/boundary="?([^"\s;]+)"?/i);
  return m?.[1] || null;
}
interface Att { filename: string; content_type: string; size: number }
interface Parsed { text: string; html: string; attachments: Att[] }
function parseMime(raw: string): Parsed {
  let i = raw.indexOf("\r\n\r\n"); let s = 4;
  if (i === -1) { i = raw.indexOf("\n\n"); s = 2; }
  if (i === -1) return { text: raw, html: "", attachments: [] };
  const headers = raw.substring(0, i);
  const body = raw.substring(i + s);
  const ct = getHeader(headers, "Content-Type") || "text/plain";
  const cte = getHeader(headers, "Content-Transfer-Encoding") || "7bit";
  const cd = getHeader(headers, "Content-Disposition") || "";
  const charset = getCharset(ct);
  if (ct.toLowerCase().startsWith("multipart/")) {
    const b = getBoundary(ct);
    if (!b) return { text: body, html: "", attachments: [] };
    const parts = body.split("--" + b);
    let text = "", html = "";
    const atts: Att[] = [];
    for (let j = 1; j < parts.length; j++) {
      const p = parts[j];
      if (p.startsWith("--")) break;
      const t = p.replace(/^\r?\n/, "");
      if (!t.trim()) continue;
      const r = parseMime(t);
      if (r.text && !text) text = r.text;
      if (r.html && !html) html = r.html;
      atts.push(...r.attachments);
    }
    return { text, html, attachments: atts };
  }
  const isAtt = cd.toLowerCase().includes("attachment") ||
    (cd.toLowerCase().includes("filename") && !ct.toLowerCase().startsWith("text/"));
  if (isAtt) {
    const m = (cd + "; " + ct).match(/(?:file)?name="?([^"\r\n;]+)"?/i);
    return { text: "", html: "", attachments: [{ filename: decodeMimeWords(m?.[1]?.trim() || "attachment"), content_type: ct.split(";")[0].trim(), size: body.length }] };
  }
  if (cd.toLowerCase().includes("inline") && !ct.toLowerCase().startsWith("text/")) {
    const m = (cd + "; " + ct).match(/(?:file)?name="?([^"\r\n;]+)"?/i);
    if (m) return { text: "", html: "", attachments: [{ filename: decodeMimeWords(m[1].trim()), content_type: ct.split(";")[0].trim(), size: body.length }] };
  }
  const dec = decodeContent(body.trim(), cte, charset);
  if (ct.toLowerCase().includes("text/html")) return { text: "", html: dec, attachments: [] };
  if (ct.toLowerCase().includes("text/plain")) return { text: dec, html: "", attachments: [] };
  const nm = ct.match(/name="?([^"\r\n;]+)"?/i);
  if (nm) return { text: "", html: "", attachments: [{ filename: nm[1], content_type: ct.split(";")[0].trim(), size: body.length }] };
  return { text: dec, html: "", attachments: [] };
}

// ============== IMAP ==============
async function readGreeting(conn: Deno.TlsConn): Promise<void> {
  const buf = new Uint8Array(8192);
  await conn.read(buf);
}
async function sendCmd(conn: Deno.TlsConn, tag: string, cmd: string, timeoutMs = 20000): Promise<string> {
  await conn.write(new TextEncoder().encode(`${tag} ${cmd}\r\n`));
  const chunks: string[] = [];
  let tail = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const buf = new Uint8Array(65536);
    const n = await conn.read(buf);
    if (n === null) break;
    const text = new TextDecoder().decode(buf.subarray(0, n));
    chunks.push(text);
    tail = (tail + text).slice(-500);
    if (tail.includes(`${tag} OK`) || tail.includes(`${tag} NO`) || tail.includes(`${tag} BAD`)) break;
  }
  return chunks.join("");
}

const FOLDER_NAMES: Record<string, string[]> = {
  inbox:  ["INBOX"],
  sent:   ["INBOX.Sent", "Sent", "Sent Items", "Sent Messages", "[Gmail]/Sent Mail", "INBOX.Sent Items", "Enviados", "INBOX.Enviados"],
  drafts: ["INBOX.Drafts", "Drafts", "[Gmail]/Drafts", "Rascunhos", "INBOX.Rascunhos"],
  spam:   ["INBOX.Junk", "Junk", "Spam", "INBOX.Spam", "[Gmail]/Spam", "Lixo Eletronico", "Lixo Eletrônico"],
  trash:  ["INBOX.Trash", "Trash", "Deleted Items", "[Gmail]/Trash", "Lixeira", "INBOX.Lixeira"],
};

function findFolder(listResp: string, candidates: string[]): string | null {
  for (const c of candidates) {
    // Match quoted folder names in LIST response
    const re = new RegExp(`"${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "i");
    if (re.test(listResp)) return c;
    if (listResp.includes(` ${c}\r\n`) || listResp.includes(` ${c}\n`)) return c;
  }
  return null;
}

function parseEnvelope(raw: string) {
  const fromMatch = raw.match(/From:\s*(?:"?([^"<]*)"?\s*)?<?([^>\r\n]+)>?/i);
  const toMatch = raw.match(/To:\s*(?:"?([^"<]*)"?\s*)?<?([^>\r\n]+)>?/i);
  const subjMatch = raw.match(/Subject:\s*(.+?)(?:\r\n(?![ \t])|\r?\n(?![ \t]))/is);
  const dateMatch = raw.match(/Date:\s*(.+?)(?:\r\n|\r?\n)/i);
  const midMatch = raw.match(/Message-ID:\s*<?([^>\r\n]+)>?/i);
  // Collect ALL recipient-related addresses to detect aliases/forwards
  const headersBlock = raw.split(/\r?\n\r?\n/)[0] || "";
  const unfolded = headersBlock.replace(/\r?\n[ \t]+/g, " ");
  const recipientHeaders = ["To", "Cc", "Bcc", "Delivered-To", "X-Original-To", "Envelope-To", "X-Delivered-To"];
  const recipients: string[] = [];
  for (const h of recipientHeaders) {
    const re = new RegExp(`^${h}:\\s*(.+)$`, "gim");
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(unfolded)) !== null) {
      const line = mm[1];
      const emails = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
      for (const e of emails) recipients.push(e.toLowerCase());
    }
  }
  return {
    fromName: decodeMimeWords(fromMatch?.[1]?.trim() || ""),
    from: (fromMatch?.[2]?.trim() || "unknown@email.com").toLowerCase(),
    toName: decodeMimeWords(toMatch?.[1]?.trim() || ""),
    to: toMatch?.[2]?.trim() || "",
    subject: decodeMimeWords((subjMatch?.[1]?.trim().replace(/\r?\n[ \t]+/g, " ") || "(Sem assunto)")),
    date: dateMatch?.[1]?.trim() || new Date().toISOString(),
    messageId: midMatch?.[1]?.trim() || `${Date.now()}-${Math.random().toString(36)}`,
    recipients,
  };
}

// Extract literal-style body for a single FETCH response item
function extractLiteral(block: string, key: string): string | null {
  const m = block.match(new RegExp(`${key}\\s*\\{(\\d+)\\}`));
  if (!m) return null;
  const size = parseInt(m[1]);
  const startIdx = block.indexOf(m[0]) + m[0].length;
  const contentStart = block.indexOf("\r\n", startIdx);
  if (contentStart === -1) return null;
  return block.substring(contentStart + 2, contentStart + 2 + size);
}

async function syncFolder(
  conn: Deno.TlsConn,
  supabase: any,
  account: any,
  folderLabel: string,
  serverFolder: string,
  tagPrefix: string
): Promise<{ synced: number; new_uid: number }> {
  const sel = await sendCmd(conn, `${tagPrefix}S`, `SELECT "${serverFolder}"`);
  if (!sel.includes(`${tagPrefix}S OK`)) return { synced: 0, new_uid: 0 };

  // Load last_uid for this (account, folder)
  const { data: state } = await supabase
    .from("email_sync_state")
    .select("last_uid")
    .eq("account_id", account.id)
    .eq("folder", folderLabel)
    .maybeSingle();
  const lastUid = state?.last_uid || 0;

  // Fetch UIDs newer than lastUid
  const searchResp = await sendCmd(conn, `${tagPrefix}U`, `UID SEARCH UID ${lastUid + 1}:*`);
  const sm = searchResp.match(/\* SEARCH\s+([\d\s]+)/);
  if (!sm) return { synced: 0, new_uid: lastUid };
  const allUids = sm[1].trim().split(/\s+/).filter(Boolean).map(Number).filter(n => n > lastUid);
  if (allUids.length === 0) return { synced: 0, new_uid: lastUid };

  // Take only newest MAX_PER_FOLDER
  allUids.sort((a, b) => a - b);
  const uidsToFetch = allUids.slice(-MAX_PER_FOLDER);
  let maxUidSeen = lastUid;
  let synced = 0;
  const isSent = folderLabel === "sent";

  // Fetch one by one (more reliable parsing than batch)
  for (const uid of uidsToFetch) {
    try {
      const fetchResp = await sendCmd(conn, `${tagPrefix}F${uid}`, `UID FETCH ${uid} BODY.PEEK[]`, 30000);
      const raw = extractLiteral(fetchResp, `BODY\\[\\]`);
      if (!raw) { maxUidSeen = Math.max(maxUidSeen, uid); continue; }

      const env = parseEnvelope(raw);
      const parsed = parseMime(raw);
      const snippet = (parsed.text || parsed.html.replace(/<[^>]+>/g, ""))
        .substring(0, 200).trim().replace(/\s+/g, " ");

      // Safe date parsing — many emails have malformed Date headers which
      // would otherwise throw RangeError and freeze the sync at this UID.
      let receivedAt: string;
      try {
        const d = new Date(env.date);
        receivedAt = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      } catch {
        receivedAt = new Date().toISOString();
      }

      // Anti-alias filter: if syncing INBOX, only keep messages actually addressed
      // to this account's email (covers Hostinger forwards/aliases that deliver
      // copies of one mailbox into another).
      if (!isSent && folderLabel === "inbox") {
        const myAddr = (account.email_address || "").toLowerCase();
        const matchesMe = env.recipients.includes(myAddr);
        if (!matchesMe && env.recipients.length > 0) {
          maxUidSeen = Math.max(maxUidSeen, uid);
          continue;
        }
      }

      // Skip if message_id already exists for this account+folder
      const { data: existing } = await supabase
        .from("email_inbox")
        .select("id")
        .eq("account_id", account.id)
        .eq("folder", folderLabel)
        .eq("message_id", env.messageId)
        .maybeSingle();
      if (existing) { maxUidSeen = Math.max(maxUidSeen, uid); continue; }

      const row: any = {
        account_id: account.id,
        message_id: env.messageId,
        imap_uid: uid,
        from_email: isSent ? account.email_address : env.from,
        from_name: isSent ? (account.display_name || null) : (env.fromName || null),
        to_email: isSent ? (env.to || "") : account.email_address,
        to_name: isSent ? (env.toName || null) : null,
        subject: env.subject,
        body_text: parsed.text || null,
        body_html: parsed.html || null,
        snippet: snippet || null,
        has_attachments: parsed.attachments.length > 0,
        attachments: parsed.attachments,
        body_fetched_at: new Date().toISOString(),
        received_at: receivedAt,
        is_read: isSent || folderLabel === "trash",
        is_starred: false,
        is_archived: false,
        folder: folderLabel,
      };

      const { error } = await supabase.from("email_inbox").insert(row);
      if (!error) synced++;
      maxUidSeen = Math.max(maxUidSeen, uid);

      // Auto-reply only for inbox (received) messages
      if (!error && !isSent && folderLabel === "inbox") {
        const headersBlock = raw.split(/\r?\n\r?\n/)[0] || "";
        if (!looksAutomated(headersBlock, env.subject) && !isOwnDomain(env.from)) {
          await sendAutoReply(supabase, account, env.from, env.subject);
        }
      }
    } catch (e) {
      console.error(`[${folderLabel}] uid=${uid} err:`, e);
      // Always advance the watermark so a single bad message can't freeze the sync.
      maxUidSeen = Math.max(maxUidSeen, uid);
    }
  }

  // Persist new last_uid
  await supabase.from("email_sync_state").upsert({
    account_id: account.id,
    folder: folderLabel,
    last_uid: maxUidSeen,
    last_synced_at: new Date().toISOString(),
  }, { onConflict: "account_id,folder" });

  return { synced, new_uid: maxUidSeen };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { account_id } = await req.json().catch(() => ({}));
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let q = supabase.from("email_accounts").select("*");
    if (account_id) q = q.eq("id", account_id);

    const { data: accounts, error } = await q;
    if (error) throw error;
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ error: "No email account" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const results: any[] = [];

    for (const account of accounts) {
      if (!account.imap_host) { results.push({ account: account.email_address, error: "no imap" }); continue; }
      try {
        const conn = await Deno.connectTls({ hostname: account.imap_host, port: account.imap_port || 993 });
        await readGreeting(conn);
        const login = await sendCmd(conn, "A1", `LOGIN "${account.smtp_user}" "${account.smtp_password}"`);
        if (!login.includes("A1 OK")) { conn.close(); results.push({ account: account.email_address, error: "login failed" }); continue; }
        const listResp = await sendCmd(conn, "L1", 'LIST "" "*"');

        const folderResults: Record<string, { synced: number; new_uid: number }> = {};
        let tagN = 10;
        for (const [label, candidates] of Object.entries(FOLDER_NAMES)) {
          const server = label === "inbox" ? "INBOX" : findFolder(listResp, candidates);
          if (!server) { folderResults[label] = { synced: 0, new_uid: 0 }; continue; }
          try {
            folderResults[label] = await syncFolder(conn, supabase, account, label, server, `T${tagN++}`);
          } catch (e: any) {
            console.error(`Folder ${label} error:`, e?.message);
            folderResults[label] = { synced: 0, new_uid: 0 };
          }
        }

        await sendCmd(conn, "Z1", "LOGOUT", 5000).catch(() => {});
        try { conn.close(); } catch { /* ignore */ }

        results.push({ account: account.email_address, folders: folderResults });
      } catch (e: any) {
        console.error(`Account ${account.email_address} error:`, e?.message);
        results.push({ account: account.email_address, error: e?.message });
      }
    }

    // Backwards-compatible response shape (inbox/sent fields)
    const first = results[0];
    const inbox = first?.folders?.inbox || { synced: 0 };
    const sent = first?.folders?.sent || { synced: 0 };

    return new Response(JSON.stringify({
      success: true,
      results,
      inbox: { synced: inbox.synced || 0 },
      sent: { synced: sent.synced || 0 },
    }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (e: any) {
    console.error("Sync error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
