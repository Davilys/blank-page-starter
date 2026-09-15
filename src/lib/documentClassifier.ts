// Classificação automática de documentos pelo nome do arquivo.
// Mantém os mesmos tipos usados na aba Documentos do CRM.
export type DocType =
  | 'procuracao' | 'certificado' | 'rpi' | 'taxa' | 'parecer'
  | 'comprovante' | 'busca_inpi' | 'contrato' | 'outro';

const RULES: Array<{ type: DocType; terms: string[] }> = [
  { type: 'procuracao', terms: ['procura'] },
  { type: 'certificado', terms: ['certificado'] },
  { type: 'rpi', terms: ['rpi', 'revista'] },
  { type: 'taxa', terms: ['gru', 'taxa', 'darf', 'guia de recolh'] },
  { type: 'parecer', terms: ['deferimento', 'exig', 'merito', 'mérito', 'parecer', 'despacho', 'oposi', 'recurso', 'nulidade', 'arquivamento'] },
  { type: 'comprovante', terms: ['comprovante', 'boleto', 'nota fiscal', 'fatura', 'recibo', 'pagamento', 'asaas'] },
  { type: 'busca_inpi', terms: ['busca', 'inpi', 'protocolo'] },
  { type: 'contrato', terms: ['contrato', 'distrato'] },
];

export function classifyDocumentName(name: string | null | undefined): DocType {
  const n = (name || '').toLowerCase();
  if (!n) return 'outro';
  for (const rule of RULES) {
    if (rule.terms.some(t => n.includes(t))) return rule.type;
  }
  return 'outro';
}
