import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { format, parseISO, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Publicacao {
  id: string;
  status: string;
  data_publicacao_rpi: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  depositada: 'hsl(217, 91%, 60%)',
  publicada: 'hsl(188, 78%, 46%)',
  oposicao: 'hsl(38, 92%, 50%)',
  deferida: 'hsl(160, 84%, 39%)',
  certificada: 'hsl(271, 91%, 65%)',
  indeferida: 'hsl(0, 84%, 60%)',
  arquivada: 'hsl(240, 5%, 50%)',
  renovacao_pendente: 'hsl(25, 95%, 53%)',
};

const STATUS_LABELS: Record<string, string> = {
  '003': '003',
  oposicao: 'Oposição',
  exigencia_merito: 'Exig. Mérito',
  indeferimento: 'Indeferimento',
  deferimento: 'Deferimento',
  certificado: 'Certificado',
  renovacao: 'Renovação',
  arquivado: 'Arquivado',
};

interface Props {
  publicacoes: Publicacao[];
}

export function PublicacaoCharts({ publicacoes }: Props) {
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(now, 5 - i);
      return {
        month: format(date, 'MMM/yy', { locale: ptBR }),
        start: startOfMonth(date),
        end: endOfMonth(date),
        count: 0,
      };
    });

    publicacoes.forEach(pub => {
      const dateStr = pub.data_publicacao_rpi || pub.created_at;
      if (!dateStr) return;
      try {
        const date = parseISO(dateStr);
        const m = months.find(m => isWithinInterval(date, { start: m.start, end: m.end }));
        if (m) m.count++;
      } catch {}
    });

    return months.map(m => ({ name: m.month, publicacoes: m.count }));
  }, [publicacoes]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    publicacoes.forEach(p => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([status, value]) => ({
        name: STATUS_LABELS[status] || status,
        value,
        fill: STATUS_COLORS[status] || 'hsl(var(--muted))',
      }))
      .sort((a, b) => b.value - a.value);
  }, [publicacoes]);

  const areaConfig = {
    publicacoes: { label: 'Publicações', color: 'hsl(var(--primary))' },
  };

  if (publicacoes.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Publicações por Mês (6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <ChartContainer config={areaConfig} className="h-[180px] w-full">
            <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pubGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="publicacoes"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#pubGradient)"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-primary" />
            Distribuição por Status
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={false}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-1 justify-center">
            {statusData.map(s => (
              <div key={s.name} className="flex items-center gap-1 text-[10px]">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.fill }} />
                <span className="text-muted-foreground">{s.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
