/**
 * Leitor estrutural e incremental do XML de Marcas da RPI (INPI).
 *
 * - Não carrega o XML inteiro em memória: o chamador empurra pedaços de texto
 *   no scanner, que devolve um bloco <processo> completo por vez.
 * - A extração dos campos é estrutural (elementos + atributos + hierarquia),
 *   nunca por regex genérica sobre o texto bruto.
 */

// ───────────────────────── utilidades de texto ─────────────────────────

export function normalizeText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

export function decodeEntities(input: string): string {
  if (!input || input.indexOf('&') === -1) return input;
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, code: string) => {
    if (code[0] === '#') {
      const num = code[1] === 'x' || code[1] === 'X'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : full;
    }
    const mapped = ENTITIES[code.toLowerCase()];
    return mapped !== undefined ? mapped : full;
  });
}

export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const br = v.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

// ───────────────────────── scanner incremental ─────────────────────────

/**
 * Acumula texto e devolve blocos <processo ...> ... </processo> completos,
 * descartando imediatamente o que já foi consumido.
 */
export class ProcessBlockScanner {
  private buffer = '';
  private readonly openTag = '<processo';
  private readonly closeTag = '</processo>';

  push(chunk: string): string[] {
    this.buffer += chunk;
    return this.drain();
  }

  flush(): string[] {
    const out = this.drain();
    this.buffer = '';
    return out;
  }

  private drain(): string[] {
    const blocks: string[] = [];
    for (;;) {
      const start = this.buffer.indexOf(this.openTag);
      if (start === -1) {
        // nada em aberto: mantém apenas uma cauda mínima para tags partidas
        if (this.buffer.length > this.openTag.length) {
          this.buffer = this.buffer.slice(-this.openTag.length);
        }
        break;
      }
      const end = this.buffer.indexOf(this.closeTag, start);
      if (end === -1) {
        if (start > 0) this.buffer = this.buffer.slice(start);
        break;
      }
      const endIdx = end + this.closeTag.length;
      blocks.push(this.buffer.slice(start, endIdx));
      this.buffer = this.buffer.slice(endIdx);
    }
    return blocks;
  }
}

// ───────────────────────── parser estrutural ─────────────────────────

export interface XmlNode {
  name: string;          // nome normalizado (minúsculo)
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;          // texto direto do elemento (já sem entidades)
  parent?: XmlNode;
}

/** Converte um bloco XML pequeno (um <processo>) em árvore. */
export function parseXmlBlock(xml: string): XmlNode | null {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  let i = 0;
  const len = xml.length;

  while (i < len) {
    const lt = xml.indexOf('<', i);
    if (lt === -1) {
      appendText(stack[stack.length - 1], xml.slice(i));
      break;
    }
    if (lt > i) appendText(stack[stack.length - 1], xml.slice(i, lt));

    if (xml.startsWith('<!--', lt)) {
      const close = xml.indexOf('-->', lt);
      i = close === -1 ? len : close + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      const close = xml.indexOf(']]>', lt);
      const content = xml.slice(lt + 9, close === -1 ? len : close);
      const node = stack[stack.length - 1];
      node.text += content;
      i = close === -1 ? len : close + 3;
      continue;
    }
    if (xml.startsWith('<?', lt) || xml.startsWith('<!', lt)) {
      const close = xml.indexOf('>', lt);
      i = close === -1 ? len : close + 1;
      continue;
    }

    const gt = findTagEnd(xml, lt);
    if (gt === -1) break;
    const raw = xml.slice(lt + 1, gt).trim();

    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim().toLowerCase();
      for (let s = stack.length - 1; s > 0; s--) {
        if (stack[s].name === name) {
          stack.length = s;
          break;
        }
      }
      i = gt + 1;
      continue;
    }

    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const nameMatch = body.match(/^([^\s/>]+)/);
    if (!nameMatch) { i = gt + 1; continue; }

    const node: XmlNode = {
      name: nameMatch[1].toLowerCase(),
      attrs: parseAttributes(body.slice(nameMatch[1].length)),
      children: [],
      text: '',
      parent: stack[stack.length - 1],
    };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
    i = gt + 1;
  }

  return root.children[0] ?? null;
}

