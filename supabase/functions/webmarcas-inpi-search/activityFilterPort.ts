/**
 * PORT da triagem por atividade (ramo) — código recuperado da VPS
 * (webmarcas-inpi-api, /srv/app/activity_filter.py, wm-activity-filter-2026-09-17).
 * Mesma semântica conservadora: desconhecido vira "pending", nada é descartado
 * silenciosamente, "other" não é exclusão jurídica.
 *
 * REVISÃO portal-port-2026-10-29 — diferenças declaradas em relação ao original:
 *  1. Dados por processo vêm da resposta ESTRUTURADA do portal novo
 *     (specifications[].text + nice_class_code), não mais de scrape HTML.
 *  2. ALTO RENOME restaurado por duas vias: (a) match EXATO por número de
 *     processo contra snapshot datado da lista oficial do INPI (ver
 *     renomeSnapshot.ts: fonte, data 2026-10-20, sha256); (b) texto
 *     'alto renome' nas especificações/status (regra original mantida, com o
 *     escopo do texto limitado às especificações que o portal fornece).
 *     O snapshot não afirma vigência atual além da data da lista; antes de
 *     produção exige verificação de atualização no INPI e política de refresh.
 *  3. primary_classes virou PARÂMETRO EXPLÍCITO (o original derivava a classe
 *     principal da atividade via orientation.py PROFILES e usava classes[:1];
 *     primary_hits do fallback por classe não existe: a busca é sempre exata).
 * Não é a versão 2026-09-17: não reutilizar aquela string como se idêntica.
 */

export const ACTIVITY_FILTER_VERSION = 'wm-activity-filter-2026-09-17+portal-port-2026-10-29+renome-2026-10-20+fifa2027-2026-09-08';

const normal = (v: unknown): string =>
  String(v ?? '').normalize('NFKD').toLowerCase().replace(/[̀-ͯ]/g, '');

// Mapa verbatim do código em produção na VPS (não é regra inventada).
const SECTORS: Record<string, [string, number[]]> = {
  furniture: ['\\b(moveis|mobiliario|decoracao|estofados|cadeiras|mesas|armarios)\\b', [20, 21, 24, 27, 35, 40]],
  automotive_repair: ['\\b((consert\\w*|repar\\w*|manutenc\\w*|funilaria|lanternagem)\\b.{0,60}\\b(automoveis|automovel|automotiv\\w*|veiculos?|carros?)|(automoveis|automovel|automotiv\\w*|veiculos?|carros?)\\b.{0,60}\\b(consert\\w*|repar\\w*|manutenc\\w*|funilaria|lanternagem))\\b', [37]],
  food: ['\\b(cafe|cafeteria\\w*|aliment\\w*|restaurante\\w*|lanchonete\\w*|bebidas?|cerveja\\w*|vinhos?|padaria\\w*|panifica\\w*|confeitaria|paes|pao|bolos?|doces|chocolate\\w*|pipoca|gastronomia|refeicoes|carnes|leite|laticinios|acucar|sucos?|frutas?|cereais|graos|hortali\\w*)\\b', [29, 30, 31, 32, 33, 35, 40, 43]],
  fashion: ['\\b(roupas?|vestuario|confecc\\w*|calcados?|moda|bolsas?|couro|tecidos?|textil|joias|bijuterias)\\b', [14, 18, 22, 23, 24, 25, 26, 35, 40]],
  health: ['\\b(saude|medic\\w*|hospital\\w*|odontolog\\w*|dentista\\w*|farmac\\w*|fisioterap\\w*|psicolog\\w*|veterinari\\w*|racoes|petshop|animais)\\b', [3, 5, 10, 31, 35, 41, 42, 44]],
  beauty: ['\\b(cosmetic\\w*|perfumes?|perfumaria|beleza|estetica|barbearia|cabeleireir\\w*|maquiagem)\\b', [3, 5, 8, 10, 21, 35, 41, 44]],
  construction: ['\\b(construc\\w*|construtor\\w*|engenharia|arquitet\\w*|imobili\\w*|imoveis|obras|reformas|cimento|tijolos|concreto|ferragens)\\b', [6, 7, 8, 11, 17, 19, 20, 35, 36, 37, 40, 42]],
  technology: ['\\b(software|saas|tecnolog\\w*|informatica|programacao|computador\\w*|telecomunic\\w*|aplicativos?)\\b', [9, 35, 38, 41, 42]],
  education: ['\\b(educa\\w*|ensino|escola\\w*|cursos?|treinamento\\w*|livros?|publicac\\w*|editor\\w*|palestras?|universidade)\\b', [9, 16, 35, 38, 41, 42]],
  religion: ['\\b(religio\\w*|igreja\\w*|cultos?|evangel\\w*|espiritual|ministerio cristao)\\b', [9, 16, 35, 38, 41, 45]],
  entertainment: ['\\b(entretenimento|shows?|musica\\w*|banda|esport\\w*|ginastica|eventos|festas|lazer|recreac\\w*)\\b', [9, 16, 25, 28, 35, 38, 41, 43]],
  transport: ['\\b(transporte\\w*|transportadora\\w*|logistica|fretes?|entregas|armazenamento|viagens|turismo|hospedagem|hotel\\w*|pousada\\w*)\\b', [12, 35, 37, 39, 41, 42, 43]],
  finance: ['\\b(financeir\\w*|credito|bancari\\w*|bancos?|seguros?|investimento\\w*|monetari\\w*)\\b', [9, 35, 36, 41, 42]],
  legal: ['\\b(juridic\\w*|advocacia|advogad\\w*|registro de marcas|patentes)\\b', [35, 41, 42, 45]],
  agro: ['\\b(agric\\w*|agropecu\\w*|pecuaria|cultivo|sementes|fertilizantes|adubos|plantas|horticultura)\\b', [1, 5, 7, 29, 30, 31, 35, 40, 44]],
};

