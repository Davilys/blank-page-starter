import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  account_id?: string;
}

// ==== MIME RFC 2047 Decoder ====
function decodeMimeWords(input: string): string {
  if (!input || !input.includes("=?")) return input;
  return input.replace(
    /=\?([^?]+)\?(Q|B)\?([^?]*)\?=/gi,
    (_match, _charset, encoding, encoded) => {
      try {
        if (encoding.toUpperCase() === "B") {
          // Base64
          const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
          return new TextDecoder("utf-8").decode(bytes);
        }
        // Quoted-Printable
        const decoded = encoded
          .replace(/_/g, " ")
          .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) =>
            String.fromCharCode(parseInt(hex, 16))
          );
        // Try UTF-8 decode for multi-byte chars
        const bytes = new Uint8Array([...decoded].map(c => c.charCodeAt(0)));
        return new TextDecoder("utf-8").decode(bytes);
      } catch {
        return encoded;
      }
    }
  ).replace(/\r?\n[ \t]+/g, ""); // unfold headers
}

async function sendCommand(
  conn: Deno.TcpConn | Deno.TlsConn,
  tag: string,
  command: string
): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  await conn.write(encoder.encode(`${tag} ${command}\r\n`));

  const buffer = new Uint8Array(32768);
  let response = "";
  const deadline = Date.now() + 8000;

  while (Date.now() < deadline) {
    const n = await conn.read(buffer);
    if (n === null) break;
    response += decoder.decode(buffer.subarray(0, n));
    if (
      response.includes(`${tag} OK`) ||
      response.includes(`${tag} NO`) ||
      response.includes(`${tag} BAD`)
    ) {
      break;
    }
  }

  return response;
}

async function readGreeting(conn: Deno.TcpConn | Deno.TlsConn): Promise<string> {
  const decoder = new TextDecoder();
  const buffer = new Uint8Array(4096);
  const n = await conn.read(buffer);
  if (n === null) return "";
  return decoder.decode(buffer.subarray(0, n));
}

function parseEnvelopeHeaders(raw: string): {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  subject: string;
  date: string;
  messageId: string;
} {
  const fromMatch = raw.match(/From:\s*(?:"?([^"<]*)"?\s*)?<?([^>\r\n]+)>?/i);
  const toMatch = raw.match(/To:\s*(?:"?([^"<]*)"?\s*)?<?([^>\r\n]+)>?/i);
  const subjectMatch = raw.match(/Subject:\s*(.+?)(?:\r\n(?![ \t])|\r?\n(?![ \t]))/is);
  const dateMatch = raw.match(/Date:\s*(.+?)(?:\r\n|\r?\n)/i);
  const messageIdMatch = raw.match(/Message-ID:\s*<?([^>\r\n]+)>?/i);

  const rawSubject = subjectMatch?.[1]?.trim().replace(/\r?\n[ \t]+/g, " ") || "(Sem assunto)";

  return {
    fromName: decodeMimeWords(fromMatch?.[1]?.trim() || ""),
    from: fromMatch?.[2]?.trim() || "unknown@email.com",
    toName: decodeMimeWords(toMatch?.[1]?.trim() || ""),
    to: toMatch?.[2]?.trim() || "",
    subject: decodeMimeWords(rawSubject),
    date: dateMatch?.[1]?.trim() || new Date().toISOString(),
    messageId:
      messageIdMatch?.[1]?.trim() ||
      `${Date.now()}-${Math.random().toString(36)}`,
  };
}

