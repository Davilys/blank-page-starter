// Shared MIME parser for the WebMarcas Email module.
// Used by sync-imap-inbox, hydrate-email and email-repair-messages so every
// path interprets a message exactly the same way.
//
// Design rules:
// - Headers are read from the real header block only (never from DKIM/ARC
//   signatures or the body), unfolded per RFC 5322 before matching.
// - Encoded words (RFC 2047), quoted-printable, base64 and charsets are
//   decoded properly, including nested multipart bodies.
// - Attachments and inline (cid:) images are separated from text/html.
// - No regex-only body splitting: the structure walk is boundary based and
//   recursive, and each part keeps its own headers.

export const PARSER_VERSION = 2;

export interface MimeAttachment {
  filename: string;
  content_type: string;
  size: number;
  inline: boolean;
  content_id?: string;
}

export interface MimeAddress {
  name: string;
  email: string;
}

export interface ParsedMessage {
  from: MimeAddress;
  to: MimeAddress[];
  cc: MimeAddress[];
  recipients: string[];
  subject: string;
  /** null when the Date header is missing/unparseable — caller decides fallback */
  date: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  threadId: string | null;
  text: string;
  html: string;
  attachments: MimeAttachment[];
  headersRaw: string;
  /** true when the body could not be decoded into text nor html */
  bodyMissing: boolean;
}

/* ------------------------------ decoding ------------------------------ */

const CHARSET_ALIASES: Record<string, string> = {
  utf8: "utf-8",
  "us-ascii": "utf-8",
  ascii: "utf-8",
  latin1: "windows-1252",
  "iso-8859-1": "windows-1252",
  "iso8859-1": "windows-1252",
  "iso-8859-15": "windows-1252",
  cp1252: "windows-1252",
  "ansi_x3.4-1968": "utf-8",
  unknown: "utf-8",
  "x-unknown": "utf-8",
};

export function safeDecode(bytes: Uint8Array, charset?: string): string {
  const c = (charset || "utf-8").toLowerCase().replace(/^"|"$/g, "").trim();
  const enc = CHARSET_ALIASES[c] || c;
  try {
    return new TextDecoder(enc, { fatal: false }).decode(bytes);
  } catch {
    try {
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    } catch {
      return new TextDecoder("windows-1252").decode(bytes);
    }
  }
}

function latin1Bytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

export function decodeQuotedPrintable(input: string, charset = "utf-8"): string {
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

export function decodeBase64(input: string, charset = "utf-8"): string {
  try {
    const clean = input.replace(/[^A-Za-z0-9+/=]/g, "");
    return safeDecode(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)), charset);
  } catch {
    return input;
  }
}

/** RFC 2047 encoded words, including adjacent-word concatenation. */
export function decodeMimeWords(input: string): string {
  if (!input) return "";
  let s = input.replace(/\?=[ \t]+=\?/g, "?==?");
  if (!s.includes("=?")) return s.replace(/\s+/g, " ").trim();
  s = s.replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (_m, cs: string, enc: string, encoded: string) => {
    const charset = (cs || "utf-8").toLowerCase().split("*")[0];
    try {
      if (enc.toUpperCase() === "B") return safeDecode(Uint8Array.from(atob(encoded.replace(/\s/g, "")), (c) => c.charCodeAt(0)), charset);
      const d = encoded.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_x: string, h: string) => String.fromCharCode(parseInt(h, 16)));
      return safeDecode(latin1Bytes(d), charset);
    } catch {
      return encoded;
    }
  });
  return s.replace(/\s+/g, " ").trim();
}

/** Decode a body part given its transfer encoding + charset. */
export function decodeContent(body: string, encoding: string, charset = "utf-8"): string {
  const enc = (encoding || "7bit").trim().toLowerCase();
  if (enc === "base64") return decodeBase64(body, charset);
  if (enc === "quoted-printable") return decodeQuotedPrintable(body, charset);
  if (charset && !["utf-8", "us-ascii", "ascii", "utf8"].includes(charset.toLowerCase())) {
    return safeDecode(latin1Bytes(body), charset);
  }
  if (/[\u0080-\u00ff]/.test(body)) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(latin1Bytes(body));
    } catch {
      return body;
    }
  }
  return body;
}

