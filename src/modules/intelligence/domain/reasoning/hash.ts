/**
 * Hash determinístico (FNV-1a 64 bits em BigInt) para selar o resultado de
 * cada análise. Determinístico = mesma entrada, mesmo hash, sempre.
 * Não é criptográfico: serve para provar que o resultado auditado é o mesmo.
 */
const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

export const stableHash = (value: unknown): string => {
  const text = canonical(value);
  let h = OFFSET;
  for (let i = 0; i < text.length; i += 1) {
    h ^= BigInt(text.charCodeAt(i));
    h = (h * PRIME) & MASK;
  }
  return h.toString(16).padStart(16, "0");
};

/** Serialização canônica: chaves ordenadas para o hash não depender da ordem. */
export const canonical = (value: unknown): string => {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};