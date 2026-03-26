const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Lista de marcas de alto renome (Brasil)
const FAMOUS_BRANDS = [
  // Bancos e Fintechs
  'itau', 'itaú', 'bradesco', 'banco do brasil', 'caixa', 'nubank', 'santander',
  'btg pactual', 'btg', 'xp', 'xp investimentos', 'picpay', 'sicoob',
  'c6 bank', 'c6', 'pagbank', 'pagseguro', 'stone', 'porto seguro', 'sulamerica',
  'sulamerica', 'sul america',

  // Bebidas e Alimentos
  'skol', 'brahma', 'antarctica', 'antartica', 'ambev', 'coca-cola', 'coca cola',
  'cocacola', 'nestle', 'nestlé', 'sadia', 'perdigao', 'perdigão', 'seara',
  'bauducco', 'cacau show', 'bis', 'sonho de valsa', 'itambe', 'itambé',
  'piracanjuba', 'tang', 'nescau', 'toddy', 'kibon', 'danone',

  // Varejo e E-commerce
  'magazine luiza', 'magalu', 'casas bahia', 'americanas', 'mercado livre',
  'mercadolivre', 'assai', 'assaí', 'atacadao', 'atacadão', 'renner', 'riachuelo',
  'havan', 'pao de acucar', 'pão de açúcar', 'carrefour', 'extra', 'kalunga',
  'tok&stok', 'tok stok', 'leroy merlin', 'shopee', 'shein',

  // Telecom / Tecnologia
  'vivo', 'claro', 'oi', 'tim', 'globo', 'ifood', '99', 'uol', 'totvs', 'positivo',

  // Energia / Indústria / Grandes Corporações
  'petrobras', 'vale', 'weg', 'ipiranga', 'ultrapar', 'suzano', 'gerdau',
  'votorantim', 'br distribuidora', 'raizen', 'raízen',

  // Transporte e Serviços
  'localiza', 'unidas', 'gol', 'azul', 'latam', 'latam brasil', 'ccr',
  'ecorodovias', 'movida', 'uber',

  // Cosméticos / Consumo
  'natura', 'boticario', 'o boticário', 'o boticario', 'avon', 'jequiti', 'eudora',
  'lupo', 'havaianas', 'brastemp', 'consul', 'tramontina',
  'quem disse berenice', 'granado', 'mahogany', 'arezzo', 'schutz',

  // Limpeza e Utilidades
  'omo', 'ype', 'ypê', 'bombril', 'veja', 'ariel', 'downy', 'dove', 'colgate',
  'oral-b', 'oral b', 'duracell',

  // Automotivo
  'volkswagen', 'fiat', 'chevrolet', 'toyota', 'honda', 'hyundai', 'ford',
  'renault', 'peugeot', 'citroen', 'citroën', 'jeep', 'land rover', 'porsche',
  'ferrari', 'lamborghini', 'bmw', 'mercedes', 'audi',

  // Entretenimento / Cultura
  'flamengo', 'globoplay', 'netflix', 'xbox', 'playstation', 'ibope',
  'google', 'apple', 'samsung', 'tiktok',

  // Alimentação / Redes
  'mcdonalds', 'mc donalds', "mcdonald's", 'burger king', 'habib', 'habibs',
  "habib's", 'giraffas', 'outback', 'subway', 'starbucks', 'kfc', 'pizza hut',
  'dominos', "domino's", 'bobs', "bob's", 'madero',

  // Indústria / Construção
  'tigre', 'amanco', 'quartzolit', 'vedacit', 'duratex',

  // Logística / Serviços
  'correios', 'jadlog', 'loggi', 'dhl', 'fedex',

  // Mídia / Digital
  'sbt', 'record', 'band', 'terra', 'ig',

  // Apps e consumo digital
  'kwai', 'telegram', 'whatsapp', 'instagram', 'facebook', 'meta', 'twitter',
  'youtube', 'linkedin', 'pinterest', 'snapchat', 'spotify',

  // Saúde / Farmácia
  'drogasil', 'droga raia', 'pague menos', 'hapvida', 'notredame intermedica',
  'notre dame intermedica', 'notredame intermédica',

  // Internacionais com forte presença
  'nike', 'adidas', 'puma', 'reebok', 'new balance', 'asics', 'mizuno',
  'vans', 'converse', 'rolex', 'cartier', 'louis vuitton', 'gucci', 'prada',
  'chanel', 'dior', 'hermes', 'hermès', 'armani', 'versace', 'burberry',
  'tiffany', 'pandora', 'swarovski', 'ray-ban', 'rayban', 'oakley',
  'visa', 'mastercard', 'american express', 'amex', 'elo', 'hipercard',
  'disney', 'warner', 'paramount', 'universal', 'sony', 'lg', 'philips',
  'panasonic', 'jbl', 'bose', 'beats', 'dell', 'hp', 'lenovo', 'asus', 'acer',
  'intel', 'amd', 'nvidia', 'microsoft', 'amazon', 'rappi',
  'cielo', 'rede', 'getnet'
];

