import { differenceInDays, parseISO, addDays, addYears, format, isAfter, subDays } from 'date-fns';
import type { Publicacao, PubStatus } from './types';

export function getDaysLeft(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return differenceInDays(parseISO(dateStr), new Date());
}

export function getUrgencyBadge(days: number | null) {
  if (days === null) return { label: '—', variant: 'outline' as const, className: '' };
  if (days < 0) return { label: `${Math.abs(days)}d atrasado`, variant: 'destructive' as const, className: 'animate-pulse' };
  if (days === 0) return { label: 'Vence hoje', variant: 'destructive' as const, className: '' };
  if (days <= 7) return { label: `${days}d restantes`, variant: 'destructive' as const, className: '' };
  if (days <= 30) return { label: `${days}d restantes`, variant: 'secondary' as const, className: 'border-amber-500/50 text-amber-700 dark:text-amber-400' };
  return { label: `${days}d restantes`, variant: 'outline' as const, className: 'text-emerald-700 dark:text-emerald-400' };
}

export function calcDeadlineFromDispatch(dispatchText: string | null, publicationDate: string | null): { days: number | null; desc: string; status?: PubStatus } | null {
  if (!publicationDate || !dispatchText) return null;
  const text = dispatchText.toLowerCase();
  if (text.includes('arquiv') || text.includes('art. 219')) return { days: null, desc: 'Processo encerrado' };
  if (text.includes('5 dias') || text.includes('cinco dias')) return { days: 5, desc: 'Exigência formal - 5 dias' };
  if (text.includes('oposição') || text.includes('oposicao')) return { days: 60, desc: 'Prazo para oposição' };
  if (text.includes('exigência') || text.includes('exigencia') || text.includes('cumpra')) return { days: 60, desc: 'Cumprimento de exigência' };
  if (text.includes('recurso')) return { days: 60, desc: 'Prazo para recurso' };
  if (text.includes('certificado de registro') || text.includes('concessao') || text.includes('concessão') || text.includes('registro concedido'))
    return { days: 3285, desc: 'Prazo para renovação ordinária (9 anos)', status: 'certificado' as PubStatus };
  if (text.includes('deferido') || text.includes('deferimento')) return { days: 60, desc: 'Pagamento de taxas (deferimento)' };
  if (text.includes('indeferido') || text.includes('indeferimento')) return { days: 60, desc: 'Prazo para recurso (indeferimento)' };
  return { days: 30, desc: 'Prazo padrão - 30 dias' };
}

export function calcAutoFields(pub: Partial<Publicacao>, dispatchText?: string | null): Partial<Publicacao> {
  const out = { ...pub };
  if (out.data_publicacao_rpi) {
    out.prazo_oposicao = format(addDays(parseISO(out.data_publicacao_rpi), 60), 'yyyy-MM-dd');
  }
  if (out.data_certificado) {
    out.data_renovacao = format(addYears(parseISO(out.data_certificado), 9), 'yyyy-MM-dd');
    out.descricao_prazo = 'Renovação ordinária - 9 anos (+ 6m ord. + 6m extra)';
  }
  if (!out.proximo_prazo_critico && out.data_publicacao_rpi && dispatchText) {
    const deadline = calcDeadlineFromDispatch(dispatchText, out.data_publicacao_rpi);
    if (deadline) {
      if (deadline.days !== null) out.proximo_prazo_critico = format(addDays(parseISO(out.data_publicacao_rpi), deadline.days), 'yyyy-MM-dd');
      out.descricao_prazo = deadline.desc;
    }
  }
  if (!out.proximo_prazo_critico && out.data_publicacao_rpi) {
    out.proximo_prazo_critico = format(addDays(parseISO(out.data_publicacao_rpi), 30), 'yyyy-MM-dd');
    if (!out.descricao_prazo) out.descricao_prazo = 'Prazo padrão - 30 dias';
  }
  const futureDates = [out.prazo_oposicao, out.data_renovacao, out.proximo_prazo_critico]
    .filter(Boolean)
    .map(d => parseISO(d!))
    .filter(d => isAfter(d, new Date()));
  if (futureDates.length > 0) {
    futureDates.sort((a, b) => a.getTime() - b.getTime());
    out.proximo_prazo_critico = format(futureDates[0], 'yyyy-MM-dd');
  }
  return out;
}

export function getScheduledAlerts(prazoCritico: string | null): { label: string; date: Date; days: number }[] {
  if (!prazoCritico) return [];
  const prazoDate = parseISO(prazoCritico);
  return [30, 15, 7].map(d => {
    const alertDate = subDays(prazoDate, d);
    return { label: `${d} dias antes`, date: alertDate, days: differenceInDays(alertDate, new Date()) };
  }).filter(a => a.days >= 0);
}

export function HighlightText({ text, search }: { text: string; search: string }) {
  if (!search || !text) return <>{text}</>;
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function normalizeBrand(name: string) {
  return name.replace(/<[^>]+>/g, '').trim().toUpperCase();
}

export const STAGE_MAP: Record<string, string> = {
  depositada: 'protocolado', publicada: 'protocolado', oposicao: 'oposicao',
  deferida: 'deferimento', certificada: 'certificados', indeferida: 'indeferimento',
  arquivada: 'distrato', renovacao_pendente: 'renovacao',
};
