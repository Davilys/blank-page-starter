import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso de administrador necessário' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { currentContent, adjustmentInstructions, resourceType, extractedData: passedData, evidences } = await req.json();

    if (!currentContent || (!adjustmentInstructions && !evidences)) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios ausentes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasEvidences = Array.isArray(evidences) && evidences.length > 0;

    const systemPrompt = `Você é um ADVOGADO ESPECIALISTA EM PROPRIEDADE INDUSTRIAL de ELITE da WEBMARCAS.

Sua tarefa é APLICAR FIELMENTE as ORIENTAÇÕES DE AJUSTE do usuário ao RASCUNHO do recurso administrativo, comparando ponto a ponto e editando o texto onde for necessário.

⚠️ FLUXO OBRIGATÓRIO (siga nesta ordem, sem pular passos):

PASSO 1 — LEIA as ORIENTAÇÕES DE AJUSTE do usuário palavra por palavra e LISTE INTERNAMENTE cada pedido (adicionar X, remover Y, corrigir Z, encurtar W, reorganizar K).
PASSO 2 — LEIA o RASCUNHO inteiro e LOCALIZE, para cada pedido do Passo 1, a seção/parágrafo/frase exata impactada.
PASSO 3 — APLIQUE cada ajuste fielmente, conforme a intenção do verbo usado pelo usuário:
  • "adicione / insira / inclua / reforce / acrescente / amplie" → EXPANDA a seção indicada com o conteúdo solicitado.
  • "remova / retire / exclua / corte / apague / suprima" → APAGUE o trecho indicado, mesmo que isso encurte a peça.
  • "corrija / troque / substitua / altere / ajuste para" → SUBSTITUA o trecho antigo pelo novo conteúdo pedido.
  • "deixe mais objetivo / curto / conciso / enxuto / direto / resumido" → REESCREVA a seção de forma mais enxuta, podendo encurtar significativamente.
  • "reorganize / mova / inverta / reordene" → REORDENE as seções conforme pedido.
PASSO 4 — Devolva o RECURSO COMPLETO já com TODOS os ajustes aplicados. NÃO devolva o texto sem aplicar. NÃO devolva uma lista de mudanças. NÃO devolva comentários.

REGRAS DE PRESERVAÇÃO (não alterar a menos que o usuário peça expressamente):
- Mantenha o cabeçalho determinístico (processo, marca, classe NCL, titular, examinador/oponente, procurador).
- Preserve TODOS os marcadores literais [DOC:NN], [IMG:marca_cliente], [IMG:marca_opositora] exatamente como aparecem.
- Preserve tabelas markdown (| col | col |), **negrito** e *itálico*.
- Mantenha o encerramento ("Termos em que, pede deferimento" + assinatura) UMA ÚNICA vez ao final.

⚠️ O TAMANHO FINAL É CONSEQUÊNCIA DOS AJUSTES PEDIDOS:
- Se o usuário pediu remoção / objetividade / corte, o texto DEVE ficar menor.
- Se o usuário pediu reforço / expansão / inserção, o texto DEVE ficar maior.
- NUNCA devolva o rascunho inalterado quando há orientações a aplicar.

${hasEvidences ? `
⚠️ INSTRUÇÕES PARA EVIDÊNCIAS DOCUMENTAIS (PRINTS / FOTOS / DECISÕES ANEXAS):

O usuário anexou EVIDÊNCIAS (imagens, prints de site, fotos de produto, páginas de decisão do INPI). Cada evidência tem um NÚMERO DE DOC e uma LEGENDA. Sua tarefa é CITAR essas evidências no corpo do recurso, INSERINDO marcadores literais [DOC:N] (onde N é o número do doc) no parágrafo onde a evidência reforça o argumento.

