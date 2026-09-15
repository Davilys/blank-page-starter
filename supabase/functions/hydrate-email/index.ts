import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseMessage, buildSnippet, PARSER_VERSION } from "../_shared/mimeParser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  sent: ["INBOX.Sent", "Sent", "Sent Items", "Sent Messages", "[Gmail]/Sent Mail", "INBOX.Sent Items", "Enviados"],
  drafts: ["INBOX.Drafts", "Drafts", "[Gmail]/Drafts", "Rascunhos"],
  spam: ["INBOX.Junk", "Junk", "Spam", "INBOX.Spam", "[Gmail]/Spam"],
  trash: ["INBOX.Trash", "Trash", "Deleted Items", "[Gmail]/Trash", "Lixeira"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email_id, force } = await req.json();
    if (!email_id) throw new Error("email_id is required");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: email, error: emailErr } = await supabase
      .from("email_inbox")
      .select("id, message_id, folder, imap_uid, raw_source, body_text, body_html, body_fetched_at, account_id, parser_version")
      .eq("id", email_id)
      .single();
    if (emailErr || !email) throw new Error("Email not found");

    const upToDate = (email.parser_version || 1) >= PARSER_VERSION && (email.body_text || email.body_html);
    if (!force && upToDate) {
      return new Response(JSON.stringify({ success: true, already_hydrated: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 1) Reuse the stored original when we already have it — no server round-trip.
    let raw: string = email.raw_source || "";

    if (!raw) {
      const { data: account, error: accErr } = await supabase
        .from("email_accounts").select("*").eq("id", email.account_id).single();
      if (accErr || !account?.imap_host) throw new Error("IMAP not configured");

      const conn = await Deno.connectTls({ hostname: account.imap_host, port: account.imap_port || 993 });
      try {
        await readGreeting(conn);
        const loginResp = await sendCmd(conn, "H001", `LOGIN "${account.smtp_user}" "${account.smtp_password}"`);
        if (!loginResp.includes("H001 OK")) throw new Error("IMAP login failed");

        const listResp = await sendCmd(conn, "H002L", 'LIST "" "*"');
        const candidates = FOLDER_CANDIDATES[email.folder || "inbox"] || ["INBOX"];
        let selected = "";
        for (const c of candidates) {
          if (c !== "INBOX" && !listResp.includes(c)) continue;
          const sel = await sendCmd(conn, "H002", `SELECT "${c}"`);
          if (sel.includes("H002 OK")) { selected = c; break; }
        }
        if (!selected) throw new Error("folder_not_found");

        let fetchResp = "";
        if (email.imap_uid) {
          fetchResp = await sendCmd(conn, "H004", `UID FETCH ${email.imap_uid} BODY.PEEK[]`, 60000);
          raw = extractLiteral(fetchResp);
        }
        if (!raw && email.message_id) {
          const searchResp = await sendCmd(conn, "H003", `UID SEARCH HEADER MESSAGE-ID "${email.message_id}"`);
          const uid = searchResp.match(/\* SEARCH\s+([\d\s]+)/)?.[1]?.trim().split(/\s+/)[0];
          if (uid) {
            fetchResp = await sendCmd(conn, "H005", `UID FETCH ${uid} BODY.PEEK[]`, 60000);
            raw = extractLiteral(fetchResp);
          }
        }
        await sendCmd(conn, "H099", "LOGOUT", 5000).catch(() => {});
      } finally {
        try { conn.close(); } catch { /* ignore */ }
      }
    }

    if (!raw || raw.length < 10) {
      // Do NOT overwrite the stored body with a fake placeholder — flag the state.
      await supabase.from("email_inbox").update({
        parse_status: "source_unavailable",
        parse_error: "Mensagem não localizada no servidor",
      }).eq("id", email_id);
      return new Response(JSON.stringify({ success: false, reason: "source_unavailable" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const msg = parseMessage(raw);
    const snippet = buildSnippet(msg.text, msg.html);

    const update: Record<string, unknown> = {
      body_text: msg.text || null,
      body_html: msg.html || null,
      snippet: snippet || null,
      has_attachments: msg.attachments.length > 0,
      attachments: msg.attachments,
      body_fetched_at: new Date().toISOString(),
      thread_id: msg.threadId,
      in_reply_to: msg.inReplyTo,
      references_ids: msg.references.join(" ") || null,
      parser_version: PARSER_VERSION,
      parse_status: msg.bodyMissing ? "empty_body" : "ok",
      parse_error: null,
      raw_source: raw.length <= 200_000 ? raw : null,
    };
    // Never replace a good subject/sender with an empty one.
    if (msg.subject) update.subject = msg.subject;
    if (email.folder !== "sent" && msg.from.email) {
      update.from_email = msg.from.email;
      update.from_name = msg.from.name || null;
    }

    await supabase.from("email_inbox").update(update).eq("id", email_id);

    return new Response(JSON.stringify({
      success: true,
      body_text: msg.text,
      body_html: msg.html,
      attachments: msg.attachments,
      snippet,
      empty: msg.bodyMissing,
    }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Hydrate email error:", error?.message);
    return new Response(JSON.stringify({ error: error?.message || "unknown" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
