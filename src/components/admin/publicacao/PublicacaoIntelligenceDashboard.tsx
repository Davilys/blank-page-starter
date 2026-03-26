import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO } from 'date-fns';
import { TrendingUp, Clock, AlertOctagon, CalendarClock } from 'lucide-react';
import type { Publicacao } from './types';

interface Props {
  publicacoes: Publicacao[];
}

export function PublicacaoIntelligenceDashboard({ publicacoes }: Props) {
  const metrics = useMemo(() => {
    const now = new Date();

    // Taxa de sucesso: deposited → deferred/certified
    const deposited = publicacoes.filter(p => ['deferimento', 'certificado', 'indeferimento', 'arquivado'].includes(p.status));
    const successful = deposited.filter(p => ['deferimento', 'certificado'].includes(p.status));
    const successRate = deposited.length > 0 ? Math.round((successful.length / deposited.length) * 100) : 0;

    // Tempo médio por etapa (deposit → publication)
    const withBothDates = publicacoes.filter(p => p.data_deposito && p.data_publicacao_rpi);
    const avgDepositToPub = withBothDates.length > 0
      ? Math.round(withBothDates.reduce((sum, p) => sum + differenceInDays(parseISO(p.data_publicacao_rpi!), parseISO(p.data_deposito!)), 0) / withBothDates.length)
      : null;

    // Publicações sem ação (stale > 30 days)
    const staleThreshold = 30;
    const stale = publicacoes.filter(p => {
      if (['certificado', 'arquivado', 'indeferimento'].includes(p.status)) return false;
      const lastDate = p.updated_at || p.created_at;
      return differenceInDays(now, parseISO(lastDate)) > staleThreshold;
    });

    // Próximos vencimentos
    const upcoming7 = publicacoes.filter(p => {
      if (!p.proximo_prazo_critico) return false;
      const d = differenceInDays(parseISO(p.proximo_prazo_critico), now);
      return d >= 0 && d <= 7;
    }).length;

    const upcoming15 = publicacoes.filter(p => {
      if (!p.proximo_prazo_critico) return false;
      const d = differenceInDays(parseISO(p.proximo_prazo_critico), now);
      return d > 7 && d <= 15;
    }).length;

    const upcoming30 = publicacoes.filter(p => {
      if (!p.proximo_prazo_critico) return false;
      const d = differenceInDays(parseISO(p.proximo_prazo_critico), now);
      return d > 15 && d <= 30;
    }).length;

    return { successRate, successful: successful.length, decided: deposited.length, avgDepositToPub, staleCount: stale.length, upcoming7, upcoming15, upcoming30 };
  }, [publicacoes]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
      {/* Taxa de Sucesso */}
      <Card className="border">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Taxa de Sucesso</p>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-foreground">{metrics.successRate}%</span>
            <span className="text-[10px] text-muted-foreground mb-1">{metrics.successful}/{metrics.decided}</span>
          </div>
          <Progress value={metrics.successRate} className="h-1.5 mt-2" />
        </CardContent>
      </Card>

      {/* Tempo Médio */}
      <Card className="border">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40">
              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Depósito → Pub.</p>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-foreground">{metrics.avgDepositToPub ?? '—'}</span>
            <span className="text-[10px] text-muted-foreground mb-1">dias (média)</span>
          </div>
        </CardContent>
      </Card>

      {/* Processos Parados */}
      <Card className={cn('border', metrics.staleCount > 0 && 'border-amber-400/50')}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40">
              <AlertOctagon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sem Ação 30d+</p>
          </div>
          <div className="flex items-end gap-2">
            <span className={cn('text-2xl font-bold', metrics.staleCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>{metrics.staleCount}</span>
            <span className="text-[10px] text-muted-foreground mb-1">processos parados</span>
          </div>
        </CardContent>
      </Card>

      {/* Vencimentos */}
      <Card className="border">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/40">
              <CalendarClock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Vencimentos</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="destructive" className="text-[10px]">7d: {metrics.upcoming7}</Badge>
            <Badge variant="secondary" className="text-[10px] border-amber-400/50 text-amber-700 dark:text-amber-400">15d: {metrics.upcoming15}</Badge>
            <Badge variant="outline" className="text-[10px]">30d: {metrics.upcoming30}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
