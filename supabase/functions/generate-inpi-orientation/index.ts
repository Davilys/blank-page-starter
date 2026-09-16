// Consultoria preparatória com IA — exclusiva das três modalidades de Recursos INPI.
// Não envia mensagens, não protocola nada e não altera outros módulos.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  resolveModelConfig,
  isRecursosInpiModality,
  isModelAccessError,
  modelConfigErrorMessage,
} from '../_shared/recursosInpiModel.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT_VERSION = 'recursos-inpi-orientacao-2026-09-fase2';

const MODALITY_BRIEF: Record<string, string> = {
  indeferimento:
    'Recurso contra indeferimento de pedido de registro de marca (art. 212 da LPI). ' +
    'Os fundamentos a rebater são os do parecer/despacho de indeferimento.',
  exigencia_merito:
    'Cumprimento de exigência de mérito formulada pelo INPI. ' +
    'Cada item exigido deve ser respondido de forma objetiva e documentada.',
  oposicao:
    'Manifestação à oposição apresentada por terceiro. ' +
    'Os fundamentos a rebater são os alegados pelo opositor na petição de oposição.',
};

const CATEGORY_LABEL: Record<string, string> = {
  documento_inpi: 'Documento principal do INPI',
  provas_cliente: 'Provas do cliente',
  procuracao: 'Procuração e representação',
  guia_taxa: 'Guia (GRU) da taxa',
  comprovante_pagamento: 'Comprovante de pagamento',
  pedido_anterioridades: 'Pedido, espelhos e anterioridades',
  complementares: 'Documentos complementares',
};

interface DocRow {
  id: string;
  category: string;
  file_name: string;
  extraction_status: string;
  extraction_notes: string | null;
  extracted_text: string | null;
  sha256: string | null;
  review_status: string;
  byte_size: number | null;
}

function buildDossier(docs: DocRow[]): string {
  if (!docs.length) return 'Nenhum documento anexado.';
  return docs
    .map((d, i) => {
      const header =
        `[DOC:${String(i + 1).padStart(2, '0')}] ${CATEGORY_LABEL[d.category] || d.category} — ` +
        `${d.file_name} (situação da leitura: ${d.extraction_status}` +
        `${d.extraction_notes ? `; ${d.extraction_notes}` : ''})`;
      const body = d.extracted_text
        ? `\nConteúdo lido:\n${d.extracted_text.slice(0, 30000)}`
        : '\nConteúdo textual não extraído localmente (arquivo PDF/imagem ou leitura falha).';
      return header + body;
    })
    .join('\n\n');
}

