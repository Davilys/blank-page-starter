// Revisão jurídica automática da peça — exclusiva das três modalidades de
// Recursos INPI. Confere se cada fato afirmado tem documento que o sustente,
// se os fundamentos foram respondidos, se há citação não conferida, campo não
// preenchido ou informação inventada. Não altera a peça: apenas aponta.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateReview } from '../_shared/inpiReviewValidation.ts';
import { parseProviderResponse } from '../process-inpi-resource/durableResponse.ts';
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

const PROMPT_VERSION = 'recursos-inpi-revisao-2026-09-fase5';

const MODALITY_BRIEF: Record<string, string> = {
  indeferimento:
    'Recurso contra indeferimento (art. 212 da LPI). A peça precisa rebater cada fundamento do parecer de indeferimento.',
  exigencia_merito:
    'Cumprimento de exigência de mérito. Cada item exigido pelo INPI precisa ser respondido de forma objetiva e documentada.',
  oposicao:
    'Manifestação à oposição. A peça precisa responder cada alegação do opositor.',
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
    const { data: canUse } = await supabase.rpc('has_inpi_resources_access', {
      _user_id: userData.user.id,
      _need_edit: true,
    });
    if (!canUse) return json({ error: 'Sem permissão para Recursos INPI' }, 403);

    const body = await req.json().catch(() => ({}));
    const caseId: string | null = typeof body?.caseId === 'string' ? body.caseId : null;
    const content: string = typeof body?.content === 'string' ? body.content : '';
    const contentHash: string = typeof body?.contentHash === 'string' ? body.contentHash : '';
    const documentsHash: string | null =
      typeof body?.documentsHash === 'string' ? body.documentsHash : null;
    const resourceId: string | null = typeof body?.resourceId === 'string' ? body.resourceId : null;
    if (!caseId || !content.trim() || !contentHash) {
      return json({ error: 'Informe o caso, o texto da peça e a versão conferida.' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: caseRow } = await admin
      .from('inpi_resource_cases')
      .select('id, resource_type, brand_name, process_number, resource_id')
      .eq('id', caseId)
      .maybeSingle();
    if (!caseRow) return json({ error: 'Caso não encontrado' }, 404);
    if (!isRecursosInpiModality(caseRow.resource_type)) {
      return json({ error: 'Modalidade fora do escopo desta revisão' }, 400);
    }

    if (!resourceId || caseRow.resource_id !== resourceId) return json({ error: 'A peça não pertence a este caso.' }, 409);

    const { data: docs, error: docsError } = await admin
      .from('inpi_case_documents')
      .select('id, doc_number, category, sha256, file_name, extraction_status, extraction_notes, extracted_text, interpreted_pages, unreadable_pages')
      .eq('case_id', caseId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (docsError) throw new Error('Falha ao carregar os documentos para revisão.');
    const documents = docs || [];
    const hashText = async (value: string) => Array.from(new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
    const fingerprint = (rows: any[]) => rows.map(d => JSON.stringify([d.id, d.doc_number, d.category, d.sha256])).sort().join('|');
    if (await hashText(content) !== contentHash || await hashText(fingerprint(documents)) !== documentsHash) {
      return json({ error: 'O texto ou os documentos mudaram. Atualize a revisão.', error_kind: 'version_changed' }, 409);
    }
    // Idempotência: mesma versão de texto e de anexos não gera revisão duplicada.
    const { data: existing } = await admin
      .from('inpi_draft_reviews')
      .select('*')
      .eq('case_id', caseId)
      .eq('content_hash', contentHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing && existing.documents_hash === documentsHash && body?.force !== true) {
      return json({ success: true, review: existing, reused: true });
    }


    const dossier = documents.length
      ? documents
          .map((d, i) => {
            const header =
              `[DOC:${String(d.doc_number).padStart(2, '0')}] ${CATEGORY_LABEL[d.category] || d.category} — ` +
              `${d.file_name} (leitura: ${d.extraction_status}` +
              `${d.unreadable_pages ? `; ${d.unreadable_pages} página(s) sem conteúdo conferido` : ''})`;
            return (
              header +
              (d.extracted_text
                ? `\nConteúdo conferido:\n${String(d.extracted_text)}`
                : '\nSem conteúdo interpretado: nada pode ser afirmado a partir deste documento.')
            );
          })
          .join('\n\n')
      : 'Nenhum documento no caso.';

    const { data: orientation } = await admin
      .from('inpi_case_orientations')
      .select('editable_text, sections')
      .eq('case_id', caseId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY não configurada' }, 503);
    const modelConfig = resolveModelConfig(caseRow.resource_type, 'gpt-5-mini', 'minimal');
    const correlationId = crypto.randomUUID();

    const instruction = [
      'Você é revisor jurídico de peças de propriedade industrial. NÃO reescreva a peça: aponte problemas.',
      `Modalidade: ${MODALITY_BRIEF[caseRow.resource_type]}`,
      '',
      'Confira, item a item:',
      '1. FATO SEM LASTRO — afirmação de fato que nenhum documento do dossiê sustenta (inclusive datas, valores, nomes e números).',
      '2. CITACAO — norma, artigo, súmula, acórdão, decisão ou doutrina citada. Você NÃO tem acesso a fontes externas:',
      '   toda referência jurídica que não esteja transcrita no dossiê é NÃO CONFERIDA e exige conferência humana na fonte oficial.',
      '3. FUNDAMENTO NAO RESPONDIDO — fundamento do INPI ou do opositor que a peça não enfrenta.',
      '4. PLACEHOLDER — campo não preenchido, colchete, "XXX", nome ou número faltando.',
      '5. CONTRADICAO — afirmações incompatíveis entre si ou com o dossiê.',
      '6. DOCUMENTO NAO CONFERIDO — conclusão apoiada em documento cujas páginas não foram interpretadas.',
      '',
      'REGRA DE PROVA (obrigatória): citar "DOC:01" NÃO comprova nada. Para cada afirmação de fato que você',
      'considerar sustentada, copie em "trecho_fonte" a passagem LITERAL do conteúdo conferido daquele documento',
      'que a sustenta. Se não houver passagem literal para copiar, o apontamento é fato_sem_lastro (bloqueante),',
      'ainda que a peça cite o documento. Nunca parafraseie no campo "trecho_fonte"; nunca invente conteúdo de documento.',
      '',
      'Bloqueantes: tipos 1, 2, 4 e 6.',
      '',
      'Responda SOMENTE com JSON válido:',
      '{"resumo":"","apontamentos":[{"tipo":"fato_sem_lastro|citacao_nao_conferida|fundamento_nao_respondido|placeholder|contradicao|documento_nao_conferido","trecho":"","trecho_fonte":"","problema":"","sugestao":"","bloqueante":true,"fontes":["DOC:01"],"conferencia_externa_necessaria":false}]}',
    ].join('\n');

    const userContent = [
      `Modalidade: ${caseRow.resource_type}`,
      caseRow.brand_name ? `Marca: ${caseRow.brand_name}` : null,
      caseRow.process_number ? `Processo: ${caseRow.process_number}` : null,
      '',
      'DOSSIÊ:',
      dossier,
      '',
      'ORIENTAÇÃO CONFIRMADA:',
      (orientation?.editable_text as string) || '(sem orientação registrada)',
      '',
      'PEÇA A REVISAR:',
      content,
    ]
      .filter(Boolean)
      .join('\n');

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(110000),
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelConfig.model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: instruction }] },
          { role: 'user', content: [{ type: 'input_text', text: userContent }] },
        ],
        reasoning: { effort: modelConfig.reasoningEffort },
        max_output_tokens: 8000,
      }),
    });

    const durationMs = Date.now() - started;
    const raw = await resp.text();
    const logBase = {
      case_id: caseId,
      resource_id: resourceId,
      resource_type: caseRow.resource_type,
      operation: 'revisao_juridica',
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
      return json({
        error: kind === 'model_access'
          ? modelConfigErrorMessage(modelConfig.model, raw.slice(0, 300))
          : `Falha na revisão automática (HTTP ${resp.status}).`,
        error_kind: kind,
      }, 502);
    }

    const parsed = JSON.parse(raw);
    const terminal = parseProviderResponse(parsed);
    if (terminal.error) return json({ error: terminal.error, error_kind: terminal.errorKind }, 502);
    const text: string =
      parsed.output_text ||
      (parsed.output || [])
        .flatMap((o: { content?: { text?: string }[] }) => o.content || [])
        .map((c: { text?: string }) => c.text || '')
        .join('') ||
      '';

    let review: { resumo?: string; apontamentos?: { bloqueante?: boolean }[] };
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      review = validateReview(JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1)));
    } catch {
      await admin.from('inpi_ai_call_logs').insert({
        ...logBase, status: 'erro', http_status: 200, error_kind: 'parse',
      });
      return json({ error: 'A revisão respondeu em formato inesperado.' }, 502);
    }

    const { data: currentDocs, error: currentError } = await admin.from('inpi_case_documents')
      .select('id, doc_number, category, sha256, extracted_text').eq('case_id', caseId).eq('is_active', true);
    if (currentError) throw new Error('Não foi possível confirmar a versão revisada.');
    const textSnapshot = (rows: any[]) => rows.map(d => JSON.stringify([d.id, d.extracted_text])).sort().join('|');
    if (fingerprint(currentDocs || []) !== fingerprint(documents) || textSnapshot(currentDocs || []) !== textSnapshot(documents)) {
      return json({ error: 'Os documentos mudaram durante a revisão. Revise a versão atual.', error_kind: 'version_changed' }, 409);
    }
    const findings = review.apontamentos || [];
    const hasBlocking = findings.some((f) => f?.bloqueante === true);

    const { data: saved, error: saveError } = await admin
      .from('inpi_draft_reviews')
      .insert({
        case_id: caseId,
        resource_id: resourceId,
        content_hash: contentHash,
        documents_hash: documentsHash,
        model: modelConfig.model,
        prompt_version: PROMPT_VERSION,
        findings,
        summary: review.resumo || null,
        has_blocking: hasBlocking,
        reviewed_by: userData.user.id,
      })
      .select()
      .single();
    // Concorrência real (duas abas / dois envios simultâneos): o índice único no
    // servidor recusa a segunda gravação e devolvemos a revisão já registrada.
    if (saveError) {
      if ((saveError as { code?: string }).code === '23505') {
        const { data: concurrent } = await admin
          .from('inpi_draft_reviews')
          .select('*')
          .eq('case_id', caseId)
          .eq('content_hash', contentHash)
          .eq('documents_hash', documentsHash)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (concurrent) {
          await admin.from('inpi_ai_call_logs').insert({
            ...logBase, status: 'sucesso', http_status: 200, error_kind: 'duplicado_concorrente',
          });
          return json({ success: true, review: concurrent, reused: true });
        }
      }
      throw saveError;
    }

    await admin.from('inpi_ai_call_logs').insert({
      ...logBase,
      status: 'sucesso',
      http_status: 200,
      input_tokens: parsed?.usage?.input_tokens ?? null,
      output_tokens: parsed?.usage?.output_tokens ?? null,
    });

    return json({ success: true, review: saved, model: modelConfig.model });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro inesperado' }, 500);
  }
});
