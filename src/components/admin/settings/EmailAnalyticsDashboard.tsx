import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Mail, CheckCircle2, AlertCircle, TrendingUp, Loader2, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';

const triggerTypeConfig: Record<string, { label: string; color: string; chartColor: string }> = {
  contract_signed: { label: 'Contrato Assinado', color: 'bg-green-500/10 text-green-500 border-green-500/20', chartColor: '#22c55e' },
  form_started: { label: 'Boas-Vindas', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', chartColor: '#3b82f6' },
  form_abandoned: { label: 'Follow-up 24h', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', chartColor: '#f59e0b' },
  user_created: { label: 'Credenciais', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20', chartColor: '#a855f7' },
  payment_received: { label: 'Pagamento', color: 'bg-sky-500/10 text-sky-500 border-sky-500/20', chartColor: '#0ea5e9' },
  signature_request: { label: 'Link Assinatura', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20', chartColor: '#6366f1' },
  manual: { label: 'Manual', color: 'bg-muted text-muted-foreground border-border', chartColor: '#94a3b8' },
  processual: { label: 'Processual', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', chartColor: '#d97706' },
};

function getTriggerLabel(type: string | null) {
  if (!type) return 'Desconhecido';
  return triggerTypeConfig[type]?.label || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getTriggerColor(type: string | null) {
  if (!type) return 'bg-muted text-muted-foreground border-border';
  return triggerTypeConfig[type]?.color || 'bg-muted text-muted-foreground border-border';
}

function getChartColor(type: string) {
  return triggerTypeConfig[type]?.chartColor || '#94a3b8';
}

export function EmailAnalyticsDashboard() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['email-logs-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allLogs = logs || [];
  const totalSent = allLogs.length;
  const successCount = allLogs.filter(l => l.status === 'sent').length;
  const errorCount = allLogs.filter(l => l.status === 'error' || l.status === 'failed').length;
  const successRate = totalSent > 0 ? Math.round((successCount / totalSent) * 100) : 0;

  // Bar chart data - by trigger type
  const triggerCounts: Record<string, number> = {};
  allLogs.forEach(l => {
    const key = l.trigger_type || 'unknown';
    triggerCounts[key] = (triggerCounts[key] || 0) + 1;
  });
  const barData = Object.entries(triggerCounts)
    .map(([type, count]) => ({ type, label: getTriggerLabel(type), count }))
    .sort((a, b) => b.count - a.count);

  // Area chart data - daily volume last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const dailyCounts: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo.getTime() + i * 86400000);
    dailyCounts[format(d, 'yyyy-MM-dd')] = 0;
  }
  allLogs.forEach(l => {
    if (!l.sent_at) return;
    const day = format(new Date(l.sent_at), 'yyyy-MM-dd');
    if (dailyCounts[day] !== undefined) dailyCounts[day]++;
  });
  const areaData = Object.entries(dailyCounts).map(([date, count]) => ({
    date,
    label: format(new Date(date), 'dd/MM', { locale: ptBR }),
    count,
  }));

  const recentLogs = allLogs.slice(0, 50);

  const metricCards = [
    { label: 'Total Enviados', value: totalSent, icon: Mail, color: 'from-primary/20 to-primary/5 border-primary/20', iconColor: 'text-primary' },
    { label: 'Entregues', value: successCount, icon: CheckCircle2, color: 'from-green-500/20 to-green-500/5 border-green-500/20', iconColor: 'text-green-500' },
    { label: 'Com Erro', value: errorCount, icon: AlertCircle, color: 'from-red-500/20 to-red-500/5 border-red-500/20', iconColor: 'text-red-500' },
    { label: 'Taxa de Sucesso', value: successRate, icon: TrendingUp, color: 'from-blue-500/20 to-blue-500/5 border-blue-500/20', iconColor: 'text-blue-500', suffix: '%' },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card className={cn("bg-gradient-to-br border overflow-hidden", card.color)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <card.icon className={cn("h-5 w-5", card.iconColor)} />
                  {card.label === 'Taxa de Sucesso' && (
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">30d</span>
                  )}
                </div>
                <p className="text-2xl font-bold tracking-tight">
                  {card.value}{card.suffix || ''}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                {card.label === 'Taxa de Sucesso' && (
                  <Progress value={successRate} className="h-1.5 mt-2" />
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Envios por Tipo de Notificação</CardTitle>
            </CardHeader>
            <CardContent>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <RechartsTooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number) => [value, 'Envios']}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {barData.map((entry) => (
                        <Cell key={entry.type} fill={getChartColor(entry.type)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Volume Diário (Últimos 30 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={areaData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                  <defs>
                    <linearGradient id="emailAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [value, 'Envios']}
                  />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#emailAreaGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* History Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Histórico de Envios Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Data/Hora</TableHead>
                    <TableHead className="text-xs">Destinatário</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Assunto</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum e-mail enviado ainda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentLogs.map((log) => (
                      <TableRow key={log.id} className="group">
                        <TableCell className="text-xs whitespace-nowrap">
                          {log.sent_at ? format(new Date(log.sent_at), "dd/MM/yy HH:mm", { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell className="text-xs max-w-[160px] truncate">{log.to_email}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate hidden md:table-cell">{log.subject}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] h-5 whitespace-nowrap", getTriggerColor(log.trigger_type))}>
                            {getTriggerLabel(log.trigger_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {log.status === 'sent' ? (
                              <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] h-5">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Enviado
                              </Badge>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] h-5 cursor-help">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      Erro
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-[300px]">
                                    <p className="text-xs">{log.error_message || 'Erro desconhecido'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
