/**
 * Documentos do dossiê de Recursos INPI — categorias, leitura e conversão.
 * Exclusivo do módulo Recursos INPI (modalidades indeferimento,
 * exigência de mérito e manifestação à oposição).
 *
 * Duas coisas distintas são registradas por documento:
 *  - EXTRAÇÃO   → o conteúdo foi interpretado para a análise da IA.
 *  - CONVERSÃO  → o documento foi transformado em páginas do PDF final.
 * Um não comprova o outro.
 */

export type CaseCategory =
  | 'documento_inpi'
  | 'provas_cliente'
  | 'procuracao'
  | 'guia_taxa'
  | 'comprovante_pagamento'
  | 'pedido_anterioridades'
  | 'complementares';

export interface CategoryDef {
  key: CaseCategory;
  label: string;
  /** Descrição por modalidade quando o papel do documento muda. */
  hint: Partial<Record<string, string>> & { default: string };
  required: boolean;
}

export const CASE_CATEGORIES: CategoryDef[] = [
  {
    key: 'documento_inpi',
    label: 'Documento principal do INPI',
    required: true,
    hint: {
      default: 'Peça oficial do INPI que motiva o trabalho.',
      indeferimento: 'Despacho de indeferimento publicado na RPI (parecer do examinador).',
      exigencia_merito: 'Publicação da exigência de mérito, com o texto integral do que foi exigido.',
      oposicao: 'Petição de oposição apresentada por terceiro e a publicação correspondente.',
    },
  },
  {
    key: 'provas_cliente',
    label: 'Provas do cliente',
    required: false,
    hint: {
      default:
        'Uso da marca, notas fiscais, materiais, redes sociais, site, contratos, registros de domínio.',
    },
  },
  {
    key: 'procuracao',
    label: 'Procuração e representação',
    required: false,
    hint: { default: 'Procuração assinada, contrato social ou documento do representante.' },
  },
  {
    key: 'guia_taxa',
    label: 'Guia (GRU) da taxa',
    required: false,
    hint: { default: 'Guia de recolhimento emitida para o serviço correspondente.' },
  },
  {
    key: 'comprovante_pagamento',
    label: 'Comprovante de pagamento',
    required: false,
    hint: { default: 'Comprovante bancário do pagamento da guia.' },
  },
  {
    key: 'pedido_anterioridades',
    label: 'Pedido, espelhos e anterioridades',
    required: false,
    hint: {
      default: 'Espelho do pedido no INPI e marcas anteriores citadas ou comparadas.',
    },
  },
  {
    key: 'complementares',
    label: 'Documentos complementares',
    required: false,
    hint: { default: 'Qualquer outro material que ajude na análise do caso.' },
  },
];

export const CATEGORY_LABEL: Record<CaseCategory, string> = CASE_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.key]: c.label }),
  {} as Record<CaseCategory, string>,
);

export const ACCEPTED_EXTENSIONS =
  '.pdf,.jpg,.jpeg,.png,.webp,.gif,.docx,.doc,.xlsx,.xls,.csv,.txt,.rtf';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * 'recebido' = arquivo chegou, mas nenhum conteúdo foi interpretado ainda
 * (é o caso de PDF só com imagem e de fotos: só a IA poderá ler).
 * 'parcial'  = parte das páginas foi interpretada, parte não.
 * 'lido'     = conteúdo interpretado e conferível.
 */
export type ExtractionStatus =
  | 'pendente'
  | 'lendo'
  | 'recebido'
  | 'parcial'
  | 'lido'
  | 'nativo' // legado: registros anteriores a esta versão
  | 'falha';

export type ConversionStatus = 'pendente' | 'convertido' | 'parcial' | 'falha';

export interface ExtractionResult {
  status: ExtractionStatus;
  text: string | null;
  notes: string | null;
  pageCount: number | null;
  interpretedPages: number | null;
  unreadablePages: number | null;
  sheetNames: string[] | null;
}

export function fileExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

export const isImageExt = (e: string) => ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(e);

/** SHA-256 do conteúdo — usado para idempotência e para o registro de versões. */
export async function sha256Hex(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  return sha256HexOfBuffer(buf);
}

