/**
 * Documentos do dossiê de Recursos INPI — categorias, leitura e conversão.
 * Exclusivo do módulo Recursos INPI (modalidades indeferimento,
 * exigência de mérito e manifestação à oposição).
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

export const ACCEPTED_EXTENSIONS =
  '.pdf,.jpg,.jpeg,.png,.webp,.gif,.docx,.doc,.xlsx,.xls,.csv,.txt,.rtf';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type ExtractionStatus = 'pendente' | 'lendo' | 'lido' | 'nativo' | 'falha';

export interface ExtractionResult {
  status: ExtractionStatus;
  text: string | null;
  notes: string | null;
  pageCount: number | null;
  sheetNames: string[] | null;
}

function ext(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

/** SHA-256 do conteúdo — usado para idempotência e para o registro de versões. */
export async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Lê e converte o arquivo para texto quando o formato permite.
 * PDF e imagens são marcados como 'nativo': seguem para o modelo no formato
 * original, sem conversão local.
 */
export async function extractContent(file: File): Promise<ExtractionResult> {
  const e = ext(file.name);
  try {
    if (['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif'].includes(e)) {
      return {
        status: 'nativo',
        text: null,
        notes: 'Arquivo enviado no formato original para leitura direta pela IA.',
        pageCount: null,
        sheetNames: null,
      };
    }

    if (e === 'txt' || e === 'csv' || e === 'rtf') {
      const text = await file.text();
      return {
        status: text.trim() ? 'lido' : 'falha',
        text: text.slice(0, 200000),
        notes: text.trim() ? null : 'Arquivo de texto vazio.',
        pageCount: null,
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
        notes: text ? null : 'Não foi possível ler texto deste documento Word.',
        pageCount: null,
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
        notes: text ? null : 'Planilha sem conteúdo legível.',
        pageCount: null,
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
        sheetNames: null,
      };
    }

    return {
      status: 'falha',
      text: null,
      notes: `Formato .${e || 'desconhecido'} não suportado.`,
      pageCount: null,
      sheetNames: null,
    };
  } catch (err) {
    return {
      status: 'falha',
      text: null,
      notes: err instanceof Error ? err.message : 'Falha na leitura do arquivo.',
      pageCount: null,
      sheetNames: null,
    };
  }
}

export const EXTRACTION_LABEL: Record<ExtractionStatus, string> = {
  pendente: 'Recebido',
  lendo: 'Lendo',
  lido: 'Lido',
  nativo: 'Recebido (leitura pela IA)',
  falha: 'Falha na leitura',
};

/** Impressão digital do conjunto ativo de documentos. */
export function documentsFingerprint(docs: { sha256: string | null; id: string }[]): string {
  return docs
    .map((d) => d.sha256 || d.id)
    .sort()
    .join('|');
}