function appendText(node: XmlNode, raw: string) {
  const t = decodeEntities(raw);
  if (t.trim()) node.text += (node.text ? ' ' : '') + t.trim();
}

/** Encontra o '>' que fecha a tag, ignorando '>' dentro de aspas. */
function findTagEnd(xml: string, from: number): number {
  let quote: string | null = null;
  for (let i = from + 1; i < xml.length; i++) {
    const c = xml[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      return i;
    }
  }
  return -1;
}

function parseAttributes(src: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? '');
  }
  return attrs;
}

// ───────────────────────── acesso tolerante a nomes ─────────────────────────

const canon = (s: string) => normalizeText(s).replace(/[^a-z0-9]/g, '');

export function childrenNamed(node: XmlNode, ...names: string[]): XmlNode[] {
  const wanted = names.map(canon);
  return node.children.filter((c) => wanted.includes(canon(c.name)));
}

export function descendantsNamed(node: XmlNode, ...names: string[]): XmlNode[] {
  const wanted = names.map(canon);
  const out: XmlNode[] = [];
  const walk = (n: XmlNode) => {
    for (const c of n.children) {
      if (wanted.includes(canon(c.name))) out.push(c);
      walk(c);
    }
  };
  walk(node);
  return out;
}

export function attr(node: XmlNode | undefined, ...names: string[]): string | null {
  if (!node) return null;
  const wanted = names.map(canon);
  for (const [k, v] of Object.entries(node.attrs)) {
    if (wanted.includes(canon(k)) && v.trim()) return v.trim();
  }
  return null;
}

export function textOf(node: XmlNode | undefined): string | null {
  if (!node) return null;
  const parts: string[] = [];
  const walk = (n: XmlNode) => {
    if (n.text.trim()) parts.push(n.text.trim());
    n.children.forEach(walk);
  };
  walk(node);
  const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
  return joined || null;
}

function pathOf(node: XmlNode): string {
  const parts: string[] = [];
  let cur: XmlNode | undefined = node;
  while (cur && cur.name !== '#root') {
    parts.unshift(cur.name);
    cur = cur.parent;
  }
  return parts.join('.');
}

// ───────────────────────── ocorrências do procurador ─────────────────────────

export type RelationType =
  | 'procurador_principal'
  | 'procurador_protocolo'
  | 'procurador_nomeado'
  | 'procurador_destituido'
  | 'procurador_substituido'
  | 'mencao_texto_complementar'
  | 'outra_mencao';

export interface Occurrence {
  order: number;
  field_path: string;
  relation: RelationType;
  matched_text: string;
  context: string;
  protocol_number: string | null;
  dispatch_code: string | null;
  source: 'atributo' | 'texto';
}

const RELATION_PRIORITY: RelationType[] = [
  'procurador_destituido',
  'procurador_substituido',
  'procurador_nomeado',
  'procurador_protocolo',
  'procurador_principal',
  'mencao_texto_complementar',
  'outra_mencao',
];

const DESTITUICAO_RE = /(destitui|destitu[ií]d|renuncia|revoga[cç][aã]o de procura|exclus[aã]o de procurador)/;
const NOMEACAO_RE = /(nomead|nomea[cç][aã]o|constitui[cç][aã]o de procurador|passa a ser representad|inclus[aã]o de procurador|novo procurador)/;
const SUBSTITUICAO_RE = /(substitui[cç][aã]o de procurador|substitu[ií]d|altera[cç][aã]o de procurador|transfer[eê]ncia de procura)/;

function ancestorNamed(node: XmlNode, ...names: string[]): XmlNode | null {
  const wanted = names.map(canon);
  let cur: XmlNode | undefined = node.parent;
  while (cur) {
    if (wanted.includes(canon(cur.name))) return cur;
    cur = cur.parent;
  }
  return null;
}

