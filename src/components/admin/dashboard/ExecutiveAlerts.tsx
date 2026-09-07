import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import type { AlertLevel, ExecutiveAlert } from './lib/metrics';
import { BlockEmpty } from './DashboardStates';

const LEVEL_STYLE: Record<AlertLevel, { color: string; icon: typeof Info; label: string }> = {
  critical: { color: '#ef4444', icon: ShieldAlert, label: 'Crítico' },
  warning: { color: '#f97316', icon: AlertTriangle, label: 'Alerta' },
  attention: { color: '#eab308', icon: Info, label: 'Atenção' },
  positive: { color: '#10b981', icon: CheckCircle2, label: 'Positivo' },
};

const ORDER: AlertLevel[] = ['critical', 'warning', 'attention', 'positive'];

export function ExecutiveAlerts({ alerts, loading }: { alerts: ExecutiveAlert[]; loading?: boolean }) {
  const sorted = [...alerts].sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level));

  return (
    <Card className="border border-border/50 bg-card/60 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Atenção Executiva</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Alertas gerados a partir das condições reais da operação</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Avaliando condições…</p>
        ) : sorted.length === 0 ? (
          <BlockEmpty height={140} message="Nenhum alerta ativo" hint="Nenhuma condição de risco ou destaque foi identificada neste período." />
        ) : (
          <ul className="space-y-2">
            {sorted.map((alert, index) => {
              const style = LEVEL_STYLE[alert.level];
              const Icon = style.icon;
              return (
                <motion.li
                  key={alert.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-3 rounded-xl border px-3 py-2.5"
                  style={{ borderColor: `${style.color}33`, background: `${style.color}0f` }}
                >
                  <Icon className="h-4 w-4 shrink-0 mt-0.5" style={{ color: style.color }} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">{alert.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{alert.detail}</p>
                  </div>
                  <span
                    className="ml-auto shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ color: style.color, background: `${style.color}1a` }}
                  >
                    {style.label}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
