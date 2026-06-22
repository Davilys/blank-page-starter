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

Sua tarefa é INCORPORAR os ajustes solicitados pelo usuário ao recurso administrativo existente, tornando-o MAIS ROBUSTO e COMPLETO.

⚠️ REGRAS ABSOLUTAS E INVIOLÁVEIS:

1. INCORPORE os ajustes solicitados DENTRO do recurso existente — NÃO substitua, ACRESCENTE e ENRIQUEÇA
2. O texto ajustado deve ser MAIOR ou IGUAL ao original — NUNCA menor
3. Mantenha TODA a estrutura, formatação e seções do recurso original
4. Preserve TODOS os dados extraídos (número do processo, marca, classe NCL, titular, etc.)
5. Preserve a assinatura e encerramento originais
6. Os novos argumentos ou correções devem ser INTEGRADOS naturalmente ao texto existente
7. Se o ajuste pede para adicionar um argumento, INSIRA-O na seção mais adequada
8. Se o ajuste pede para corrigir algo, CORRIJA mantendo o restante intacto
9. Se o ajuste pede para fortalecer uma seção, EXPANDA-A com mais fundamentação
10. NUNCA retorne um texto resumido, abreviado ou mais curto que o original

IMPORTANTE: O resultado final deve conter TODO o conteúdo original MAIS as melhorias/ajustes solicitados.
O recurso ajustado DEVE ser mais robusto que o original.

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

    const userPrompt = `RECURSO ATUAL (mantenha TODO este conteúdo e ACRESCENTE os ajustes):

---INÍCIO DO RECURSO---
${currentContent}
---FIM DO RECURSO---

AJUSTES SOLICITADOS PELO USUÁRIO (incorpore DENTRO do recurso acima, enriquecendo-o):
${adjustmentInstructions || (hasEvidences ? 'Insira referências às evidências documentais abaixo nos parágrafos adequados, usando os marcadores [DOC:N] exatos. Reforce a argumentação citando cada evidência ao menos uma vez.' : '')}
${evidenceBlock}

INSTRUÇÕES FINAIS:
- Retorne o recurso COMPLETO com os ajustes INCORPORADOS
- O texto deve ser MAIOR que o original, não menor
- NÃO retorne explicações, apenas o recurso ajustado completo
- NÃO omita nenhuma seção do recurso original
${formattingRules}`;

    console.log('Calling AI to adjust INPI resource, original length:', currentContent.length, 'chars');

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 16000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao ajustar recurso com IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const adjustedContent = aiData.choices?.[0]?.message?.content;

    if (!adjustedContent) {
      console.error('Empty AI response for adjustment');
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let trimmed = adjustedContent.trim();
    console.log('Adjusted content length:', trimmed.length, 'chars (original:', currentContent.length, 'chars)');

    // Warn if adjusted is significantly shorter than original
    if (trimmed.length < currentContent.length * 0.7) {
      console.warn('WARNING: Adjusted content is significantly shorter than original!');
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
        adjusted_content: trimmed
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
