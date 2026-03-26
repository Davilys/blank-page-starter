import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Bell, CheckCircle, EyeOff, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AnimatedCounter } from '@/components/admin/dashboard/AnimatedCounter';

const TYPE_CONFIG: Record<string, { label: string; color: string; chartColor: string }> = {
  info: { label: 'Informação', color: 'bg-blue-100 text-blue-800', chartColor: '#3b82f6' },
  success: { label: 'Sucesso', color: 'bg-green-100 text-green-800', chartColor: '#22c55e' },
  warning: { label: 'Aviso', color: 'bg-amber-100 text-amber-800', chartColor: '#f59e0b' },
  error: { label: 'Urgente', color: 'bg-red-100 text-red-800', chartColor: '#ef4444' },
};

export function NotificationAnalyticsDashboard() {
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notification-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, profiles:user_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const all = notifications || [];
  const total = all.length;
  const read = all.filter((n: any) => n.read).length;
  const unread = total - read;
  const readRate = total > 0 ? (read / total) * 100 : 0;

  // Type distribution
  const typeCounts = ['info', 'success', 'warning', 'error'].map((type) => ({
    name: TYPE_CONFIG[type]?.label || type,
    value: all.filter((n: any) => n.type === type).length,
    color: TYPE_CONFIG[type]?.chartColor || '#6b7280',
  }));

  // Daily volume last 30 days
  const thirtyDaysAgo = subDays(new Date(), 30);
  const dailyData: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const day = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd');
    dailyData[day] = 0;
  }
  all.forEach((n: any) => {
    if (!n.created_at) return;
    const day = format(parseISO(n.created_at), 'yyyy-MM-dd');
    if (dailyData[day] !== undefined) dailyData[day]++;
  });
  const volumeData = Object.entries(dailyData).map(([date, count]) => ({
    date: format(parseISO(date), 'dd/MM', { locale: ptBR }),
    count,
  }));

  const metricCards = [
    { title: 'Total Enviadas', value: total, icon: Bell, color: 'text-blue-500' },
    { title: 'Lidas', value: read, icon: CheckCircle, color: 'text-green-500' },
    { title: 'Não Lidas', value: unread, icon: EyeOff, color: 'text-amber-500' },
    { title: 'Taxa de Leitura', value: readRate, icon: TrendingUp, color: 'text-purple-500', suffix: '%', decimals: 1 },
  ];

  const recent50 = all.slice(0, 50);

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold">
                      <AnimatedCounter value={card.value} suffix={card.suffix} decimals={card.decimals} />
                    </p>
                  </div>
                  <card.icon className={`h-8 w-8 ${card.color} opacity-80`} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Notificações por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={typeCounts}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {typeCounts.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Volume Diário (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" fontSize={10} interval={4} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#f97316" fill="#f97316" fillOpacity={0.2} name="Notificações" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Histórico de Notificações</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent50.map((n: any) => {
                  const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                  return (
                    <TableRow key={n.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {n.created_at ? format(parseISO(n.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{n.profiles?.full_name || '—'}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{n.title}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={n.read ? 'outline' : 'secondary'} className="text-xs">
                          {n.read ? 'Lida' : 'Não lida'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {recent50.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma notificação encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
