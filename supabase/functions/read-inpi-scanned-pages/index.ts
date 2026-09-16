// Leitura visual (OCR/IA) das páginas sem texto extraível — exclusiva das três
// modalidades de Recursos INPI. PDF sem texto não é documento ilegível: as
// páginas são enviadas como imagem e o que foi efetivamente interpretado fica
// registrado no documento.
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

const PROMPT_VERSION = 'recursos-inpi-leitura-visual-2026-09-fase7';
const MAX_PAGES = 12;

interface PageInput {
  page: number;
  dataUrl: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const started = Date.now();
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autorizado' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!userData?.user) return json({ error: 'Não autorizado' }, 401);
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Acesso de administrador necessário' }, 403);

    const body = await req.json().catch(() => ({}));
    const caseId: string | null = typeof body?.caseId === 'string' ? body.caseId : null;
    const documentId: string | null = typeof body?.documentId === 'string' ? body.documentId : null;
    const pages: PageInput[] = Array.isArray(body?.pages) ? body.pages.slice(0, MAX_PAGES) : [];
    if (!caseId || !documentId || !pages.length) {
      return json({ error: 'Informe o caso, o documento e ao menos uma página.' }, 400);
    }
    if (pages.some((p) => typeof p.dataUrl !== 'string' || !p.dataUrl.startsWith('data:image/'))) {
      return json({ error: 'Páginas devem ser imagens.' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: caseRow } = await admin
      .from('inpi_resource_cases')
      .select('id, resource_type')
      .eq('id', caseId)
      .maybeSingle();
    if (!caseRow) return json({ error: 'Caso não encontrado' }, 404);
    if (!isRecursosInpiModality(caseRow.resource_type)) {
      return json({ error: 'Modalidade fora do escopo desta leitura' }, 400);
    }

    // Isolamento entre casos: o documento precisa pertencer ao caso informado.
    const { data: docRow } = await admin
      .from('inpi_case_documents')
      .select('id, case_id, file_name, extracted_text, page_count, interpreted_pages, extraction_status, vision_read_at, vision_read_pages')
      .eq('id', documentId)
      .maybeSingle();
    if (!docRow || docRow.case_id !== caseId) {
      return json({ error: 'Documento não pertence a este caso' }, 404);
    }

    // Proteção de duplicação no servidor: leitura visual já concluída (ou em curso
    // há menos de 5 minutos) não é refeita por duas abas ou envios simultâneos.
    if (docRow.vision_read_at && body?.force !== true) {
      return json({
        success: true,
        reused: true,
        pages_read: docRow.vision_read_pages || 0,
        message: 'Leitura visual já registrada para este documento.',
      });
    }
    // Marca o início — a segunda requisição concorrente cai no bloco acima.
    await admin.from('inpi_case_documents')
      .update({ vision_read_at: new Date().toISOString() })
      .eq('id', documentId)
      .is('vision_read_at', null);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY não configurada' }, 503);

    const modelConfig = resolveModelConfig(caseRow.resource_type, 'gpt-5-mini', 'minimal');
    const correlationId = crypto.randomUUID();

    const instruction = [
      'Você transcreve páginas digitalizadas de documentos de propriedade industrial.',
      'Transcreva fielmente o texto visível de cada página, na ordem em que aparece.',
      'Nunca complete, corrija ou invente conteúdo que não esteja visível.',
      'Quando um trecho estiver ilegível, escreva [ilegível] naquele ponto.',
      'Quando a página não contiver texto (foto, logotipo, gráfico), descreva objetivamente o que se vê.',
      'Responda SOMENTE com JSON válido:',
      '{"paginas":[{"pagina":1,"tipo":"texto|imagem|ilegivel","transcricao":"","observacao":""}]}',
    ].join('\n');

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelConfig.model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: instruction }] },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `Documento: ${docRow.file_name}. Páginas enviadas: ${pages
                  .map((p) => p.page)
                  .join(', ')}.`,
              },
              ...pages.map((p) => ({ type: 'input_image', image_url: p.dataUrl })),
            ],
          },
        ],
        reasoning: { effort: modelConfig.reasoningEffort },
        max_output_tokens: 8000,
      }),
    });

    const durationMs = Date.now() - started;
    const raw = await resp.text();
    const logBase = {
      case_id: caseId,
      resource_type: caseRow.resource_type,
      operation: 'leitura_visual',
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
        ...logBase, status: 'erro', http_status: resp.status, error_kind: kind,
      });
      await admin.from('inpi_case_documents').update({
        vision_notes: `Leitura visual não concluída (HTTP ${resp.status}). As páginas continuam sem conteúdo conferido.`,
      }).eq('id', documentId);
      return json({
        error: kind === 'model_access'
          ? modelConfigErrorMessage(modelConfig.model, raw.slice(0, 300))
          : `Falha na leitura visual (HTTP ${resp.status}).`,
        error_kind: kind,
      }, 502);
    }

    const parsed = JSON.parse(raw);
    const text: string =
      parsed.output_text ||
      (parsed.output || [])
        .flatMap((o: { content?: { text?: string }[] }) => o.content || [])
        .map((c: { text?: string }) => c.text || '')
        .join('') ||
      '';

    let result: { paginas?: { pagina?: number; tipo?: string; transcricao?: string; observacao?: string }[] };
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      result = JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1));
    } catch {
      await admin.from('inpi_ai_call_logs').insert({
        ...logBase, status: 'erro', http_status: 200, error_kind: 'parse',
      });
      return json({ error: 'A leitura visual respondeu em formato inesperado.' }, 502);
    }

    const readPages = (result.paginas || []).filter(
      (p) => (p.transcricao || '').trim().length > 0 || (p.observacao || '').trim().length > 0,
    );
    const interpretedByVision = readPages.filter((p) => p.tipo !== 'ilegivel').length;

    const visionText = readPages
      .map(
        (p) =>
          `### Página ${p.pagina ?? '?'} (leitura visual — ${p.tipo || 'texto'})\n${
            (p.transcricao || '').trim() || (p.observacao || '').trim()
          }`,
      )
      .join('\n\n');

    const combined = [docRow.extracted_text || '', visionText].filter(Boolean).join('\n\n').slice(0, 200000);
    const totalPages = docRow.page_count ?? pages.length;
    const interpretedTotal = Math.min(totalPages, (docRow.interpreted_pages || 0) + interpretedByVision);
    const unreadable = Math.max(0, totalPages - interpretedTotal);
    const status = interpretedTotal === 0 ? 'recebido' : unreadable > 0 ? 'parcial' : 'lido';

    await admin.from('inpi_case_documents').update({
      extracted_text: combined,
      extraction_status: status,
      interpreted_pages: interpretedTotal,
      unreadable_pages: unreadable,
      extraction_notes:
        `${interpretedTotal} de ${totalPages} página(s) com conteúdo interpretado ` +
        `(${interpretedByVision} por leitura visual da IA).`,
      vision_read_pages: interpretedByVision,
      vision_model: modelConfig.model,
      vision_notes: readPages
        .map((p) => `Pág. ${p.pagina ?? '?'}: ${p.tipo || 'texto'}${p.observacao ? ` — ${p.observacao}` : ''}`)
        .join(' | ')
        .slice(0, 2000),
      vision_read_at: new Date().toISOString(),
    }).eq('id', documentId);

    await admin.from('inpi_ai_call_logs').insert({
      ...logBase,
      status: 'sucesso',
      http_status: 200,
      input_tokens: parsed?.usage?.input_tokens ?? null,
      output_tokens: parsed?.usage?.output_tokens ?? null,
    });

    return json({
      success: true,
      model: modelConfig.model,
      pages_sent: pages.length,
      pages_interpreted: interpretedByVision,
      extraction_status: status,
      interpreted_pages: interpretedTotal,
      unreadable_pages: unreadable,
      pages: result.paginas || [],
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro inesperado' }, 500);
  }
});
