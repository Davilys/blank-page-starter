/**
 * Laudo de viabilidade em PDF — padrão WebMarcas (timbrado oficial aprovado,
 * geometria do comando mestre §8-9) a partir dos dados da consulta exata no
 * portal público do INPI. Sem dados pessoais do visitante: apenas marca, ramo
 * informado e registros públicos do INPI.
 *
 * Estrutura conforme o padrão de laudos da casa (análise da marca, classes
 * sugeridas, pesquisa de anterioridade, estratégia, conclusão técnica e as 7
 * perguntas frequentes aprovadas). Nada aqui inventa resultado: zero
 * ocorrências NÃO é apresentado como disponibilidade e a conclusão final é
 * sempre da equipe WebMarcas.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1';
import { LAUDO_HEADER_LOGO_PNG_B64 } from './laudoAssets.ts';

export interface LaudoRecord {
  process: string;
  brand: string;
  status: string;
  holder: string | null;
  nice: string | null;
  priority: string | null;
}

export interface LaudoAnalysisItem {
  process: string;
  group: 'related' | 'pending' | 'other';
  reason: string;
  specification: string | null;
}

export interface LaudoAnalysis {
  version: string;
  activity: string;
  focus_classes: number[];
  counts: { related: number; pending: number; other: number };
  items: LaudoAnalysisItem[];
  message: string;
  limitation: string;
}

export interface LaudoGuidanceStep {
  class: number | null;
  title: string;
  scope: string;
  text: string;
}

export interface LaudoGuidance {
  status: 'preliminary' | 'needs_confirmation' | 'conditional';
  primary_class: number | null;
  steps: LaudoGuidanceStep[];
  clarification_question?: string;
  budget_text?: string;
}

export interface LaudoInput {
  jobId: string;
  brand: string;
  activity: string;
  queriedAt: string;
  baseUpdatedAt: string;
  conclusion: string;
  total: number;
  records: LaudoRecord[];
  activityAnalysis: LaudoAnalysis | null;
  guidance: LaudoGuidance | null;
}

// Teto de linhas no PDF para limitar tempo/tamanho; o total real é sempre citado.
const MAX_ROWS_IN_PDF = 300;

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 51; // comando mestre: margens laterais de 51 pontos
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H = 90; // cabeçalho em largura integral, 90pt, encostado no topo
const FOOTER_Y = 25.22; // rodapé em largura integral, base a 25,22pt do limite
const FOOTER_H = 25.67;
const BODY_TOP = 730; // início do corpo
const BODY_BOTTOM = 82; // limite inferior do corpo (acima das linhas de contato do rodapé)

const INK = rgb(0x23 / 255, 0x29 / 255, 0x36 / 255); // #232936
const MUTED = rgb(0.38, 0.38, 0.44);
const ACCENT = rgb(0x20 / 255, 0x3f / 255, 0x68 / 255); // #203F68 (azul de títulos)
const LINE = rgb(0.85, 0.85, 0.89);

/** Cabeçalhos abreviados da Classificação de Nice (45 classes). */
const NICE_HEADINGS: Record<number, string> = {
  1: 'Produtos químicos', 2: 'Tintas e vernizes', 3: 'Cosméticos e produtos de limpeza',
  4: 'Óleos, graxas e velas', 5: 'Produtos farmacêuticos', 6: 'Metais comuns',
  7: 'Máquinas', 8: 'Ferramentas e instrumentos manuais', 9: 'Aparelhos elétricos e científicos',
  10: 'Aparelhos médicos e cirúrgicos', 11: 'Aparelhos de iluminação e aquecimento', 12: 'Veículos',
  13: 'Armas de fogo', 14: 'Joalheria e relojoaria', 15: 'Instrumentos musicais',
  16: 'Papel, impressos e material de escritório', 17: 'Produtos de borracha', 18: 'Couro e artigos de couro',
  19: 'Materiais de construção não metálicos', 20: 'Móveis', 21: 'Utensílios domésticos',
  22: 'Cordas, redes e fibras', 23: 'Fios para têxteis', 24: 'Tecidos',
  25: 'Vestuário, calçados e chapelaria', 26: 'Passamanaria e bordados', 27: 'Tapetes e revestimentos de piso',
  28: 'Jogos e brinquedos', 29: 'Carnes e alimentos processados de origem animal',
  30: 'Café, cereais e produtos de padaria', 31: 'Produtos agrícolas naturais e alimentos para animais',
  32: 'Bebidas não alcoólicas', 33: 'Bebidas alcoólicas', 34: 'Tabaco',
  35: 'Publicidade e gestão de negócios', 36: 'Seguros e serviços financeiros',
  37: 'Construção, instalação e reparação', 38: 'Telecomunicações', 39: 'Transporte e armazenamento',
  40: 'Tratamento de materiais', 41: 'Educação, formação e entretenimento',
  42: 'Serviços científicos e tecnológicos', 43: 'Serviços de alimentação e hospedagem',
  44: 'Serviços médicos, veterinários e de beleza', 45: 'Serviços jurídicos e de segurança',
};

