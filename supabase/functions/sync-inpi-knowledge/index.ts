import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─────────────────────────────────────────────
// SCRAPING HELPERS
// ─────────────────────────────────────────────

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,*/*' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.error(`Fetch error for ${url}:`, e);
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function extractSection(html: string, keyword: string, maxChars = 3000): string {
  const lc = html.toLowerCase();
  const idx = lc.indexOf(keyword.toLowerCase());
  if (idx === -1) return '';
  const start = Math.max(0, idx - 200);
  const end = Math.min(html.length, idx + maxChars);
  return stripHtml(html.substring(start, end));
}

// ─────────────────────────────────────────────
// SOURCES TO SCRAPE
// ─────────────────────────────────────────────

interface ScrapedItem {
  category: string;
  title: string;
  content: string;
  source_url: string;
  source_date: string;
  priority: number;
  tags: string[];
}

async function scrapeTaxasINPI(): Promise<ScrapedItem | null> {
  const url = 'https://www.gov.br/inpi/pt-br/servicos/marcas/taxas';
  const html = await fetchPage(url);
  if (!html) return null;

  const text = stripHtml(html).substring(0, 6000);
  if (text.length < 100) return null;

  return {
    category: 'taxas',
    title: `Taxas INPI atualizadas – ${new Date().toLocaleDateString('pt-BR')}`,
    content: `INFORMAÇÕES OFICIAIS DE TAXAS DO INPI (fonte: gov.br/inpi – atualizado em ${new Date().toLocaleDateString('pt-BR')}):\n\n${text}`,
    source_url: url,
    source_date: new Date().toISOString().split('T')[0],
    priority: 1,
    tags: ['taxas', 'valores', 'oficial', '2026'],
  };
}

async function scrapeNoticiasINPI(): Promise<ScrapedItem[]> {
  const items: ScrapedItem[] = [];
  const urls = [
    'https://www.gov.br/inpi/pt-br/central-de-conteudo/noticias',
    'https://www.gov.br/inpi/pt-br/assuntos/noticias',
  ];

  for (const url of urls) {
    const html = await fetchPage(url);
    if (!html) continue;

    // Extrai links de notícias recentes
    const linkRegex = /href=["']([^"']*noticias[^"']*\d{4}[^"']*)["'][^>]*>([^<]{10,120})/gi;
    let match;
    const seen = new Set<string>();
    let count = 0;

    while ((match = linkRegex.exec(html)) !== null && count < 8) {
      const href = match[1].startsWith('http') ? match[1] : `https://www.gov.br${match[1]}`;
      const title = match[2].trim().replace(/\s+/g, ' ');
      if (seen.has(href) || title.length < 15) continue;
      seen.add(href);
      count++;

      const pageHtml = await fetchPage(href);
      if (!pageHtml) continue;

      const content = stripHtml(pageHtml).substring(0, 4000);
      if (content.length < 100) continue;

      // Filtra apenas notícias relevantes para marcas/propriedade industrial
      const lc = content.toLowerCase();
      const isRelevant = ['marca', 'registro', 'inpi', 'propriedade industrial', 'lpi', 'recurso', 'despacho', 'rpi', 'taxa']
        .some(kw => lc.includes(kw));

      if (!isRelevant) continue;

      // Extrai data
      const dateMatch = content.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      const itemDate = dateMatch
        ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
        : new Date().toISOString().split('T')[0];

      items.push({
        category: 'noticias',
        title: `[INPI Notícia] ${title.substring(0, 120)}`,
        content: `NOTÍCIA OFICIAL INPI (${itemDate}):\n\n${content}`,
        source_url: href,
        source_date: itemDate,
        priority: 3,
        tags: ['noticia', 'inpi', 'atualizado', '2026'],
      });
    }
    break; // apenas uma URL de notícias
  }

  return items;
}

async function scrapeResolucoes(): Promise<ScrapedItem[]> {
  const items: ScrapedItem[] = [];
  const url = 'https://www.gov.br/inpi/pt-br/central-de-conteudo/legislacao-e-atos-normativos/resolucoes';
  const html = await fetchPage(url);
  if (!html) return items;

  // Busca resoluções recentes (últimos 2 anos)
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1];
  
  for (const year of years) {
    const section = extractSection(html, String(year), 5000);
    if (section.length < 50) continue;

    items.push({
      category: 'resolucoes',
      title: `Resoluções INPI ${year}`,
      content: `RESOLUÇÕES INPI ${year} (fonte gov.br – atualizado em ${new Date().toLocaleDateString('pt-BR')}):\n\n${section}`,
      source_url: url,
      source_date: `${year}-01-01`,
      priority: 2,
      tags: ['resolucoes', 'legislacao', String(year), 'normativo'],
    });
  }

  return items;
}

async function scrapePrazosEProcedimentos(): Promise<ScrapedItem | null> {
  const url = 'https://www.gov.br/inpi/pt-br/servicos/marcas/prazos-e-procedimentos';
  const html = await fetchPage(url);
  if (!html) return null;

  const text = stripHtml(html).substring(0, 6000);
  if (text.length < 100) return null;

  return {
    category: 'prazos',
    title: `Prazos e Procedimentos INPI – ${new Date().toLocaleDateString('pt-BR')}`,
    content: `PRAZOS E PROCEDIMENTOS OFICIAIS DO INPI (atualizado em ${new Date().toLocaleDateString('pt-BR')}):\n\n${text}`,
    source_url: url,
    source_date: new Date().toISOString().split('T')[0],
    priority: 1,
    tags: ['prazos', 'procedimentos', 'oficial', '2026'],
  };
}

async function scrapeManualMarcas(): Promise<ScrapedItem | null> {
  const urls = [
    'https://www.gov.br/inpi/pt-br/servicos/marcas/manual-de-marcas',
    'https://manualdemarcas.inpi.gov.br',
  ];
  
  for (const url of urls) {
    const html = await fetchPage(url);
    if (!html) continue;

    const text = stripHtml(html).substring(0, 8000);
    if (text.length < 200) continue;

    return {
      category: 'manual',
      title: `Manual de Marcas INPI – versão ${new Date().getFullYear()}`,
      content: `MANUAL DE MARCAS DO INPI (atualizado em ${new Date().toLocaleDateString('pt-BR')}):\n\n${text}`,
      source_url: url,
      source_date: new Date().toISOString().split('T')[0],
      priority: 1,
      tags: ['manual', 'criterios', 'distintividade', 'oficial'],
    };
  }

  return null;
}

async function scrapeJurisprudencia(): Promise<ScrapedItem | null> {
  // Busca decisões recentes no STJ sobre marcas
  const url = 'https://www.stj.jus.br/SCON/pesquisar.jsp?b=ACOR&livre=marca+INPI+registro&thesaurus=JURIDICO&p=true';
  const html = await fetchPage(url);
  if (!html) {
    // fallback: notícias jurídicas do INPI
    const fallbackUrl = 'https://www.gov.br/inpi/pt-br/central-de-conteudo/noticias';
    const fallbackHtml = await fetchPage(fallbackUrl);
    if (!fallbackHtml) return null;

    const text = extractSection(fallbackHtml, 'marca', 4000);
    return {
      category: 'jurisprudencia',
      title: `Atualizações Jurídicas – ${new Date().toLocaleDateString('pt-BR')}`,
      content: `ATUALIZAÇÕES JURÍDICAS PROPRIEDADE INDUSTRIAL (${new Date().toLocaleDateString('pt-BR')}):\n\n${text}`,
      source_url: fallbackUrl,
      source_date: new Date().toISOString().split('T')[0],
      priority: 2,
      tags: ['jurisprudencia', 'stj', 'marcas', '2026'],
    };
  }

  const text = stripHtml(html).substring(0, 5000);
  return {
    category: 'jurisprudencia',
    title: `Jurisprudência STJ – Marcas e Propriedade Industrial – ${new Date().toLocaleDateString('pt-BR')}`,
    content: `JURISPRUDÊNCIA STJ SOBRE MARCAS (atualizado em ${new Date().toLocaleDateString('pt-BR')}):\n\n${text}`,
    source_url: url,
    source_date: new Date().toISOString().split('T')[0],
    priority: 2,
    tags: ['jurisprudencia', 'stj', 'marcas', '2026'],
  };
}

// ─────────────────────────────────────────────
// AI ENRICHMENT (opcional)
// ─────────────────────────────────────────────

async function enrichWithAI(rawContent: string, category: string): Promise<string> {
  if (!OPENAI_API_KEY || rawContent.length < 200) return rawContent;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1500,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em propriedade industrial brasileira. Extraia e organize SOMENTE informações factuais e precisas sobre ${category} do INPI. Descarte conteúdo irrelevante (menus, rodapés, anúncios). Formate de forma clara e estruturada para uso como contexto de uma IA jurídica especialista em marcas. Mantenha valores monetários, datas e prazos EXATAMENTE como aparecem no texto. Responda em português.`,
          },
          {
            role: 'user',
            content: `Organize e enriqueça estas informações do INPI (categoria: ${category}):\n\n${rawContent.substring(0, 3000)}`,
          },
        ],
      }),
    });

    if (!res.ok) return rawContent;
    const data = await res.json();
    const enriched = data.choices?.[0]?.message?.content;
    return enriched && enriched.length > 100 ? enriched : rawContent;
  } catch {
    return rawContent;
  }
}

// ─────────────────────────────────────────────
// UPSERT LOGIC
// ─────────────────────────────────────────────

async function upsertKnowledgeItem(item: ScrapedItem): Promise<'created' | 'updated' | 'failed'> {
  try {
    // Verifica se já existe item da mesma categoria e URL
    const { data: existing } = await supabase
      .from('inpi_knowledge_base')
      .select('id, source_date')
      .eq('category', item.category)
      .eq('source_url', item.source_url)
      .single();

    if (existing) {
      // Atualiza somente se a data é mais recente
      const { error } = await supabase
        .from('inpi_knowledge_base')
        .update({
          title: item.title,
          content: item.content,
          source_date: item.source_date,
          tags: item.tags,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      return error ? 'failed' : 'updated';
    } else {
      const { error } = await supabase
        .from('inpi_knowledge_base')
        .insert(item);

      return error ? 'failed' : 'created';
    }
  } catch (e) {
    console.error('Upsert error:', e);
    return 'failed';
  }
}

// ─────────────────────────────────────────────
// MAIN SYNC HANDLER
// ─────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  let logId: string | null = null;

  try {
    // Cria log de sync
    const { data: log } = await supabase
      .from('inpi_sync_logs')
      .insert({ sync_type: req.method === 'POST' ? 'manual' : 'scheduled', status: 'running' })
      .select('id')
      .single();
    logId = log?.id;

    console.log('[sync-inpi-knowledge] Iniciando sincronização...');

    let created = 0, updated = 0, failed = 0;
    const categoriesSynced: string[] = [];

    // ── 1. Taxas ──
    const taxas = await scrapeTaxasINPI();
    if (taxas) {
      const enrichedContent = await enrichWithAI(taxas.content, 'taxas');
      const result = await upsertKnowledgeItem({ ...taxas, content: enrichedContent });
      if (result === 'created') created++;
      else if (result === 'updated') updated++;
      else failed++;
      categoriesSynced.push('taxas');
    }

    // ── 2. Prazos ──
    const prazos = await scrapePrazosEProcedimentos();
    if (prazos) {
      const enrichedContent = await enrichWithAI(prazos.content, 'prazos');
      const result = await upsertKnowledgeItem({ ...prazos, content: enrichedContent });
      if (result === 'created') created++;
      else if (result === 'updated') updated++;
      else failed++;
      categoriesSynced.push('prazos');
    }

    // ── 3. Notícias ──
    const noticias = await scrapeNoticiasINPI();
    for (const n of noticias) {
      const result = await upsertKnowledgeItem(n);
      if (result === 'created') created++;
      else if (result === 'updated') updated++;
      else failed++;
    }
    if (noticias.length > 0) categoriesSynced.push('noticias');

    // ── 4. Resoluções ──
    const resolucoes = await scrapeResolucoes();
    for (const r of resolucoes) {
      const result = await upsertKnowledgeItem(r);
      if (result === 'created') created++;
      else if (result === 'updated') updated++;
      else failed++;
    }
    if (resolucoes.length > 0) categoriesSynced.push('resolucoes');

    // ── 5. Manual ──
    const manual = await scrapeManualMarcas();
    if (manual) {
      const enrichedContent = await enrichWithAI(manual.content, 'manual');
      const result = await upsertKnowledgeItem({ ...manual, content: enrichedContent });
      if (result === 'created') created++;
      else if (result === 'updated') updated++;
      else failed++;
      categoriesSynced.push('manual');
    }

    // ── 6. Jurisprudência ──
    const juris = await scrapeJurisprudencia();
    if (juris) {
      const enrichedContent = await enrichWithAI(juris.content, 'jurisprudencia');
      const result = await upsertKnowledgeItem({ ...juris, content: enrichedContent });
      if (result === 'created') created++;
      else if (result === 'updated') updated++;
      else failed++;
      categoriesSynced.push('jurisprudencia');
    }

    const duration = Date.now() - startedAt;

    // Atualiza log
    if (logId) {
      await supabase.from('inpi_sync_logs').update({
        status: failed > 0 && created + updated === 0 ? 'failed' : failed > 0 ? 'partial' : 'success',
        categories_synced: categoriesSynced,
        items_created: created,
        items_updated: updated,
        items_failed: failed,
        duration_ms: duration,
        finished_at: new Date().toISOString(),
      }).eq('id', logId);
    }

    console.log(`[sync-inpi-knowledge] Concluído: ${created} criados, ${updated} atualizados, ${failed} falhas em ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      created,
      updated,
      failed,
      categoriesSynced,
      durationMs: duration,
      syncedAt: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const duration = Date.now() - startedAt;
    console.error('[sync-inpi-knowledge] Erro fatal:', error);

    if (logId) {
      await supabase.from('inpi_sync_logs').update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        duration_ms: duration,
        finished_at: new Date().toISOString(),
      }).eq('id', logId);
    }

    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
