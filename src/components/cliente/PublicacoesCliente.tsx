import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Newspaper, CheckCircle2, Clock, AlertTriangle, FileText, Gavel, Shield, Award, RefreshCw } from 'lucide-react';
import { format, parseISO, differenceInDays, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  '003': { label: '003', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/40' },
  oposicao: { label: 'Oposição', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40' },
  exigencia_merito: { label: 'Exigência de Mérito', color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/40' },
  indeferimento: { label: 'Indeferimento', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40' },
  deferimento: { label: 'Deferimento', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  certificado: { label: 'Certificado', color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/40' },
  renovacao: { label: 'Renovação', color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/40' },
  arquivado: { label: 'Arquivado', color: 'text-zinc-700 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-900/40' },
};

const TIMELINE_STEPS = [
  { key: 'data_deposito', label: 'Depósito', icon: FileText },
  { key: 'data_publicacao_rpi', label: 'Publicação RPI', icon: Newspaper },
  { key: 'prazo_oposicao', label: 'Prazo Oposição', icon: Gavel },
  { key: 'data_decisao', label: 'Decisão', icon: Shield },
  { key: 'data_certificado', label: 'Certificado', icon: Award },
  { key: 'data_renovacao', label: 'Renovação', icon: RefreshCw },
] as const;

interface Props {
  userId?: string;
}

export function PublicacoesCliente({ userId }: Props) {
  const { data: publicacoes = [], isLoading } = useQuery({
    queryKey: ['publicacoes-cliente', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('publicacoes_marcas')
        .select('*')
        .eq('client_id', userId)
        .order('proximo_prazo_critico', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: processes = [] } = useQuery({
    queryKey: ['brand-processes-cliente-pub', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('brand_processes')
        .select('id, brand_name, process_number')
        .eq('user_id', userId);
      if (error) return [];
      return data || [];
    },
    enabled: !!userId,
  });

  const processMap = new Map(processes.map(p => [p.id, p]));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  if (publicacoes.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          Publicações de Marcas
          <Badge variant="secondary" className="ml-auto">{publicacoes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {publicacoes.map(pub => {
          const proc = processMap.get(pub.process_id);
          const stCfg = STATUS_CONFIG[pub.status] || STATUS_CONFIG.depositada;
          const days = pub.proximo_prazo_critico ? differenceInDays(parseISO(pub.proximo_prazo_critico), new Date()) : null;

          return (
            <div key={pub.id} className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold">{proc?.brand_name || 'Marca'}</p>
                  <p className="text-xs text-muted-foreground">{proc?.process_number || ''}</p>
                </div>
                <span className={cn('text-xs font-semibold px-3 py-1 rounded-full', stCfg.bg, stCfg.color)}>
                  {stCfg.label}
                </span>
              </div>

              {days !== null && (
                <div className={cn('flex items-center gap-2 text-sm',
                  days < 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-muted-foreground'
                )}>
                  {days < 0 ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  {days < 0 ? `Prazo atrasado por ${Math.abs(days)} dias` : `Próximo prazo em ${days} dias`}
                </div>
              )}

              {/* Mini timeline */}
              <div className="flex items-center gap-1">
                {TIMELINE_STEPS.map((step, i) => {
                  const date = (pub as any)[step.key] as string | null;
                  const completed = !!date && isBefore(parseISO(date), new Date());
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className="flex items-center">
                      <div
                        className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center border',
                          completed
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 text-emerald-600'
                            : 'bg-muted border-border text-muted-foreground'
                        )}
                        title={`${step.label}${date ? `: ${format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR })}` : ''}`}
                      >
                        {completed ? <CheckCircle2 className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                      </div>
                      {i < TIMELINE_STEPS.length - 1 && (
                        <div className={cn('w-4 h-0.5', completed ? 'bg-emerald-500' : 'bg-border')} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