const SECTOR_RE: Record<string, RegExp> = Object.fromEntries(
  Object.entries(SECTORS).map(([k, [re]]) => [k, new RegExp(re, 'i')]),
);

function sectorsOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const [k, re] of Object.entries(SECTOR_RE)) if (re.test(text)) out.add(k);
  return out;
}

export interface ActivityProfile { tags: Set<string>; focus: Set<number> }

export function profile(activity: string): ActivityProfile {
  const text = normal(activity);
  const narrowRetail =
    /\b(loja|comercio|varej\w*|revenda)\b/.test(text) &&
    /\b(moveis|decoracao)\b/.test(text) &&
    /\b(?:de|produtos? de) terceiros\b/.test(text) &&
    /\bsem fabricacao(?: ou| e)?(?: marca propria)?\b|\bsem marca propria\b/.test(text) &&
    !/\b(talvez|pretendo|nao vendo|nao comercializo)\b/.test(text);
  if (narrowRetail) return { tags: new Set(['furniture']), focus: new Set(SECTORS.furniture[1]) };
  if (/\b(nao|sem|exceto|talvez|pretendo)\b/.test(text)) return { tags: new Set(), focus: new Set() };
  const tags = sectorsOf(text);
  const focus = new Set<number>();
  for (const t of tags) for (const c of SECTORS[t][1]) focus.add(c);
  return { tags, focus };
}

export function niceClasses(value: unknown): Set<number> {
  const str = String(value ?? '');
  let matches = [...str.matchAll(/NCL\s*\(\d+\)\s*(\d{1,2})(?!\d)/gi)].map((m) => m[1]);
  if (!matches.length && /^\s*\d{1,2}\s*$/.test(str)) matches = [str.trim()];
  return new Set(matches.map(Number).filter((n) => n >= 1 && n <= 45));
}

export interface SpecInput { nice: string; text: string }
export interface DetailInput { process: string; specifications: SpecInput[] }
export interface RecordInput { process: string; brand: string; status: string; nice: string | null }
export type Group = 'related' | 'pending' | 'other';

import { RENOME_PROCESSES, RENOME_SNAPSHOT, RENOME_FIFA2027_PROCESSES, RENOME_FIFA2027_SNAPSHOT } from './renomeSnapshot.ts';

