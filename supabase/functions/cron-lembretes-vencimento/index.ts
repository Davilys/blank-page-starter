import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Delays escalonados em minutos (D-3 e D-0 usam sequência 5, 7, 10, 5, 7, 10, ...)
const DELAYS_MIN = [5, 7, 10];

// Horário comercial (BRT). Envios só entre 08:00 e 18:00.
function isBusinessHourBRT(d = new Date()): boolean {
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000); // UTC-3
  const h = brt.getUTCHours();
  const dow = brt.getUTCDay(); // 0=dom,6=sáb
  return dow >= 1 && dow <= 5 && h >= 8 && h < 18;
}

function todayBRT(): string {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
}
function addDaysBRT(days: number): string {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000 + days * 24 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    if (!isBusinessHourBRT() && !force) {
      return new Response(JSON.stringify({ skipped: true, reason: "Fora do horário comercial (08-18 BRT, seg-sex)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const d0 = todayBRT();
    const d3 = addDaysBRT(3);

    const { data: invoices, error } = await admin
      .from("invoices")
      .select("id, due_date, status")
      .in("status", ["pending", "open"])
      .in("due_date", [d0, d3]);

    if (error) throw error;

    const results: any[] = [];
    let idx = 0;

    for (const inv of invoices || []) {
      const tipo = inv.due_date === d0 ? "d0" : "d3";
      const delayMs = DELAYS_MIN[idx % DELAYS_MIN.length] * 60 * 1000;
      idx++;

      // Agenda envio: aguarda delay dentro do próprio invoke.
      // Como edge functions têm limite de execução (~60s), disparamos sequencialmente
      // usando Promise com setTimeout, mas apenas se o ciclo total for viável.
      // Aqui optamos por invocar imediatamente e deixar o delay via "scheduled" no BotConversa.
      // Simplificação: chamamos com pequena espera in-process (máx ~50s total).
      const startWait = idx > 1 ? Math.min(delayMs, 45_000) : 0;
      if (startWait > 0) await new Promise((r) => setTimeout(r, startWait));

      try {
        const { data, error: fnErr } = await admin.functions.invoke("lembrar-fatura-vencendo", {
          body: { invoice_id: inv.id, tipo, origin: "cron" },
        });
        results.push({ invoice_id: inv.id, tipo, ok: !fnErr, data, error: fnErr?.message });
      } catch (e) {
        results.push({ invoice_id: inv.id, tipo, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      d0_date: d0,
      d3_date: d3,
      total: invoices?.length ?? 0,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("cron-lembretes-vencimento error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});