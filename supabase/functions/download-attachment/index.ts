import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    if (tail.includes(`${tag} OK`) || tail.includes(`${tag} NO`) || tail.includes(`${tag} BAD`)) break;
  }
  return chunks.join("");
}

const SENT_FOLDER_NAMES = [
  "Sent", "INBOX.Sent", "Sent Items", "Sent Messages",
  "[Gmail]/Sent Mail", "INBOX.Sent Items", "Enviados",
];

function decodeBase64ToBytes(input: string): Uint8Array {
  const cleaned = input.replace(/\s/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeQPBytes(input: string): Uint8Array {
  const str = input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

function getHeaderValue(headers: string, name: string): string {
  const unfolded = headers.replace(/\r?\n[ \t]+/g, " ");
  const regex = new RegExp(`^${name}:\\s*(.+?)$`, "im");
  const match = unfolded.match(regex);
  return match?.[1]?.trim() || "";
}

function getBoundary(ct: string): string | null {
  const m = ct.match(/boundary="?([^"\s;]+)"?/i);
  return m?.[1] || null;
}

function decodeMimeWords(input: string): string {
  if (!input || !input.includes("=?")) return input;
  return input.replace(
    /=\?([^?]+)\?(Q|B)\?([^?]*)\?=/gi,
    (_m, _cs, enc, encoded) => {
      try {
        if (enc.toUpperCase() === "B") {
          const b = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
          return new TextDecoder("utf-8").decode(b);
        }
        const d = encoded.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_: string, h: string) => String.fromCharCode(parseInt(h, 16)));
        const b = new Uint8Array([...d].map(c => c.charCodeAt(0)));
        return new TextDecoder("utf-8").decode(b);
      } catch { return encoded; }
    }
  ).replace(/\r?\n[ \t]+/g, "");
}

interface AttachmentPart {
  filename: string;
  content_type: string;
  encoding: string;
  body: string;
}

