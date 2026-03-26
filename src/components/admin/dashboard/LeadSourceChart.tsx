import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Share2, Instagram, Phone, Globe, Mail, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const SOURCE_CONFIG: Record<string, { icon: typeof Share2; color: string; label: string }> = {
  'site': { icon: Globe, color: '#3b82f6', label: 'Site' },
  'instagram': { icon: Instagram, color: '#e1306c', label: 'Instagram' },
  'whatsapp': { icon: MessageCircle, color: '#25d366', label: 'WhatsApp' },
  'telefone': { icon: Phone, color: '#f59e0b', label: 'Telefone' },
  'email': { icon: Mail, color: '#8b5cf6', label: 'E-mail' },
  'indicacao': { icon: Share2, color: '#10b981', label: 'Indicação' },
  'google': { icon: Globe, color: '#4285f4', label: 'Google' },
  'facebook': { icon: Globe, color: '#1877f2', label: 'Facebook' },
};

interface SourceData {
  source: string;
  label: string;
  count: number;
  color: string;
}

export function LeadSourceChart() {
  const [data, setData] = useState<SourceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    const [leadsRes, profilesRes] = await Promise.all([
      supabase.from('leads').select('origin'),
      supabase.from('profiles').select('origin')
    ]);

    const allOrigins = [
      ...(leadsRes.data || []).map(l => l.origin),
      ...(profilesRes.data || []).map(p => p.origin)
    ];

    const counts: Record<string, number> = {};
    
    allOrigins.forEach(origin => {
      const key = (origin || 'site').toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });

    const totalCount = allOrigins.length;
    setTotal(totalCount);

    const chartData: SourceData[] = Object.entries(counts)
      .map(([source, count]) => {
        const config = SOURCE_CONFIG[source] || SOURCE_CONFIG['site'];
        return {
          source,
          label: config.label,
          count,
          color: config.color
        };
      })
      .sort((a, b) => b.count - a.count);

    setData(chartData);
    setIsLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
    >
      <Card className="border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl h-full overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-400 shadow-lg">
              <Share2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Origem dos Leads</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">De onde vêm seus clientes</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis 
                  dataKey="label" 
                  type="category" 
                  tick={{ fontSize: 12 }}
                  width={80}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: 'none', 
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value: number) => [
                    `${value} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
                    'Quantidade'
                  ]}
                />
                <Bar 
                  dataKey="count" 
                  radius={[0, 8, 8, 0]}
                  animationDuration={1500}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Source cards */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {data.slice(0, 3).map((item, index) => {
              const config = SOURCE_CONFIG[item.source] || SOURCE_CONFIG['site'];
              const Icon = config.icon;
              
              return (
                <motion.div
                  key={item.source}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="p-3 rounded-xl text-center"
                  style={{ backgroundColor: `${item.color}15` }}
                >
                  <Icon className="h-5 w-5 mx-auto mb-1" style={{ color: item.color }} />
                  <p className="text-lg font-bold">{item.count}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
