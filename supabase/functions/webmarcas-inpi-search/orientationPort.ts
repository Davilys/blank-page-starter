/**
 * Port fiel de orientation.py (VPS webmarcas-inpi-api-rotation-stage, extraído
 * 2026-10-29, versões wm-orientation-2026-09-16 + camadas candles 2026-10-05,
 * auto-repair 2026-10-09, retail-clothing 2026-10-09, solar 2026-10-10).
 * Uso no candidato: derivar primary_class da atividade para a triagem
 * (equivalente a search_classes(plan) -> classes[:1] do coletor original).
 * Não é veredito de disponibilidade; é orientação preliminar conservadora.
 * Diferença de ambiente: apenas a saída consumida (primary_class/status) é
 * usada aqui; steps/textos seguem fiéis para futura reutilização.
 */
export const ORIENTATION_VERSION = 'wm-orientation-2026-09-16';
export const ORIENTATION_SOURCE = 'https://www.gov.br/inpi/pt-br/servicos/marcas/classificacao-marcas';

type ProfileRow = [string, number, string, number, string, number, string];
const PROFILES: ProfileRow[] = [
  ['\\b(energia solar|solar fotovoltaic\\w*|pain(?:el|eis)\\w* solar\\w*|sistema\\w* fotovoltaic\\w*|geracao de energia fotovoltaic\\w*)\\b',37,'Instalação e manutenção de sistemas de energia solar fotovoltaica',35,'Comercialização de equipamentos e sistemas de energia solar',9,'Equipamentos fotovoltaicos e elétricos sob marca própria'],
  ['\\b(igreja|ministerio cristao|religios\\w*|evangelizacao|assistencia espiritual|cultos)\\b',45,'Serviços religiosos e assistência espiritual',41,'Ensino, formação e eventos educacionais ou culturais próprios',16,'Livros, apostilas e publicações impressas próprias'],
  ['\\b(veterinari\\w*|clinica animal)\\b',44,'Serviços veterinários e cuidados de saúde animal',35,'Comércio de produtos para animais',31,'Alimentos não medicinais para animais sob marca própria'],
  ['\\b(odontolog\\w*|dentista\\w*|clinica medica|fisioterap\\w*|psicolog\\w*|hospital\\w*)\\b',44,'Serviços de saúde da especialidade informada',41,'Cursos e formação oferecidos a terceiros',35,'Comércio de produtos relacionados à atividade'],
  ['\\b(salao de beleza|barbearia|cabeleireir\\w*|manicure|clinica de estetica)\\b',44,'Cuidados de beleza e higiene pessoal',35,'Comércio de cosméticos e produtos de beleza',3,'Cosméticos não medicinais sob marca própria'],
  ['\\b(restaurante\\w*|lanchonete\\w*|cafeteria\\w*|pizzaria\\w*|bar|bares|buffet)\\b',43,'Fornecimento de comidas e bebidas para consumo',30,'Produtos alimentícios próprios, como café, pães ou confeitaria, conforme o produto',35,'Comércio de produtos alimentícios'],
  ['\\b(hotel\\w*|pousada\\w*|hospedagem)\\b',43,'Serviços de hospedagem temporária',39,'Organização de viagens e transporte de passageiros',41,'Atividades de lazer oferecidas a terceiros'],
  ['\\b(escola\\w*|cursos|ensino|educacao|treinamentos|academia de ginastica)\\b',41,'Educação, formação ou atividades esportivas informadas',16,'Materiais didáticos impressos próprios',9,'Publicações eletrônicas baixáveis ou software sob marca própria'],
  ['\\b(banda musical|cantor\\w*|shows|entretenimento|producao musical)\\b',41,'Entretenimento e apresentações artísticas',9,'Gravações e conteúdos digitais baixáveis sob a marca',25,'Vestuário próprio comercializado sob a marca'],
  ['\\b(saas|desenvolvimento de software|software como servico|programacao de software)\\b',42,'Desenvolvimento de software ou software como serviço',9,'Software baixável próprio',41,'Cursos de tecnologia oferecidos a terceiros'],
  ['\\b(transportadora\\w*|transporte|logistica|fretes|entregas)\\b',39,'Transporte, entrega ou armazenamento de mercadorias',35,'Gestão comercial de logística para terceiros',42,'Plataforma tecnológica própria oferecida como serviço'],
  ['\\b(construtora\\w*|construcao civil|obras|reformas|instalacao eletrica)\\b',37,'Construção, instalação ou reparação informadas',42,'Projetos de engenharia ou arquitetura',35,'Comércio de materiais de construção'],
  ['\\b(arquitet\\w*|projetos de engenharia)\\b',42,'Projetos e serviços de arquitetura ou engenharia',37,'Execução de obras e serviços de construção',41,'Cursos e formação oferecidos a terceiros'],
  ['\\b(servicos financeiros|credito|seguros|corretora de seguros|banco|financeira)\\b',36,'Serviços financeiros, monetários ou de seguros informados',42,'Plataforma tecnológica oferecida como serviço',41,'Educação financeira oferecida a terceiros'],
  ['\\b(imobiliaria|corretagem imobiliaria|administracao de imoveis)\\b',36,'Serviços imobiliários informados',37,'Construção ou manutenção de imóveis',42,'Projetos de arquitetura oferecidos a terceiros'],
  ['\\b(agencia de publicidade|marketing|publicidade|contabilidade|consultoria empresarial)\\b',35,'Serviços comerciais, publicitários ou de gestão informados',41,'Cursos e formação oferecidos a terceiros',42,'Serviços tecnológicos próprios oferecidos a terceiros'],
  ['\\b(advocacia|advogad\\w*|juridic\\w*|servicos juridicos|registro de marcas|marcas e patentes)\\b',45,'Serviços jurídicos e de propriedade intelectual informados',41,'Cursos e formação oferecidos a terceiros',42,'Plataforma tecnológica própria oferecida como serviço'],
  ['\\b(agencia de viagens|operadora de turismo)\\b',39,'Organização de viagens e serviços de transporte',43,'Reservas de hospedagem temporária',41,'Visitas guiadas culturais ou atividades recreativas'],
];
type ProductRow = [string, number, string, number, string];
const PRODUCTS: ProductRow[] = [
  ['\\b(roupas|vestuario|calcados|camisetas|moda)\\b',25,'Vestuário, calçados e chapelaria sob marca própria',18,'Bolsas e artigos de couro sob marca própria'],
  ['\\b(cosmeticos|perfumes|perfumaria|maquiagem)\\b',3,'Cosméticos e perfumes não medicinais sob marca própria',44,'Serviços de cuidados de beleza'],
  ['\\b(pipoca|confeitaria|doces|bolos|biscoitos|cafe|chocolate)\\b',30,'Produtos de confeitaria, café ou cereais preparados sob marca própria, conforme o produto',43,'Fornecimento de comidas e bebidas para consumo'],
  ['\\b(racoes|alimentos para animais|pet shop|petshop)\\b',31,'Alimentos não medicinais para animais sob marca própria',44,'Serviços veterinários ou de higiene animal'],
  ['\\b(joias|relogios|bijuterias)\\b',14,'Joias, bijuterias e relógios sob marca própria',40,'Fabricação personalizada para terceiros'],
  ['\\b(moveis|mobiliario)\\b',20,'Móveis sob marca própria',37,'Instalação e reparação de móveis'],
];