// Mapeamento de ramos para classes NCL (fallback)
const BUSINESS_AREA_CLASSES: Record<string, { classes: number[], descriptions: string[] }> = {
  'tecnologia': { classes: [9, 42, 35], descriptions: ['Classe 09 – Softwares, aplicativos, plataformas digitais e equipamentos eletrônicos. (Classe principal)', 'Classe 42 – Desenvolvimento de sistemas, hospedagem de sites, consultoria em TI e suporte técnico. (protege o serviço)', 'Classe 35 – Venda online de produtos de tecnologia, e-commerce e marketing digital. (protege a loja ou franquia)'] },
  'alimentacao': { classes: [43, 30, 35], descriptions: ['Classe 43 – Serviços de restaurante, lanchonete, buffet, delivery de refeições e atendimento ao público. (Classe principal)', 'Classe 30 – Alimentos preparados, massas, pães, doces, temperos e condimentos. (protege o produto)', 'Classe 35 – Comércio varejista de alimentos, franquias de alimentação e gestão de restaurantes. (protege a loja ou franquia)'] },
  'moda': { classes: [25, 18, 35], descriptions: ['Classe 25 – Roupas, calçados, tênis, chinelos, bonés e acessórios de vestir. (Classe principal)', 'Classe 18 – Bolsas, mochilas, carteiras, cintos e acessórios de couro. (protege o produto)', 'Classe 35 – Loja de roupas, e-commerce de moda, franquias e varejo de vestuário. (protege a loja ou franquia)'] },
  'saude': { classes: [44, 5, 35], descriptions: ['Classe 44 – Clínicas, consultórios, atendimento médico, odontológico e serviços de saúde. (Classe principal)', 'Classe 05 – Medicamentos, suplementos, vitaminas e produtos farmacêuticos. (protege o produto)', 'Classe 35 – Farmácias, drogarias, venda de produtos de saúde e gestão hospitalar. (protege a loja ou franquia)'] },
  'educacao': { classes: [41, 16, 35], descriptions: ['Classe 41 – Escolas, cursos, treinamentos, aulas particulares e plataformas de ensino. (Classe principal)', 'Classe 16 – Livros, apostilas, materiais didáticos e impressos educacionais. (protege o produto)', 'Classe 35 – Gestão de instituições de ensino, franquias educacionais e marketing escolar. (protege a loja ou franquia)'] },
  'beleza': { classes: [44, 3, 35], descriptions: ['Classe 44 – Salão de beleza, barbearia, estética, depilação e tratamentos capilares. (Classe principal)', 'Classe 03 – Cosméticos, cremes, shampoos, perfumes e produtos de higiene pessoal. (protege o produto)', 'Classe 35 – Loja de cosméticos, e-commerce de beleza e franquias de estética. (protege a loja ou franquia)'] },
  'construcao': { classes: [37, 19, 35], descriptions: ['Classe 37 – Serviços de construção, reformas, pintura, instalações elétricas e hidráulicas. (Classe principal)', 'Classe 19 – Materiais de construção como cimento, tijolos, telhas e pisos. (protege o produto)', 'Classe 35 – Lojas de materiais de construção, home centers e comércio varejista. (protege a loja ou franquia)'] },
  'financeiro': { classes: [36, 35, 42], descriptions: ['Classe 36 – Serviços financeiros, seguros, investimentos, crédito e consultoria fiscal. (Classe principal)', 'Classe 35 – Contabilidade, gestão empresarial, consultoria administrativa e auditoria. (protege o serviço)', 'Classe 42 – Plataformas fintech, sistemas bancários digitais e soluções tecnológicas financeiras. (protege a tecnologia)'] },
  'advocacia': { classes: [45, 35, 41], descriptions: ['Classe 45 – Serviços jurídicos, advocacia, consultoria legal e assessoria contratual. (Classe principal)', 'Classe 35 – Gestão de escritórios de advocacia, administração e consultoria empresarial. (protege o serviço)', 'Classe 41 – Cursos jurídicos, palestras, treinamentos e eventos na área do Direito. (protege a educação)'] },
  'automotivo': { classes: [37, 12, 35], descriptions: ['Classe 37 – Oficinas mecânicas, funilaria, pintura automotiva e manutenção de veículos. (Classe principal)', 'Classe 12 – Veículos, peças automotivas, acessórios para carros e motos. (protege o produto)', 'Classe 35 – Concessionárias, lojas de autopeças, comércio de veículos e franquias. (protege a loja ou franquia)'] },
  // 'default' is handled dynamically in getClassesForBusinessAreaFallback
};

