// Serviço do despacho 003 (etapa de id estável '003'): e-mail e descrição da cobrança.
// O nome exibido da etapa vem sempre do cadastro central (Configurar Etapas — Jurídico).

export const DESPACHO_003_STAGE_ID = '003';

export const isDespacho003Stage = (stageId?: string | null) => stageId === DESPACHO_003_STAGE_ID;

export interface Despacho003Data {
  nomeEtapa: string;
  nomeCliente?: string | null;
  marca?: string | null;
  numeroProcesso?: string | null;
}

export function buildDespacho003InvoiceDescription(d: { marca: string; numeroProcesso: string }): string {
  return `Honorários de assessoria e acompanhamento da fase de publicação do despacho 003 — Marca ${d.marca.trim()} — Processo ${d.numeroProcesso.trim()}.`;
}

export function buildDespacho003Subject(d: { nomeEtapa: string; marca: string }): string {
  return `${d.nomeEtapa} — acompanhamento da marca ${d.marca.trim()}`;
}

/** Corpo com [VALOR_COBRANCA], [DATA_VENCIMENTO] e [LINK_BOLETO] a preencher com a cobrança efetiva. */
export function buildDespacho003EmailBody(d: Despacho003Data): string {
  return `Prezado(a) ${d.nomeCliente?.trim() || '[NOME_CLIENTE]'},

O pedido de registro da marca ${d.marca?.trim() || '[MARCA]'}, processo ${d.numeroProcesso?.trim() || '[NUMERO_PROCESSO]'}, foi publicado na Revista da Propriedade Industrial (RPI), no despacho 003, iniciando o período para apresentação de eventuais oposições de terceiros.

Nesta fase, a WebMarcas realiza o acompanhamento da publicação, o controle do prazo e o monitoramento de eventuais oposições, mantendo você informado sobre as movimentações e orientando sobre as providências cabíveis.

Conforme as condições contratadas, os honorários referentes ao acompanhamento desta etapa são de [VALOR_COBRANCA], com vencimento em [DATA_VENCIMENTO].

Acesse seu boleto: [LINK_BOLETO]

Para esclarecer dúvidas com nossa equipe jurídica, responda a este e-mail informando o melhor dia e horário.

Atenciosamente,
Equipe WebMarcas
www.webmarcas.net
WhatsApp: (11) 91112-0225`;
}

/** Campos essenciais ausentes antes de gerar a cobrança/enviar. */
export function missingDespacho003Fields(d: Despacho003Data & { email?: string | null; sendEmail?: boolean }): string[] {
  const missing: string[] = [];
  if (!d.nomeCliente?.trim()) missing.push('Nome do cliente');
  if (!d.marca?.trim()) missing.push('Marca');
  if (!d.numeroProcesso?.trim()) missing.push('Número do processo');
  if (d.sendEmail && !d.email?.trim()) missing.push('E-mail do cliente');
  return missing;
}

export const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatDateBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Preenche valor, vencimento e link com os dados efetivos da cobrança criada. Lança erro se faltar algum. */
export function fillDespacho003Charge(body: string, charge: { value?: number | null; dueDate?: string | null; link?: string | null }): string {
  const pend: string[] = [];
  if (!charge.value || charge.value <= 0) pend.push('valor da cobrança');
  const due = charge.dueDate ? formatDateBR(charge.dueDate) : '';
  if (!due) pend.push('vencimento');
  if (!charge.link) pend.push('link do boleto');
  if (pend.length) throw new Error(`Cobrança sem ${pend.join(', ')}. E-mail não enviado.`);
  const out = body
    .split('[VALOR_COBRANCA]').join(formatBRL(charge.value!))
    .split('[DATA_VENCIMENTO]').join(due)
    .split('[LINK_BOLETO]').join(charge.link!);
  const left = out.match(/\[[A-Z_]+\]/g);
  if (left) throw new Error(`Campos não preenchidos no e-mail: ${[...new Set(left)].join(', ')}`);
  return out;
}