// Renome: match exato por número de processo contra o snapshot oficial datado
// + texto 'alto renome' em status/especificações (regra original). O portal
// não expõe campo próprio (verificado 2026-10-29).
// Normalização de processo: somente dígitos, zero à esquerda até 9 posições
// (a lista oficial usa 9 dígitos com zeros à esquerda, ex. 001959204; o portal
// pode devolver sem preenchimento). Valores sem 1-9 dígitos não casam.
export function classify(record: RecordInput, detail: DetailInput | null, tags: Set<string>, focus: Set<number>): [Group, string] {
  if (!tags.size) return ['pending', 'Ramo insuficiente ou ambíguo para comparar produtos e serviços.'];
  if (!detail || detail.process !== record.process) return ['pending', 'Especificação oficial indisponível nesta consulta.'];
  const procNorm = (() => { const dgt = String(record.process ?? '').replace(/\D/g, ''); return dgt.length >= 1 && dgt.length <= 9 ? dgt.padStart(9, '0') : null; })();
  if (procNorm && RENOME_PROCESSES.has(procNorm)) {
    return ['pending', `Marca consta na lista oficial de alto renome do INPI (lista de ${RENOME_SNAPSHOT.listDate}); exige análise específica.`];
  }
  if (procNorm && RENOME_FIFA2027_PROCESSES.has(procNorm)) {
    return ['pending', `Marca consta na lista oficial de alto renome da Copa do Mundo Feminina da FIFA (Lei nº 15.421/2026, lista de ${RENOME_FIFA2027_SNAPSHOT.listDate}); exige análise específica.`];
  }
  if (/alto renome/i.test(record.status ?? '')) return ['pending', 'Há referência a alto renome; exige análise específica.'];
  const specs = detail.specifications ?? [];
  if (specs.some((sp) => /alto renome/i.test(sp.text ?? ''))) {
    return ['pending', 'Há referência a alto renome; exige análise específica.'];
  }
  if (!specs.length) return ['pending', 'Especificação oficial não identificada.'];
  const states: Group[] = [];
  for (const spec of specs) {
    const classes = niceClasses(spec.nice);
    const text = normal(spec.text);
    if (!classes.size || !text || /\b(nao|exceto|excluindo)\b/.test(text)) { states.push('pending'); continue; }
    const specTags = sectorsOf(text);
    let hit = false;
    for (const t of specTags) if (tags.has(t)) { hit = true; break; }
    if (hit) { states.push('related'); continue; }
    let inFocus = false;
    for (const c of classes) if (focus.has(c)) { inFocus = true; break; }
    if (inFocus) { states.push('pending'); continue; }
    states.push(specTags.size ? 'other' : 'pending');
  }
  if (states.includes('related')) return ['related', 'Especificação oficial contém produtos ou serviços do segmento informado; avaliar a semelhança das marcas.'];
  if (states.includes('pending')) return ['pending', 'A classe ou a especificação exige conferência de afinidade; não foi descartada.'];
  return ['other', 'Especificação identifica outro segmento e classes fora do foco preliminar. Não constitui exclusão jurídica de conflito.'];
}

const sameName = (a: string, b: string): boolean => {
  const n = (v: string) => normal(v).replace(/[^a-z0-9]/g, '');
  return Boolean(n(a)) && n(a) === n(b);
};

export interface TriageItem { process: string; group: Group; reason: string; specification: string | null }
export interface TriageResult {
  version: string; activity: string; focus_classes: number[];
  counts: Record<Group, number>; items: TriageItem[]; message: string; limitation: string;
}

export function triage(records: RecordInput[], activity: string, details: Map<string, DetailInput>, brand: string, primaryClasses: number[] = []): TriageResult {
  const { tags, focus } = profile(activity);
  const primary = new Set(primaryClasses);
  const items: TriageItem[] = [];
  for (const r of records) {
    const d = details.get(r.process) ?? null;
    let [group, reason] = classify(r, d, tags, focus);
    // Regra original: marca idêntica na classe principal da atividade → related.
    let inPrimary = false;
    for (const c of niceClasses(r.nice ?? '')) if (primary.has(c)) { inPrimary = true; break; }
    if (group === 'pending' && tags.size && brand && sameName(r.brand, brand) && inPrimary) {
      group = 'related';
      reason = 'Marca idêntica encontrada pelo INPI na classe principal da atividade informada; conferir especificação e situação antes do protocolo.';
    }
    items.push({
      process: r.process, group, reason,
      specification: d && d.specifications.length ? d.specifications.map((s) => s.text).join('; ') : null,
    });
  }
  const counts: Record<Group, number> = { related: 0, pending: 0, other: 0 };
  for (const i of items) counts[i.group]++;
  return {
    version: ACTIVITY_FILTER_VERSION,
    activity,
    focus_classes: [...focus].sort((a, b) => a - b),
    counts,
    items,
    message: counts.related
      ? 'Há ocorrências potencialmente relacionadas à atividade; precisam de análise técnica.'
      : counts.pending
        ? 'A análise por atividade tem pendências. Não é possível concluir ausência de ocorrências relevantes.'
        : 'Nenhuma ocorrência potencialmente conflitante foi identificada nesta triagem para a atividade informada.',
    limitation:
      'Triagem preliminar por especificação e classes relacionadas. Outros segmentos permanecem disponíveis. Não confirma disponibilidade nem substitui a análise de afinidade, semelhança, alto renome e demais requisitos antes do protocolo. ' +
      `Alto renome verificado por número de processo contra as listas oficiais do INPI: alto renome em vigência de ${RENOME_SNAPSHOT.listDate} (${RENOME_SNAPSHOT.count} processos; fonte ${RENOME_SNAPSHOT.sourceUrl}) e Copa do Mundo Feminina da FIFA de ${RENOME_FIFA2027_SNAPSHOT.listDate} (${RENOME_FIFA2027_SNAPSHOT.count} processos; ${RENOME_FIFA2027_SNAPSHOT.sourceUrl}). As listas refletem a vigência nas respectivas datas; não afirmam a vigência atual.`,
  };
}