function normalizeString(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function isFamousBrand(brandName: string): boolean {
  const normalized = normalizeString(brandName);
  return FAMOUS_BRANDS.some(famous =>
    normalized.includes(normalizeString(famous)) ||
    normalizeString(famous).includes(normalized)
  );
}

function getClassesForBusinessAreaFallback(businessArea: string): { classes: number[], descriptions: string[] } {
  const normalized = normalizeString(businessArea);
  for (const [key, value] of Object.entries(BUSINESS_AREA_CLASSES)) {
    if (key !== 'default' && normalized.includes(key)) return value;
  }
  const keywordMap: [string[], string][] = [
    [['software', 'app', 'sistema', 'ti'], 'tecnologia'],
    [['restaurante', 'comida', 'gastronomia', 'lanchonete', 'sorvete', 'sorveteria', 'acai', 'açaí', 'pizzaria', 'hamburgueria', 'doceria', 'padaria', 'cafeteria', 'bar'], 'alimentacao'],
    [['roupa', 'vestuario', 'loja', 'boutique', 'moda'], 'moda'],
    [['clinica', 'hospital', 'medic', 'farmacia', 'odonto', 'dentista', 'fisioterapia'], 'saude'],
    [['escola', 'curso', 'ensino', 'faculdade', 'treinamento'], 'educacao'],
    [['salao', 'estetica', 'cabelo', 'cosmetico', 'barbearia', 'beleza', 'manicure'], 'beleza'],
    [['obra', 'engenharia', 'arquitetura', 'pedreiro', 'construcao', 'construtora'], 'construcao'],
    [['banco', 'investimento', 'credito', 'financeira', 'contabilidade', 'fintech'], 'financeiro'],
    [['advogado', 'juridico', 'direito', 'advocacia'], 'advocacia'],
    [['carro', 'moto', 'oficina', 'mecanica', 'automotivo', 'concessionaria'], 'automotivo'],
  ];
  for (const [keywords, area] of keywordMap) {
    if (keywords.some(k => normalized.includes(k))) return BUSINESS_AREA_CLASSES[area];
  }
  // Dynamic default fallback — contextualizes descriptions with the client's actual business area
  return {
    classes: [35, 41, 42],
    descriptions: [
      `Classe 35 – Comércio, vendas, marketing e gestão do seu negócio de ${businessArea}, atendimento ao cliente e promoção dos seus serviços. (Classe principal)`,
      `Classe 41 – Cursos, treinamentos, workshops, eventos e atividades educacionais relacionadas a ${businessArea}. (protege o serviço)`,
      `Classe 42 – Desenvolvimento de sites, sistemas, plataformas digitais e soluções tecnológicas para ${businessArea}. (protege a tecnologia)`,
    ]
  };
}

// ========== ETAPA 2: Mapeamento NCL via IA ==========
async function suggestClassesWithAI(businessArea: string): Promise<{ classes: number[], descriptions: string[] }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.log('[CLASSES] LOVABLE_API_KEY não configurada, usando fallback');
    return getClassesForBusinessAreaFallback(businessArea);
  }

  try {
    console.log(`[CLASSES] Consultando IA para ramo: "${businessArea}"`);
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-5.2',
        messages: [
          { role: 'system', content: `Você é um especialista em propriedade intelectual e classificação NCL (Nice) do INPI Brasil com 20 anos de experiência.

TAREFA: Dado o ramo de atividade do cliente, sugira EXATAMENTE 3 classes NCL (números de 1 a 45) mais estratégicas para proteger a marca dele.

REGRAS OBRIGATÓRIAS:
1. As descrições DEVEM ser ESPECÍFICAS e CONTEXTUALIZADAS para o ramo real do cliente.
2. Cada descrição DEVE mencionar os produtos ou serviços REAIS do ramo informado pelo cliente (ex: se o ramo é "sorveteria", escreva "sorvetes, picolés, sobremesas geladas").
3. Use linguagem CLARA e SIMPLES que qualquer pessoa leiga entenda — NÃO use jargão jurídico.
4. Indique entre parênteses a função estratégica: (Classe principal), (protege o produto), (protege a loja ou franquia), (protege o serviço), (protege a tecnologia).

PROIBIDO — NUNCA use estas descrições genéricas:
- "Publicidade, gestão de negócios"
- "Educação, treinamento e cultura"  
- "Serviços científicos e tecnológicos"
- "Propaganda e publicidade"
- "Pesquisa e desenvolvimento"
Se você retornar qualquer descrição genérica como essas, sua resposta será REJEITADA.

EXEMPLOS DE RESPOSTAS CORRETAS:

Ramo "Sorveteria":
{"classes":[43,30,35],"descriptions":["Classe 43 – Serviços de sorveteria, venda de sorvetes, picolés, sobremesas geladas e atendimento ao público. (Classe principal)","Classe 30 – Sorvetes, picolés, sobremesas geladas e produtos alimentícios à base de leite ou frutas. (protege o produto)","Classe 35 – Comércio varejista e venda de sorvetes, picolés e produtos alimentícios. (protege a loja ou franquia)"]}

Ramo "Escritório de Advocacia":
{"classes":[45,35,41],"descriptions":["Classe 45 – Serviços de advocacia, consultoria jurídica, defesa em processos e assessoria legal para empresas e pessoas físicas. (Classe principal)","Classe 35 – Gestão e administração de escritórios de advocacia, consultoria empresarial e administrativa. (protege o serviço)","Classe 41 – Cursos, palestras e treinamentos na área jurídica, eventos e seminários de Direito. (protege a educação)"]}

Ramo "Pet Shop":
{"classes":[31,44,35],"descriptions":["Classe 31 – Rações, petiscos, brinquedos e acessórios para animais de estimação. (Classe principal)","Classe 44 – Banho e tosa, consultas veterinárias, vacinação e cuidados com saúde animal. (protege o serviço)","Classe 35 – Loja de produtos para pets, e-commerce de artigos para animais e franquias de pet shop. (protege a loja ou franquia)"]}

Responda SOMENTE em JSON válido, sem markdown.` },
          { role: 'user', content: `O cliente atua no ramo "${businessArea}". Sugira EXATAMENTE 3 classes NCL estratégicas com descrições específicas para este ramo.
JSON: {"classes":[n1,n2,n3],"descriptions":["Classe XX – descrição específica para ${businessArea}. (função estratégica)","Classe XX – descrição específica para ${businessArea}. (função)","Classe XX – descrição específica para ${businessArea}. (função)"]}` }
        ],
        temperature: 0.3,
        max_completion_tokens: 800,
      }),
    });

    if (!response.ok) {
      console.error(`[CLASSES] Erro IA: ${response.status}`);
      return getClassesForBusinessAreaFallback(businessArea);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.classes) && parsed.classes.length === 3 &&
            Array.isArray(parsed.descriptions) && parsed.descriptions.length === 3 &&
            parsed.classes.every((c: number) => c >= 1 && c <= 45)) {
          
          // POST-AI VALIDATION: Check if descriptions are contextual (not generic)
          const genericPhrases = [
            'publicidade, gestão de negócios',
            'educação, treinamento e cultura',
            'serviços científicos e tecnológicos',
            'propaganda e publicidade',
            'pesquisa e desenvolvimento',
          ];
          const descriptionsText = parsed.descriptions.join(' ').toLowerCase();
          const isGeneric = genericPhrases.some(phrase => descriptionsText.includes(phrase));
          
          if (isGeneric) {
            console.warn(`[CLASSES] IA retornou descrições genéricas, usando fallback contextualizado`);
            return getClassesForBusinessAreaFallback(businessArea);
          }
          
          console.log(`[CLASSES] IA sugeriu:`, parsed.classes);
          return parsed;
        }
      }
    }
  } catch (error) {
    console.error('[CLASSES] Erro:', error);
  }
  return getClassesForBusinessAreaFallback(businessArea);
}