function systemPrompt(resourceType: string, agentName: string, agentStrategy: string): string {
  return [
    'Você é um consultor de propriedade industrial preparando o trabalho da equipe WebMarcas.',
    `Modalidade: ${MODALITY_BRIEF[resourceType]}`,
    `Agente/estratégia escolhida: ${agentName}. ${agentStrategy || ''}`.trim(),
    '',
    'REGRAS OBRIGATÓRIAS:',
    '1. Baseie-se APENAS no que está nos documentos fornecidos. Nunca invente fatos, datas, números ou provas.',
    '2. Quando o dossiê estiver incompleto, diga exatamente o que falta em vez de supor.',
    '3. Cite a origem de cada afirmação usando o identificador [DOC:NN].',
    '4. Distinga arquivo recebido (anexado), lido (texto extraído) e conferido (validado por humano).',
    '5. Não redija a peça agora. Esta etapa é apenas a orientação preparatória.',
    '',
    'Responda SOMENTE com JSON válido no formato:',
    '{',
    '  "fundamentos": [{"titulo": "", "descricao": "", "fontes": ["DOC:01"]}],',
    '  "provas": [{"documento": "DOC:02", "o_que_demonstra": "", "forca": "alta|media|baixa"}],',
    '  "pontos_favoraveis": [""],',
    '  "pontos_desfavoraveis": [""],',
    '  "lacunas": [""],',
    '  "documentos_recomendados": [{"documento": "", "finalidade": ""}],',
    '  "estrategia": "texto corrido com a linha de defesa sugerida para o agente escolhido",',
    '  "prontidao": {"suficiente_para_minuta": true, "observacao": ""}',
    '}',
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const started = Date.now();
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Acesso de administrador necessário' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const caseId = typeof body?.caseId === 'string' ? body.caseId : null;
    const previousEdits = typeof body?.previousEdits === 'string' ? body.previousEdits : '';
    if (!caseId) {
      return new Response(JSON.stringify({ error: 'Caso não informado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: caseRow, error: caseError } = await admin
      .from('inpi_resource_cases')
      .select('*')
      .eq('id', caseId)
      .maybeSingle();
    if (caseError || !caseRow) {
      return new Response(JSON.stringify({ error: 'Caso não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!isRecursosInpiModality(caseRow.resource_type)) {
      return new Response(
        JSON.stringify({ error: 'Modalidade fora do escopo desta consultoria' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: docs } = await admin
      .from('inpi_case_documents')
      .select(
        'id, category, file_name, extraction_status, extraction_notes, extracted_text, sha256, review_status, byte_size',
      )
      .eq('case_id', caseId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    const documents = (docs || []) as DocRow[];
    if (!documents.length) {
      return new Response(
        JSON.stringify({ error: 'Anexe ao menos um documento utilizável antes de gerar a orientação.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const fingerprint = documents
      .map((d) => d.sha256 || d.id)
      .sort()
      .join('|');

    const modelConfig = resolveModelConfig(caseRow.resource_type, 'gpt-5-mini', 'minimal');
    const correlationId = crypto.randomUUID();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY não configurada' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userContent = [
      `Modalidade: ${caseRow.resource_type}`,
      caseRow.process_number ? `Processo informado: ${caseRow.process_number}` : null,
      caseRow.brand_name ? `Marca informada: ${caseRow.brand_name}` : null,
      '',
      'DOSSIÊ RECEBIDO:',
      buildDossier(documents),
      previousEdits
        ? `\nORIENTAÇÃO JÁ REVISADA POR HUMANO (preserve o conteúdo e a intenção; apenas complemente com o que mudou):\n${previousEdits.slice(0, 20000)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelConfig.model,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: systemPrompt(
                  caseRow.resource_type,
                  caseRow.agent_name || 'agente selecionado',
                  typeof body?.agentStrategy === 'string' ? body.agentStrategy : '',
                ),
              },
            ],
          },
          { role: 'user', content: [{ type: 'input_text', text: userContent }] },
        ],
        reasoning: { effort: modelConfig.reasoningEffort },
        text: { format: { type: 'json_object' } },
        max_output_tokens: 16000,
      }),

    });

    const durationMs = Date.now() - started;
    const raw = await resp.text();

    const logBase = {
      case_id: caseId,
      resource_type: caseRow.resource_type,
      operation: 'orientacao',
      model: modelConfig.model,
      dedicated_model: modelConfig.dedicated,
      reasoning_effort: modelConfig.reasoningEffort,
      prompt_version: PROMPT_VERSION,
      duration_ms: durationMs,
      correlation_id: correlationId,
    };

    if (!resp.ok) {
      const kind = isModelAccessError(resp.status, raw) ? 'model_access' : 'http';
      await admin.from('inpi_ai_call_logs').insert({
        ...logBase,
        status: 'erro',
        http_status: resp.status,
        error_kind: kind,
      });
      return new Response(
        JSON.stringify({
          error:
            kind === 'model_access'
              ? modelConfigErrorMessage(modelConfig.model, raw.slice(0, 300))
              : `Falha na geração da orientação (HTTP ${resp.status}).`,
          error_kind: kind,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const json = JSON.parse(raw);
    const text: string =
      json.output_text ||
      (json.output || [])
        .flatMap((o: { content?: { text?: string }[] }) => o.content || [])
        .map((c: { text?: string }) => c.text || '')
        .join('') ||
      '';

    let sections: Record<string, unknown>;
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      sections = JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1));
    } catch {
      await admin.from('inpi_ai_call_logs').insert({
        ...logBase,
        status: 'erro',
        http_status: 200,
        error_kind: 'parse',
      });
      return new Response(
        JSON.stringify({ error: 'A IA respondeu em formato inesperado. Tente novamente.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: last } = await admin
      .from('inpi_case_orientations')
      .select('version')
      .eq('case_id', caseId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    const version = (last?.version || 0) + 1;

    const { data: inserted, error: insertError } = await admin
      .from('inpi_case_orientations')
      .insert({
        case_id: caseId,
        version,
        sections,
        editable_text: typeof sections.estrategia === 'string' ? sections.estrategia : null,
        human_edited: false,
        documents_fingerprint: fingerprint,
        is_stale: false,
        model: modelConfig.model,
      })
      .select()
      .single();
    if (insertError) throw insertError;

    await admin
      .from('inpi_resource_cases')
      .update({ current_orientation_version: version, last_error: null })
      .eq('id', caseId);

    await admin.from('inpi_ai_call_logs').insert({
      ...logBase,
      status: 'sucesso',
      http_status: 200,
      input_tokens: json?.usage?.input_tokens ?? null,
      output_tokens: json?.usage?.output_tokens ?? null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        orientation: inserted,
        documents_fingerprint: fingerprint,
        model: modelConfig.model,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro inesperado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