/* ------------------------------ headers ------------------------------ */

export function splitHeadersBody(raw: string): { headers: string; body: string } {
  let i = raw.indexOf("\r\n\r\n");
  let skip = 4;
  if (i === -1) {
    i = raw.indexOf("\n\n");
    skip = 2;
  }
  if (i === -1) return { headers: raw, body: "" };
  return { headers: raw.substring(0, i), body: raw.substring(i + skip) };
}

/** Parse a header block into an ordered list of [name(lowercase), value]. */
export function parseHeaders(headerBlock: string): Array<[string, string]> {
  const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, " ");
  const out: Array<[string, string]> = [];
  for (const line of unfolded.split(/\r?\n/)) {
    const m = line.match(/^([!-9;-~]+):[ \t]*(.*)$/);
    if (!m) continue;
    out.push([m[1].toLowerCase(), m[2].trim()]);
  }
  return out;
}

export function headerValue(headers: Array<[string, string]>, name: string): string {
  const n = name.toLowerCase();
  for (const [k, v] of headers) if (k === n) return v;
  return "";
}

export function headerValues(headers: Array<[string, string]>, name: string): string[] {
  const n = name.toLowerCase();
  return headers.filter(([k]) => k === n).map(([, v]) => v);
}

function paramValue(headerLine: string, param: string): string | null {
  const re = new RegExp(`${param}\\s*=\\s*("([^"]*)"|([^;\\s]+))`, "i");
  const m = headerLine.match(re);
  if (!m) return null;
  return (m[2] ?? m[3] ?? "").trim() || null;
}

/** Parse an address list header ("Name" <a@b>, c@d). */
export function parseAddressList(value: string): MimeAddress[] {
  if (!value) return [];
  const out: MimeAddress[] = [];
  let buf = "";
  let inQuotes = false;
  let depth = 0;
  const flush = () => {
    const piece = buf.trim();
    buf = "";
    if (!piece) return;
    const angled = piece.match(/<([^>]+)>/);
    let email = "";
    let name = "";
    if (angled) {
      email = angled[1].trim();
      name = piece.slice(0, angled.index).trim().replace(/^"|"$/g, "");
    } else {
      const bare = piece.match(/[^\s<>,;]+@[^\s<>,;]+/);
      email = bare?.[0] || "";
      name = email ? piece.replace(email, "").trim().replace(/^"|"$/g, "") : piece;
    }
    if (!email) return;
    out.push({ name: decodeMimeWords(name), email: email.toLowerCase() });
  };
  for (const ch of value) {
    if (ch === '"') inQuotes = !inQuotes;
    if (!inQuotes && (ch === "(" )) depth++;
    if (!inQuotes && (ch === ")")) depth = Math.max(0, depth - 1);
    if (ch === "," && !inQuotes && depth === 0) {
      flush();
      continue;
    }
    buf += ch;
  }
  flush();
  return out;
}

/* ------------------------------ structure ------------------------------ */

interface WalkResult {
  text: string;
  html: string;
  attachments: MimeAttachment[];
}