function classifyOccurrence(node: XmlNode, context: string): RelationType {
  const path = canon(pathOf(node));
  const ctx = normalizeText(context);
  const isProcuradorNode = canon(node.name).includes('procurador');
  const inProtocolo = !!ancestorNamed(node, 'protocolo', 'protocolos', 'peticao', 'peticoes');
  const inTextoComplementar = !!ancestorNamed(node, 'texto-complementar', 'textocomplementar', 'complemento')
    || path.includes('textocomplementar');

  if (DESTITUICAO_RE.test(ctx)) return 'procurador_destituido';
  if (SUBSTITUICAO_RE.test(ctx)) return 'procurador_substituido';
  if (NOMEACAO_RE.test(ctx)) return 'procurador_nomeado';
  if (isProcuradorNode && inProtocolo) return 'procurador_protocolo';
  if (isProcuradorNode) return 'procurador_principal';
  if (inTextoComplementar) return 'mencao_texto_complementar';
  return 'outra_mencao';
}

function contextAround(haystack: string, needle: string, radius = 220): string {
  const idx = normalizeText(haystack).indexOf(normalizeText(needle));
  if (idx === -1) return haystack.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  return haystack.slice(start, Math.min(haystack.length, idx + needle.length + radius)).replace(/\s+/g, ' ').trim();
}

// ───────────────────────── processo extraído ─────────────────────────

export interface ParsedProcess {
  processNumber: string;
  brandName: string | null;
  apresentacao: string | null;
  natureza: string | null;
  depositDate: string | null;
  concessionDate: string | null;
  validityDate: string | null;
  apostila: string | null;
  holders: Array<{ name: string; pais?: string | null; uf?: string | null; ordem: number }>;
  requerentes: Array<{ name: string; pais?: string | null; uf?: string | null; ordem: number }>;
  procuradores: Array<{ name: string; ordem: number; escopo: string }>;
  dispatches: Array<{
    ordem: number;
    codigo: string | null;
    nome: string | null;
    texto_complementar: string | null;
    protocolos: Array<{ numero: string | null; data: string | null; procurador: string | null; requerente: string | null }>;
  }>;
  protocols: Array<{ numero: string | null; data: string | null; procurador: string | null; despacho: string | null }>;
  nclClasses: string[];
  nclSpecifications: Array<{ classe: string | null; status: string | null; especificacao: string | null }>;
  viennaClasses: Array<{ codigo: string | null; descricao: string | null }>;
  occurrences: Occurrence[];
  relationTypes: RelationType[];
  relationPrimary: RelationType | null;
  relationConfidence: number;
  isDestituicao: boolean;
  isNomeacao: boolean;
  isSubstituicao: boolean;
  procuradorAnterior: string | null;
  procuradorNovo: string | null;
  primaryDispatchCode: string | null;
  primaryDispatchName: string | null;
  primaryDispatchText: string | null;
}

/**
 * Interpreta um bloco <processo>. Devolve null quando o nome monitorado
 * não aparece em nenhum campo do bloco.
 */
