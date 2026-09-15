import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseMessage, buildSnippet, PARSER_VERSION } from "../_shared/mimeParser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Max new messages to fetch per folder per call (avoid CPU timeout).
const MAX_PER_FOLDER = 12;
const MAX_PER_FOLDER_BACKFILL = 50;
// Keep the original source when it is small enough to be useful for repair.
const MAX_RAW_STORED = 200_000;
// Other @webmarcas.net mailboxes we also sync.
const SIBLING_DOMAIN = "webmarcas.net";
// A running sync older than this is considered stale and the lock is released.
const LOCK_TTL_MS = 10 * 60 * 1000;

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
  const h = (headers || "").toLowerCase();
  if (h.includes("auto-submitted:") && !h.includes("auto-submitted: no")) return true;
  if (h.includes("precedence: bulk") || h.includes("precedence: auto_reply") || h.includes("precedence: junk")) return true;
  if (h.includes("x-auto-response-suppress:")) return true;
  if (h.includes("list-unsubscribe:")) return true;
  if (h.includes("x-autoreply") || h.includes("x-autorespond")) return true;
  const s = (subject || "").toLowerCase();
  if (s.includes("recebemos seu contato")) return true;
  if (s.startsWith("auto:") || s.includes("out of office") || s.includes("ausência") || s.includes("ausencia automática")) return true;
  if (/^(mailer-daemon|postmaster|no-?reply)/.test(s)) return true;
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
    if (/^(mailer-daemon|postmaster|no-?reply|noreply|bounce)/i.test(toEmail)) return;

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

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress,
        to: [toEmail],
        subject: AUTO_REPLY_SUBJECT,
        html: AUTO_REPLY_HTML,
        reply_to: [account.email_address],
        headers: { "Auto-Submitted": "auto-replied", "X-Auto-Response-Suppress": "All" },
      }),
    });

    await supabase.from("email_logs").insert({
      from_email: account.email_address,
      to_email: toEmail.toLowerCase(),
      subject: AUTO_REPLY_SUBJECT,
      body: "Resposta automática de recebimento",
      html_body: AUTO_REPLY_HTML,
      status: resp.ok ? "sent" : "failed",
      trigger_type: "auto_reply_received",
    });
  } catch (e) {
    console.error("auto-reply error:", e);
  }
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
    const text = new TextDecoder("latin1").decode(buf.subarray(0, n));
    chunks.push(text);
    tail = (tail + text).slice(-500);
    if (tail.includes(`${tag} OK`) || tail.includes(`${tag} NO`) || tail.includes(`${tag} BAD`)) break;
  }
  return chunks.join("");
}

const FOLDER_NAMES: Record<string, string[]> = {
  inbox: ["INBOX"],
  sent: ["INBOX.Sent", "Sent", "Sent Items", "Sent Messages", "[Gmail]/Sent Mail", "INBOX.Sent Items", "Enviados", "INBOX.Enviados"],
  drafts: ["INBOX.Drafts", "Drafts", "[Gmail]/Drafts", "Rascunhos", "INBOX.Rascunhos"],
  spam: ["INBOX.Junk", "Junk", "Spam", "INBOX.Spam", "[Gmail]/Spam", "Lixo Eletronico", "Lixo Eletrônico"],
  trash: ["INBOX.Trash", "Trash", "Deleted Items", "[Gmail]/Trash", "Lixeira", "INBOX.Lixeira"],
};