async function syncFolder(
  conn: Deno.TcpConn | Deno.TlsConn,
  supabase: any,
  emailAccount: any,
  folderName: string,
  folderLabel: string,
  tagPrefix: number,
  batchSize: number
): Promise<{ synced: { subject: string; from: string }[]; total: number }> {
  const selectResp = await sendCommand(conn, `F${tagPrefix}`, `SELECT "${folderName}"`);
  
  if (selectResp.includes(`F${tagPrefix} NO`) || selectResp.includes(`F${tagPrefix} BAD`)) {
    console.log(`Folder "${folderName}" not found, skipping`);
    return { synced: [], total: 0 };
  }

  const existsMatch = selectResp.match(/\* (\d+) EXISTS/);
  const totalMessages = existsMatch ? parseInt(existsMatch[1]) : 0;
  console.log(`${folderName} has ${totalMessages} messages`);

  const syncedEmails: { subject: string; from: string }[] = [];

  if (totalMessages > 0) {
    let currentStart = 1;

    while (currentStart <= totalMessages) {
      const currentEnd = Math.min(currentStart + batchSize - 1, totalMessages);
      console.log(`[${folderName}] Fetching batch ${currentStart}:${currentEnd} of ${totalMessages}`);

      const fetchTag = `F${tagPrefix}B${currentStart}`;
      const fetchResp = await sendCommand(
        conn,
        fetchTag,
        `FETCH ${currentStart}:${currentEnd} (BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)])`
      );

      const headerBlocks = fetchResp.split(/\* \d+ FETCH/);

      for (const block of headerBlocks) {
        if (!block.trim() || block.length < 30) continue;

        try {
          const headers = parseEnvelopeHeaders(block);

          const { data: existing } = await supabase
            .from("email_inbox")
            .select("id")
            .eq("message_id", headers.messageId)
            .eq("folder", folderLabel)
            .single();

          if (!existing) {
            const isSent = folderLabel === "sent";
            const emailData = {
              account_id: emailAccount.id,
              message_id: headers.messageId,
              from_email: isSent ? emailAccount.email_address : headers.from,
              from_name: isSent ? (emailAccount.display_name || null) : (headers.fromName || null),
              to_email: isSent ? (headers.to || "") : emailAccount.email_address,
              to_name: isSent ? (headers.toName || null) : null,
              subject: headers.subject,
              body_text: null,
              body_html: null,
              received_at: new Date(headers.date).toISOString(),
              is_read: isSent ? true : false,
              is_starred: false,
              is_archived: false,
              folder: folderLabel,
            };

            const { error: insertError } = await supabase
              .from("email_inbox")
              .insert(emailData);

            if (!insertError) {
              syncedEmails.push({
                subject: headers.subject,
                from: headers.from,
              });
            }
          }
        } catch (parseError) {
          console.error(`[${folderName}] Error parsing message:`, parseError);
        }
      }

      currentStart = currentEnd + 1;
    }
  }

  return { synced: syncedEmails, total: totalMessages };
}

const SENT_FOLDER_NAMES = [
  "Sent",
  "INBOX.Sent", 
  "Sent Items",
  "Sent Messages",
  "[Gmail]/Sent Mail",
  "INBOX.Sent Items",
  "Enviados",
];

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { account_id }: SyncRequest = await req.json().catch(() => ({}));
    const batchSize = 10;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase.from("email_accounts").select("*");
    if (account_id) {
      query = query.eq("id", account_id);
    } else {
      query = query.eq("is_default", true);
    }

    const { data: emailAccount, error: accountError } = await query.single();

    if (accountError || !emailAccount) {
      return new Response(
        JSON.stringify({ error: "No email account configured" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!emailAccount.imap_host || !emailAccount.imap_port) {
      return new Response(
        JSON.stringify({ error: "IMAP not configured for this account" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Connecting to IMAP:", emailAccount.imap_host, emailAccount.imap_port);

    const conn = await Deno.connectTls({
      hostname: emailAccount.imap_host,
      port: emailAccount.imap_port,
    });

    await readGreeting(conn);
    console.log("Server greeting received");

    const loginResp = await sendCommand(
      conn,
      "A001",
      `LOGIN "${emailAccount.smtp_user}" "${emailAccount.smtp_password}"`
    );
    if (!loginResp.includes("A001 OK")) {
      conn.close();
      throw new Error("IMAP login failed");
    }
    console.log("Logged in successfully");

    // 1. Sync INBOX
    const inboxResult = await syncFolder(conn, supabase, emailAccount, "INBOX", "inbox", 1, batchSize);

    // 2. List folders to find Sent folder
    const listResp = await sendCommand(conn, "L001", 'LIST "" "*"');
    console.log("Available folders:", listResp.substring(0, 500));

    // 3. Try to find and sync Sent folder
    let sentResult = { synced: [] as { subject: string; from: string }[], total: 0 };
    for (const sentName of SENT_FOLDER_NAMES) {
      if (listResp.includes(sentName)) {
        console.log(`Found sent folder: ${sentName}`);
        sentResult = await syncFolder(conn, supabase, emailAccount, sentName, "sent", 2, batchSize);
        break;
      }
    }

    // Logout
    await sendCommand(conn, "Z001", "LOGOUT");
    conn.close();

    const totalSynced = inboxResult.synced.length + sentResult.synced.length;
    console.log(`Synced ${totalSynced} new emails (inbox: ${inboxResult.synced.length}, sent: ${sentResult.synced.length})`);

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: totalSynced,
        inbox: { synced: inboxResult.synced.length, total: inboxResult.total },
        sent: { synced: sentResult.synced.length, total: sentResult.total },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error syncing IMAP:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