export function normal(text: unknown): string {
  return String(text ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

interface Step { class: number | null; title: string; scope: string; text: string }
export interface Guidance {
  version: string; source: string; status: 'preliminary' | 'needs_confirmation' | 'conditional';
  primary_class: number | null; steps: Step[]; method?: string;
  clarification_question?: string; budget_text?: string;
}

function pending(reason: string, primary: number | null = null): Guidance {
  return { version: ORIENTATION_VERSION, source: ORIENTATION_SOURCE, status: 'needs_confirmation', primary_class: null, steps: [
    { class: primary, title: 'DEFINIR A ATIVIDADE PRINCIPAL', scope: 'Confirmar o enquadramento', text: reason },
    { class: null, title: 'MAPEAR ATIVIDADES COMPLEMENTARES', scope: 'Informar o que é oferecido sob a marca', text: 'Distinguir serviços, comércio de produtos de terceiros e produtos com marca própria. Isso permite identificar classes complementares pertinentes.' },
    { class: null, title: 'PLANEJAR A AMPLIAÇÃO', scope: 'Registrar conforme a atuação efetiva', text: 'Após confirmar o ramo, selecionar as classes adequadas. Não indicar três classes apenas para preencher o relatório.' },
  ] };
}

function legacyGuidance(activity: string): Guidance {
  const text = normal(activity);
  const uncertain = /\b(nao|sem|exceto|menos|talvez|pretendo)\b/.test(text);
  const matches = PROFILES.filter((p) => new RegExp(p[0]).test(text));
  const products = PRODUCTS.filter((p) => new RegExp(p[0]).test(text));
  const retail = /\b(loja|comercio|revenda|varejo|atacado|e-commerce|ecommerce|pet shop|petshop)\b/.test(text);
  if (retail && matches.length) {
    return pending('O ramo combina comércio com termos de serviços. Confirme se a atividade principal é a loja ou a prestação dos serviços antes de escolher a classe.');
  }
  let mixed = matches.length > 1 || products.length > 1;
  if (matches.length && products.length) mixed = mixed || !(matches[0][1] === 43 || matches[0][1] === 44);
  if (uncertain || mixed) {
    return pending('O ramo contém ressalvas ou mais de uma atividade. Confirme a atividade principal antes de escolher a classe.');
  }
  let primary: number, scope: string, second: number, sScope: string, third: number, tScope: string;
  if (matches.length) {
    [, primary, scope, second, sScope, third, tScope] = matches[0];
  } else if (products.length) {
    const [, product, pScope, t, ttScope] = products[0];
    third = t; tScope = ttScope;
    if (retail) { primary = 35; scope = 'Comércio dos produtos informados, com especificação do segmento'; second = product; sScope = pScope; }
    else { primary = product; scope = pScope; second = 35; sScope = 'Comércio dos produtos informados'; }
  } else if (retail) {
    return pending('Há indicação de comércio, mas é necessário detalhar quais produtos são vendidos e se há marca própria.', 35);
  } else {
    return pending('O ramo informado precisa de detalhamento para uma indicação segura de classes. Informe produtos, serviços e forma de atuação.');
  }
  return { version: ORIENTATION_VERSION, source: ORIENTATION_SOURCE, status: 'preliminary', primary_class: primary, steps: [
    { class: primary, title: 'PRIORIDADE PRINCIPAL', scope, text: 'Enquadramento preliminar da atividade central informada. Confirme a especificação dos produtos ou serviços efetivos antes do depósito.' },
    { class: second, title: 'COBERTURA COMPLEMENTAR', scope: sScope, text: 'Avaliar somente se esta atividade também for efetivamente exercida sob a marca. A indicação não confirma que o cliente já a realiza.' },
    { class: third, title: 'EXPANSÃO CONDICIONADA', scope: tScope, text: 'Atividade adicional a confirmar. Registrar nesta classe somente se houver atuação compatível; não é uma exigência automática.' },
  ] };
}

function foodGuidance(activity: string): Guidance {
  const text = normal(activity);
  const g = legacyGuidance(activity);
  g.method = 'regras_locais';
  if (g.status === 'needs_confirmation' && /\b(alimentacao|alimenticio\w*|alimentos|comida\w*|gastronomia)\b/.test(text)) {
    g.status = 'conditional'; g.primary_class = null;
    g.clarification_question = 'Você prepara refeições para consumo, vende alimentos ou fabrica produtos com marca própria?';
    g.budget_text = 'Se o orçamento estiver limitado, priorize a classe da atividade efetiva: 43 para servir refeições; 35 para comércio; 29 ou 30 para produtos próprios, conforme o alimento. Confirme essa atividade antes do depósito.';
    g.steps = [
      { class: 43, title: 'SE PREPARA E SERVE REFEIÇÕES', scope: 'Serviços de alimentação', text: 'Restaurantes, lanchonetes e fornecimento de comidas e bebidas para consumo. Pode ser a prioridade se esta for sua atividade principal.' },
      { class: 35, title: 'SE ATUA NO COMÉRCIO', scope: 'Comércio de alimentos', text: 'Venda varejista ou atacadista, com especificação dos alimentos comercializados. Pode ser a prioridade para uma loja; não substitui a proteção dos produtos próprios.' },
      { class: 30, title: 'SE VENDE PRODUTOS PRÓPRIOS', scope: 'Café, confeitaria e produtos à base de cereais', text: 'A classe 30 depende do alimento. Carnes, laticínios e diversos alimentos processados podem pertencer à classe 29; outros produtos podem exigir outras classes. Informe o produto antes de escolher.' },
    ];
  } else if (g.status === 'needs_confirmation') {
    g.clarification_question = 'Qual produto ou serviço você oferece e sua atuação principal é produzir, vender ou prestar o serviço?';
  }
  return g;
}

function candleGuidance(activity: string): Guidance {
  const text = normal(activity);
  if (!/\bvelas?\b/.test(text)) return foodGuidance(activity);
  if (/\b(massagem|cosmetic\w*|terapeut\w*|medicin\w*|nao|sem|exceto|talvez|pretendo)\b/.test(text)) {
    const g = pending('Confirme se as velas são para iluminação/uso doméstico ou massagem cosmética/terapêutica e qual a atividade principal.');
    g.method = 'regras_locais';
    g.clarification_question = 'As velas são para uso doméstico/iluminação ou massagem cosmética/terapêutica? Você produz ou mantém uma loja?';
    return g;
  }
  const produces = /\b(fabrica\w*|produ\w*|marca propria)\b/.test(text);
  const retail = /\b(loja|comercio|varej\w*|revenda|atacado|ecommerce|e-commerce)\b/.test(text);
  if (!produces && !retail) return foodGuidance(activity);
  const primary = produces ? 4 : 35;
  const steps: Step[] = [
    { class: 4, title: 'PRODUTO PRÓPRIO', scope: 'Velas para iluminação e velas aromáticas de uso doméstico sob marca própria', text: 'Classe principal somente se oferece velas próprias. Não inclui velas de massagem cosméticas (3) ou terapêuticas (5).' },
    { class: 35, title: 'LOJA A CONFIRMAR', scope: 'Agrupamento e comércio varejista de velas em loja', text: 'Avaliar se há serviço de loja. A venda subsidiária dos próprios produtos não cria automaticamente um serviço na classe 35.' },
    { class: 40, title: 'FABRICAÇÃO PERSONALIZADA A CONFIRMAR', scope: 'Fabricação personalizada de velas para terceiros', text: 'Somente se feita a pedido e conforme especificações de terceiros. Não se aplica automaticamente à produção própria.' },
  ];
  steps.sort((a, b) => (a.class === primary ? 0 : 1) - (b.class === primary ? 0 : 1));
  steps[0].title = 'PRIORIDADE PRINCIPAL';
  return { version: ORIENTATION_VERSION + '-candles-2026-10-05', source: 'https://www.gov.br/inpi/pt-br/servicos/marcas/classificacao-marcas/Caputs_enotas_NCL_13_2026.pdf', status: 'preliminary', primary_class: primary, steps, method: 'regras_locais' };
}

function autoGuidance(activity: string): Guidance {
  const text = normal(activity);
  const vehicle = /\b(automoveis|automovel|automotiv\w*|veiculos?|carros?)\b/.test(text);
  const repair = /\b(consert\w*|repar\w*|manutenc\w*|oficina mecanica|funilaria|lanternagem)\b/.test(text);
  const uncertain = /\b(nao|sem|exceto|talvez|pretendo)\b/.test(text);
  if (!(vehicle && repair) || uncertain) return candleGuidance(activity);
  return { version: ORIENTATION_VERSION + '-auto-repair-2026-10-09', source: 'https://www.gov.br/inpi/pt-br/servicos/marcas/classificacao-marcas/Lista_auxiliar_SERVIOS_janeiro_2026.pdf', status: 'preliminary', primary_class: 37, method: 'regras_locais', steps: [
    { class: 37, title: 'PRIORIDADE PRINCIPAL', scope: 'Serviços de conserto, reparo e manutenção de automóveis', text: 'Classe 37 para o serviço informado de reparo e manutenção de veículos. Confirmar a especificação e a atividade efetiva antes do depósito.' },
    { class: null, title: 'ATIVIDADES COMPLEMENTARES A CONFIRMAR', scope: 'Venda de peças, produtos próprios ou outros serviços', text: 'Não presume comércio nem produtos com marca própria. Informar atividades complementares antes de escolher outras classes.' },
  ] };
}

function retailClothingGuidance(activity: string): Guidance {
  const text = normal(activity);
  const retail = /\b(loja|comercio|varej\w*|revenda)\b/.test(text);
  const clothing = /\b(roupas|vestuario|calcados|camisetas|moveis|decoracao)\b/.test(text);
  const thirdParty = /\b(?:de|produtos? de) terceiros\b/.test(text);
  const excludedOwn = /\bsem fabricacao(?: ou| e)?(?: marca propria)?\b|\bsem marca propria\b/.test(text);
  const uncertain = /\b(talvez|pretendo|nao vendo|nao comercializo)\b/.test(text);
  if (!(retail && clothing && thirdParty && excludedOwn) || uncertain) return autoGuidance(activity);
  return { version: ORIENTATION_VERSION + '-retail-clothing-2026-10-09', source: ORIENTATION_SOURCE, status: 'preliminary', primary_class: 35, method: 'regras_locais', steps: [
    { class: 35, title: 'PRIORIDADE PRINCIPAL', scope: 'Comércio varejista de produtos de terceiros informados (vestuário, móveis ou decoração)', text: 'A atividade informada é a loja que reúne e vende produtos de terceiros. Confirmar a especificação do serviço de comércio antes do depósito.' },
    { class: null, title: 'PRODUTOS PRÓPRIOS NÃO INFORMADOS', scope: 'Produtos sob marca própria somente se houver produção ou produtos próprios', text: 'As classes dos produtos, como 25 para vestuário ou 20 para móveis, não substituem a classe 35 do serviço de varejo. Não indicá-las como obrigação para esta loja sem produtos próprios.' },
  ] };
}

export function guidance(activity: string): Guidance {
  const text = normal(activity);
  if (!/\b(energia solar|solar fotovoltaic\w*|pain(?:el|eis)\w* solar\w*|sistema\w* fotovoltaic\w*|geracao de energia fotovoltaic\w*)\b/.test(text)) {
    return retailClothingGuidance(activity);
  }
  const other = PROFILES.slice(1).filter((p) => new RegExp(p[0]).test(text));
  if (/\b(nao|sem|exceto|menos|talvez|pretendo)\b/.test(text) || other.length) {
    const g = pending('A atividade contém negação, ressalvas ou negócios diferentes. Confirme quais produtos ou serviços são efetivamente oferecidos; sem prioridade definida.');
    g.method = 'regras_locais';
    g.clarification_question = 'Quais atividades você realmente exerce sob esta marca e qual é a principal?';
    return g;
  }
  return { version: ORIENTATION_VERSION + '-solar-clarification-2026-10-10', source: ORIENTATION_SOURCE, status: 'needs_confirmation', primary_class: null, method: 'regras_locais', clarification_question: 'Sua atividade é instalar ou manter sistemas, comercializar equipamentos, oferecer painéis fotovoltaicos próprios ou prestar serviços de geração de energia?', budget_text: 'Ainda não há prioridade definida. Detalhe a atividade principal e os produtos ou serviços antes de escolher a classe. As opções apresentadas são condicionais, não uma lista de pedidos obrigatórios.', steps: [
    { class: 37, title: 'SE PRESTA INSTALAÇÃO OU MANUTENÇÃO', scope: 'Instalação e manutenção de sistemas solares', text: 'Aplicável apenas se esses serviços forem efetivamente oferecidos. Energia solar, isoladamente, não confirma instalação nem manutenção.' },
    { class: 35, title: 'SE PRESTA SERVIÇO DE COMÉRCIO', scope: 'Comércio de equipamentos solares de terceiros', text: 'Confirmar os produtos e o serviço de loja, varejo ou atacado. A venda dos próprios produtos não cria automaticamente um serviço de comércio separado.' },
    { class: 9, title: 'SE OFERECE PAINÉIS FOTOVOLTAICOS PRÓPRIOS', scope: 'Painéis solares para produção de eletricidade e células fotovoltaicas', text: 'Confirmar produtos efetivos sob a marca. Outros equipamentos podem exigir outra classe, por exemplo coletores solares térmicos; não classificar todo equipamento solar na classe 9.' },
    { class: 40, title: 'SE PRESTA SERVIÇO DE GERAÇÃO DE ENERGIA', scope: 'Produção de energia', text: 'Confirmar se a atividade informada é o serviço de produção de energia. Não presume fabricação, instalação nem comércio de equipamentos.' },
  ] };
}

/** primary_class derivado da atividade (equivalente a classes[:1] do coletor). */
export function primaryClassFor(activity: string): number | null {
  return guidance(activity).primary_class;
}