function findFolder(listResp: string, candidates: string[]): string | null {
  for (const c of candidates) {
    const re = new RegExp(`"${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "i");
    if (re.test(listResp)) return c;
    if (listResp.includes(` ${c}\r\n`) || listResp.includes(` ${c}\n`)) return c;
  }
  return null;
}

function classifyError(msg: string): { code: string; action: string } {
  const m = (msg || "").toLowerCase();
  if (m.includes("login failed") || m.includes("authenticationfailed") || m.includes("invalid credentials")) {
    return { code: "auth_failed", action: "Atualize a senha desta conta em Configurações do módulo Emails." };
  }
  if (m.includes("close_notify") || m.includes("connection reset") || m.includes("broken pipe") || m.includes("eof")) {
    return { code: "connection_dropped", action: "O servidor encerrou a conexão. Nova tentativa automática no próximo ciclo; se persistir, verifique limites de conexão simultânea da conta." };
  }
  if (m.includes("timed out") || m.includes("timeout")) {
    return { code: "timeout", action: "Servidor lento ou indisponível. Nova tentativa automática." };
  }
  if (m.includes("dns") || m.includes("failed to lookup")) {
    return { code: "host_unreachable", action: "Verifique o endereço do servidor IMAP nas configurações da conta." };
  }
  return { code: "unknown", action: "Consulte o histórico de sincronização para detalhes." };
}

async function recordAccountState(
  supabase: any,
  accountId: string,
  patch: Record<string, unknown>,
) {
  const { data: cur } = await supabase
    .from("email_sync_state")
    .select("consecutive_errors, last_success_at, uidvalidity")
    .eq("account_id", accountId)
    .eq("folder", "_account")
    .maybeSingle();
  await supabase.from("email_sync_state").upsert({
    account_id: accountId,
    folder: "_account",
    last_uid: 0,
    last_synced_at: new Date().toISOString(),
    last_success_at: cur?.last_success_at ?? null,
    consecutive_errors: cur?.consecutive_errors ?? 0,
    ...patch,
  }, { onConflict: "account_id,folder" });
}

function parseUidValidity(selResp: string): number | null {
  const m = selResp.match(/UIDVALIDITY\s+(\d+)/i);
  return m ? Number(m[1]) : null;
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

interface FolderResult {
  synced: number;
  updated: number;
  new_uid: number;
  skipped_alias: number;
  skipped_dup: number;
  errors: number;
  uidvalidity_reset?: boolean;
}

async function queueFailure(supabase: any, accountId: string, folder: string, uid: number, error: string) {
  const { data: cur } = await supabase
    .from("email_reprocess_queue")
    .select("attempts")
    .eq("account_id", accountId)
    .eq("folder", folder)
    .eq("imap_uid", uid)
    .maybeSingle();
  const attempts = (cur?.attempts || 0) + 1;
  // Progressive backoff: 5min, 20min, 1h20, ... capped at 6h; give up after 5 tries.
  const delayMin = Math.min(360, 5 * Math.pow(4, attempts - 1));
  await supabase.from("email_reprocess_queue").upsert({
    account_id: accountId,
    folder,
    imap_uid: uid,
    attempts,
    next_attempt_at: new Date(Date.now() + delayMin * 60_000).toISOString(),
    last_error: (error || "").slice(0, 300),
    status: attempts >= 5 ? "failed" : "pending",
    updated_at: new Date().toISOString(),
  }, { onConflict: "account_id,folder,imap_uid" });
}

async function clearQueue(supabase: any, accountId: string, folder: string, uid: number) {
  await supabase
    .from("email_reprocess_queue")
    .update({ status: "done", updated_at: new Date().toISOString() })
    .eq("account_id", accountId)
    .eq("folder", folder)
    .eq("imap_uid", uid);
}

async function syncFolder(
  conn: Deno.TlsConn,
  supabase: any,
  account: any,
  folderLabel: string,
  serverFolder: string,
  tagPrefix: string,
  opts: { backfill?: boolean; sinceUid?: number } = {}
): Promise<FolderResult> {
  const empty: FolderResult = { synced: 0, updated: 0, new_uid: 0, skipped_alias: 0, skipped_dup: 0, errors: 0 };
  const sel = await sendCmd(conn, `${tagPrefix}S`, `SELECT "${serverFolder}"`);
  if (!sel.includes(`${tagPrefix}S OK`)) {
    console.error(`[${account.email_address}/${folderLabel}] SELECT failed`);
    return { ...empty, errors: 1 };
  }

  const serverUidValidity = parseUidValidity(sel);

  const { data: state } = await supabase
    .from("email_sync_state")
    .select("last_uid, uidvalidity")
    .eq("account_id", account.id)
    .eq("folder", folderLabel)
    .maybeSingle();

  let savedUid = state?.last_uid || 0;
  let uidValidityReset = false;
  // If the server restarted UID numbering, the saved watermark is meaningless.
  // Restart from 1 — the message_id/uid dedup below prevents duplicates.
  if (serverUidValidity && state?.uidvalidity && Number(state.uidvalidity) !== serverUidValidity) {
    console.warn(`[${account.email_address}/${folderLabel}] UIDVALIDITY changed ${state.uidvalidity} -> ${serverUidValidity}; restarting watermark`);
    savedUid = 0;
    uidValidityReset = true;
  }

  const isBackfill = !!opts.backfill;
  const startUid = isBackfill ? Math.max(1, opts.sinceUid ?? 1) : savedUid + 1;

  // Retry UIDs previously queued as failed and due now.
  const { data: dueRetries } = await supabase
    .from("email_reprocess_queue")
    .select("imap_uid")
    .eq("account_id", account.id)
    .eq("folder", folderLabel)
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .limit(5);
  const retryUids: number[] = (dueRetries || []).map((r: any) => Number(r.imap_uid));

  const searchResp = await sendCmd(conn, `${tagPrefix}U`, `UID SEARCH UID ${startUid}:*`);
  const sm = searchResp.match(/\* SEARCH\s+([\d\s]+)/);
  const searched = sm ? sm[1].trim().split(/\s+/).filter(Boolean).map(Number).filter((n) => n >= startUid) : [];
  const allUids = [...new Set([...retryUids, ...searched])].sort((a, b) => a - b);

  if (allUids.length === 0) {
    await supabase.from("email_sync_state").upsert({
      account_id: account.id,
      folder: folderLabel,
      last_uid: savedUid,
      uidvalidity: serverUidValidity,
      last_synced_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      status: "ok",
      last_error: null,
      consecutive_errors: 0,
    }, { onConflict: "account_id,folder" });
    return { ...empty, new_uid: savedUid, uidvalidity_reset: uidValidityReset };
  }

  const limit = isBackfill ? MAX_PER_FOLDER_BACKFILL : MAX_PER_FOLDER;
  const uidsToFetch = allUids.slice(0, limit);
  let lastProcessedUid = savedUid;
  let synced = 0;
  let updated = 0;
  let skippedAlias = 0;
  let skippedDup = 0;
  let errors = 0;
  const isSent = folderLabel === "sent";

  for (const uid of uidsToFetch) {
    const advance = () => { if (uid > lastProcessedUid) lastProcessedUid = uid; };
    try {
      const fetchResp = await sendCmd(conn, `${tagPrefix}F${uid}`, `UID FETCH ${uid} BODY.PEEK[]`, 30000);
      const raw = extractLiteral(fetchResp, `BODY\\[\\]`);
      if (!raw) {
        // Could not download this message: keep it in the retry queue instead of
        // silently moving the watermark past it.
        errors++;
        await queueFailure(supabase, account.id, folderLabel, uid, "download_failed");
        advance();
        continue;
      }

      const msg = parseMessage(raw);
      const snippet = buildSnippet(msg.text, msg.html);
      const receivedAt = msg.date || new Date().toISOString();

      // Alias classification (not discard)
      let isAlias = false;
      if (!isSent && folderLabel === "inbox" && msg.recipients.length > 0) {
        const myAddr = (account.email_address || "").toLowerCase();
        if (!msg.recipients.includes(myAddr)) {
          const deliveredToSibling = msg.recipients.some((r) => r.endsWith("@" + SIBLING_DOMAIN) && r !== myAddr);
          if (deliveredToSibling) {
            skippedAlias++;
            advance();
            continue;
          }
          isAlias = true;
        }
      }

      const messageId = msg.messageId || `uid-${account.id}-${folderLabel}-${uid}`;

      // Dedup by UID first (authoritative per folder), then by Message-ID.
      const { data: existingByUid } = await supabase
        .from("email_inbox")
        .select("id, parser_version")
        .eq("account_id", account.id)
        .eq("folder", folderLabel)
        .eq("imap_uid", uid)
        .maybeSingle();
      const { data: existingByMid } = existingByUid ? { data: null } : await supabase
        .from("email_inbox")
        .select("id, parser_version")
        .eq("account_id", account.id)
        .eq("folder", folderLabel)
        .eq("message_id", messageId)
        .maybeSingle();
      const existing = existingByUid || existingByMid;

      const payload: Record<string, unknown> = {
        account_id: account.id,
        message_id: messageId,
        imap_uid: uid,
        from_email: isSent ? account.email_address : (msg.from.email || "desconhecido@sem-remetente"),
        from_name: isSent ? (account.display_name || null) : (msg.from.name || null),
        to_email: isSent ? (msg.to[0]?.email || "") : account.email_address,
        to_name: isSent ? (msg.to[0]?.name || null) : null,
        subject: msg.subject || "(Sem assunto)",
        body_text: msg.text || null,
        body_html: msg.html || null,
        snippet: snippet || null,
        has_attachments: msg.attachments.some((a) => !a.inline) || msg.attachments.length > 0,
        attachments: msg.attachments,
        body_fetched_at: new Date().toISOString(),
        received_at: receivedAt,
        folder: folderLabel,
        is_alias: isAlias,
        thread_id: msg.threadId,
        in_reply_to: msg.inReplyTo,
        references_ids: msg.references.join(" ") || null,
        parse_status: msg.bodyMissing ? "empty_body" : "ok",
        parse_error: null,
        parser_version: PARSER_VERSION,
        raw_source: raw.length <= MAX_RAW_STORED ? raw : null,
      };

      if (existing) {
        // Re-parse with the current parser without touching user state
        // (read flags, star, archive) or creating a duplicate.
        const { error } = await supabase
          .from("email_inbox")
          .update({ ...payload, reprocessed_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) { errors++; await queueFailure(supabase, account.id, folderLabel, uid, error.message); }
        else { if ((existing.parser_version || 1) < PARSER_VERSION) updated++; else skippedDup++; await clearQueue(supabase, account.id, folderLabel, uid); }
        advance();
        continue;
      }

      const { error } = await supabase.from("email_inbox").insert({
        ...payload,
        is_read: isSent || folderLabel === "trash",
        is_starred: false,
        is_archived: false,
      });

      if (error) {
        errors++;
        await queueFailure(supabase, account.id, folderLabel, uid, error.message);
        console.error(`[${account.email_address}/${folderLabel}] uid=${uid} insert_error=${error.message}`);
        advance();
        continue;
      }

      synced++;
      await clearQueue(supabase, account.id, folderLabel, uid);
      advance();

      // Auto-reply (per-account toggle; default on)
      if (account.auto_reply_enabled !== false && !isAlias && !isSent && folderLabel === "inbox") {
        if (!looksAutomated(msg.headersRaw, msg.subject) && !isOwnDomain(msg.from.email)) {
          const p = sendAutoReply(supabase, account, msg.from.email, msg.subject).catch((e) => console.error("autoreply bg:", e));
          // @ts-ignore EdgeRuntime is available in Supabase edge runtime
          if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
            // @ts-ignore
            (EdgeRuntime as any).waitUntil(p);
          }
        }
      }
    } catch (e: any) {
      errors++;
      await queueFailure(supabase, account.id, folderLabel, uid, e?.message || "parse_error");
      console.error(`[${account.email_address}/${folderLabel}] uid=${uid} parse_error:`, e?.message);
      advance();
    }
  }

  await supabase.from("email_sync_state").upsert({
    account_id: account.id,
    folder: folderLabel,
    last_uid: lastProcessedUid,
    uidvalidity: serverUidValidity,
    last_synced_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    status: errors > 0 ? "partial" : "ok",
    last_error: null,
    consecutive_errors: 0,
  }, { onConflict: "account_id,folder" });

  return { synced, updated, new_uid: lastProcessedUid, skipped_alias: skippedAlias, skipped_dup: skippedDup, errors, uidvalidity_reset: uidValidityReset };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { account_id, mode, since_uid, trigger_source } = body || {};
    const backfill = mode === "backfill";
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

      // Per-account concurrency lock
      const { data: accState } = await supabase
        .from("email_sync_state")
        .select("status, locked_at, consecutive_errors, last_success_at")
        .eq("account_id", account.id)
        .eq("folder", "_account")
        .maybeSingle();
      const lockedAt = accState?.locked_at ? new Date(accState.locked_at).getTime() : 0;
      if (accState?.status === "running" && Date.now() - lockedAt < LOCK_TTL_MS) {
        results.push({ account: account.email_address, skipped: "already_running" });
        continue;
      }

      const runStart = new Date().toISOString();
      const { data: run } = await supabase.from("email_sync_runs").insert({
        account_id: account.id,
        started_at: runStart,
        result: "running",
        trigger_source: trigger_source || (account_id ? "manual" : "cron"),
      }).select("id").maybeSingle();

      await recordAccountState(supabase, account.id, { status: "running", locked_at: new Date().toISOString() });

      let conn: Deno.TlsConn | null = null;
      try {
        conn = await Deno.connectTls({ hostname: account.imap_host, port: account.imap_port || 993 });
        await readGreeting(conn);
        const login = await sendCmd(conn, "A1", `LOGIN "${account.smtp_user}" "${account.smtp_password}"`);
        if (!login.includes("A1 OK")) throw new Error("LOGIN failed");

        const listResp = await sendCmd(conn, "L1", 'LIST "" "*"');

        const folderResults: Record<string, FolderResult> = {};
        let tagN = 10;
        for (const [label, candidates] of Object.entries(FOLDER_NAMES)) {
          const server = label === "inbox" ? "INBOX" : findFolder(listResp, candidates);
          if (!server) continue;
          try {
            folderResults[label] = await syncFolder(conn, supabase, account, label, server, `T${tagN++}`, { backfill, sinceUid: since_uid });
          } catch (e: any) {
            console.error(`Folder ${label} error:`, e?.message);
            folderResults[label] = { synced: 0, updated: 0, new_uid: 0, skipped_alias: 0, skipped_dup: 0, errors: 1 };
          }
        }

        await sendCmd(conn, "Z1", "LOGOUT", 5000).catch(() => {});
        try { conn.close(); } catch { /* ignore */ }

        const totals = Object.values(folderResults).reduce(
          (a, f) => ({ n: a.n + f.synced, u: a.u + f.updated, e: a.e + f.errors }),
          { n: 0, u: 0, e: 0 },
        );

        await supabase.from("email_sync_runs").update({
          finished_at: new Date().toISOString(),
          result: totals.e > 0 ? "partial" : "success",
          new_count: totals.n,
          updated_count: totals.u,
          failed_count: totals.e,
          folders: folderResults,
        }).eq("id", run?.id);

        await recordAccountState(supabase, account.id, {
          status: totals.e > 0 ? "partial" : "ok",
          locked_at: null,
          last_error: null,
          consecutive_errors: 0,
          last_success_at: new Date().toISOString(),
        });

        results.push({ account: account.email_address, folders: folderResults, new: totals.n, updated: totals.u, failed: totals.e });
      } catch (e: any) {
        try { conn?.close(); } catch { /* ignore */ }
        const msg = e?.message || "unknown";
        const { code, action } = classifyError(msg);
        const consecutive = (accState?.consecutive_errors || 0) + 1;

        await supabase.from("email_sync_runs").update({
          finished_at: new Date().toISOString(),
          result: "error",
          error_code: code,
          error_summary: msg.slice(0, 300),
          recommended_action: action,
        }).eq("id", run?.id);

        await recordAccountState(supabase, account.id, {
          status: code === "auth_failed" ? "auth_required" : "error",
          locked_at: null,
          last_error: msg.slice(0, 500),
          consecutive_errors: consecutive,
        });

        console.error(`Account ${account.email_address} error [${code}]:`, msg);
        results.push({ account: account.email_address, error: code });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error("sync-imap-inbox fatal:", e?.message);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
