export type ContractPaymentMethod = 'avista' | 'cartao6x' | 'boleto3x';

export interface BotConversaContractInput {
  event_id: string;
  flow_name?: string;
  agent_name?: string;
  full_name: string;
  email: string;
  phone: string;
  cpf: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  brand_name: string;
  business_area: string;
  payment_method: ContractPaymentMethod;
  company_name?: string | null;
  cnpj?: string | null;
  custom_due_date?: string | null;
  suggested_classes?: number[];
}

export const digits = (value: string | null | undefined) => (value || '').replace(/\D/g, '');
export const normaliseText = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

export function isValidCpf(value: string): boolean {
  const cpf = digits(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const check = (base: string, factor: number) => {
    const sum = base.split('').reduce((total, digit, index) => total + Number(digit) * (factor - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return check(cpf.slice(0, 9), 10) === Number(cpf[9]) && check(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

export function isValidCnpj(value: string): boolean {
  const cnpj = digits(value);
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const check = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return check(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[12]) &&
    check(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[13]);
}

export function validateBotConversaContractInput(value: unknown): { data?: BotConversaContractInput; errors: string[] } {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const payment = normaliseText(raw.payment_method);
  const phoneFromContact = raw.phone ?? raw.contact_phone ?? raw.whatsapp ?? (raw.contact && typeof raw.contact === 'object' ? (raw.contact as Record<string, unknown>).phone : undefined);
  const data: BotConversaContractInput = {
    event_id: normaliseText(raw.event_id),
    flow_name: normaliseText(raw.flow_name) || undefined,
    agent_name: normaliseText(raw.agent_name) || undefined,
    full_name: normaliseText(raw.full_name),
    email: normaliseText(raw.email).toLowerCase(),
    // Phone is always supplied by the BotConversa contact context, never requested by Fernanda.
    phone: normaliseText(phoneFromContact),
    cpf: normaliseText(raw.cpf),
    address: normaliseText(raw.address),
    neighborhood: normaliseText(raw.neighborhood),
    city: normaliseText(raw.city),
    state: normaliseText(raw.state).toUpperCase(),
    cep: normaliseText(raw.cep),
    brand_name: normaliseText(raw.brand_name),
    business_area: normaliseText(raw.business_area),
    payment_method: payment as ContractPaymentMethod,
    company_name: normaliseText(raw.company_name) || null,
    cnpj: normaliseText(raw.cnpj) || null,
    custom_due_date: normaliseText(raw.custom_due_date) || null,
    suggested_classes: Array.isArray(raw.suggested_classes)
      ? raw.suggested_classes.filter((item): item is number => Number.isInteger(item) && item >= 1 && item <= 45)
      : undefined,
  };
  const errors: string[] = [];
  // BotConversa composes this stable key from contact fields. Formatting
  // characters are accepted because phone/CPF may arrive masked.
  if (!/^[^\u0000-\u001F\u007F]{8,500}$/u.test(data.event_id)) errors.push('event_id inválido');
  if (data.full_name.length < 3 || data.full_name.length > 160) errors.push('full_name inválido');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 254) errors.push('email inválido');
  if (!/^\d{10,11}$/.test(digits(data.phone))) errors.push('phone inválido');
  if (!isValidCpf(data.cpf)) errors.push('cpf inválido');
  if (!/^\d{8}$/.test(digits(data.cep))) errors.push('cep inválido');
  if (data.address.length < 5 || data.neighborhood.length < 2 || data.city.length < 2 || !/^[A-Z]{2}$/.test(data.state)) errors.push('endereço inválido');
  if (data.brand_name.length < 2 || data.brand_name.length > 120) errors.push('brand_name inválido');
  if (data.business_area.length < 3 || data.business_area.length > 240) errors.push('business_area inválido');
  if (!['avista', 'cartao6x', 'boleto3x'].includes(data.payment_method)) errors.push('payment_method inválido');
  if (data.cnpj && !isValidCnpj(data.cnpj)) errors.push('cnpj inválido');
  if (data.cnpj && !data.company_name) errors.push('company_name é obrigatório quando houver cnpj');
  if (data.custom_due_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.custom_due_date)) errors.push('custom_due_date inválido');
  return errors.length ? { errors } : { data, errors };
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] || char));
}

export function formatPtBrDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(date);
}

export function paymentDetails(paymentMethod: ContractPaymentMethod) {
  if (paymentMethod === 'avista') return '• Pagamento à vista via PIX: R$ 699,00 - com 43% de desconto.';
  if (paymentMethod === 'cartao6x') return '• Pagamento parcelado no Cartão de Crédito: 6x de R$ 199,00 = Total: R$ 1.194,00 - sem juros.';
  return '• Pagamento parcelado via Boleto Bancário: 3x de R$ 399,00 = Total: R$ 1.197,00.';
}

export function contractValue(paymentMethod: ContractPaymentMethod) {
  return paymentMethod === 'avista' ? 699 : paymentMethod === 'cartao6x' ? 1194 : 1197;
}

export function renderStandardContract(template: string, input: BotConversaContractInput, now = new Date()) {
  const address = `${input.address}, ${input.neighborhood}, ${input.city} - ${input.state}, CEP ${input.cep}`;
  const clientName = escapeHtml(input.full_name);
  const companyOrName = escapeHtml(input.company_name || input.full_name);
  const cnpjClause = input.cnpj ? `inscrita no CNPJ sob nº ${escapeHtml(input.cnpj)}, ` : '';
  const cpfOrCnpj = escapeHtml(input.cnpj || input.cpf);
  const values: Record<string, string> = {
    nome_cliente: clientName,
    cpf: escapeHtml(input.cpf),
    cpf_cnpj: cpfOrCnpj,
    email: escapeHtml(input.email),
    telefone: escapeHtml(input.phone),
    ramo_atividade: escapeHtml(input.business_area),
    endereco_completo: escapeHtml(address),
    endereco: escapeHtml(input.address),
    bairro: escapeHtml(input.neighborhood),
    cidade: escapeHtml(input.city),
    estado: escapeHtml(input.state),
    cep: escapeHtml(input.cep),
    razao_social_ou_nome: companyOrName,
    dados_cnpj: cnpjClause,
    forma_pagamento_detalhada: paymentDetails(input.payment_method),
    data_extenso: formatPtBrDate(now),
    data: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(now),
    marca: escapeHtml(input.brand_name),
  };
  return Object.entries(values).reduce((rendered, [key, replacement]) => rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), replacement), template);
}