/** WinAnsi (Latin-1) não cobre emoji/símbolos fora de cp1252; remove sem inventar. */
function clean(v: string | null | undefined): string {
  return (v ?? '').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, ' ').replace(/\s+/g, ' ').trim();
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return clean(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function fmtDay(iso: string | null | undefined): string {
  if (!iso) return 'não informada';
  const d = new Date(iso);
  // Portais antigos devolvem datas nulas como 1899/1970: exibir como não informada, nunca como fato.
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1920) return 'não informada';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

class Writer {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  logo: Awaited<ReturnType<PDFDocument['embedPng']>>;
  y: number;
  private constructor(
    doc: PDFDocument, page: PDFPage, font: PDFFont, bold: PDFFont,
    logo: Writer['logo'],
  ) {
    this.doc = doc; this.page = page; this.font = font; this.bold = bold;
    this.logo = logo;
    this.decorate(page);
    this.y = BODY_TOP;
  }
  static async create(): Promise<Writer> {
    const doc = await PDFDocument.create();
    doc.setTitle('Laudo de viabilidade');
    doc.setAuthor('WebMarcas');
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const logo = await doc.embedPng(b64ToBytes(LAUDO_HEADER_LOGO_PNG_B64));
    return new Writer(doc, doc.addPage([PAGE_W, PAGE_H]), font, bold, logo);
  }
  private decorate(page: PDFPage) {
    // Timbrado legado: faixas full-width + bloco do logo recortado + contatos a direita
    const NAVY = rgb(0.114, 0.231, 0.38);
    const GOLD = rgb(0.788, 0.651, 0.153);
    const GRAYRULE = rgb(0.525, 0.588, 0.667);
    page.drawRectangle({ x: 0, y: PAGE_H - 10, width: PAGE_W, height: 10, color: NAVY });
    page.drawRectangle({ x: 0, y: PAGE_H - 13, width: PAGE_W, height: 3, color: GOLD });
    const logoW = PAGE_W * (1100 / 1786);
    const logoH = logoW * (220 / 1100);
    page.drawImage(this.logo, { x: 0, y: PAGE_H - 15 - logoH, width: logoW, height: logoH });
    page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H + 2.6, width: PAGE_W, height: 1.6, color: GRAYRULE });
    page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: 2.4, color: GOLD });
    const cx = PAGE_W - MARGIN;
    const lines: Array<[string, boolean]> = [
      ['CNPJ: 39.528.012/0001-29', true],
      ['Av. Brigadeiro Luís Antônio, 2696', false],
      ['São Paulo/SP', false],
      ['ola@webmarcas.net', true],
    ];
    let ty = PAGE_H - 30;
    for (const [t, b] of lines) {
      const f = b ? this.bold : this.font;
      const tw = f.widthOfTextAtSize(t, 8);
      page.drawText(t, { x: cx - tw, y: ty, size: 8, font: f, color: ACCENT });
      ty -= 10.5;
    }
  }
  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.decorate(this.page);
    this.y = BODY_TOP;
  }
  ensure(h: number) { if (this.y - h < BODY_BOTTOM) this.newPage(); }
  text(t: string, size = 10.4, opts?: { bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number }) {
    const f = opts?.bold ? this.bold : this.font;
    const x = MARGIN + (opts?.indent ?? 0);
    this.page.drawText(t, { x, y: this.y - size, size, font: f, color: opts?.color ?? INK });
    this.y -= size + 4.0;
  }
  wrapLines(t: string, size: number, width: number, bold = false): string[] {
    const f = bold ? this.bold : this.font;
    const words = t.split(' ');
    let line = '';
    const lines: string[] = [];
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(trial, size) > width && line) { lines.push(line); line = word; } else { line = trial; }
    }
    if (line) lines.push(line);
    return lines;
  }
  wrap(t: string, size = 10.4, opts?: { bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; lineGap?: number }) {
    const w = CONTENT_W - (opts?.indent ?? 0);
    for (const ln of this.wrapLines(t, size, w, opts?.bold)) {
      this.ensure(size + 4.0);
      this.text(ln, size, opts);
      this.y -= opts?.lineGap ?? 0;
    }
  }
  gap(h = 8) { this.y -= h; }
  rule() { this.ensure(6); this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 0.7, color: LINE }); this.y -= 8; }
  section(title: string) {
    this.ensure(36);
    this.gap(2);
    this.text(title, 12.5, { bold: true, color: ACCENT });
    this.y -= 2;
  }
  /** Caixa clara com barra azul a esquerda (padrão dos passos do laudo legado). */
  private renderBox(entries: Array<{ t: string; size: number; bold?: boolean; color?: ReturnType<typeof rgb>; gapAfter?: number }>, bg: ReturnType<typeof rgb>, withBar: boolean) {
    const padX = 12, padY = 10, barW = 3, lead = 3.6;
    const innerW = CONTENT_W - padX * 2 - (withBar ? barW : 0);
    const rendered = entries.map((e) => ({ ...e, lines: this.wrapLines(e.t, e.size, innerW, e.bold) }));
    let h = padY * 2;
    for (const r of rendered) h += r.lines.length * (r.size + lead) + (r.gapAfter ?? 2);
    this.ensure(h + 10);
    const top = this.y;
    this.page.drawRectangle({ x: MARGIN, y: top - h, width: CONTENT_W, height: h, color: bg });
    if (withBar) this.page.drawRectangle({ x: MARGIN, y: top - h, width: barW, height: h, color: ACCENT });
    let yy = top - padY;
    for (const r of rendered) {
      for (const ln of r.lines) {
        this.page.drawText(ln, { x: MARGIN + padX + (withBar ? barW : 0), y: yy - r.size, size: r.size, font: r.bold ? this.bold : this.font, color: r.color ?? INK });
        yy -= r.size + lead;
      }
      yy -= r.gapAfter ?? 2;
    }
    this.y = top - h - 7;
  }
  stepBox(heading: string, sub: string, body: string) {
    this.renderBox([
      { t: heading, size: 10, bold: true, color: ACCENT, gapAfter: 3 },
      { t: sub, size: 9.4, bold: true, gapAfter: 2 },
      { t: body, size: 9.4, color: rgb(0.28, 0.31, 0.36) },
    ], rgb(0.937, 0.953, 0.973), true);
  }
  darkBox(title: string, body: string) {
    this.renderBox([
      { t: title.toUpperCase(), size: 9.8, bold: true, color: rgb(1, 1, 1), gapAfter: 4 },
      { t: body, size: 9.4, color: rgb(0.95, 0.96, 0.98) },
    ], rgb(0.125, 0.247, 0.408), false);
  }
}

