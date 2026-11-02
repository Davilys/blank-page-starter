// marcas-ia-agent — BrandBot da Central Inteligente WebMarcas.
// NASCE DESLIGADA: sem MARCAS_IA_ENABLED=true NENHUMA chamada paga é feita.
// Budget: reserva atômica upper-bound ANTES de cada chamada (inclui retries),
// em centavos inteiros arredondados para cima; reserva de chamada que falha
// NÃO é devolvida (sem refund ambíguo / sem double-credit na reconciliação).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CAP_TOTAL_CENTS = 1000; // US$10,00 — grant pedido ao usuário 02/11 15:22
const CAP_SESSION_CENTS = 200; // US$2,00 por sessão
const TEXT_MODEL = 'gpt-5-mini';

// Preços oficiais verificados 02/11 (developers.openai.com/api/docs/pricing + guia image-generation)
const PRICE_TEXT_IN_PER_MTOK = 0.25;   // gpt-5-mini input
const PRICE_TEXT_OUT_PER_MTOK = 2.0;   // gpt-5-mini output

// Reservas UPPER-BOUND por ação (input máximo + output máximo + retries), em centavos, arredondado para cima.
function centsUpperBoundText(maxInputTok: number, maxOutputTok: number, retries: number): number {
  const usd = (retries + 1) * (maxInputTok * PRICE_TEXT_IN_PER_MTOK + maxOutputTok * PRICE_TEXT_OUT_PER_MTOK) / 1_000_000;
  return Math.ceil(usd * 100);
}
const RESERVE: Record<string, () => number> = {
  chat: () => centsUpperBoundText(8000, 1200, 1),       // briefing: 1 retry
  nomes: () => centsUpperBoundText(6000, 3000, 1),      // 10 nomes + justificativas
  logos: () => centsUpperBoundText(6000, 16000, 1),    // 5 conceitos SVG autorais (texto) + 1 retry
  brandbook: () => centsUpperBoundText(8000, 6000, 1),  // manual completo
};

const BRANDBOT_PROMPT = `Você é o BrandBot, o agente de criação de marcas da WebMarcas, escritório brasileiro de registro de marcas no INPI.

TOM: profissional, empático, criativo e direto. Português brasileiro impecável, frases curtas, zero jargão desnecessário.

MISSÃO: conduzir o usuário da ideia inicial até um nome de marca forte e uma direção visual clara, em etapas com aprovação explícita.

ETAPAS DO BRIEFING (nesta ordem, no MÁXIMO 2 a 3 perguntas por mensagem, nunca mais):
1. Essência: o que o negócio faz, o que o nome precisa transmitir.
2. Público e diferencial: quem compra e por que escolheria essa marca.
3. Personalidade: adjetivos da marca (séria, divertida, premium, acessível...).
4. Visual: cores, estilos, referências que o usuário imagina (ou não).
5. Diagnóstico: resuma TUDO em um diagnóstico estruturado (essência, público, diferencial, personalidade, direção visual) e peça aprovação explícita ANTES de propor nomes ou qualquer visual.

REGRAS DURAS:
- Nunca pule etapas nem faça mais de 3 perguntas por vez.
- Nunca prometa que um nome está "disponível" no INPI: a checagem na base é feita pelo sistema e exibida com fonte, data e limitações; diga sempre que a aprovação final depende do exame do INPI.
- Não invente registros, processos ou disponibilidade.
- Se o usuário pedir algo fora de criação de marca/logotipo, redirecione com educação para a Consultoria jurídica da central.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    if (Deno.env.get('MARCAS_IA_ENABLED') !== 'true') {
      return json({ ok: false, error: { code: 'disabled', message: 'O BrandBot está em configuração. Avisaremos quando estiver ativo.' } }, 503);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ ok: false, error: { code: 'unauthorized', message: 'Não autorizado' } }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !userData?.user) return json({ ok: false, error: { code: 'unauthorized', message: 'Não autorizado' } }, 401);

    const { data: isAdmin, error: roleError } = await userClient.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
    if (roleError || !isAdmin) return json({ ok: false, error: { code: 'forbidden', message: 'Acesso restrito à equipe WebMarcas.' } }, 403);

    const body = await req.json().catch(() => null);
    const action = body?.action as string | undefined;
    const sessionId = String(body?.session_id ?? '').slice(0, 64);
    if (!action || !(action in RESERVE) || !sessionId) {
      return json({ ok: false, error: { code: 'bad_request', message: 'Ação ou sessão inválida.' } }, 400);
    }

    // RESERVA ATÔMICA UPPER-BOUND (total + sessão) ANTES de qualquer chamada paga.
    const reserveCents = RESERVE[action]();
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: spend, error: spendError } = await adminClient.rpc('marcas_ia_spend', {
      p_amount_cents: reserveCents,
      p_session_id: sessionId,
      p_action: action,
      p_cap_total_cents: CAP_TOTAL_CENTS,
      p_cap_session_cents: CAP_SESSION_CENTS,
    });
    if (spendError || !spend?.ok) {
      return json({ ok: false, error: { code: 'budget_exceeded', message: 'Limite de uso do Marcas IA atingido. O agente foi pausado para não gerar custo extra.' } }, 402);
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) return json({ ok: false, error: { code: 'config', message: 'Agente em configuração.' } }, 503);

    if (action === 'chat') {
      // Teto de input REAL: últimas 12 mensagens, cada uma com no máx. 1500
      // caracteres (~400 tokens). 12x400 + prompt ~600 = ~5.4k tokens < 8000
      // assumidos na reserva. Sem este cap a reserva não é upper-bound.
      const messages = (Array.isArray(body?.messages) ? body.messages.slice(-12) : [])
        .map((m: { role?: unknown; content?: unknown }) => ({
          role: m?.role === 'user' ? 'user' : 'assistant',
          content: String(m?.content ?? '').slice(0, 1500),
        }));
      const completion = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: TEXT_MODEL,
          max_completion_tokens: 1200,
          messages: [{ role: 'system', content: BRANDBOT_PROMPT }, ...messages],
        }),
      });
      const data = await completion.json();
      if (!completion.ok) return json({ ok: false, error: { code: 'openai', message: 'O BrandBot não respondeu agora. Tente de novo em instantes.' } }, 502);
      const reply = data?.choices?.[0]?.message?.content ?? '';
      return json({ ok: true, reply });
    }

    if (action === 'nomes') {
      const diagnostico = String(body?.diagnostico ?? '').slice(0, 4000);
      const completion = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: TEXT_MODEL,
          max_completion_tokens: 3000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `${BRANDBOT_PROMPT}\n\nAgora gere EXATAMENTE 10 nomes de marca para o diagnóstico aprovado. Responda APENAS JSON: {"nomes":[{"nome":"...","justificativa":"...","tom":"..."}]}. Nomes curtos, registráveis, sem genéricos do ramo, sem imitar marcas conhecidas.` },
            { role: 'user', content: `Diagnóstico aprovado:\n${diagnostico}` },
          ],
        }),
      });
      const data = await completion.json();
      if (!completion.ok) return json({ ok: false, error: { code: 'openai', message: 'Não consegui gerar os nomes agora.' } }, 502);
      let nomes: unknown[] = [];
      try { nomes = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')?.nomes ?? []; } catch { nomes = []; }
      return json({ ok: true, nomes });
    }

    if (action === 'logos') {
      // Rota vetorial genuína: o MODELO DE TEXTO autora 5 conceitos DIRETAMENTE em SVG
      // (vetor real, editável em Illustrator/CorelDRAW/Inkscape). Sem raster, sem renomear extensão.
      const nome = String(body?.nome ?? '').slice(0, 80);
      const diagnostico = String(body?.diagnostico ?? '').slice(0, 4000);
      if (!nome) return json({ ok: false, error: { code: 'bad_request', message: 'Nome ausente.' } }, 400);
      const completion = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: TEXT_MODEL,
          max_completion_tokens: 16000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `Você é um designer de logotipos sênior. Gere 5 conceitos DISTINTOS do logotipo da marca informada, CADA UM como um SVG completo e válido (viewBox 0 0 240 240, sem <script>, sem elementos externos, fontes genéricas como Arial/sans-serif, formas vetoriais limpas e profissionais, fundo com cantos arredondados). Conceitos variados: monograma, símbolo abstrato, wordmark, emblema e minimalista. Responda APENAS JSON: {"svgs":["<svg ...>...</svg>", ...5 itens], "conceitos":["monograma", ...]}.` },
            { role: 'user', content: `Marca: ${nome}