function findAttachmentParts(raw: string): AttachmentPart[] {
  let divIdx = raw.indexOf("\r\n\r\n");
  let sepLen = 4;
  if (divIdx === -1) { divIdx = raw.indexOf("\n\n"); sepLen = 2; }
  if (divIdx === -1) return [];

  const headers = raw.substring(0, divIdx);
  const body = raw.substring(divIdx + sepLen);
  const ct = getHeaderValue(headers, "Content-Type") || "text/plain";
  const cte = getHeaderValue(headers, "Content-Transfer-Encoding") || "7bit";
  const cd = getHeaderValue(headers, "Content-Disposition") || "";

  if (ct.toLowerCase().startsWith("multipart/")) {
    const boundary = getBoundary(ct);
    if (!boundary) return [];
    const parts = body.split("--" + boundary);
    const results: AttachmentPart[] = [];
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].startsWith("--")) break;
      const trimmed = parts[i].replace(/^\r?\n/, "");
      if (!trimmed.trim()) continue;
      results.push(...findAttachmentParts(trimmed));
    }
    return results;
  }

  // Check if this part is an attachment
  const isAttachment =
    cd.toLowerCase().includes("attachment") ||
    (cd.toLowerCase().includes("filename") && !ct.toLowerCase().startsWith("text/")) ||
    (cd.toLowerCase().includes("inline") && !ct.toLowerCase().startsWith("text/") && (cd + ct).match(/(?:file)?name=/i));

  if (!isAttachment) {
    // Also check for non-text parts with a name
    const nameMatch = ct.match(/name="?([^"\r\n;]+)"?/i);
    if (nameMatch && !ct.toLowerCase().startsWith("text/")) {
      return [{
        filename: decodeMimeWords(nameMatch[1].trim()),
        content_type: ct.split(";")[0].trim(),
        encoding: cte.trim().toLowerCase(),
        body: body.trim(),
      }];
    }
    return [];
  }

  const fnMatch = (cd + "; " + ct).match(/(?:file)?name="?([^"\r\n;]+)"?/i);
  const filename = decodeMimeWords(fnMatch?.[1]?.trim() || "attachment");

  return [{
    filename,
    content_type: ct.split(";")[0].trim(),
    encoding: cte.trim().toLowerCase(),
    body: body.trim(),
  }];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email_id, attachment_index } = await req.json();
    if (!email_id) throw new Error("email_id is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: email, error: emailErr } = await supabase
      .from("email_inbox")
      .select("id, message_id, folder, account_id")
      .eq("id", email_id)
      .single();
    if (emailErr || !email) throw new Error("Email not found");

    const { data: account, error: accErr } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", email.account_id)
      .single();
    if (accErr || !account?.imap_host) throw new Error("IMAP not configured");

    // Connect to IMAP
    const conn = await Deno.connectTls({
      hostname: account.imap_host,
      port: account.imap_port || 993,
    });
    await readGreeting(conn);

    const loginResp = await sendCmd(conn, "D001", `LOGIN "${account.smtp_user}" "${account.smtp_password}"`);
    if (!loginResp.includes("D001 OK")) { conn.close(); throw new Error("IMAP login failed"); }

    // Select folder
    let folderSelected = false;
    if (email.folder === "sent") {
      const listResp = await sendCmd(conn, "D002L", 'LIST "" "*"');
      for (const sf of SENT_FOLDER_NAMES) {
        if (listResp.includes(sf)) {
          const selResp = await sendCmd(conn, "D002", `SELECT "${sf}"`);
          if (selResp.includes("D002 OK")) { folderSelected = true; break; }
        }
      }
    } else {
      const selResp = await sendCmd(conn, "D002", "SELECT INBOX");
      if (selResp.includes("D002 OK")) folderSelected = true;
    }
    if (!folderSelected) { conn.close(); throw new Error("Folder not found"); }

    // Search message
    const searchResp = await sendCmd(conn, "D003", `SEARCH HEADER MESSAGE-ID "${email.message_id}"`);
    const searchMatch = searchResp.match(/\* SEARCH\s+([\d\s]+)/);
    if (!searchMatch || !searchMatch[1].trim()) { conn.close(); throw new Error("Message not found on server"); }
    const seqNum = searchMatch[1].trim().split(/\s+/)[0];

    // Fetch full message
    const fetchResp = await sendCmd(conn, "D004", `FETCH ${seqNum} BODY.PEEK[]`, 60000);
    await sendCmd(conn, "D099", "LOGOUT", 5000).catch(() => {});
    try { conn.close(); } catch { /* ignore */ }

    // Extract raw message
    let rawMessage = "";
    const literalMatch = fetchResp.match(/BODY\[\]\s*\{(\d+)\}/);
    if (literalMatch) {
      const size = parseInt(literalMatch[1]);
      const startIdx = fetchResp.indexOf(literalMatch[0]) + literalMatch[0].length;
      const contentStart = fetchResp.indexOf("\r\n", startIdx);
      if (contentStart !== -1) rawMessage = fetchResp.substring(contentStart + 2, contentStart + 2 + size);
    }
    if (!rawMessage) {
      const bodyIdx = fetchResp.indexOf("BODY[]");
      if (bodyIdx !== -1) {
        const afterBody = fetchResp.substring(bodyIdx);
        const firstNl = afterBody.indexOf("\r\n");
        if (firstNl !== -1) {
          rawMessage = afterBody.substring(firstNl + 2);
          const closeIdx = rawMessage.lastIndexOf("\r\nD004 OK");
          if (closeIdx !== -1) rawMessage = rawMessage.substring(0, closeIdx);
          if (rawMessage.endsWith(")\r\n")) rawMessage = rawMessage.slice(0, -3);
          else if (rawMessage.endsWith(")")) rawMessage = rawMessage.slice(0, -1);
        }
      }
    }

    if (!rawMessage || rawMessage.length < 10) throw new Error("Could not extract message");

    // Find all attachment parts
    const attachments = findAttachmentParts(rawMessage);
    const idx = attachment_index ?? 0;

    if (idx >= attachments.length) {
      throw new Error(`Attachment index ${idx} not found. Found ${attachments.length} attachments.`);
    }

    const att = attachments[idx];
    let fileBytes: Uint8Array;

    if (att.encoding === "base64") {
      fileBytes = decodeBase64ToBytes(att.body);
    } else if (att.encoding === "quoted-printable") {
      fileBytes = decodeQPBytes(att.body);
    } else {
      fileBytes = new TextEncoder().encode(att.body);
    }

    // Return as base64 data URL for the frontend
    const base64Content = btoa(String.fromCharCode(...fileBytes));

    return new Response(
      JSON.stringify({
        success: true,
        filename: att.filename,
        content_type: att.content_type,
        size: fileBytes.length,
        data_base64: base64Content,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Download attachment error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