function walkPart(rawPart: string, depth = 0): WalkResult {
  if (depth > 12) return { text: "", html: "", attachments: [] };
  const { headers: hdrBlock, body } = splitHeadersBody(rawPart);
  const headers = parseHeaders(hdrBlock);
  const ct = headerValue(headers, "content-type") || "text/plain";
  const ctLower = ct.toLowerCase();
  const cte = headerValue(headers, "content-transfer-encoding") || "7bit";
  const cd = headerValue(headers, "content-disposition") || "";
  const cdLower = cd.toLowerCase();
  const charset = paramValue(ct, "charset") || "utf-8";

  if (ctLower.startsWith("multipart/")) {
    const boundary = paramValue(ct, "boundary");
    if (!boundary) return { text: decodeContent(body, cte, charset), html: "", attachments: [] };
    const marker = "--" + boundary;
    const segments = body.split(marker);
    const texts: string[] = [];
    const htmls: string[] = [];
    const attachments: MimeAttachment[] = [];
    const isAlternative = ctLower.includes("multipart/alternative");
    for (let i = 1; i < segments.length; i++) {
      let seg = segments[i];
      if (seg.startsWith("--")) break; // closing delimiter
      seg = seg.replace(/^\r?\n/, "");
      if (!seg.trim()) continue;
      const r = walkPart(seg, depth + 1);
      if (r.text) texts.push(r.text);
      if (r.html) htmls.push(r.html);
      attachments.push(...r.attachments);
    }
    return {
      text: isAlternative ? texts[texts.length - 1] || "" : texts.join("\n\n"),
      html: isAlternative ? htmls[htmls.length - 1] || "" : htmls.join("\n"),
      attachments,
    };
  }

  if (ctLower.startsWith("message/rfc822")) {
    const inner = walkPart(body.replace(/^\r?\n/, ""), depth + 1);
    return inner;
  }

  const filename = decodeMimeWords(paramValue(cd, "filename") || paramValue(ct, "name") || "");
  const isTextual = ctLower.startsWith("text/plain") || ctLower.startsWith("text/html");
  const isAttachment = cdLower.includes("attachment") || (!!filename && !isTextual);
  const isInline = cdLower.includes("inline") && !isTextual;

  if (isAttachment || isInline) {
    const cid = (headerValue(headers, "content-id") || "").replace(/^<|>$/g, "") || undefined;
    const approxSize = (cte || "").toLowerCase() === "base64"
      ? Math.floor(body.replace(/\s/g, "").length * 0.75)
      : body.length;
    return {
      text: "",
      html: "",
      attachments: [{
        filename: filename || (cid ? `imagem-${cid}` : "anexo"),
        content_type: ctLower.split(";")[0].trim(),
        size: approxSize,
        inline: isInline && !cdLower.includes("attachment"),
        content_id: cid,
      }],
    };
  }

  const decoded = decodeContent(body, cte, charset);
  if (ctLower.startsWith("text/html")) return { text: "", html: decoded, attachments: [] };
  if (ctLower.startsWith("text/")) return { text: decoded, html: "", attachments: [] };
  return { text: "", html: "", attachments: [] };
}

/* ------------------------------ public API ------------------------------ */

export function parseMessage(raw: string): ParsedMessage {
  const { headers: headerBlock } = splitHeadersBody(raw);
  const headers = parseHeaders(headerBlock);

  const fromList = parseAddressList(headerValue(headers, "from"));
  const from = fromList[0] || { name: "", email: "" };
  const to = parseAddressList(headerValue(headers, "to"));
  const cc = parseAddressList(headerValue(headers, "cc"));

  const recipientSet = new Set<string>();
  for (const h of ["to", "cc", "bcc", "delivered-to", "x-original-to", "envelope-to", "x-delivered-to", "x-rcpt-to"]) {
    for (const line of headerValues(headers, h)) {
      for (const addr of parseAddressList(line)) recipientSet.add(addr.email);
      for (const m of line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []) recipientSet.add(m.toLowerCase());
    }
  }

  const subjectRaw = headerValue(headers, "subject");
  const subject = decodeMimeWords(subjectRaw);

  let date: string | null = null;
  const dateRaw = headerValue(headers, "date");
  if (dateRaw) {
    const d = new Date(dateRaw);
    if (!isNaN(d.getTime())) date = d.toISOString();
  }

  const messageId = (headerValue(headers, "message-id").match(/<([^>]+)>/)?.[1] || headerValue(headers, "message-id") || "").trim() || null;
  const inReplyTo = (headerValue(headers, "in-reply-to").match(/<([^>]+)>/)?.[1] || "").trim() || null;
  const references = (headerValue(headers, "references").match(/<[^>]+>/g) || []).map((r) => r.slice(1, -1));

  const walked = walkPart(raw);
  const text = walked.text.trim();
  const html = walked.html.trim();

  return {
    from,
    to,
    cc,
    recipients: [...recipientSet],
    subject,
    date,
    messageId,
    inReplyTo,
    references,
    threadId: references[0] || inReplyTo || messageId,
    text,
    html,
    attachments: walked.attachments,
    headersRaw: headerBlock,
    bodyMissing: !text && !html && walked.attachments.length === 0,
  };
}

/** Short, single-line preview for the message list. */
export function buildSnippet(text: string, html: string, max = 180): string {
  const source = text || htmlToText(html);
  return source.replace(/\s+/g, " ").trim().slice(0, max);
}

export function htmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>(?=\s*)/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
}
