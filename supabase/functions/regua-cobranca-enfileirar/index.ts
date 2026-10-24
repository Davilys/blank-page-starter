import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { reguaAuthorized } from "../_shared/reguaAuth.ts";
import { businessHourBRT } from "../_shared/reguaElegibilidade.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!reguaAuthorized(req)) return json({ error: "Não autorizado" }, 401);
  if (!businessHourBRT()) return json({ skipped: true, reason: "fora do horário comercial (seg-sáb 08-18 BRT)" });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.rpc("enfileirar_regua_cobranca");
  if (error) { console.error("regua enfileirar", error.message); return json({ error: error.message }, 500); }
  console.log("regua enfileirar", JSON.stringify(data)); // só contagens, sem dados de cliente
  return json(data);
});
