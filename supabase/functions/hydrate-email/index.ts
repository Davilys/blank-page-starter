import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ==== MIME helpers ====

function decodeMimeWords(input: string): string {
  if (!input || !input.includes("=?")) return input;
  return input.replace(
    /=\?([^?]+)\?(Q|B)\?([^?]*)\?=/gi,
    (_match, _charset, encoding, encoded) => {
      try {
        if (encoding.toUpperCase() === "B") {
          const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
          return new TextDecoder("utf-8").decode(bytes);
        }
        const decoded = encoded
          .replace(/_/g, " ")
          .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) =>
            String.fromCharCode(parseInt(hex, 16))
          );
        const bytes = new Uint8Array([...decoded].map(c => c.charCodeAt(0)));
        return new TextDecoder("utf-8").decode(bytes);
      } catch { return encoded; }
    }
  ).replace(/\r?\n[ \t]+/g, "");
}

function decodeQP(input: string): string {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

function decodeBase64ToString(input: string): string {
  try {
    const cleaned = input.replace(/\s/g, "");
    const bytes = Uint8Array.from(atob(cleaned), c => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return input;
  }
}

function decodeContent(body: string, encoding: string): string {
  const enc = (encoding || "7bit").trim().toLowerCase();
  if (enc === "base64") return decodeBase64ToString(body);
  if (enc === "quoted-printable") return decodeQP(body);
  return body;
}

function getHeaderValue(headers: string, name: string): string {
  const unfolded = headers.replace(/\r?\n[ \t]+/g, " ");
  const regex = new RegExp(`^${name}:\\s*(.+?)$`, "im");
  const match = unfolded.match(regex);
  return match?.[1]?.trim() || "";
}

function getBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary="?([^"\s;]+)"?/i);
  return match?.[1] || null;
}

interface AttachmentMeta {
  filename: string;
  content_type: string;
  size: number;
}

interface ParsedEmail {
  text: string;
  html: string;
  attachments: AttachmentMeta[];
}

function parseMimePart(raw: string): ParsedEmail {
  // Find header/body separator
  let divIdx = raw.indexOf("\r\n\r\n");
  let sepLen = 4;
  if (divIdx === -1) {
    divIdx = raw.indexOf("\n\n");
    sepLen = 2;
  }
  if (divIdx === -1) return { text: raw, html: "", attachments: [] };

  const headers = raw.substring(0, divIdx);
  const body = raw.substring(divIdx + sepLen);

  const ct = getHeaderValue(headers, "Content-Type") || "text/plain";
  const cte = getHeaderValue(headers, "Content-Transfer-Encoding") || "7bit";
  const cd = getHeaderValue(headers, "Content-Disposition") || "";

  // Multipart
  if (ct.toLowerCase().startsWith("multipart/")) {
    const boundary = getBoundary(ct);
    if (!boundary) return { text: body, html: "", attachments: [] };

    const parts = body.split("--" + boundary);
    let text = "", html = "";
    const attachments: AttachmentMeta[] = [];

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith("--")) break;

      const trimmed = part.replace(/^\r?\n/, "");
      if (!trimmed.trim()) continue;

      const result = parseMimePart(trimmed);
      if (result.text && !text) text = result.text;
      if (result.html && !html) html = result.html;
      attachments.push(...result.attachments);
    }

    return { text, html, attachments };
  }

  // Attachment check
  const isAttachment =
    cd.toLowerCase().includes("attachment") ||
    (cd.toLowerCase().includes("filename") && !ct.toLowerCase().startsWith("text/"));

  if (isAttachment) {
    const fnMatch = (cd + "; " + ct).match(/(?:file)?name="?([^"\r\n;]+)"?/i);
    const filename = decodeMimeWords(fnMatch?.[1]?.trim() || "attachment");
    return {
      text: "", html: "",
      attachments: [{ filename, content_type: ct.split(";")[0].trim(), size: body.length }],
    };
  }

  // Inline content with filename (likely inline attachment)
  if (cd.toLowerCase().includes("inline") && !ct.toLowerCase().startsWith("text/")) {
    const fnMatch = (cd + "; " + ct).match(/(?:file)?name="?([^"\r\n;]+)"?/i);
    if (fnMatch) {
      return {
        text: "", html: "",
        attachments: [{ filename: decodeMimeWords(fnMatch[1].trim()), content_type: ct.split(";")[0].trim(), size: body.length }],
      };
    }
  }

  // Decode body content
  const decoded = decodeContent(body.trim(), cte);

  if (ct.toLowerCase().includes("text/html")) {
    return { text: "", html: decoded, attachments: [] };
  }
  if (ct.toLowerCase().includes("text/plain")) {
    return { text: decoded, html: "", attachments: [] };
  }

  // Unknown inline, check for name
  const nameMatch = ct.match(/name="?([^"\r\n;]+)"?/i);
  if (nameMatch) {
    return {
      text: "", html: "",
      attachments: [{ filename: nameMatch[1], content_type: ct.split(";")[0].trim(), size: body.length }],
    };
  }

  return { text: decoded, html: "", attachments: [] };
}

