/** Normalização e comparação entre cadastro atual e dados encontrados. */
import type {
  ComparisonItem,
  CrmClientSnapshot,
  EnrichedData,
} from './types';

/** (11) 99999-9999 | 11999999999 | +55 11 99999-9999 → mesma chave. */
export const normalizePhone = (value?: string | null): string => {
  let digits = (value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  if (digits.length === 11 && digits[2] === '9') return digits;
  if (digits.length === 10) {
    // sem nono dígito — compara pelo DDD + 8 dígitos finais
    return digits;
  }
  return digits;
};

/** Considera iguais números que diferem apenas pelo nono dígito. */
export const samePhone = (a?: string | null, b?: string | null): boolean => {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const tail = (n: string) => n.slice(-8);
  const ddd = (n: string) => n.slice(0, 2);
  return ddd(na) === ddd(nb) && tail(na) === tail(nb);
};

export const normalizeEmail = (value?: string | null): string =>
  (value || '').trim().toLowerCase();

export const normalizeZip = (value?: string | null): string =>
  (value || '').replace(/\D/g, '');

export const normalizeText = (value?: string | null): string =>
  (value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const formatPhoneBR = (value?: string | null): string => {
  const d = normalizePhone(value);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value || '';
};

const EMPTY = '—';

interface FieldSpec {
  key: string;
  column: keyof CrmClientSnapshot;
  label: string;
  group: ComparisonItem['group'];
  found: keyof EnrichedData;
  compare?: (a: unknown, b: unknown) => boolean;
  display?: (v: unknown) => string;
}

const money = (v: unknown) =>
  typeof v === 'number'
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : String(v ?? '');

const dateBR = (v: unknown) => {
  const s = String(v ?? '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
};

const FIELD_SPECS: FieldSpec[] = [
  { key: 'company_name', column: 'company_name', label: 'Razão social', group: 'empresa', found: 'company_name' },
  { key: 'trade_name', column: 'trade_name', label: 'Nome fantasia', group: 'empresa', found: 'trade_name' },
  { key: 'registration_status', column: 'registration_status', label: 'Situação cadastral', group: 'empresa', found: 'registration_status' },
  { key: 'cnae', column: 'cnae', label: 'CNAE', group: 'empresa', found: 'cnae' },
  { key: 'opening_date', column: 'opening_date', label: 'Data de abertura', group: 'empresa', found: 'opening_date', display: dateBR },
  {
    key: 'share_capital',
    column: 'share_capital',
    label: 'Capital social',
    group: 'empresa',
    found: 'share_capital',
    compare: (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && Number(a) === Number(b),
    display: money,
  },
  { key: 'zip_code', column: 'zip_code', label: 'CEP', group: 'endereco', found: 'zip_code', compare: (a, b) => normalizeZip(a as string) === normalizeZip(b as string) },
  { key: 'address', column: 'address', label: 'Logradouro', group: 'endereco', found: 'address' },
  { key: 'address_number', column: 'address_number', label: 'Número', group: 'endereco', found: 'address_number' },
  { key: 'address_complement', column: 'address_complement', label: 'Complemento', group: 'endereco', found: 'address_complement' },
  { key: 'neighborhood', column: 'neighborhood', label: 'Bairro', group: 'endereco', found: 'neighborhood' },
  { key: 'city', column: 'city', label: 'Cidade', group: 'endereco', found: 'city' },
  { key: 'state', column: 'state', label: 'Estado', group: 'endereco', found: 'state' },
];

/** Monta a lista de comparações a partir do cadastro atual e dos dados encontrados. */
export const buildComparison = (
  current: CrmClientSnapshot,
  found: EnrichedData,
): ComparisonItem[] => {
  const items: ComparisonItem[] = [];

  for (const spec of FIELD_SPECS) {
    const foundRaw = found[spec.found] as unknown;
    if (foundRaw === undefined || foundRaw === null || foundRaw === '') continue;
    const currentRaw = current[spec.column] as unknown;
    const equal = spec.compare
      ? spec.compare(currentRaw, foundRaw)
      : normalizeText(String(currentRaw ?? '')) === normalizeText(String(foundRaw ?? ''));
    const hasCurrent = currentRaw !== null && currentRaw !== undefined && String(currentRaw) !== '';
    const display = spec.display ?? ((v: unknown) => String(v ?? ''));

    items.push({
      key: spec.key,
      column: spec.column,
      label: spec.label,
      group: spec.group,
      kind: 'field',
      currentValue: hasCurrent ? display(currentRaw) : EMPTY,
      foundValue: display(foundRaw),
      status: equal ? 'unchanged' : hasCurrent ? 'updated' : 'new',
      rawValue: (typeof foundRaw === 'number' ? foundRaw : String(foundRaw)) as string | number,
    });
  }

  // Telefones — comparados individualmente, nunca substituídos
  const currentPhones = [current.phone, ...(current.additional_phones || [])].filter(Boolean) as string[];
  (found.phones || []).forEach((p, idx) => {
    if (!normalizePhone(p)) return;
    const exists = currentPhones.some(cp => samePhone(cp, p));
    if (items.some(i => i.kind === 'phone' && samePhone(i.rawValue as string, p))) return;
    items.push({
      key: `phone_${idx}_${normalizePhone(p)}`,
      label: currentPhones.length ? 'Telefone adicional' : 'Telefone',
      group: 'contato',
      kind: 'phone',
      currentValue: currentPhones.length ? currentPhones.map(formatPhoneBR).join(', ') : EMPTY,
      foundValue: formatPhoneBR(p),
      status: exists ? 'unchanged' : currentPhones.length ? 'new' : 'new',
      rawValue: formatPhoneBR(p),
    });
  });

  // E-mails
  const currentEmails = [current.email, ...(current.additional_emails || [])].filter(Boolean) as string[];
  (found.emails || []).forEach((e, idx) => {
    const norm = normalizeEmail(e);
    if (!norm) return;
    const exists = currentEmails.some(ce => normalizeEmail(ce) === norm);
    if (items.some(i => i.kind === 'email' && normalizeEmail(i.rawValue as string) === norm)) return;
    items.push({
      key: `email_${idx}_${norm}`,
      label: currentEmails.length ? 'E-mail adicional' : 'E-mail',
      group: 'contato',
      kind: 'email',
      currentValue: currentEmails.length ? currentEmails.join(', ') : EMPTY,
      foundValue: norm,
      status: exists ? 'unchanged' : 'new',
      rawValue: norm,
    });
  });

  return items;
};
