import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FOLDER_NAMES: Record<string, string[]> = {
  inbox:  ["INBOX"],
  sent:   ["INBOX.Sent", "Sent", "Sent Items", "Sent Messages", "Enviados", "INBOX.Enviados"],
  drafts: ["INBOX.Drafts", "Drafts", "Rascunhos", "INBOX.Rascunhos"],
  spam:   ["INBOX.Junk", "Junk", "Spam", "INBOX.Spam", "Lixo Eletronico", "Lixo Eletrônico"],
  trash:  ["INBOX.Trash", "Trash", "Deleted Items", "Lixeira", "INBOX.Lixeira"],
};

async function sendCmd(conn: Deno.TlsConn, tag: string, cmd: string, timeoutMs = 15000): Promise<string> {
  await conn.write(new TextEncoder().encode(`${tag} ${cmd}\r\n`));
  const chunks: string[] = [];
  let tail = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const buf = new Uint8Array(8192);
    const n = await conn.read(buf);
    if (n === null) break;
    const text = new TextDecoder().decode(buf.subarray(0, n));
    chunks.push(text);
    tail = (tail + text).slice(-500);
    if (tail.includes(`${tag} OK`) || tail.includes(`${tag} NO`) || tail.includes(`${tag} BAD`)) break;
  }
  return chunks.join("");
}

function findFolder(listResp: string, candidates: string[]): string | null {
  for (const c of candidates) {
    const re = new RegExp(`"${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "i");
    if (re.test(listResp)) return c;
    if (listResp.includes(` ${c}\r\n`) || listResp.includes(` ${c}\n`)) return c;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email_id, action } = await req.json();
    if (!email_id || !action) {
      return new Response(JSON.stringify({ error: "missing email_id or action" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!["mark_read", "mark_unread", "delete"].includes(action)) {
      return new Response(JSON.stringify({ error: "invalid action" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: email, error: emailErr } = await supabase
      .from("email_inbox")
      .select("id, account_id, folder, imap_uid")
      .eq("id", email_id)
      .maybeSingle();
    if (emailErr || !email) {
      return new Response(JSON.stringify({ error: "email not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!email.imap_uid) {
      return new Response(JSON.stringify({ ok: true, skipped: "no imap_uid" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: account } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", email.account_id)
      .maybeSingle();
    if (!account?.imap_host) {
      return new Response(JSON.stringify({ ok: true, skipped: "no imap_host" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const conn = await Deno.connectTls({ hostname: account.imap_host, port: account.imap_port || 993 });
    const greet = new Uint8Array(4096); await conn.read(greet);
    try {
      const login = await sendCmd(conn, "A1", `LOGIN "${account.smtp_user}" "${account.smtp_password}"`);
      if (!login.includes("A1 OK")) throw new Error("LOGIN failed");

      let serverFolder = "INBOX";
      if (email.folder !== "inbox") {
        const listResp = await sendCmd(conn, "L1", 'LIST "" "*"');
        const candidates = FOLDER_NAMES[email.folder] || ["INBOX"];
        serverFolder = findFolder(listResp, candidates) || "INBOX";
      }
      const sel = await sendCmd(conn, "S1", `SELECT "${serverFolder}"`);
      if (!sel.includes("S1 OK")) throw new Error(`SELECT ${serverFolder} failed`);

      if (action === "mark_read") {
        await sendCmd(conn, "F1", `UID STORE ${email.imap_uid} +FLAGS (\\Seen)`);
      } else if (action === "mark_unread") {
        await sendCmd(conn, "F1", `UID STORE ${email.imap_uid} -FLAGS (\\Seen)`);
      } else if (action === "delete") {
        await sendCmd(conn, "F1", `UID STORE ${email.imap_uid} +FLAGS (\\Deleted)`);
        await sendCmd(conn, "E1", `EXPUNGE`);
      }

      await sendCmd(conn, "Z1", "LOGOUT", 5000).catch(() => {});
    } finally {
      try { conn.close(); } catch { /* ignore */ }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error("update-imap-flag error:", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});