// ========== UTILIDADE: Busca DuckDuckGo (sem API key) ==========
async function searchDuckDuckGo(query: string): Promise<Array<{ title: string; url: string; description: string }>> {
  try {
    console.log(`[DDG] Buscando: "${query}"`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `q=${encodeURIComponent(query)}`,
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[DDG] HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    const results: Array<{ title: string; url: string; description: string }> = [];

    // Parse DuckDuckGo HTML results
    const resultBlocks = html.split('class="result ');
    for (let i = 1; i < resultBlocks.length && results.length < 10; i++) {
      const block = resultBlocks[i];
      
      // Extract title from result__a
      const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      
      // Extract URL from result__url or href
      const urlMatch = block.match(/href="([^"]*)"/) || block.match(/class="result__url"[^>]*>([\s\S]*?)<\/a>/);
      let url = '';
      if (urlMatch) {
        url = urlMatch[1].replace(/<[^>]*>/g, '').trim();
        // DuckDuckGo wraps URLs in redirect links
        if (url.includes('uddg=')) {
          const decoded = decodeURIComponent(url.split('uddg=')[1]?.split('&')[0] || '');
          url = decoded || url;
        }
        if (!url.startsWith('http')) url = `https://${url}`;
      }
      
      // Extract description/snippet
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/) ||
                           block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/span>/);
      const description = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';

      if (title && url) {
        results.push({ title, url, description });
      }
    }

    console.log(`[DDG] Encontrados ${results.length} resultados para "${query}"`);
    return results;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[DDG] Timeout para "${query}"`);
    } else {
      console.error(`[DDG] Erro:`, error);
    }
    return [];
  }
}

// ========== ETAPA 3: Consulta INPI via Firecrawl (real) + fallback DuckDuckGo ==========

// Busca real no portal do INPI usando Firecrawl para renderizar a SPA React
async function searchINPIViaFirecrawl(brandName: string): Promise<string | null> {
  const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
  if (!FIRECRAWL_API_KEY) {
    console.log('[INPI-FC] FIRECRAWL_API_KEY não configurada, pulando Firecrawl');
    return null;
  }

  try {
    const searchUrl = `https://servicos.busca.inpi.gov.br/marcas/search?q=${encodeURIComponent(brandName)}&searchType=quick`;
    console.log(`[INPI-FC] Scraping: ${searchUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 5000,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[INPI-FC] Firecrawl HTTP ${response.status}: ${errText}`);
      return null;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    console.log(`[INPI-FC] Markdown recebido: ${markdown.length} chars`);

    if (markdown.length < 20) {
      console.warn('[INPI-FC] Markdown muito curto, possível falha no carregamento');
      return null;
    }

    return markdown;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[INPI-FC] Timeout após 25s');
    } else {
      console.error('[INPI-FC] Erro:', error);
    }
    return null;
  }
}

