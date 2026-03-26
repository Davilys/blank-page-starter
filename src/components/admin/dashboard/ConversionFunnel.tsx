import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Users, FileCheck, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface FunnelStep {
  name: string;
  value: number;
  percentage: number;
  icon: typeof Target;
  gradient: string;
}

export function ConversionFunnel() {
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [conversionRate, setConversionRate] = useState(0);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [leadsRes, clientsRes, contractsRes, processesRes] = await Promise.all([
      supabase.from('leads').select('id, status', { count: 'exact' }),
      supabase.from('profiles').select('id', { count: 'exact' }),
      supabase.from('contracts').select('id, signature_status'),
      supabase.from('brand_processes').select('id, status')
    ]);

    const totalLeads = leadsRes.count || 0;
    const totalClients = clientsRes.count || 0;
    const signedContracts = contractsRes.data?.filter(c => c.signature_status === 'signed').length || 0;
    const completedProcesses = processesRes.data?.filter(p => p.status === 'registrada').length || 0;

    setSteps([
      { name: 'Leads', value: totalLeads, percentage: 100, icon: Target, gradient: 'from-blue-500 to-cyan-400' },
      { name: 'Clientes', value: totalClients, percentage: totalLeads > 0 ? (totalClients / totalLeads) * 100 : 0, icon: Users, gradient: 'from-violet-500 to-purple-400' },
      { name: 'Contratos', value: signedContracts, percentage: totalLeads > 0 ? (signedContracts / totalLeads) * 100 : 0, icon: FileCheck, gradient: 'from-amber-500 to-orange-400' },
      { name: 'Concluídos', value: completedProcesses, percentage: totalLeads > 0 ? (completedProcesses / totalLeads) * 100 : 0, icon: CheckCircle, gradient: 'from-emerald-500 to-green-400' }
    ]);
    setConversionRate(totalLeads > 0 ? (totalClients / totalLeads) * 100 : 0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      <Card className="border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl h-full overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-400 shadow-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Funil de Conversão</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Taxa de conversão de leads</p>
              </div>
            </div>
            <motion.div 
              className="text-right"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8, type: "spring" }}
            >
              <p className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                {conversionRate.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground font-medium">Conversão</p>
            </motion.div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const widthPct = Math.max(step.percentage, 8);
              
              return (
                <motion.div
                  key={step.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={cn("flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br shadow-sm", step.gradient)}>
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-sm font-medium">{step.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{step.value}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        ({step.percentage.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                  <div className="relative h-7 bg-muted/50 rounded-lg overflow-hidden">
                    <motion.div
                      className={cn("absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r", step.gradient)}
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 1.2, delay: 0.5 + index * 0.15, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div 
            className="mt-6 p-4 rounded-xl border border-border/50 bg-gradient-to-r from-primary/5 to-transparent"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <p className="text-sm font-semibold mb-1">💡 Insights</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {conversionRate >= 30 
                ? "Excelente taxa de conversão! Continue com a estratégia atual."
                : conversionRate >= 15
                ? "Boa taxa de conversão. Considere otimizar o follow-up de leads."
                : "Há espaço para melhorar a conversão. Foque no acompanhamento de leads."}
            </p>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