/** Perguntas frequentes — texto aprovado (19/10/2026), impresso em corpo menor. */
const FAQ: Array<[string, string]> = [
  ['1. Quanto tempo leva o registro?', 'De 8 a 12 meses. A proteção já começa no protocolo.'],
  ['2. O valor é só esse?', 'Os R$699,00 são nossos honorários para preparo, protocolo, acompanhamento e vigilância de 12 meses. Além disso, há a taxa federal do INPI de R$440,00 por classe. Se houver exigências extras, os valores serão publicados no Diário Oficial conforme contrato.'],
  ['3. Tem garantia?', 'Sim. Se o pedido for arquivado, protocolamos uma nova marca sem custos.'],
  ['4. Inclui o logotipo?', 'Sim. O pacote inclui nome + logotipo.'],
  ['5. Onde a marca é protegida?', 'Em todo o território nacional, válida por 10 anos.'],
  ['6. Onde vocês ficam?', 'WebMarcas & Patentes EIRELI — Av. Brigadeiro Luiz Antônio 2696, São Paulo/SP — ola@webmarcas.net — (11) 94055-5265 — www.webmarcas.net. O atendimento é 100% digital.'],
  ['7. Os R$699 incluem todas as classes?', 'Não. O valor é por classe. Cada classe é um processo distinto no INPI.'],
];

function classLabel(n: number): string {
  return `CLASSE ${n} — ${(NICE_HEADINGS[n] ?? 'Classe de Nice').toUpperCase()}`;
}

