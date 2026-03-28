import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─────────────────────────────────────────────
// BASE SYSTEM PROMPT (sempre injetado)
// ─────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `#instruction

Você é um AGENTE JURÍDICO ESPECIALISTA EM REGISTRO DE MARCAS NO INPI,

atuando como ADVOGADA ESPECIALISTA EM PROPRIEDADE INDUSTRIAL.

Sua atuação é EXCLUSIVA para:

- Registro de marcas

- Indeferimento

- Exigência de mérito

- Oposição

- Recursos administrativos no INPI

Você possui domínio absoluto da:

- Lei da Propriedade Industrial (Lei nº 9.279/96)

- Manual de Marcas do INPI (versão vigente)

- Classificação Internacional de Nice

- Taxas oficiais do INPI (valores reais e atualizados)

- Jurisprudência REAL do STJ, TRF-2 e TRF-3

⚠️ É TERMINANTEMENTE PROIBIDO:

- Inventar fatos

- Simular decisões

- Criar jurisprudência falsa

- Dar garantias irreais

- Iludir o cliente

Sua atuação deve ser:

- Técnica

- Estratégica

- Brutalmente sincera

- Ética

- Focada em resolver o problema real do cliente

#comportamento

Você deve agir como uma ADVOGADA HUMANA, EXPERIENTE E CONSULTIVA.

Sempre:

- Diga a verdade, mesmo que não agrade

- Explique em linguagem simples e acessível

- Traduza o jurídico para o cliente leigo

- Avalie riscos de forma realista

- Indique o melhor caminho possível

#processo_analise

Quando o usuário enviar um arquivo PDF do INPI:

1. Leia integralmente o documento

2. Identifique:

   - Tipo (exigência, indeferimento ou oposição)

   - Fundamento legal utilizado

   - Marca envolvida

   - Classe

   - Ramo de atividade

3. Faça uma CONSULTORIA JURÍDICA RESUMIDA explicando:

   - O que aconteceu

   - Por que aconteceu

   - O risco real

   - As chances reais

   - O que pode ser feito

#consultoria_obrigatoria

Antes de criar qualquer recurso, você DEVE:

- Entregar uma consultoria jurídica clara

- Explicar como se estivesse falando com um cliente leigo

- Dizer se vale a pena recorrer ou não

- Indicar alternativas mais seguras quando existirem

#recurso_juridico

Somente quando o usuário solicitar, você deve:

- Criar recurso administrativo completo

- Usar fundamentação real (LPI + Manual INPI)

- Aplicar jurisprudência verdadeira

- Defender o cliente com estratégia técnica

- Seguir estrutura profissional de advogado

#linguagem

- Clara

- Direta

- Sem juridiquês excessivo

- Focada em entendimento do cliente

- Profissional e segura

#objetivo

Resolver o problema real do cliente de forma técnica, estratégica, honesta e ética.

Seja direta, clara e sempre foque na melhor solução possível para o caso concreto.`;

// ─────────────────────────────────────────────
// DYNAMIC KNOWLEDGE INJECTION
// ─────────────────────────────────────────────

async function fetchDynamicKnowledge(): Promise<{ context: string; lastSync: string | null }> {
  try {
    const { data: items, error } = await supabaseAdmin
      .from('inpi_knowledge_base')
      .select('category, title, content, source_date, updated_at, priority')
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error || !items || items.length === 0) {
      console.log('[chat-inpi-legal] No dynamic knowledge found, using base prompt only');
      return { context: '', lastSync: null };
    }

    // Agrupa por categoria
    const grouped: Record<string, typeof items> = {};
    for (const item of items) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    const categoryOrder = ['taxas', 'prazos', 'manual', 'despachos', 'resolucoes', 'jurisprudencia', 'noticias'];
    const categoryLabels: Record<string, string> = {
      taxas: '💰 TAXAS OFICIAIS ATUALIZADAS',
      prazos: '⏱️ PRAZOS E PROCEDIMENTOS VIGENTES',
      manual: '📘 MANUAL DE MARCAS INPI',
      despachos: '📋 CÓDIGOS DE DESPACHO',
      resolucoes: '📜 RESOLUÇÕES RECENTES',
      jurisprudencia: '⚖️ JURISPRUDÊNCIA RECENTE',
      noticias: '📰 NOTÍCIAS E ATUALIZAÇÕES INPI',
    };

    let context = `\n\n═══════════════════════════════════════
🔄 BASE DE CONHECIMENTO DINÂMICA DO INPI
Atualizada automaticamente toda semana com dados oficiais do INPI, STJ e TRF.
Data desta atualização: ${new Date().toLocaleDateString('pt-BR')}
═══════════════════════════════════════\n`;

    for (const cat of categoryOrder) {
      if (!grouped[cat] || grouped[cat].length === 0) continue;
      const label = categoryLabels[cat] || cat.toUpperCase();
      context += `\n\n### ${label}\n`;

      for (const item of grouped[cat].slice(0, 3)) {
        const dateStr = item.source_date
          ? new Date(item.source_date).toLocaleDateString('pt-BR')
          : 'data desconhecida';
        context += `\n[${item.title} – ${dateStr}]\n`;
        // Limita conteúdo por item para não explodir o prompt
        context += item.content.substring(0, 2500) + '\n';
      }
    }

    context += `\n═══════════════════════════════════════
INSTRUÇÃO CRÍTICA: Use SEMPRE as informações acima como referência primária.
Se houver conflito entre seu treinamento e estes dados, PREFIRA estes dados pois são mais recentes.
═══════════════════════════════════════`;

    // Pega a data do sync mais recente
    const { data: lastLog } = await supabaseAdmin
      .from('inpi_sync_logs')
      .select('finished_at, status')
      .eq('status', 'success')
      .order('finished_at', { ascending: false })
      .limit(1)
      .single();

    const lastSync = lastLog?.finished_at || null;

    console.log(`[chat-inpi-legal] Dynamic knowledge injected: ${items.length} items, ${context.length} chars`);
    return { context, lastSync };

  } catch (e) {
    console.error('[chat-inpi-legal] Error fetching dynamic knowledge:', e);
    return { context: '', lastSync: null };
  }
}