// ==== IMAP helpers ====

async function readGreeting(conn: Deno.TlsConn): Promise<void> {
  const buf = new Uint8Array(4096);
  await conn.read(buf);
}

async function sendCmd(
  conn: Deno.TlsConn,
  tag: string,
  cmd: string,
  timeoutMs = 30000
): Promise<string> {
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
    if (
      tail.includes(`${tag} OK`) ||
      tail.includes(`${tag} NO`) ||
      tail.includes(`${tag} BAD`)
    ) {
      break;
    }
  }

  return chunks.join("");
}

const SENT_FOLDER_NAMES = [
  "Sent", "INBOX.Sent", "Sent Items", "Sent Messages",
  "[Gmail]/Sent Mail", "INBOX.Sent Items", "Enviados",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email_id } = await req.json();
    if (!email_id) throw new Error("email_id is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get email record with account info
    const { data: email, error: emailErr } = await supabase
      .from("email_inbox")
      .select("id, message_id, folder, body_text, body_html, body_fetched_at, account_id")
      .eq("id", email_id)
      .single();

    if (emailErr || !email) throw new Error("Email not found");

    // Already hydrated?
    if (email.body_fetched_at && (email.body_text || email.body_html)) {
      return new Response(
        JSON.stringify({ success: true, already_hydrated: true }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get account credentials
    const { data: account, error: accErr } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", email.account_id)
      .single();

    if (accErr || !account?.imap_host) throw new Error("IMAP not configured");

    console.log(`Hydrating email ${email_id}, connecting to ${account.imap_host}`);

    // Connect to IMAP
    const conn = await Deno.connectTls({
      hostname: account.imap_host,
      port: account.imap_port || 993,
    });
    await readGreeting(conn);

    // Login
    const loginResp = await sendCmd(
      conn, "H001",
      `LOGIN "${account.smtp_user}" "${account.smtp_password}"`
    );
    if (!loginResp.includes("H001 OK")) {
      conn.close();
      throw new Error("IMAP login failed");
    }

    // Select the right folder
    let folderSelected = false;
    if (email.folder === "sent") {
      // List folders first to find the right sent folder
      const listResp = await sendCmd(conn, "H002L", 'LIST "" "*"');
      for (const sf of SENT_FOLDER_NAMES) {
        if (listResp.includes(sf)) {
          const selResp = await sendCmd(conn, "H002", `SELECT "${sf}"`);
          if (selResp.includes("H002 OK")) { folderSelected = true; break; }
        }
      }
    } else {
      const selResp = await sendCmd(conn, "H002", "SELECT INBOX");
      if (selResp.includes("H002 OK")) folderSelected = true;
    }

    if (!folderSelected) {
      conn.close();
      await supabase.from("email_inbox").update({
        body_fetched_at: new Date().toISOString(),
        body_text: "(Pasta não encontrada no servidor)",
      }).eq("id", email_id);
      return new Response(
        JSON.stringify({ success: true, body_text: "(Pasta não encontrada no servidor)" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Search by Message-ID
    const searchResp = await sendCmd(
      conn, "H003",
      `SEARCH HEADER MESSAGE-ID "${email.message_id}"`
    );
    const searchMatch = searchResp.match(/\* SEARCH\s+([\d\s]+)/);

    if (!searchMatch || !searchMatch[1].trim()) {
      conn.close();
      console.log("Message not found on server for ID:", email.message_id);
      await supabase.from("email_inbox").update({
        body_fetched_at: new Date().toISOString(),
        body_text: "(Conteúdo não disponível no servidor)",
      }).eq("id", email_id);
      return new Response(
        JSON.stringify({ success: true, body_text: "(Conteúdo não disponível no servidor)" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const seqNum = searchMatch[1].trim().split(/\s+/)[0];
    console.log(`Found message at sequence ${seqNum}, fetching body...`);

    // Fetch full message (60s timeout for large messages)
    const fetchResp = await sendCmd(
      conn, "H004",
      `FETCH ${seqNum} BODY.PEEK[]`,
      60000
    );

    // Logout and close
    await sendCmd(conn, "H099", "LOGOUT", 5000).catch(() => {});
    try { conn.close(); } catch { /* ignore */ }

    // Extract raw message from FETCH response
    // Format: * N FETCH (BODY[] {SIZE}\r\n<content>)\r\nH004 OK ...
    let rawMessage = "";
    const literalMatch = fetchResp.match(/BODY\[\]\s*\{(\d+)\}/);
    if (literalMatch) {
      const size = parseInt(literalMatch[1]);
      const startIdx = fetchResp.indexOf(literalMatch[0]) + literalMatch[0].length;
      // Skip the \r\n after {size}
      const contentStart = fetchResp.indexOf("\r\n", startIdx);
      if (contentStart !== -1) {
        rawMessage = fetchResp.substring(contentStart + 2, contentStart + 2 + size);
      }
    }

    if (!rawMessage) {
      // Fallback: try to find body between FETCH ( and closing )
      const bodyIdx = fetchResp.indexOf("BODY[]");
      if (bodyIdx !== -1) {
        const afterBody = fetchResp.substring(bodyIdx);
        const firstNewline = afterBody.indexOf("\r\n");
        if (firstNewline !== -1) {
          rawMessage = afterBody.substring(firstNewline + 2);
          const closeIdx = rawMessage.lastIndexOf("\r\nH004 OK");
          if (closeIdx !== -1) rawMessage = rawMessage.substring(0, closeIdx);
          // Remove trailing )
          if (rawMessage.endsWith(")\r\n")) rawMessage = rawMessage.slice(0, -3);
          else if (rawMessage.endsWith(")")) rawMessage = rawMessage.slice(0, -1);
        }
      }
    }

    if (!rawMessage || rawMessage.length < 10) {
      console.error("Could not extract message body from FETCH response");
      await supabase.from("email_inbox").update({
        body_fetched_at: new Date().toISOString(),
        body_text: "(Erro ao processar conteúdo do email)",
      }).eq("id", email_id);
      return new Response(
        JSON.stringify({ success: false, error: "Could not extract message body" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Raw message extracted (${rawMessage.length} chars), parsing MIME...`);

    // Parse MIME
    const parsed = parseMimePart(rawMessage);

    const plainText = parsed.text || "";
    const htmlContent = parsed.html || "";
    const snippet = (plainText || htmlContent.replace(/<[^>]+>/g, ""))
      .substring(0, 200).trim().replace(/\s+/g, " ");

    console.log(`Parsed: text=${plainText.length}ch, html=${htmlContent.length}ch, attachments=${parsed.attachments.length}`);

    // Update email record
    const updateData = {
      body_text: plainText || null,
      body_html: htmlContent || null,
      snippet: snippet || null,
      has_attachments: parsed.attachments.length > 0,
      attachments: parsed.attachments,
      body_fetched_at: new Date().toISOString(),
    };

    await supabase.from("email_inbox").update(updateData).eq("id", email_id);

    return new Response(
      JSON.stringify({
        success: true,
        body_text: plainText,
        body_html: htmlContent,
        attachments: parsed.attachments,
        snippet,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Hydrate email error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
