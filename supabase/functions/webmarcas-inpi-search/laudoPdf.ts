/**
 * Geração do laudo de viabilidade em PDF a partir dos dados da consulta exata
 * no portal público do INPI. Sem dados pessoais do visitante: apenas marca,
 * ramo informado e registros públicos do INPI.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1';

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
}

// Teto de linhas no PDF para limitar tempo/tamanho; o total real é sempre citado.
const MAX_ROWS_IN_PDF = 300;

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

const INK = rgb(0.13, 0.13, 0.16);
const MUTED = rgb(0.38, 0.38, 0.44);
const ACCENT = rgb(0.23, 0.35, 0.75);
const LINE = rgb(0.85, 0.85, 0.89);

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
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return clean(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}

class Writer {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  private constructor(doc: PDFDocument, page: PDFPage, font: PDFFont, bold: PDFFont) {
    this.doc = doc; this.page = page; this.font = font; this.bold = bold; this.y = PAGE_H - MARGIN;
  }
  static async create(): Promise<Writer> {
    const doc = await PDFDocument.create();
    doc.setTitle('Laudo de viabilidade');
    doc.setAuthor('WebMarcas');
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    return new Writer(doc, doc.addPage([PAGE_W, PAGE_H]), font, bold);
  }
  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }
  ensure(h: number) { if (this.y - h < MARGIN) this.newPage(); }
  text(t: string, size = 10, opts?: { bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number }) {
    const f = opts?.bold ? this.bold : this.font;
    const x = MARGIN + (opts?.indent ?? 0);
    this.page.drawText(t, { x, y: this.y - size, size, font: f, color: opts?.color ?? INK });
    this.y -= size + 4;
  }
  wrap(t: string, size = 10, opts?: { bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; lineGap?: number }) {
    const f = opts?.bold ? this.bold : this.font;
    const w = CONTENT_W - (opts?.indent ?? 0);
    const words = t.split(' ');
    let line = '';
    const lines: string[] = [];
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(trial, size) > w && line) { lines.push(line); line = word; } else { line = trial; }
    }
    if (line) lines.push(line);
    for (const ln of lines) {
      this.ensure(size + 4);
      this.text(ln, size, opts);
      this.y -= opts?.lineGap ?? 0;
    }
  }
  gap(h = 8) { this.y -= h; }
  rule() { this.ensure(6); this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 0.7, color: LINE }); this.y -= 8; }
}

export async function buildLaudoPdf(input: LaudoInput): Promise<Uint8Array> {
  const w = await Writer.create();

  // Cabeçalho
  w.text('WebMarcas', 16, { bold: true, color: ACCENT });
  w.text('Laudo de viabilidade — consulta preliminar de marca', 12, { bold: true });
  w.gap(4);
  w.rule();

  w.wrap(`Marca pesquisada: ${clean(input.brand)}`, 11, { bold: true });
  w.wrap(`Ramo de atividade informado: ${clean(input.activity)}`, 10);
  w.text(`Consulta realizada em: ${fmtDate(input.queriedAt)}`, 10);
  w.text(`Protocolo da consulta: ${clean(input.jobId)}`, 10);
  w.gap(6);

  w.text('Fonte e alcance', 11, { bold: true });
  w.wrap('Fonte: portal público de busca do INPI (servicos.busca.inpi.gov.br), pesquisa EXATA — encontra o nome exatamente como foi pesquisado, ignorando apenas maiúsculas/minúsculas e acentos (marcas compostas pesquisadas por inteiro correspondem). Não abrange variantes, plurais, nem nomes com termos adicionais, ausentes ou em ordem diferente.', 9.5, { color: MUTED });
  w.wrap(`A base consultada informa atualização em ${clean(input.baseUpdatedAt)}. Pedidos mais recentes podem não constar do resultado.`, 9.5, { color: MUTED });
  w.gap(6);

  // Resultado
  w.text('Resultado', 11, { bold: true });
  if (input.conclusion === 'requires_legal_review') {
    w.wrap(`Foram encontrados ${input.total} processo(s) com o mesmo nome na base consultada. Isso não significa que o registro é impossível: a análise jurídica avalia classe, atividade e grau de semelhança antes de qualquer protocolo.`, 10);
  } else {
    w.wrap('A busca exata não retornou processos com esse nome na base consultada. Pedidos muito recentes podem não constar. A análise final de colidência e classe é feita pela equipe WebMarcas antes do protocolo.', 10);
  }
  w.gap(4);

  if (input.records.length > 0) {
    const listed = input.records.slice(0, MAX_ROWS_IN_PDF);
    w.text(`Registros encontrados: ${input.total}`, 10, { bold: true });
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

  // Triagem por atividade: grupos, razões por processo e limitações (inclui a
  // fonte e a data da lista oficial de alto renome usada na verificação).
  w.gap(6);
  w.text('Análise por atividade (triagem preliminar)', 11, { bold: true });
  const analysis = input.activityAnalysis;
  if (!analysis) {
    w.wrap('A análise por atividade não foi executada nesta consulta. Isso não significa ausência de ocorrências: os registros acima e a conferência técnica da equipe WebMarcas permanecem necessários.', 9.5, { color: MUTED });
  } else {
    const labels: Record<string, string> = { related: 'Potencialmente relacionados', pending: 'Necessitam conferência', other: 'Outros segmentos' };
    w.wrap(clean(analysis.message), 10);
    w.text(`Potencialmente relacionados: ${analysis.counts.related} | Necessitam conferência: ${analysis.counts.pending} | Outros segmentos: ${analysis.counts.other}`, 9.5, { bold: true });
    w.text(`Classes de foco preliminar: ${analysis.focus_classes.length ? analysis.focus_classes.join(', ') : 'ramo a esclarecer'}.`, 9, { color: MUTED });
    const brandOf = new Map(input.records.map((r) => [r.process, r.brand]));
    for (const group of ['related', 'pending', 'other'] as const) {
      const items = analysis.items.filter((i) => i.group === group).slice(0, MAX_ROWS_IN_PDF);
      if (!items.length) continue;
      w.gap(3);
      w.text(`${labels[group]} (${items.length}${analysis.counts[group] > items.length ? ' de ' + analysis.counts[group] : ''})`, 10, { bold: true });
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

  w.gap(6);
  w.text('Avisos', 11, { bold: true });
  w.wrap('Consulta preliminar automatizada sobre base pública. Este documento não garante a disponibilidade nem o registro da marca e não substitui a análise técnica e jurídica da equipe WebMarcas, realizada antes do protocolo.', 9.5, { color: MUTED });

  return await w.doc.save();
}