export async function sha256HexOfBuffer(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256HexOfText(text: string): Promise<string> {
  return sha256HexOfBuffer(new TextEncoder().encode(text).buffer as ArrayBuffer);
}

/** Carrega o pdf.js com worker — mesma biblioteca já usada no projeto. */
export async function loadPdfJs() {
  const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerSrc = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  lib.GlobalWorkerOptions.workerSrc = workerSrc;
  return lib;
}

/**
 * Lê e converte o arquivo para texto quando o formato permite.
 * PDF é aberto de verdade: conta páginas e mede quantas têm texto
 * interpretável. Nenhum arquivo recebe "Lido" apenas por ter sido enviado.
 */
export async function extractContent(file: File): Promise<ExtractionResult> {
  const e = fileExtension(file.name);
  try {
    if (e === 'pdf') {
      const pdfjs = await loadPdfJs();
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await pdfjs.getDocument({ data: bytes }).promise;
      const parts: string[] = [];
      let interpreted = 0;
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const text = content.items
          .map((it: { str?: string }) => it.str || '')
          .join(' ')
          .trim();
        if (text.length > 40) {
          interpreted++;
          parts.push(`### Página ${p}\n${text}`);
        }
      }
      const unreadable = doc.numPages - interpreted;
      const status: ExtractionStatus =
        interpreted === 0 ? 'recebido' : unreadable > 0 ? 'parcial' : 'lido';
      const notes =
        interpreted === 0
          ? `PDF com ${doc.numPages} página(s) sem texto interpretável (provável digitalização). O conteúdo depende da leitura da IA.`
          : unreadable > 0
            ? `${interpreted} de ${doc.numPages} páginas interpretadas; ${unreadable} sem texto extraível.`
            : `${doc.numPages} página(s) interpretadas.`;
      return {
        status,
        text: parts.join('\n\n').slice(0, 200000) || null,
        notes,
        pageCount: doc.numPages,
        interpretedPages: interpreted,
        unreadablePages: unreadable,
        sheetNames: null,
      };
    }

    if (isImageExt(e)) {
      return {
        status: 'recebido',
        text: null,
        notes: 'Imagem enviada no formato original. O conteúdo só será conhecido após a leitura da IA.',
        pageCount: 1,
        interpretedPages: 0,
        unreadablePages: 1,
        sheetNames: null,
      };
    }

    if (e === 'txt' || e === 'csv' || e === 'rtf') {
      const text = await file.text();
      return {
        status: text.trim() ? 'lido' : 'falha',
        text: text.slice(0, 200000),
        notes: text.trim() ? 'Texto lido integralmente.' : 'Arquivo de texto vazio.',
        pageCount: null,
        interpretedPages: text.trim() ? 1 : 0,
        unreadablePages: text.trim() ? 0 : 1,
        sheetNames: null,
      };
    }

    if (e === 'docx') {
      const mammoth = await import('mammoth');
      const buf = await file.arrayBuffer();
      const res = await mammoth.extractRawText({ arrayBuffer: buf });
      const text = (res.value || '').trim();
      return {
        status: text ? 'lido' : 'falha',
        text: text.slice(0, 200000),
        notes: text ? 'Texto do Word lido.' : 'Não foi possível ler texto deste documento Word.',
        pageCount: null,
        interpretedPages: text ? 1 : 0,
        unreadablePages: text ? 0 : 1,
        sheetNames: null,
      };
    }

    if (e === 'xlsx' || e === 'xls') {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const parts: string[] = [];
      for (const name of wb.SheetNames) {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
        parts.push(`### Planilha: ${name}\n${csv}`);
      }
      const text = parts.join('\n\n').trim();
      return {
        status: text ? 'lido' : 'falha',
        text: text.slice(0, 200000),
        notes: text
          ? `${wb.SheetNames.length} aba(s) lida(s): ${wb.SheetNames.join(', ')}.`
          : 'Planilha sem conteúdo legível.',
        pageCount: null,
        interpretedPages: wb.SheetNames.length,
        unreadablePages: 0,
        sheetNames: wb.SheetNames,
      };
    }

    if (e === 'doc') {
      return {
        status: 'falha',
        text: null,
        notes:
          'Formato .doc antigo não é lido automaticamente. Salve como .docx ou PDF e envie novamente.',
        pageCount: null,
        interpretedPages: null,
        unreadablePages: null,
        sheetNames: null,
      };
    }

    return {
      status: 'falha',
      text: null,
      notes: `Formato .${e || 'desconhecido'} não suportado.`,
      pageCount: null,
      interpretedPages: null,
      unreadablePages: null,
      sheetNames: null,
    };
  } catch (err) {
    return {
      status: 'falha',
      text: null,
      notes: err instanceof Error ? err.message : 'Falha na leitura do arquivo.',
      pageCount: null,
      interpretedPages: null,
      unreadablePages: null,
      sheetNames: null,
    };
  }
}

export const EXTRACTION_LABEL: Record<ExtractionStatus, string> = {
  pendente: 'Recebido',
  lendo: 'Lendo',
  recebido: 'Recebido — leitura pela IA',
  parcial: 'Lido em parte',
  lido: 'Lido',
  nativo: 'Recebido — leitura pela IA',
  falha: 'Falha na leitura',
};

export const CONVERSION_LABEL: Record<ConversionStatus, string> = {
  pendente: 'Conversão pendente',
  convertido: 'Convertido para o PDF',
  parcial: 'Convertido em parte',
  falha: 'Falha na conversão',
};

/** Impressão digital do conjunto ativo de documentos. */
export function documentsFingerprint(docs: { sha256: string | null; id: string }[]): string {
  return docs
    .map((d) => d.sha256 || d.id)
    .sort()
    .join('|');
}
