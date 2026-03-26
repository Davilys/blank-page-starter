import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { MapPin, Users, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const BRAZIL_STATES: Record<string, string> = {
  'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas',
  'BA': 'Bahia', 'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo',
  'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul',
  'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná',
  'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte',
  'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina',
  'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins'
};

const COLORS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
];

type ViewType = 'estados' | 'cidades';

interface GeoData {
  name: string;
  value: number;
  percentage: number;
}

export function GeographicChart() {
  const [view, setView] = useState<ViewType>('estados');
  const [data, setData] = useState<GeoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchData();
  }, [view]);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch from both leads and profiles
    const [leadsRes, profilesRes] = await Promise.all([
      supabase.from('leads').select('state, city'),
      supabase.from('profiles').select('state, city')
    ]);

    const allData = [...(leadsRes.data || []), ...(profilesRes.data || [])];
    const counts: Record<string, number> = {};
    
    allData.forEach(item => {
      let key: string;
      if (view === 'estados') {
        key = item.state || 'Não informado';
        // Convert state abbreviation to full name if needed
        if (key.length === 2 && BRAZIL_STATES[key]) {
          key = BRAZIL_STATES[key];
        }
      } else {
        key = item.city || 'Não informado';
      }
      counts[key] = (counts[key] || 0) + 1;
    });

    const totalCount = allData.length;
    setTotal(totalCount);

    const sortedData = Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalCount > 0 ? (value / totalCount) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    setData(sortedData);
    setIsLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl h-full overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Distribuição Geográfica</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Origem dos leads e clientes</p>
            </div>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
            <TabsList>
              <TabsTrigger value="estados" className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                Estados
              </TabsTrigger>
              <TabsTrigger value="cidades" className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Cidades
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Total: <strong className="text-foreground">{total}</strong> registros
            </span>
          </div>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={data} 
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis 
                  type="number" 
                  tick={{ fontSize: 12 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis 
                  dataKey="name" 
                  type="category"
                  tick={{ fontSize: 12 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  width={75}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: 'none', 
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value: number, name: string, props: any) => [
                    `${value} (${props.payload.percentage.toFixed(1)}%)`,
                    view === 'estados' ? 'Estado' : 'Cidade'
                  ]}
                />
                <Bar 
                  dataKey="value" 
                  radius={[0, 8, 8, 0]}
                  animationDuration={1500}
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend with percentages */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {data.slice(0, 6).map((item, index) => (
              <motion.div 
                key={item.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="flex items-center gap-2"
              >
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-xs text-muted-foreground truncate">
                  {item.name}: {item.percentage.toFixed(1)}%
                </span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