REGRAS:
- Use a forma EXATA: [DOC:01], [DOC:02], [DOC:03]… (com dois dígitos, entre colchetes, sem espaços).
- Cite cada doc PELO MENOS UMA VEZ no parágrafo argumentativo apropriado, ex.: "conforme se verifica do print do site do concorrente, anexado a esta peça como [DOC:03]…"
- Use a legenda da evidência (e o texto OCR quando útil) para escolher ONDE inserir o marcador. Print de site → seções de uso anterior/concorrência/diluição. Foto de produto/rótulo → distintividade e uso comercial. Página de decisão INPI → história processual.
- Os marcadores [DOC:N] serão substituídos automaticamente pela imagem real ao gerar o PDF — NÃO escreva descrições da imagem, apenas o marcador, opcionalmente seguido por uma referência como "(Doc. 03, anexo)".
- NÃO altere a numeração que o sistema atribuiu — use exatamente o número fornecido.
- Preserve todos os marcadores [DOC:N] que já estiverem no texto original.
` : ''}`;

    const formattingRules = `

REGRAS DE FORMATAÇÃO (preserve OU adicione conforme o ajuste pedir):
- Mantenha **negrito** (**texto**) em conclusões parciais, nomes de marcas em cotejo e termos jurídicos-chave.
- Mantenha *itálico* (*texto*) em transcrições literais de lei, expressões em latim e citações doutrinárias.
- PRESERVE tabelas markdown (| col | col |) intactas. Se o ajuste pedir cotejo de marcas e não houver tabela, ADICIONE uma.
- PRESERVE marcadores literais [IMG:marca_cliente], [IMG:marca_opositora] e [DOC:NN] exatamente como aparecem — esses marcadores serão substituídos por imagens reais no PDF.
- Títulos de seção em CAIXA-ALTA, sem # de cabeçalho markdown.
`;

    const evidenceBlock = hasEvidences
      ? '\n\nEVIDÊNCIAS DOCUMENTAIS ANEXADAS (insira marcadores [DOC:N] no corpo do recurso, na seção argumentativa adequada):\n' +
        evidences.map((e: any, i: number) => {
          const n = String(i + 1).padStart(2, '0');
          const cap = (e.caption || e.source_file_name || 'evidência').toString().slice(0, 200);
          const ocr = (e.ocr_text || '').toString().slice(0, 400);
          return `[DOC:${n}] — ${cap}${ocr ? ` — Texto da página: "${ocr.replace(/\s+/g, ' ').trim()}"` : ''}`;
        }).join('\n')
      : '';

    const userPrompt = `ORIENTAÇÕES DE AJUSTE DO USUÁRIO (LEIA PRIMEIRO, interprete cada pedido e aplique COMPLETAMENTE ao rascunho abaixo):

---INÍCIO DAS ORIENTAÇÕES---
${adjustmentInstructions || (hasEvidences ? 'Insira referências às evidências documentais abaixo nos parágrafos adequados, usando os marcadores [DOC:N] exatos. Reforce a argumentação citando cada evidência ao menos uma vez.' : '')}
---FIM DAS ORIENTAÇÕES---
${evidenceBlock}

RASCUNHO ATUAL DO RECURSO (compare com as orientações acima e aplique cada ajuste no LOCAL CORRETO):

---INÍCIO DO RASCUNHO---
${currentContent}
---FIM DO RASCUNHO---

INSTRUÇÕES FINAIS:
- Aplique TODAS as orientações listadas, fielmente — adicionar, remover, corrigir, encurtar ou reorganizar conforme cada pedido.
- Devolva APENAS o recurso final ajustado, sem comentários e sem listar as mudanças.
- Mantenha cabeçalho, marcadores [DOC:NN], tabelas e encerramento.
- Se uma orientação implicar encurtar a peça, encurte sem hesitação.
${formattingRules}`;

    console.log('Calling AI to adjust INPI resource, original length:', currentContent.length, 'chars');

    // Migrated to Responses API with minimal reasoning for much lower latency.
    // Retries once on transient 429/5xx (backoff) before surfacing the error.
    const callAdjust = async (attempt: number): Promise<Response> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 140000);
      try {
        return await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-5-mini',
            input: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: [{ type: 'input_text', text: userPrompt }] },
            ],
            max_output_tokens: 12000,
            reasoning: { effort: 'minimal' },
            text: { verbosity: 'high' },
          }),
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    let aiResponse: Response | null = null;
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        aiResponse = await callAdjust(attempt);
        if (aiResponse.ok) break;
        const status = aiResponse.status;
        if (status !== 429 && status < 500) break; // non-retryable
        lastError = await aiResponse.text();
        console.warn(`Adjust attempt ${attempt + 1} failed: ${status}`);
        await new Promise((r) => setTimeout(r, 1500 * Math.pow(2, attempt)));
      } catch (err) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        lastError = isAbort ? 'timeout' : (err as Error).message;
        console.warn(`Adjust attempt ${attempt + 1} exception: ${lastError}`);
        if (isAbort) break;
        await new Promise((r) => setTimeout(r, 1500 * Math.pow(2, attempt)));
      }
    }

    if (!aiResponse || !aiResponse.ok) {
      const status = aiResponse?.status || 504;
      console.error('AI API error after retries:', status, lastError.substring(0, 500));
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.', retryable: true }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Erro ao ajustar recurso com IA', retryable: true }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    // Extract text from Responses API output
    let adjustedContent = '';
    if (aiData.output && Array.isArray(aiData.output)) {
      for (const item of aiData.output) {
        if (item.type === 'message' && item.content) {
          for (const part of item.content) {
            if (part.type === 'output_text') adjustedContent += part.text;
          }
        }
      }
    }

    if (!adjustedContent) {
      console.error('Empty AI response for adjustment');
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da IA', retryable: true }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let trimmed = adjustedContent.trim();
    console.log('Adjusted content length:', trimmed.length, 'chars (original:', currentContent.length, 'chars)');
    const unchanged = trimmed === currentContent.trim();

    // Diagnóstico: avisar se o modelo devolveu texto idêntico ao rascunho (ajustes não aplicados)
    if (trimmed === currentContent.trim()) {
      console.warn('WARNING: Adjusted content is IDENTICAL to original — model may not have applied the instructions.');
    } else {
      const delta = trimmed.length - currentContent.length;
      console.log('Adjustment delta:', delta, 'chars (', delta >= 0 ? '+' : '', delta, ')');
    }

    // ═══ ENFORCE MANDATORY OPENING BLOCK ═══
    // Re-apply the deterministic header to prevent AI from stripping it
    if (passedData && resourceType) {
      const RESOURCE_TYPE_LABELS: Record<string, string> = {
        indeferimento: 'RECURSO CONTRA INDEFERIMENTO',
        exigencia_merito: 'CUMPRIMENTO DE EXIGÊNCIA DE MÉRITO / RECURSO ADMINISTRATIVO',
        oposicao: 'MANIFESTAÇÃO À OPOSIÇÃO',
        notificacao_extrajudicial: 'NOTIFICAÇÃO EXTRAJUDICIAL',
        troca_procurador: 'PETIÇÃO DE TROCA DE PROCURADOR',
        nomeacao_procurador: 'PETIÇÃO DE NOMEAÇÃO DE PROCURADOR'
      };
      const label = RESOURCE_TYPE_LABELS[resourceType] || 'RECURSO ADMINISTRATIVO';
      const d = passedData;
      const brandUpper = (d.brand_name || 'N/I').toUpperCase();
      const processNum = (d.process_number || 'N/I').replace(/[^\d./-]/g, '').trim() || 'N/I';
      const brandLine = d.brand_name || 'N/I';
      const nclClass = d.ncl_class || 'N/I';
      const holder = d.holder || 'N/I';
      const examinerOrOpponent = d.examiner_or_opponent || 'N/I';
      const isOposicao = resourceType === 'oposicao';
      const isProcurador = resourceType === 'troca_procurador' || resourceType === 'nomeacao_procurador';
      const personLabel = isOposicao ? 'Oponente' : 'Examinador(a)';

      // Procurador petitions do NOT include an Examinador/Oponente line
      const personLine = isProcurador ? '' : `\n${personLabel}: ${examinerOrOpponent}`;

      const header = `RECURSO ADMINISTRATIVO – ${label}\n\nMARCA: ${brandUpper}\n\nEXCELENTÍSSIMO SENHOR PRESIDENTE DA DIRETORIA DE MARCAS,\nPATENTES E DESENHOS INDUSTRIAIS DO INSTITUTO NACIONAL\nDA PROPRIEDADE INDUSTRIAL – INPI\n\nProcesso INPI nº: ${processNum}\nMarca: ${brandLine}\nClasse NCL (12ª Ed.): ${nclClass}\nTitular/Requerente: ${holder}${personLine}\nProcurador: Davilys Danques de Oliveira Cunha – CPF 393.239.118-79`;

      // Find section I in adjusted content
      const sectionMatch = trimmed.match(/\n?\s*(I\s*[–—\-\.]\s*)/);
      if (sectionMatch && sectionMatch.index !== undefined) {
        const body = trimmed.substring(sectionMatch.index).trim();
        trimmed = `${header}\n\n${body}`;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        adjusted_content: trimmed,
        unchanged,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error adjusting INPI resource:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