function analiseDaMarca(brand: string, activity: string): string[] {
  const tokens = brand.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  if (tokens.length > 1) {
    out.push(`A marca ${brand} é um nome composto, formado pelos elementos "${tokens.join('" e "')}". Cada elemento e o conjunto são considerados na pesquisa de anterioridades e na avaliação de distintividade.`);
  } else {
    out.push(`A marca ${brand} foi pesquisada como sinal nominativo único.`);
  }
  out.push(`A relação do nome com o segmento informado (${activity}), o potencial distintivo do conjunto e eventuais limitações de exclusividade sobre elementos descritivos ou de uso comum são avaliados na análise técnica da equipe WebMarcas, à luz dos arts. 122 e 124 da Lei nº 9.279/1996 (Lei da Propriedade Industrial). Nenhum elemento isolado, por si só, garante ou inviabiliza o registro.`);
  return out;
}

export async function buildLaudoPdf(input: LaudoInput): Promise<Uint8Array> {
  const w = await Writer.create();
  const brand = clean(input.brand);
  const activity = clean(input.activity);

  // ─── Título ───
  w.text('LAUDO TÉCNICO DE VIABILIDADE DE MARCA', 15, { bold: true, color: ACCENT });
  w.gap(4);
  w.wrap(`Marca analisada: ${brand}`, 11, { bold: true });
  w.wrap(`Atividade informada: ${activity}`, 10.4);
  w.text(`Data da análise: ${fmtDate(input.queriedAt)}`, 10.4);
  w.wrap(`Protocolo da consulta: ${clean(input.jobId)}`, 9.5, { color: MUTED });
  w.gap(2);
  w.rule();

  // ─── 1. Análise da marca ───
  w.section('1. ANÁLISE DA MARCA');
  for (const p of analiseDaMarca(brand, activity)) w.wrap(p, 10.4);

  // ─── 2. Orientação jurídica: classes sugeridas ───
  w.section('2. ORIENTAÇÃO JURÍDICA — CLASSES SUGERIDAS');
  const g = input.guidance;
  const classSteps = (g?.steps ?? []).filter((s) => typeof s.class === 'number' && s.class >= 1 && s.class <= 45);
  const listedClasses = [...new Set(classSteps.map((s) => s.class!))];
  if (!g) {
    w.wrap('A indicação de classes para o ramo informado é definida na análise da equipe WebMarcas antes do protocolo.', 10.4);
  } else if (classSteps.length) {
    w.wrap('Classes indicadas para a atividade informada, conforme a Classificação Internacional de Nice (INPI), com a explicação do que cada uma abrange. A especificação final é confirmada pela equipe WebMarcas antes do depósito.', 10.4);
    w.gap(4);
    classSteps.forEach((st, i) => {
      w.stepBox(
        `${i + 1}. ${classLabel(st.class!)}`,
        `${clean(st.title)} — ${clean(st.scope)}`,
        clean(st.text),
      );
    });
    for (const st of g.steps.filter((s) => s.class === null)) {
      w.ensure(30);
      w.wrap(`${clean(st.title)}: ${clean(st.text)}`, 9, { color: MUTED });
    }
    w.ensure(120);
    w.gap(2);
    w.text('Prioridade conforme seu orçamento', 11, { bold: true, color: ACCENT });
    w.gap(2);
    const nWord = ['uma', 'duas', 'três', 'quatro'][listedClasses.length - 1] ?? `${listedClasses.length}`;
    if (g.primary_class) {
      w.darkBox(
        `Registre nas ${nWord} classes indicadas que correspondam à sua atuação. Se o orçamento estiver limitado, priorize a Classe ${g.primary_class}.`,
        `A Classe ${g.primary_class} (${NICE_HEADINGS[g.primary_class] ?? 'Nice'}) protege a atividade principal informada e é o primeiro registro a fazer. As classes complementares valem somente se as atividades correspondentes forem efetivamente exercidas sob a marca; a equipe WebMarcas confirma essa correspondência antes do depósito.`,
      );
    } else if (g.budget_text) {
      w.darkBox('Prioridade a confirmar conforme o orçamento', clean(g.budget_text));
    }
    w.gap(2);
    w.wrap('O depósito não garante deferimento. A decisão final depende do exame do INPI.', 9, { color: MUTED });
    w.wrap('Orientação preliminar pelo ramo informado. Referência: INPI — Classificação de produtos e serviços. A indicação das classes é preliminar e é confirmada pela equipe WebMarcas antes do protocolo.', 9, { color: MUTED });
  } else {
    w.wrap('O ramo informado precisa de detalhamento para uma indicação segura de classes. Informe produtos, serviços e forma de atuação para que a equipe WebMarcas indique as classes corretas antes do protocolo.', 10.4);
    if (g.clarification_question) w.wrap(`Para direcionar a indicação: ${clean(g.clarification_question)}`, 10.4);
  }

  // ─── 3. Pesquisa de anterioridade ───
  w.section('3. PESQUISA DE ANTERIORIDADE');
  w.wrap('Fonte: portal público de busca do INPI (servicos.busca.inpi.gov.br), pesquisa EXATA — encontra o nome exatamente como foi pesquisado, ignorando apenas maiúsculas/minúsculas e acentos (marcas compostas pesquisadas por inteiro correspondem). Não abrange variantes, plurais, nem nomes com termos adicionais, ausentes ou em ordem diferente.', 9.4, { color: MUTED });
  w.wrap(`A base consultada informa atualização em ${clean(input.baseUpdatedAt)}. Pedidos mais recentes podem não constar do resultado.`, 9.4, { color: MUTED });
  w.gap(3);
  if (input.conclusion === 'requires_legal_review') {
    w.wrap(`Foram encontrados ${input.total} processo(s) com o mesmo nome na base consultada. Isso não significa que o registro é impossível: a análise jurídica avalia classe, atividade e grau de semelhança antes de qualquer protocolo.`, 10.4);
  } else {
    w.wrap('A busca exata não retornou processos com esse nome na base consultada. Isso não confirma a disponibilidade: pedidos muito recentes podem não constar e a análise final de colidência e classe é feita pela equipe WebMarcas antes do protocolo.', 10.4);
  }
  w.gap(4);

  if (input.records.length > 0) {
    const listed = input.records.slice(0, MAX_ROWS_IN_PDF);
    w.text(`Registros encontrados: ${input.total}`, 10.4, { bold: true });
    if (listed.length < input.total) {
      w.wrap(`Este documento lista os ${listed.length} primeiros de ${input.total} registros retornados pela base.`, 9, { color: MUTED });
    }
    w.gap(4);
    for (const r of listed) {
      w.ensure(46);
      w.wrap(`${clean(r.brand) || '—'} — processo ${clean(r.process) || '—'}`, 9.5, { bold: true });
      w.wrap(`Situação: ${clean(r.status) || '—'} | Titular: ${clean(r.holder) || 'não informado'} | Classe: ${clean(r.nice) || '—'} | Prioridade: ${fmtDay(r.priority)}`, 9, { color: MUTED });
      w.gap(3);
      w.rule();
    }
  }

  // ─── 4. Análise por atividade (triagem preliminar) ───
  w.section('4. ANÁLISE POR ATIVIDADE (TRIAGEM PRELIMINAR)');
  const analysis = input.activityAnalysis;
  if (!analysis) {
    w.wrap('A análise por atividade não foi executada nesta consulta porque a pesquisa não retornou registros para classificar. Isso não confirma a disponibilidade da marca: a conferência técnica da equipe WebMarcas permanece necessária antes do protocolo.', 9.4, { color: MUTED });
  } else {
    const labels: Record<string, string> = { related: 'Potencialmente relacionados', pending: 'Necessitam conferência', other: 'Outros segmentos' };
    w.wrap(clean(analysis.message), 10.4);
    w.text(`Potencialmente relacionados: ${analysis.counts.related} | Necessitam conferência: ${analysis.counts.pending} | Outros segmentos: ${analysis.counts.other}`, 9.5, { bold: true });
    w.text(`Classes de foco preliminar: ${analysis.focus_classes.length ? analysis.focus_classes.join(', ') : 'ramo a esclarecer'}.`, 9, { color: MUTED });
    const brandOf = new Map(input.records.map((r) => [r.process, r.brand]));
    for (const group of ['related', 'pending', 'other'] as const) {
      const items = analysis.items.filter((i) => i.group === group).slice(0, MAX_ROWS_IN_PDF);
      if (!items.length) continue;
      w.gap(3);
      w.text(`${labels[group]} (${items.length}${analysis.counts[group] > items.length ? ' de ' + analysis.counts[group] : ''})`, 10.4, { bold: true });
      for (const it of items) {
        w.ensure(40);
        w.wrap(`processo ${clean(it.process)} — ${clean(brandOf.get(it.process)) || 'marca não listada'}`, 9, { bold: true });
        w.wrap(clean(it.reason), 8.5, { color: MUTED });
        if (it.specification) w.wrap(`Especificação: ${clean(it.specification).slice(0, 600)}`, 8.5, { color: MUTED });
      }
    }
    w.gap(3);
    w.wrap(`Limitações: ${clean(analysis.limitation)}`, 8.5, { color: MUTED });
  }

  // ─── 5. Estratégia de proteção ───
  w.section('5. ESTRATÉGIA DE PROTEÇÃO');
  w.wrap('Este laudo refere-se à pesquisa do nome (marca nominativa), que protege o sinal verbal, observados os limites do registro concedido. Se houver logotipo, pode ser interessante avaliar também um pedido de marca mista, que protege o conjunto formado pelos elementos nominativos e figurativos apresentados. A marca figurativa protege elementos visuais sem elemento nominativo.', 10.4);
  w.wrap('A recomendação final de modalidade considera o nome, o logotipo, a distintividade, os resultados da pesquisa, as classes e a estratégia comercial, e é definida com a equipe WebMarcas antes do protocolo.', 10.4);

  // ─── 6. Conclusão técnica ───
  w.ensure(215); // conclusão+avisos juntos: nunca deixar AVISOS órfão em página própria
  w.section('6. CONCLUSÃO TÉCNICA');
  if (input.conclusion === 'requires_legal_review') {
    w.wrap(`A pesquisa exata encontrou ${input.total} processo(s) com o mesmo nome na base do INPI. A existência de ocorrências não significa, por si só, impedimento: a viabilidade depende da análise de colidência, classe e situação de cada processo. Classificação preliminar: VIABILIDADE INDETERMINADA — análise técnica da equipe WebMarcas necessária antes do protocolo.`, 10.4);
  } else {
    w.wrap(`A pesquisa exata não encontrou processos com o nome exato na base do INPI (atualização ${clean(input.baseUpdatedAt)}). Isso não confirma a disponibilidade da marca: a busca exata não abrange variantes, pedidos recentes podem não constar da base e a colidência depende de análise técnica. Classificação preliminar: VIABILIDADE A CONFIRMAR — a análise de colidência e classe é feita pela equipe WebMarcas antes do protocolo.`, 10.4);
  }
  if (listedClasses.length) {
    const principal = g?.primary_class ?? null;
    const others = listedClasses.filter((c) => c !== principal);
    if (principal) {
      w.wrap(`Classe principal sugerida: Classe ${principal} (${NICE_HEADINGS[principal] ?? 'Nice'}).`, 10.4, { bold: true });
      if (others.length) w.wrap(`Classes complementares, condicionadas à atuação efetiva sob a marca: ${others.map((c) => `Classe ${c} (${NICE_HEADINGS[c] ?? 'Nice'})`).join('; ')}.`, 10.4);
    } else {
      w.wrap(`Classes sugeridas: ${listedClasses.map((c) => `Classe ${c} (${NICE_HEADINGS[c] ?? 'Nice'})`).join('; ')}.`, 10.4, { bold: true });
    }
  }
  w.wrap('A concessão do registro depende do exame do INPI; não é possível garantir antecipadamente o deferimento.', 10.4);

  // ─── Avisos ───
  w.ensure(46);
  w.section('AVISOS');
  w.wrap('Consulta preliminar automatizada sobre base pública. Este documento não garante a disponibilidade nem o registro da marca e não substitui a análise técnica e jurídica da equipe WebMarcas, realizada antes do protocolo.', 9, { color: MUTED });

  // FAQ comercial (19/10) retirado da prévia: taxa/prazo/contato divergem das fontes
  // oficiais atuais e aguardam decisão do usuário (ver relatório). Volta após aprovação.

  // Rodapé padrão legado: contato central + tarja + paginação
  const pages = w.doc.getPages();
  pages.forEach((p, i) => {
    const contact = 'WebMarcas e Patentes | (11) 91112-0225 | ola@webmarcas.net | www.webmarcas.net';
    const cw = w.font.widthOfTextAtSize(contact, 7.5);
    p.drawText(contact, { x: (PAGE_W - cw) / 2, y: FOOTER_Y + FOOTER_H + 17, size: 7.5, font: w.font, color: MUTED });
    p.drawText('RESULTADO PRELIMINAR | CONSULTA TEXTUAL AO INPI', { x: MARGIN, y: FOOTER_Y + FOOTER_H + 5, size: 7, font: w.bold, color: ACCENT });
    const label = `Página ${i + 1} de ${pages.length}`;
    const lw = w.font.widthOfTextAtSize(label, 7.5);
    p.drawText(label, { x: PAGE_W - MARGIN - lw, y: FOOTER_Y + FOOTER_H + 5, size: 7.5, font: w.font, color: MUTED });
  });

  return await w.doc.save();
}