Direção visual aprovada:
${diagnostico}` },
          ],
        }),
      });
      const data = await completion.json();
      if (!completion.ok) return json({ ok: false, error: { code: 'openai', message: 'Não consegui gerar os logotipos agora.' } }, 502);
      let svgs: string[] = [];
      let conceitos: string[] = [];
      try {
        const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
        svgs = Array.isArray(parsed?.svgs) ? parsed.svgs.filter((x: unknown) => typeof x === 'string' && x.includes('<svg')) : [];
        conceitos = Array.isArray(parsed?.conceitos) ? parsed.conceitos : [];
      } catch { svgs = []; }
      if (svgs.length === 0) return json({ ok: false, error: { code: 'openai', message: 'A geração voltou incompleta. Tente novamente.' } }, 502);
      return json({ ok: true, svgs, conceitos });
    }

    if (action === 'brandbook') {
      const nome = String(body?.nome ?? '').slice(0, 80);
      const diagnostico = String(body?.diagnostico ?? '').slice(0, 4000);
      const svg = String(body?.svg ?? '').slice(0, 60000);
      if (!nome || !svg.includes('<svg')) return json({ ok: false, error: { code: 'bad_request', message: 'Dados ausentes.' } }, 400);
      const completion = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: TEXT_MODEL,
          max_completion_tokens: 6000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `Você é um estrategista de marca. Monte o manual de identidade da marca em JSON: {"proposito":"...","tom_de_voz":["..."],"valores":["..."],"paleta":[{"nome":"...","hex":"#RRGGBB","rgb":"r,g,b","cmyk":"c,m,y,k"}],"tipografia":{"primaria":"...","secundaria":"...","uso":"..."}}. Paleta com 4 a 6 cores coerentes com o SVG aprovado; CMYK convertido (0-100); NÃO incluir Pantone.` },
            { role: 'user', content: `Marca: ${nome}
Diagnóstico:
${diagnostico}
SVG aprovado:
${svg.slice(0, 8000)}` },
          ],
        }),
      });
      const data = await completion.json();
      if (!completion.ok) return json({ ok: false, error: { code: 'openai', message: 'Não consegui montar o manual agora.' } }, 502);
      let manual: unknown = null;
      try { manual = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}'); } catch { manual = null; }
      return json({ ok: true, manual });
    }

    return json({ ok: false, error: { code: 'bad_request', message: 'Ação desconhecida.' } }, 400);
  } catch (err) {
    return json({ ok: false, error: { code: 'internal', message: 'Falha interna do agente.' } }, 500);
  }
});
