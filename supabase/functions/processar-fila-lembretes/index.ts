import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Horário comercial (BRT): seg-sex, 08:00-18:00
function isBusinessHourBRT(d = new Date()): boolean {
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const h = brt.getUTCHours();
  const dow = brt.getUTCDay();
  return dow >= 1 && dow <= 5 && h >= 8 && h < 18;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";

    if (!isBusinessHourBRT() && !force) {
      return json({ skipped: true, reason: "Fora do horário comercial (08-18 BRT, seg-sex)" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Libera itens travados em "processando" há mais de 10 minutos
    await admin
      .from("lembrete_fila")
      .update({ status: "pendente" })
      .eq("status", "processando")
      .lt("updated_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

    // Pega o próximo item pendente cujo horário já chegou
    const { data: candidatos, error: selErr } = await admin
      .from("lembrete_fila")
      .select("id, invoice_id, asaas_payment_id, tipo, cliente_nome, attempts")
      .eq("status", "pendente")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1);

    if (selErr) throw selErr;
    const item = candidatos?.[0];
    if (!item) return json({ processed: 0, reason: "Fila vazia" });

    // Trava atômica: só um processo consegue mover de pendente -> processando
    const { data: locked, error: lockErr } = await admin
      .from("lembrete_fila")
      .update({ status: "processando", attempts: (item.attempts ?? 0) + 1 })
      .eq("id", item.id)
      .eq("status", "pendente")
      .select("id")
      .maybeSingle();

    if (lockErr) throw lockErr;
    if (!locked) return json({ processed: 0, reason: "Item já em processamento" });

    try {
      const { data, error } = await admin.functions.invoke("lembrar-fatura-vencendo", {
        body: {
          invoice_id: item.invoice_id ?? undefined,
          asaas_payment_id: item.asaas_payment_id ?? undefined,
          tipo: item.tipo,
          origin: "fila_admin",
        },
      });

      if (error) {
        await admin
          .from("lembrete_fila")
          .update({ status: "falha", last_error: error.message ?? String(error) })
          .eq("id", item.id);
        return json({ processed: 1, id: item.id, status: "falha", error: error.message });
      }

      const skipped = (data as Record<string, unknown> | null)?.skipped === true;
      await admin
        .from("lembrete_fila")
        .update({
          status: skipped ? "pulado" : "enviado",
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", item.id);

      return json({ processed: 1, id: item.id, status: skipped ? "pulado" : "enviado" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("lembrete_fila").update({ status: "falha", last_error: msg }).eq("id", item.id);
      return json({ processed: 1, id: item.id, status: "falha", error: msg });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("processar-fila-lembretes:", msg);
    return json({ error: msg }, 500);
  }
});