// ─────────────────────────────────────────────
// PDF HELPERS
// ─────────────────────────────────────────────

async function extractPdfTextFromBase64(base64: string, maxPages = 50): Promise<string> {
  const startedAt = Date.now();

  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const doc = await pdfjsLib.getDocument({ data: bytes, disableWorker: true }).promise;
    const pagesToRead = Math.min(doc.numPages, maxPages);

    let fullText = '';
    for (let pageNum = 1; pageNum <= pagesToRead; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => (typeof item?.str === 'string' ? item.str : ''))
        .filter(Boolean)
        .join(' ');

      if (pageText.trim()) {
        fullText += `\n\n--- Página ${pageNum} ---\n${pageText}`;
      }
    }

    console.log(
      `[pdf] extractedChars=${fullText.length} pages=${pagesToRead} timeMs=${Date.now() - startedAt}`
    );

    return fullText.trim();
  } catch (err) {
    console.error('[pdf] extract failed:', err);
    return '';
  }
}

function buildMultimodalContent(text: string, images: string[], fileName: string): any[] {
  const content: any[] = [];
  
  content.push({
    type: "text",
    text: `${text}\n\n📄 Documento anexado: ${fileName}\n\nAs imagens abaixo são páginas do documento PDF. Por favor, faça OCR e análise jurídica completa do conteúdo visível.`
  });
  
  for (const imageData of images) {
    content.push({
      type: "image_url",
      image_url: { url: imageData, detail: "high" }
    });
  }
  
  return content;
}

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, getMetadata } = await req.json();

    // Endpoint especial para metadados (usado pelo frontend para exibir status)
    if (getMetadata) {
      const { data: lastLog } = await supabaseAdmin
        .from('inpi_sync_logs')
        .select('finished_at, status, items_created, items_updated, categories_synced')
        .in('status', ['success', 'partial'])
        .order('finished_at', { ascending: false })
        .limit(1)
        .single();

      const { count } = await supabaseAdmin
        .from('inpi_knowledge_base')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      return new Response(JSON.stringify({
        lastSync: lastLog?.finished_at || null,
        syncStatus: lastLog?.status || 'never',
        knowledgeItemsCount: count || 0,
        categoriesSynced: lastLog?.categories_synced || [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // Busca conhecimento dinâmico do INPI
    const { context: dynamicContext } = await fetchDynamicKnowledge();

    // Monta system prompt enriquecido
    const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT + (dynamicContext || '');

    // Build messages array
    const apiMessages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }];

    // Process conversation history
    if (messages && Array.isArray(messages)) {
      for (const msg of messages) {
        if (msg.role !== 'user') {
          apiMessages.push({ role: msg.role, content: msg.content });
          continue;
        }

        const hasImages = Array.isArray(msg.fileImages) && msg.fileImages.length > 0;
        const hasPdf = typeof msg.fileBase64 === 'string' && msg.fileBase64.length > 0;

        if (hasImages) {
          console.log('Using multimodal OCR for PDF:', msg.fileName, 'with', msg.fileImages.length, 'images');

          let extractedText = '';
          if (hasPdf) {
            extractedText = await extractPdfTextFromBase64(msg.fileBase64);
          }

          const baseText = msg.content || 'Analise este documento do INPI:';
          const withExtract = extractedText
            ? `${baseText}\n\n[Texto extraído do PDF (quando disponível)]:\n${extractedText}`
            : baseText;

          const multimodalContent = buildMultimodalContent(
            withExtract,
            msg.fileImages,
            msg.fileName || 'documento.pdf'
          );

          apiMessages.push({ role: 'user', content: multimodalContent });
          continue;
        }

        if (hasPdf) {
          console.log('PDF received without images:', msg.fileName);

          const extractedText = await extractPdfTextFromBase64(msg.fileBase64);
          const baseText = msg.content || 'Analise este documento do INPI:';

          apiMessages.push({
            role: 'user',
            content:
              extractedText && extractedText.length > 50
                ? `${baseText}\n\n📄 Documento anexado: ${msg.fileName || 'documento.pdf'}\n\n[Conteúdo extraído do PDF]:\n${extractedText}`
                : `${baseText}\n\n📄 Documento anexado: ${msg.fileName || 'documento.pdf'}\n\nNão consegui extrair texto suficiente desse PDF (provavelmente é escaneado). Se possível, reenvie com melhor qualidade ou use o PDF original do INPI (texto selecionável).`,
          });
          continue;
        }

        apiMessages.push({ role: 'user', content: msg.content });
      }
    }

    console.log(`[chat-inpi-legal] Sending to OpenAI: ${apiMessages.length} messages, system prompt: ${SYSTEM_PROMPT.length} chars`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: apiMessages,
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns instantes.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Chat INPI Legal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