async function searchINPI(brandName: string, mainClass: number): Promise<{
  totalResultados: number;
  resultados: Array<{ processo: string; marca: string; situacao: string; classe: string; titular: string }>;
  consultadoEm: string;
  error?: string;
}> {
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  // TENTATIVA 1: Firecrawl (busca real no portal INPI)
  const firecrawlMarkdown = await searchINPIViaFirecrawl(brandName);

  if (firecrawlMarkdown) {
    // Verificar se não há resultados
    const noResultsPatterns = [
      'nenhum resultado encontrado',
      'nenhum resultado',
      'no results found',
      '0 resultados',
      'não foram encontrados',
    ];
    const lowerMarkdown = firecrawlMarkdown.toLowerCase();
    const hasNoResults = noResultsPatterns.some(p => lowerMarkdown.includes(p));

    if (hasNoResults) {
      console.log('[INPI] Firecrawl: NENHUM resultado encontrado — marca disponível');
      return { totalResultados: 0, resultados: [], consultadoEm: now };
    }

    // Há resultados — extrair via IA
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (LOVABLE_API_KEY) {
      try {
        console.log('[INPI] Extraindo dados estruturados do markdown real do INPI...');
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'openai/gpt-5.2',
            messages: [
              {
                role: 'system',
                content: `Você é um parser especializado em dados do INPI Brasil. Analise o conteúdo markdown retornado da busca oficial de marcas do INPI e extraia todos os processos encontrados.

Para cada processo, extraia:
- processo: número do processo (ex: "930072960")
- marca: nome da marca
- situacao: status exato (ex: "Registro de marca em vigor", "Pedido definitivamente arquivado", "Pedido depositado", etc.)
- classe: classe NCL se disponível (ex: "35")
- titular: nome do titular

Responda APENAS em JSON válido:
{"totalResultados": N, "resultados": [{"processo": "...", "marca": "...", "situacao": "...", "classe": "...", "titular": "..."}]}

Se o texto mencionar quantidade de resultados (ex: "Mostrando 1 - 2 de um total de 2 resultados"), use esse número.
NÃO invente dados. Extraia APENAS do conteúdo fornecido.`
              },
              {
                role: 'user',
                content: `Conteúdo da busca no INPI para a marca "${brandName}":\n\n${firecrawlMarkdown.substring(0, 4000)}`
              }
            ],
            temperature: 0.1,
            max_completion_tokens: 1200,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (typeof parsed.totalResultados === 'number' && Array.isArray(parsed.resultados)) {
                console.log(`[INPI] Firecrawl + IA: ${parsed.totalResultados} processos extraídos dos dados REAIS do INPI`);
                return { ...parsed, consultadoEm: now };
              }
            }
          }
        }
      } catch (error) {
        console.error('[INPI] Erro ao extrair dados do Firecrawl:', error);
      }
    }
  }

  // TENTATIVA 2 (FALLBACK): DuckDuckGo
  console.log('[INPI] Firecrawl falhou ou indisponível, usando fallback DuckDuckGo...');
  try {
    const [inpiResults, generalResults] = await Promise.all([
      searchDuckDuckGo(`"${brandName}" site:busca.inpi.gov.br`),
      searchDuckDuckGo(`"${brandName}" INPI registro marca classe ${mainClass}`),
    ]);

    const allResults = [...inpiResults, ...generalResults];
    console.log(`[INPI] DuckDuckGo fallback: ${allResults.length} resultados combinados`);

    if (allResults.length === 0) {
      return { totalResultados: 0, resultados: [], consultadoEm: now };
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return { totalResultados: allResults.length, resultados: [], consultadoEm: now, error: 'IA indisponível para estruturar resultados' };
    }

    const searchData = allResults.map(r => `- ${r.title}\n  URL: ${r.url}\n  ${r.description}`).join('\n\n');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-5.2',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em marcas do INPI. Analise os resultados de busca abaixo e extraia APENAS registros de marca que sejam relevantes para a marca "${brandName}".
Responda APENAS em JSON: {"totalResultados": N, "resultados": [{"processo": "NNNNNNNNN", "marca": "NOME", "situacao": "Registro em vigor|Pedido depositado|Arquivado/Extinto", "classe": "NN", "titular": "NOME"}]}
Se os resultados não contiverem dados de processos INPI reais, retorne {"totalResultados": 0, "resultados": []}.
NÃO invente números de processo ou dados. Extraia apenas do que está nos resultados de busca.`
          },
          {
            role: 'user',
            content: `Resultados de busca para a marca "${brandName}" (classe principal ${mainClass}):\n\n${searchData}`
          }
        ],
        temperature: 0.1,
        max_completion_tokens: 800,
      }),
    });

    if (!response.ok) {
      console.error(`[INPI] IA erro: ${response.status}`);
      return { totalResultados: allResults.length, resultados: [], consultadoEm: now, error: 'Erro ao estruturar resultados INPI' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed.totalResultados === 'number' && Array.isArray(parsed.resultados)) {
          console.log(`[INPI] DuckDuckGo + IA: ${parsed.totalResultados} resultados estruturados`);
          return { ...parsed, consultadoEm: now };
        }
      }
    }
  } catch (error) {
    console.error('[INPI] Erro fallback DuckDuckGo:', error);
  }
  return { totalResultados: 0, resultados: [], consultadoEm: now, error: 'Consulta INPI inconclusiva' };
}

// ========== ETAPA 4: Busca CNPJ via DuckDuckGo + IA ==========
async function searchCNPJ(brandName: string): Promise<{
  total: number;
  matches: Array<{ nome: string; cnpj: string; situacao: string }>;
}> {
  try {
    // Duas buscas DuckDuckGo em paralelo
    const [generalResults, siteResults] = await Promise.all([
      searchDuckDuckGo(`"${brandName}" CNPJ empresa razao social`),
      searchDuckDuckGo(`"${brandName}" cnpj.info OR cnpja.com OR casadosdados.com.br`),
    ]);

    const allResults = [...generalResults, ...siteResults];
    console.log(`[CNPJ] DuckDuckGo: ${allResults.length} resultados combinados`);

    if (allResults.length === 0) {
      return { total: 0, matches: [] };
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return { total: 0, matches: [] };

    const searchData = allResults.map(r => `- ${r.title}\n  URL: ${r.url}\n  ${r.description}`).join('\n\n');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-5.2',
        messages: [
          {
            role: 'system',
            content: `Analise os resultados de busca e extraia dados de empresas brasileiras com nome "${brandName}" ou similar.
Responda APENAS em JSON: {"total": N, "matches": [{"nome": "RAZAO SOCIAL", "cnpj": "XX.XXX.XXX/XXXX-XX", "situacao": "Ativa|Baixada|Inapta"}]}
Extraia APENAS dados reais dos resultados. Se não houver dados de CNPJ nos resultados, retorne {"total": 0, "matches": []}.`
          },
          {
            role: 'user',
            content: `Resultados de busca para empresas com nome "${brandName}":\n\n${searchData}`
          }
        ],
        temperature: 0.1,
        max_completion_tokens: 600,
      }),
    });

    if (!response.ok) return { total: 0, matches: [] };

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed.total === 'number' && Array.isArray(parsed.matches)) {
          console.log(`[CNPJ] IA extraiu ${parsed.total} empresas dos dados reais`);
          return { total: parsed.total, matches: parsed.matches.slice(0, 5) };
        }
      }
    }
  } catch (error) {
    console.error('[CNPJ] Erro:', error);
  }
  return { total: 0, matches: [] };
}

// ========== ETAPA 5: Busca Internet via DuckDuckGo (sem IA) ==========
async function searchInternet(brandName: string): Promise<{
  socialMatches: Array<{ plataforma: string; encontrado: boolean; url?: string; descricao?: string }>;
  webMatches: Array<{ titulo: string; url: string; descricao: string }>;
}> {
  try {
    // 4 buscas DuckDuckGo em paralelo (3 redes sociais + geral)
    const [igResults, fbResults, liResults, webResults] = await Promise.all([
      searchDuckDuckGo(`"${brandName}" site:instagram.com`),
      searchDuckDuckGo(`"${brandName}" site:facebook.com`),
      searchDuckDuckGo(`"${brandName}" site:linkedin.com`),
      searchDuckDuckGo(`"${brandName}"`),
    ]);

    // Parsear presença em redes sociais diretamente (sem IA)
    const checkSocial = (results: Array<{ title: string; url: string; description: string }>, platform: string, domain: string) => {
      const match = results.find(r => r.url.includes(domain));
      return {
        plataforma: platform,
        encontrado: !!match,
        url: match?.url,
        descricao: match ? match.title : undefined,
      };
    };

    const socialMatches = [
      checkSocial(igResults, 'Instagram', 'instagram.com'),
      checkSocial(fbResults, 'Facebook', 'facebook.com'),
      checkSocial(liResults, 'LinkedIn', 'linkedin.com'),
    ];

    // Web matches: filtrar resultados gerais removendo redes sociais
    const socialDomains = ['instagram.com', 'facebook.com', 'linkedin.com', 'twitter.com', 'tiktok.com'];
    const webMatches = webResults
      .filter(r => !socialDomains.some(d => r.url.includes(d)))
      .slice(0, 5)
      .map(r => ({ titulo: r.title, url: r.url, descricao: r.description }));

    console.log(`[INTERNET] Social: ${socialMatches.filter(s => s.encontrado).length}/3 | Web: ${webMatches.length}`);

    return { socialMatches, webMatches };
  } catch (error) {
    console.error('[INTERNET] Erro:', error);
  }

  return {
    socialMatches: [
      { plataforma: 'Instagram', encontrado: false },
      { plataforma: 'Facebook', encontrado: false },
      { plataforma: 'LinkedIn', encontrado: false },
    ],
    webMatches: []
  };
}

// ========== ETAPA 6: Decisão final via IA ==========
async function generateFinalAnalysis(
  brandName: string,
  businessArea: string,
  classes: number[],
  classDescriptions: string[],
  inpiData: any,
  cnpjData: any,
  internetData: any
): Promise<{
  level: 'high' | 'medium' | 'low';
  viabilidade: string;
  title: string;
  description: string;
  laudo: string;
}> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const collectedData = `
DADOS COLETADOS:

1. CONSULTA INPI:
- Total de resultados: ${inpiData.totalResultados}
- Resultados: ${JSON.stringify(inpiData.resultados)}
- Data consulta: ${inpiData.consultadoEm}
${inpiData.error ? `- Erro: ${inpiData.error}` : ''}

2. CONSULTA CNPJ/EMPRESAS:
- Total: ${cnpjData.total}
- Matches: ${JSON.stringify(cnpjData.matches)}

3. PRESENÇA NA INTERNET:
- Redes sociais: ${JSON.stringify(internetData.socialMatches)}
- Web: ${JSON.stringify(internetData.webMatches)}

4. CLASSES NCL SUGERIDAS:
${classDescriptions.join('\n')}
`;

  if (!LOVABLE_API_KEY) {
    // Fallback sem IA
    return buildFallbackAnalysis(brandName, businessArea, classes, classDescriptions, inpiData, cnpjData, internetData, now);
  }

  try {
    console.log('[ANALISE] Gerando laudo via IA...');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-5.2',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em registro de marcas no INPI Brasil. Analise os dados coletados e gere um laudo técnico de viabilidade.

REGRAS DE DECISÃO:
- INDISPONIVEL (level: "low"): Se encontrar registro em vigor ou pedido ativo na mesma classe NCL
- VIAVEL_INICIAL (level: "high"): Se zero resultados INPI na busca exata + classe principal
- POSSIVEL_COM_ALERTA (level: "medium"): Se apenas marcas arquivadas/extintas ou em classes diferentes

Responda APENAS em JSON:
{
  "level": "high" | "medium" | "low",
  "viabilidade": "VIAVEL_INICIAL" | "POSSIVEL_COM_ALERTA" | "INDISPONIVEL",
  "title": "título curto do resultado",
  "description": "descrição de 1-2 frases",
  "laudo": "laudo técnico completo e detalhado em texto formatado"
}

O laudo deve conter TODAS estas seções:
1. DADOS DA CONSULTA (marca, ramo, data)
2. RESULTADO DA PESQUISA NO INPI (detalhamento dos resultados encontrados)
3. ANÁLISE DE COLIDÊNCIA EMPRESARIAL (CNPJs encontrados)
4. ANÁLISE DE COLIDÊNCIA NA INTERNET (redes sociais e web)
5. CLASSES NCL RECOMENDADAS — IMPORTANTE: NÃO use descrições genéricas como "Publicidade, gestão de negócios". 
   Escreva descrições ESPECÍFICAS e CONTEXTUALIZADAS para o ramo "${businessArea}" do cliente, em linguagem CLARA e SIMPLES que qualquer pessoa entenda.
   Formato: "🏷️ Classes sugeridas (estratégia com 3 classes):" seguido de cada classe com descrição detalhada dos produtos/serviços reais do ramo e a função estratégica entre parênteses (Classe principal), (protege o produto), (protege a loja ou franquia), etc.
   Exemplo para Sorveteria: "Classe 43 – Serviços de sorveteria, venda de sorvetes, picolés, sobremesas geladas e atendimento ao público. (Classe principal)"
6. CONCLUSÃO TÉCNICA (viabilidade e justificativa)
7. ORIENTAÇÃO JURÍDICA
8. AVISO: "O DONO DA MARCA É QUEM REGISTRA PRIMEIRO!"

Use separadores ━━━ entre seções. Use emojis nos títulos das seções. Seja detalhado e profissional.`
          },
          {
            role: 'user',
            content: `Marca: "${brandName}"\nRamo: "${businessArea}"\nData: ${now}\n\n${collectedData}`
          }
        ],
        temperature: 0.3,
        max_completion_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ANALISE] Erro IA: ${response.status} ${errText}`);
      return buildFallbackAnalysis(brandName, businessArea, classes, classDescriptions, inpiData, cnpjData, internetData, now);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.level && parsed.laudo) {
          console.log(`[ANALISE] Resultado IA: ${parsed.viabilidade} (${parsed.level})`);
          return {
            level: parsed.level,
            viabilidade: parsed.viabilidade || (parsed.level === 'high' ? 'VIAVEL_INICIAL' : parsed.level === 'medium' ? 'POSSIVEL_COM_ALERTA' : 'INDISPONIVEL'),
            title: parsed.title,
            description: parsed.description,
            laudo: parsed.laudo
          };
        }
      }
    }
  } catch (error) {
    console.error('[ANALISE] Erro:', error);
  }

  return buildFallbackAnalysis(brandName, businessArea, classes, classDescriptions, inpiData, cnpjData, internetData, now);
}

function buildFallbackAnalysis(
  brandName: string, businessArea: string, classes: number[], classDescriptions: string[],
  inpiData: any, cnpjData: any, internetData: any, now: string
) {
  // Determine level based on INPI results
  let level: 'high' | 'medium' | 'low' = 'high';
  let viabilidade = 'VIAVEL_INICIAL';
  let searchIncomplete = false;

  // Se houve erro na busca INPI (ex: Firecrawl sem créditos), não concluir "alta viabilidade"
  if (inpiData.error) {
    level = 'medium';
    viabilidade = 'POSSIVEL_COM_ALERTA';
    searchIncomplete = true;
  } else if (inpiData.totalResultados > 0) {
    const hasActive = inpiData.resultados.some((r: any) =>
      r.situacao?.toLowerCase().includes('vigor') || r.situacao?.toLowerCase().includes('pedido') || r.situacao?.toLowerCase().includes('deposit'));
    if (hasActive) {
      level = 'low';
      viabilidade = 'INDISPONIVEL';
    } else {
      level = 'medium';
      viabilidade = 'POSSIVEL_COM_ALERTA';
    }
  }

  const inpiSection = inpiData.totalResultados > 0
    ? inpiData.resultados.map((r: any, i: number) => `${i + 1}. ${r.marca} | Processo: ${r.processo} | Situação: ${r.situacao} | Classe: ${r.classe}`).join('\n')
    : searchIncomplete
    ? '⚠️ A consulta ao banco do INPI não pôde ser completada nesta sessão. Os resultados são parciais. Recomendamos nova consulta.'
    : 'Nenhuma marca idêntica encontrada na base do INPI.';

  const cnpjSection = cnpjData.total > 0
    ? cnpjData.matches.map((m: any, i: number) => `${i + 1}. ${m.nome} | CNPJ: ${m.cnpj} | Situação: ${m.situacao}`).join('\n')
    : 'Nenhuma empresa com nome idêntico encontrada.';

  const socialSection = internetData.socialMatches.length > 0
    ? internetData.socialMatches.map((s: any) => `• ${s.plataforma}: ${s.encontrado ? '✅ Encontrado' : '❌ Não encontrado'}${s.url ? ` - ${s.url}` : ''}`).join('\n')
    : 'Nenhuma presença em redes sociais identificada.';

  const webSection = internetData.webMatches.length > 0
    ? internetData.webMatches.map((w: any, i: number) => `${i + 1}. ${w.titulo}\n   ${w.url}`).join('\n')
    : 'Nenhum site relevante encontrado.';

  const laudo = `*LAUDO TÉCNICO DE VIABILIDADE DE MARCA*
