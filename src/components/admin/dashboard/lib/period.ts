// Período do Dashboard — funções puras, sem dependência de UI.

export type PeriodKey = 'hoje' | 'semana' | 'mes' | 'mes_passado' | 'ano' | 'total' | 'custom';

export interface DateRange {
  key: PeriodKey;
  /** início inclusivo; null = sem limite (acumulado) */
  start: Date | null;
  /** fim exclusivo; null = sem limite */
  end: Date | null;
  prevStart: Date | null;
  prevEnd: Date | null;
  label: string;
}

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mês' },
  { key: 'mes_passado', label: 'Mês passado' },
  { key: 'ano', label: 'Este ano' },
  { key: 'total', label: 'Acumulado' },
  { key: 'custom', label: 'Personalizado' },
];

const day = (y: number, m: number, d: number) => new Date(y, m, d, 0, 0, 0, 0);
const DAY_MS = 86400000;

export interface CustomRangeInput {
  from?: Date | null;
  to?: Date | null;
}

export function getRange(period: PeriodKey, custom?: CustomRangeInput, now = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case 'hoje': {
      const start = day(y, m, now.getDate());
      const end = new Date(start.getTime() + DAY_MS);
      return {
        key: period, start, end,
        prevStart: new Date(start.getTime() - DAY_MS), prevEnd: start,
        label: 'Hoje',
      };
    }
    case 'semana': {
      const start = day(y, m, now.getDate() - now.getDay());
      const end = new Date(start.getTime() + 7 * DAY_MS);
      return {
        key: period, start, end,
        prevStart: new Date(start.getTime() - 7 * DAY_MS), prevEnd: start,
        label: 'Esta semana',
      };
    }
    case 'mes_passado': {
      const start = day(y, m - 1, 1);
      const end = day(y, m, 1);
      return {
        key: period, start, end,
        prevStart: day(y, m - 2, 1), prevEnd: start,
        label: capitalize(start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })),
      };
    }
    case 'ano': {
      const start = day(y, 0, 1);
      const end = day(y + 1, 0, 1);
      return {
        key: period, start, end,
        prevStart: day(y - 1, 0, 1), prevEnd: start,
        label: `Ano de ${y}`,
      };
    }
    case 'total':
      return {
        key: period, start: null, end: null, prevStart: null, prevEnd: null,
        label: 'Acumulado histórico',
      };
    case 'custom': {
      const from = custom?.from ?? null;
      const to = custom?.to ?? null;
      if (!from) {
        // sem seleção ainda — comporta-se como mês atual
        return { ...getRange('mes', undefined, now), key: 'custom', label: 'Selecione as datas' };
      }
      const start = day(from.getFullYear(), from.getMonth(), from.getDate());
      const endBase = to ?? from;
      const end = new Date(day(endBase.getFullYear(), endBase.getMonth(), endBase.getDate()).getTime() + DAY_MS);
      const span = end.getTime() - start.getTime();
      return {
        key: period, start, end,
        prevStart: new Date(start.getTime() - span), prevEnd: start,
        label: `${start.toLocaleDateString('pt-BR')} — ${new Date(end.getTime() - DAY_MS).toLocaleDateString('pt-BR')}`,
      };
    }
    case 'mes':
    default: {
      const start = day(y, m, 1);
      const end = day(y, m + 1, 1);
      return {
        key: 'mes', start, end,
        prevStart: day(y, m - 1, 1), prevEnd: start,
        label: capitalize(start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })),
      };
    }
  }
}

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** true quando o intervalo cobre toda a base (acumulado) */
export function isAllTime(range: DateRange) {
  return range.start === null && range.end === null;
}

export function inRange(value: string | Date | null | undefined, range: { start: Date | null; end: Date | null }) {
  if (!value) return false;
  if (!range.start && !range.end) return true;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  if (range.start && d < range.start) return false;
  if (range.end && d >= range.end) return false;
  return true;
}
