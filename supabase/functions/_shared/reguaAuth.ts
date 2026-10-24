// Autorização das funções da régua: só com CRON_SECRET configurado e igual ao header.
export function reguaAuthorized(req: Request, secretEnv: string | undefined | null = Deno.env.get("CRON_SECRET")): boolean {
  const secret = (secretEnv || "").trim();
  if (!secret) return false;
  const got = req.headers.get("x-cron-secret") || "";
  if (got.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
