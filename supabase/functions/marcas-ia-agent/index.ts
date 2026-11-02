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

const CAP_TOTAL_CENTS = 1000; // US$10,00 TOTAL — grant do usuário 02/11 (WhatsApp 👍 15:33:52). NÃO recorrente: o ledger
// (marcas_ia_spend_ledger) é único e persistente; migration usa CREATE IF NOT EXISTS e o RPC só incrementa — redeploy NÃO reseta.
const CAP_SESSION_CENTS = 200; // US$2,00 ADVISORY por session_id: o id vem do cliente e é forjável; o guard real é o cap TOTAL.
const TEXT_MODEL = 'gpt-5-mini';

// Preços oficiais verificados 02/11 (developers.openai.com/api/docs/pricing + guia image-generation)
const PRICE_TEXT_IN_PER_MTOK = 0.25;   // gpt-5-mini input
const PRICE_TEXT_OUT_PER_MTOK = 2.0;   // gpt-5-mini output

// ===== UPPER-BOUND PROVÁVEL (não estimativa) =====
// O tokenizer do gpt-5-mini é BPE byte-level (o200k): as unidades base são BYTES
// e merges só REDUZEM a contagem. Logo, para qualquer string UTF-8 válida:
//   tokens(string) <= bytes_utf8(string)
// Todo input do usuário é capado em BYTES no servidor (capBytes) e o teto de
// input de CADA chamada é MEDIDO no payload real: soma dos bytes de todos os
// conteúdos + 16 tokens/mensagem de framing + 256 de overhead (JSON/formato).
// Output é capado pela API (max_completion_tokens, inclui reasoning): fatura
// <= cap. Tentativas cobertas: ATTEMPTS=2 (chamada + 1 retry do cliente).
const enc = new TextEncoder();
function byteLen(s: string): number { return enc.encode(s).length; }
function capBytes(s: string, maxBytes: number): string {
  if (byteLen(s) <= maxBytes) return s;
  let out = '';
  let used = 0;
  for (const ch of s) { // itera por code point: nunca corta surrogate/acento no meio
    const b = byteLen(ch);
    if (used + b > maxBytes) break;
    out += ch; used += b;
  }
  return out;
}
const ATTEMPTS = 2; // chamada + 1 retry, ambos dentro da reserva
function reserveCentsFor(inputBytes: number, nMessages: number, outCapTokens: number): number {
  const inCeiling = inputBytes + 32 * nMessages + 1024; // tokens <= bytes (BPE byte-level) + framing 32/msg + overhead 1024 (auditoria executor 16:04)
  const usd = ATTEMPTS * (inCeiling * PRICE_TEXT_IN_PER_MTOK + outCapTokens * PRICE_TEXT_OUT_PER_MTOK) / 1_000_000;
  return Math.max(1, Math.ceil(usd * 100));
}
const ACTIONS = ['chat', 'nomes', 'logos', 'brandbook'];
// Caps de input em BYTES (servidor, por campo):
const CAP_MSG_BYTES = 1500;      // cada mensagem do chat
const CAP_MSG_COUNT = 12;        // janela de mensagens do chat
const CAP_DIAG_BYTES = 4000;     // diagnóstico aprovado
const CAP_NOME_BYTES = 80;       // nome da marca
const CAP_SVG_BYTES = 8000;      // SVG aprovado (entra no prompt do brandbook)

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
    // Ativação exige flag E janela de teste finita: expirada (ou ausente), a
    // função volta sozinha para OFF — evita deriva de preço/estado indefinida.
    // Janela obrigatória até GO de operação contínua (auditoria executor 16:04).
    const testUntil = Date.parse(Deno.env.get('MARCAS_IA_TEST_UNTIL') ?? '');
    if (Deno.env.get('MARCAS_IA_ENABLED') !== 'true' || !Number.isFinite(testUntil) || Date.now() > testUntil) {
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
    if (!action || !ACTIONS.includes(action) || !sessionId) {
      return json({ ok: false, error: { code: 'bad_request', message: 'Ação ou sessão inválida.' } }, 400);
    }

    // Chave ANTES da reserva: config ausente não consome budget.
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) return json({ ok: false, error: { code: 'config', message: 'Agente em configuração.' } }, 503);

    // RESERVA ATÔMICA com o teto MEDIDO do payload desta chamada (montado por ação abaixo).
    const adminClient = createClient(supabaseUrl, serviceKey);
    async function reserve(inputBytes: number, nMessages: number, outCapTokens: number): Promise<Response | null> {
      const reserveCents = reserveCentsFor(inputBytes, nMessages, outCapTokens);
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
      return null;
    }

    if (action === 'chat') {
      // Cap REAL em BYTES (não caracteres): unicode/adversarial não escapa do teto.
      const messages = (Array.isArray(body?.messages) ? body.messages.slice(-CAP_MSG_COUNT) : [])
        .map((m: { role?: unknown; content?: unknown }) => ({
          role: m?.role === 'user' ? 'user' : 'assistant',
          content: capBytes(String(m?.content ?? ''), CAP_MSG_BYTES),
        }));
      const inputBytes = byteLen(BRANDBOT_PROMPT) + messages.reduce((acc: number, m: { content: string }) => acc + byteLen(m.content), 0);
      const blocked = await reserve(inputBytes, messages.length + 1, 1200);
      if (blocked) return blocked;
      const completion = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: TEXT_MODEL,
          service_tier: 'default', // trava na tier padrão: sem priority/flex mais cara
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
      const diagnostico = capBytes(String(body?.diagnostico ?? ''), CAP_DIAG_BYTES);
      const sysNomes = `${BRANDBOT_PROMPT}\n\nAgora gere EXATAMENTE 10 nomes de marca para o diagnóstico aprovado. Responda APENAS JSON: {"nomes":[{"nome":"...","justificativa":"...","tom":"..."}]}. Nomes curtos, registráveis, sem genéricos do ramo, sem imitar marcas conhecidas.`;
      const userNomes = `Diagnóstico aprovado:\n${diagnostico}`;
      const blocked = await reserve(byteLen(sysNomes) + byteLen(userNomes), 2, 3000);
      if (blocked) return blocked;
      const completion = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: TEXT_MODEL,
          service_tier: 'default', // trava na tier padrão: sem priority/flex mais cara
          max_completion_tokens: 3000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sysNomes },
            { role: 'user', content: userNomes },
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
      const nome = capBytes(String(body?.nome ?? ''), CAP_NOME_BYTES);
      const diagnostico = capBytes(String(body?.diagnostico ?? ''), CAP_DIAG_BYTES);
      if (!nome) return json({ ok: false, error: { code: 'bad_request', message: 'Nome ausente.' } }, 400);
      const sysLogos = `Você é um designer de logotipos sênior. Gere 5 conceitos DISTINTOS do logotipo da marca informada, CADA UM como um SVG completo e válido (viewBox 0 0 240 240, sem <script>, sem elementos externos, fontes genéricas como Arial/sans-serif, formas vetoriais limpas e profissionais, fundo com cantos arredondados). Conceitos variados: monograma, símbolo abstrato, wordmark, emblema e minimalista. Responda APENAS JSON: {"svgs":["<svg ...>...</svg>", ...5 itens], "conceitos":["monograma", ...]}.`;
      const userLogos = `Marca: ${nome}\nDireção visual aprovada:\n${diagnostico}`;
      const blocked = await reserve(byteLen(sysLogos) + byteLen(userLogos), 2, 16000);
      if (blocked) return blocked;
      const completion = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: TEXT_MODEL,
          service_tier: 'default', // trava na tier padrão: sem priority/flex mais cara
          max_completion_tokens: 16000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sysLogos },
            { role: 'user', content: userLogos },
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
      const nome = capBytes(String(body?.nome ?? ''), CAP_NOME_BYTES);
      const diagnostico = capBytes(String(body?.diagnostico ?? ''), CAP_DIAG_BYTES);
      const svg = capBytes(String(body?.svg ?? ''), CAP_SVG_BYTES);
      if (!nome || !svg.includes('<svg')) return json({ ok: false, error: { code: 'bad_request', message: 'Dados ausentes.' } }, 400);
      const sysBook = `Você é um estrategista de marca. Monte o manual de identidade da marca em JSON: {"proposito":"...","tom_de_voz":["..."],"valores":["..."],"paleta":[{"nome":"...","hex":"#RRGGBB","rgb":"r,g,b","cmyk":"c,m,y,k"}],"tipografia":{"primaria":"...","secundaria":"...","uso":"..."}}. Paleta com 4 a 6 cores coerentes com o SVG aprovado; CMYK convertido (0-100); NÃO incluir Pantone.`;
      const userBook = `Marca: ${nome}\nDiagnóstico:\n${diagnostico}\nSVG aprovado:\n${svg}`;
      const blocked = await reserve(byteLen(sysBook) + byteLen(userBook), 2, 6000);
      if (blocked) return blocked;
      const completion = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: TEXT_MODEL,
          service_tier: 'default', // trava na tier padrão: sem priority/flex mais cara
          max_completion_tokens: 6000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sysBook },
            { role: 'user', content: userBook },
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