export function parseProcessBlock(
  block: string,
  monitoredTerms: string[],
  monitoredFullName: string,
): ParsedProcess | null {
  const normalizedBlock = normalizeText(block);
  if (!monitoredTerms.some((t) => normalizedBlock.includes(normalizeText(t)))) return null;

  const root = parseXmlBlock(block);
  if (!root) return null;

  const processNumber = (attr(root, 'numero', 'numero-processo', 'nroprocesso') || '').replace(/\D/g, '');
  if (!processNumber) return null;

  // ── ocorrências ───────────────────────────────────────────────
  const occurrences: Occurrence[] = [];
  let order = 0;
  const matches = (value: string) => {
    const n = normalizeText(value);
    return monitoredTerms.some((t) => n.includes(normalizeText(t)));
  };

  const walk = (node: XmlNode) => {
    const protocolo = ancestorNamed(node, 'protocolo', 'peticao');
    const despacho = ancestorNamed(node, 'despacho');
    const protocolNumber = attr(protocolo ?? undefined, 'numero', 'numero-protocolo');
    const dispatchCode = attr(despacho ?? undefined, 'codigo', 'cod-despacho');

    for (const [k, v] of Object.entries(node.attrs)) {
      if (v && matches(v)) {
        const ctxBase = textOf(node.parent ?? node) || v;
        occurrences.push({
          order: ++order,
          field_path: `${pathOf(node)}@${k}`,
          relation: classifyOccurrence(node, `${ctxBase} ${textOf(despacho ?? undefined) || ''}`),
          matched_text: v.slice(0, 200),
          context: contextAround(`${ctxBase} ${textOf(despacho ?? undefined) || ''}`, v),
          protocol_number: protocolNumber,
          dispatch_code: dispatchCode,
          source: 'atributo',
        });
      }
    }
    if (node.text && matches(node.text)) {
      occurrences.push({
        order: ++order,
        field_path: pathOf(node),
        relation: classifyOccurrence(node, node.text),
        matched_text: monitoredFullName,
        context: contextAround(node.text, monitoredTerms[0]),
        protocol_number: protocolNumber,
        dispatch_code: dispatchCode,
        source: 'texto',
      });
    }
    node.children.forEach(walk);
  };
  walk(root);

  if (occurrences.length === 0) return null;

  const relationTypes = Array.from(new Set(occurrences.map((o) => o.relation)));
  const relationPrimary = RELATION_PRIORITY.find((r) => relationTypes.includes(r)) ?? 'outra_mencao';
  const isDestituicao = relationTypes.includes('procurador_destituido');
  const isSubstituicao = relationTypes.includes('procurador_substituido');
  const isNomeacao = relationTypes.includes('procurador_nomeado');

  // ── dados estruturais ────────────────────────────────────────
  const marcaNode = childrenNamed(root, 'marca')[0] ?? descendantsNamed(root, 'marca')[0];
  const brandName =
    attr(marcaNode, 'nome') ||
    textOf(childrenNamed(marcaNode ?? root, 'nome')[0]) ||
    textOf(descendantsNamed(root, 'denominacao')[0]) ||
    null;
  const apresentacao =
    attr(marcaNode, 'apresentacao') || textOf(descendantsNamed(root, 'apresentacao')[0]);
  const natureza =
    attr(marcaNode, 'natureza') || attr(root, 'natureza') || textOf(descendantsNamed(root, 'natureza')[0]);

  const holders = descendantsNamed(root, 'titular').map((n, idx) => ({
    name: attr(n, 'nome-razao-social', 'nome', 'razao-social') || textOf(n) || '',
    pais: attr(n, 'pais'),
    uf: attr(n, 'uf'),
    ordem: idx + 1,
  })).filter((h) => h.name);

  const requerentes = descendantsNamed(root, 'requerente', 'depositante').map((n, idx) => ({
    name: attr(n, 'nome-razao-social', 'nome', 'razao-social') || textOf(n) || '',
    pais: attr(n, 'pais'),
    uf: attr(n, 'uf'),
    ordem: idx + 1,
  })).filter((r) => r.name);

  const procuradores = descendantsNamed(root, 'procurador').map((n, idx) => ({
    name: attr(n, 'nome-razao-social', 'nome') || textOf(n) || '',
    ordem: idx + 1,
    escopo: ancestorNamed(n, 'protocolo', 'peticao') ? 'protocolo' : 'processo',
  })).filter((p) => p.name);

  const dispatchNodes = descendantsNamed(root, 'despacho');
  const dispatches = dispatchNodes.map((d, idx) => {
    const protocolos = descendantsNamed(d, 'protocolo', 'peticao').map((p) => ({
      numero: attr(p, 'numero', 'numero-protocolo'),
      data: toIsoDate(attr(p, 'data', 'data-protocolo')),
      procurador: attr(descendantsNamed(p, 'procurador')[0], 'nome-razao-social', 'nome')
        || textOf(descendantsNamed(p, 'procurador')[0]),
      requerente: attr(descendantsNamed(p, 'requerente', 'titular')[0], 'nome-razao-social', 'nome')
        || textOf(descendantsNamed(p, 'requerente', 'titular')[0]),
    }));
    return {
      ordem: idx + 1,
      codigo: attr(d, 'codigo', 'cod-despacho'),
      nome: attr(d, 'nome', 'descricao'),
      texto_complementar: textOf(childrenNamed(d, 'texto-complementar', 'textocomplementar')[0]),
      protocolos,
    };
  });

  const protocols = dispatches.flatMap((d) =>
    d.protocolos.map((p) => ({ numero: p.numero, data: p.data, procurador: p.procurador, despacho: d.codigo })),
  );

  const nclNodes = descendantsNamed(root, 'classe-nice', 'classenice');
  const nclSpecifications = nclNodes.map((n) => ({
    classe: attr(n, 'codigo', 'classe'),
    status: attr(n, 'status', 'status-classe'),
    especificacao: textOf(childrenNamed(n, 'especificacao')[0]) || textOf(n),
  }));
  const nclClasses = Array.from(new Set(nclSpecifications.map((s) => s.classe).filter(Boolean) as string[]));

  const viennaClasses = descendantsNamed(root, 'classe-vienna', 'classevienna', 'classe-viena').map((n) => ({
    codigo: attr(n, 'codigo'),
    descricao: textOf(n),
  }));

  const apostila = textOf(descendantsNamed(root, 'apostila')[0]);

  const primary = dispatches[0] ?? null;

  // ── procurador anterior / novo em movimentações ──────────────
  let procuradorAnterior: string | null = null;
  let procuradorNovo: string | null = null;
  if (isDestituicao || isNomeacao || isSubstituicao) {
    const movText = occurrences
      .filter((o) => ['procurador_destituido', 'procurador_nomeado', 'procurador_substituido'].includes(o.relation))
      .map((o) => o.context)
      .join(' ');
    if (isDestituicao) procuradorAnterior = monitoredFullName;
    const nomeados = procuradores
      .map((p) => p.name)
      .filter((n) => !matches(n));
    if (nomeados.length === 1) procuradorNovo = nomeados[0];
    else if (nomeados.length > 1 && NOMEACAO_RE.test(normalizeText(movText))) procuradorNovo = nomeados[0];
  }

  const relationConfidence = (() => {
    if (relationPrimary === 'procurador_principal' || relationPrimary === 'procurador_protocolo') return 0.95;
    if (isDestituicao || isNomeacao || isSubstituicao) return 0.7;
    return 0.5;
  })();

  return {
    processNumber,
    brandName: brandName ? brandName.replace(/\s+/g, ' ').trim() : null,
    apresentacao,
    natureza,
    depositDate: toIsoDate(attr(root, 'data-deposito', 'datadeposito')),
    concessionDate: toIsoDate(attr(root, 'data-concessao', 'dataconcessao')),
    validityDate: toIsoDate(attr(root, 'data-vigencia', 'datavigencia', 'vigencia')),
    apostila,
    holders,
    requerentes,
    procuradores,
    dispatches,
    protocols,
    nclClasses,
    nclSpecifications,
    viennaClasses,
    occurrences,
    relationTypes: occurrences.length > 1 ? relationTypes : relationTypes,
    relationPrimary,
    relationConfidence,
    isDestituicao,
    isNomeacao,
    isSubstituicao,
    procuradorAnterior,
    procuradorNovo,
    primaryDispatchCode: primary?.codigo ?? null,
    primaryDispatchName: primary?.nome ?? null,
    primaryDispatchText: primary?.texto_complementar ?? null,
  };
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
