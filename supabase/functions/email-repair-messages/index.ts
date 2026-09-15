import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseMessage, buildSnippet, PARSER_VERSION } from "../_shared/mimeParser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Controlled repair of previously mis-parsed messages.
// - preview (default): reparses and returns before/after, writes nothing.
// - apply: writes the new values, keeping a backup of the previous ones in
//   original_backup so the repair can be reverted per message.
// Never creates rows, never deletes rows, never touches read/star/archive
// state, links or categories, and never triggers auto-reply or automations.

async function readGreeting(conn: Deno.TlsConn): Promise<void> {
  const buf = new Uint8Array(8192);
  await conn.read(buf);
}

async function sendCmd(conn: Deno.TlsConn, tag: string, cmd: string, timeoutMs = 25000): Promise<string> {
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

function extractLiteral(block: string): string {
  const m = block.match(/BODY\[\]\s*\{(\d+)\}/);
  if (!m) return "";
  const size = parseInt(m[1]);
  const startIdx = block.indexOf(m[0]) + m[0].length;
  const contentStart = block.indexOf("\r\n", startIdx);
  if (contentStart === -1) return "";
  return block.substring(contentStart + 2, contentStart + 2 + size);
}

const FOLDER_CANDIDATES: Record<string, string[]> = {
  inbox: ["INBOX"],
  sent: ["INBOX.Sent", "Sent", "Sent Items", "[Gmail]/Sent Mail", "Enviados"],
  drafts: ["INBOX.Drafts", "Drafts", "Rascunhos"],
  spam: ["INBOX.Junk", "Junk", "Spam", "INBOX.Spam"],
  trash: ["INBOX.Trash", "Trash", "Lixeira"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const mode: "preview" | "apply" | "revert" = body.mode || "preview";
    const accountId: string | undefined = body.account_id;
    const limit = Math.min(Number(body.limit) || 30, 100);
    const ids: string[] | undefined = body.email_ids;

    // Caller must be an authenticated admin.
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    const { data: userData } = await supabase.auth.getUser(jwt);
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });

    if (mode === "revert") {
      const targets = ids || [];
      let reverted = 0;
      for (const id of targets) {
        const { data: row } = await supabase.from("email_inbox").select("id, original_backup").eq("id", id).maybeSingle();
        if (!row?.original_backup) continue;
        await supabase.from("email_inbox").update({ ...(row.original_backup as Record<string, unknown>), original_backup: null, reprocessed_at: null }).eq("id", id);
        reverted++;
      }
      return new Response(JSON.stringify({ success: true, reverted }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Select defective messages: old parser + (mojibake subject | empty body | unknown sender | header leak)
    let q = supabase
      .from("email_inbox")
      .select("id, account_id, folder, imap_uid, message_id, subject, from_email, from_name, body_text, body_html, snippet, attachments, has_attachments, raw_source, parser_version")
      .lt("parser_version", PARSER_VERSION)
      .not("imap_uid", "is", null)
      .order("received_at", { ascending: false })
      .limit(limit);
    if (accountId) q = q.eq("account_id", accountId);
    if (ids?.length) q = supabase.from("email_inbox").select("*").in("id", ids);

    const { data: rows, error } = await q;
    if (error) throw error;

    const candidates = (rows || []).filter((r: any) =>
      ids?.length ? true :
      /Ã.|â€|Â./.test(r.subject || "") ||
      (!r.body_text && !r.body_html) ||
      r.from_email === "unknown@email.com" ||
      /authentication-results|dkim|spf=/i.test(r.subject || "")
    );

    const results: any[] = [];
    const byAccount = new Map<string, any[]>();
    for (const r of candidates) {
      if (!byAccount.has(r.account_id)) byAccount.set(r.account_id, []);
      byAccount.get(r.account_id)!.push(r);
    }

    for (const [accId, list] of byAccount) {
      const { data: account } = await supabase.from("email_accounts").select("*").eq("id", accId).maybeSingle();
      let conn: Deno.TlsConn | null = null;
      let currentFolder = "";
      try {
        for (const row of list) {
          let raw: string = row.raw_source || "";
          if (!raw && account?.imap_host && row.imap_uid) {
            if (!conn) {
              conn = await Deno.connectTls({ hostname: account.imap_host, port: account.imap_port || 993 });
              await readGreeting(conn);
              const login = await sendCmd(conn, "R1", `LOGIN "${account.smtp_user}" "${account.smtp_password}"`);
              if (!login.includes("R1 OK")) throw new Error("login_failed");
            }
            const folder = row.folder || "inbox";
            if (folder !== currentFolder) {
              const listResp = await sendCmd(conn, "R2L", 'LIST "" "*"');
              let selected = "";
              for (const c of FOLDER_CANDIDATES[folder] || ["INBOX"]) {
                if (c !== "INBOX" && !listResp.includes(c)) continue;
                const sel = await sendCmd(conn, "R2", `SELECT "${c}"`);
                if (sel.includes("R2 OK")) { selected = c; break; }
              }
              if (!selected) { results.push({ id: row.id, status: "folder_not_found" }); continue; }
              currentFolder = folder;
            }
            const fetchResp = await sendCmd(conn, `R3${row.imap_uid}`, `UID FETCH ${row.imap_uid} BODY.PEEK[]`, 45000);
            raw = extractLiteral(fetchResp);
          }

          if (!raw || raw.length < 10) {
            results.push({ id: row.id, status: "source_unavailable", subject_before: row.subject });
            continue;
          }

          const msg = parseMessage(raw);
          const snippet = buildSnippet(msg.text, msg.html);
          const isSent = row.folder === "sent";

          const after: Record<string, unknown> = {
            subject: msg.subject || row.subject,
            body_text: msg.text || row.body_text,
            body_html: msg.html || row.body_html,
            snippet: snippet || row.snippet,
            attachments: msg.attachments.length ? msg.attachments : row.attachments,
            has_attachments: msg.attachments.length > 0 || !!row.has_attachments,
            thread_id: msg.threadId,
            in_reply_to: msg.inReplyTo,
            references_ids: msg.references.join(" ") || null,
            parse_status: msg.bodyMissing ? "empty_body" : "ok",
            parser_version: PARSER_VERSION,
            raw_source: raw.length <= 200_000 ? raw : null,
          };
          if (!isSent && msg.from.email) {
            after.from_email = msg.from.email;
            after.from_name = msg.from.name || row.from_name;
          }

          results.push({
            id: row.id,
            status: mode === "apply" ? "applied" : "preview",
            before: { subject: row.subject, from: row.from_email, from_name: row.from_name, snippet: row.snippet, has_body: !!(row.body_text || row.body_html) },
            after: { subject: after.subject, from: after.from_email ?? row.from_email, from_name: after.from_name ?? row.from_name, snippet: after.snippet, has_body: !!(after.body_text || after.body_html) },
          });

          if (mode === "apply") {
            await supabase.from("email_inbox").update({
              ...after,
              reprocessed_at: new Date().toISOString(),
              original_backup: {
                subject: row.subject,
                from_email: row.from_email,
                from_name: row.from_name,
                body_text: row.body_text,
                body_html: row.body_html,
                snippet: row.snippet,
                attachments: row.attachments,
                has_attachments: row.has_attachments,
                parser_version: row.parser_version,
              },
            }).eq("id", row.id);
          }
        }
      } catch (e: any) {
        results.push({ account_id: accId, status: "error", error: e?.message });
      } finally {
        try { if (conn) { await sendCmd(conn, "R9", "LOGOUT", 5000).catch(() => {}); conn.close(); } } catch { /* ignore */ }
      }
    }

    const summary = {
      examined: candidates.length,
      repaired: results.filter((r) => r.status === "applied").length,
      preview: results.filter((r) => r.status === "preview").length,
      source_unavailable: results.filter((r) => r.status === "source_unavailable").length,
      errors: results.filter((r) => r.status === "error").length,
    };

    return new Response(JSON.stringify({ success: true, mode, summary, results }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error("email-repair-messages error:", e?.message);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