*Pesquisa Real – INPI + Mercado + Internet*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 *DADOS DA CONSULTA*

Marca Pesquisada: ${brandName.toUpperCase()}
Ramo de Atividade: ${businessArea}
Data/Hora: ${now}
Tipo de Pesquisa: COMPLETA (INPI + CNPJ + Internet)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 *RESULTADO DA PESQUISA NO INPI*

Total de resultados: ${inpiData.totalResultados}
${inpiSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏢 *ANÁLISE DE COLIDÊNCIA EMPRESARIAL (CNPJ)*

Total de empresas encontradas: ${cnpjData.total}
${cnpjSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 *ANÁLISE DE COLIDÊNCIA NA INTERNET*

Redes Sociais:
${socialSection}

Sites e Web:
${webSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏷️ *Classes sugeridas (estratégia com ${classes.length} classes):*

${classDescriptions.map((desc, i) => {
  const tag = i === 0 ? '(Classe principal)' : i === 1 ? '(protege o produto)' : '(protege a loja ou franquia)';
  // If description already has a parenthetical tag, use as-is; otherwise append
  const hasTag = desc.includes('(') && desc.includes(')');
  return hasTag ? desc : `${desc} ${tag}`;
}).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚖️ *CONCLUSÃO TÉCNICA*

${level === 'high' ?
`A marca "${brandName.toUpperCase()}" apresenta ALTA VIABILIDADE de registro. Não foram encontradas marcas idênticas ativas na base do INPI. Recomendamos prosseguir com o registro imediatamente.` :
level === 'medium' ?
`A marca "${brandName.toUpperCase()}" apresenta VIABILIDADE MÉDIA. Foram encontrados registros similares, porém arquivados ou em classes diferentes. Recomendamos consulta especializada.` :
`A marca "${brandName.toUpperCase()}" apresenta BAIXA VIABILIDADE. Existem marcas conflitantes ativas que provavelmente impedirão o registro. Sugerimos alteração do nome.`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚖️ *ORIENTAÇÃO JURÍDICA*

O ideal é registrar nas 3 classes para máxima proteção.
Se a questão for financeira, orientamos registrar urgente na classe principal.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *IMPORTANTE*

O DONO DA MARCA É QUEM REGISTRA PRIMEIRO!
Não perca tempo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WebMarcas - Registro de Marcas
www.webmarcas.net`;

  return {
    level,
    viabilidade,
    title: searchIncomplete ? 'Pesquisa Parcial' : level === 'high' ? 'Alta Viabilidade' : level === 'medium' ? 'Média Viabilidade' : 'Baixa Viabilidade',
    description: searchIncomplete
      ? 'A consulta ao INPI não pôde ser completada. Os resultados são parciais — recomendamos nova consulta ou fale com nossos especialistas.'
      : level === 'high'
      ? 'Sua marca está disponível para registro! Não encontramos conflitos na base do INPI.'
      : level === 'medium'
      ? 'Existem registros similares. Recomendamos consulta especializada antes de prosseguir.'
      : 'Existem marcas conflitantes ativas na base do INPI. Consulte nossos especialistas.',
    laudo
  };
}

// ========== HANDLER PRINCIPAL ==========
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandName, businessArea, classesOnly } = await req.json();

    if (!brandName || !businessArea) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nome da marca e ramo de atividade são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // MODE: classesOnly — return only NCL class suggestions (used by admin contract creation)
    if (classesOnly) {
      console.log(`[CLASSES-ONLY] Gerando classes para ramo: "${businessArea}"`);
      const { classes, descriptions } = await suggestClassesWithAI(businessArea);
      return new Response(
        JSON.stringify({ success: true, classes, classDescriptions: descriptions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ETAPA 1: Verificação marca famosa
    if (isFamousBrand(brandName)) {
      return new Response(
        JSON.stringify({
          success: true, isFamousBrand: true, level: 'blocked',
          title: 'Marca de Alto Renome',
          description: `A marca "${brandName}" é uma marca de alto renome protegida em todas as classes. Não é possível registrar.`,
          laudo: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[VIABILITY] ========== INÍCIO: "${brandName}" / "${businessArea}" ==========`);

    // ETAPA 2: Mapeamento NCL via IA
    const { classes, descriptions } = await suggestClassesWithAI(businessArea);
    const mainClass = classes[0];

    // ETAPAS 3, 4, 5: Consultas em PARALELO
    const [inpiData, cnpjData, internetData] = await Promise.all([
      searchINPI(brandName, mainClass),
      searchCNPJ(brandName),
      searchInternet(brandName),
    ]);

    console.log(`[VIABILITY] INPI: ${inpiData.totalResultados} | CNPJ: ${cnpjData.total} | Social: ${internetData.socialMatches.filter(s => s.encontrado).length} | Web: ${internetData.webMatches.length}`);

    // ETAPA 6: Análise final via IA
    const analysis = await generateFinalAnalysis(
      brandName, businessArea, classes, descriptions, inpiData, cnpjData, internetData
    );

    const response = {
      success: true,
      isFamousBrand: false,
      level: analysis.level,
      title: analysis.title,
      description: analysis.description,
      laudo: analysis.laudo,
      classes,
      classDescriptions: descriptions,
      searchDate: inpiData.consultadoEm,
      // Novos campos estruturados
      viabilidade: analysis.viabilidade,
      inpiData: {
        totalResultados: inpiData.totalResultados,
        resultados: inpiData.resultados,
        consultadoEm: inpiData.consultadoEm
      },
      cnpjData: {
        total: cnpjData.total,
        matches: cnpjData.matches
      },
      internetData: {
        socialMatches: internetData.socialMatches,
        webMatches: internetData.webMatches
      },
      // Compat: keep analysisResult for old frontends
      analysisResult: {
        totalResults: inpiData.totalResultados,
        brands: inpiData.resultados,
        patternScore: analysis.level === 'high' ? 90 : analysis.level === 'medium' ? 60 : 30,
        searchAttempted: true
      }
    };

    console.log(`[VIABILITY] ========== FIM: ${analysis.viabilidade} (${analysis.level}) ==========`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in viability check:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro ao processar a consulta' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
