import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, UserPlus, FileText, CreditCard, FileCheck, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  type: 'lead' | 'client' | 'process' | 'invoice' | 'contract';
  title: string;
  description: string;
  time: Date;
  gradient: string;
  icon: typeof Clock;
}

const TYPE_CONFIG = {
  lead: { icon: UserPlus, gradient: 'from-blue-500 to-cyan-400' },
  client: { icon: UserPlus, gradient: 'from-violet-500 to-purple-400' },
  process: { icon: FileText, gradient: 'from-amber-500 to-orange-400' },
  invoice: { icon: CreditCard, gradient: 'from-emerald-500 to-teal-400' },
  contract: { icon: FileCheck, gradient: 'from-rose-500 to-pink-400' },
};

export function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => { fetchActivities(); }, []);

  const fetchActivities = async () => {
    const [leadsRes, clientsRes, processesRes, invoicesRes, contractsRes] = await Promise.all([
      supabase.from('leads').select('id, full_name, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('profiles').select('id, full_name, email, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('brand_processes').select('id, brand_name, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('invoices').select('id, description, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('contracts').select('id, subject, created_at').order('created_at', { ascending: false }).limit(5),
    ]);

    const all: Activity[] = [
      ...(leadsRes.data || []).map(l => ({ id: `lead-${l.id}`, type: 'lead' as const, title: 'Novo lead', description: l.full_name || 'Lead', time: new Date(l.created_at), ...TYPE_CONFIG.lead })),
      ...(clientsRes.data || []).map(c => ({ id: `client-${c.id}`, type: 'client' as const, title: 'Novo cliente', description: c.full_name || c.email, time: new Date(c.created_at!), ...TYPE_CONFIG.client })),
      ...(processesRes.data || []).map(p => ({ id: `process-${p.id}`, type: 'process' as const, title: 'Novo processo', description: p.brand_name, time: new Date(p.created_at!), ...TYPE_CONFIG.process })),
      ...(invoicesRes.data || []).map(i => ({ id: `invoice-${i.id}`, type: 'invoice' as const, title: 'Nova fatura', description: i.description, time: new Date(i.created_at!), ...TYPE_CONFIG.invoice })),
      ...(contractsRes.data || []).map(c => ({ id: `contract-${c.id}`, type: 'contract' as const, title: 'Novo contrato', description: c.subject || 'Contrato', time: new Date(c.created_at!), ...TYPE_CONFIG.contract })),
    ];

    all.sort((a, b) => b.time.getTime() - a.time.getTime());
    setActivities(all.slice(0, 10));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
    >
      <Card className="border border-border/50 bg-card/80 backdrop-blur-sm shadow-xl h-full overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-400 shadow-lg">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Atividade Recente</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Últimas interações no sistema</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[380px] pr-2">
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Clock className="h-12 w-12 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma atividade recente</p>
              </div>
            ) : (
              <div className="space-y-1">
                {activities.map((activity, index) => {
                  const Icon = activity.icon;
                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors group cursor-default"
                    >
                      <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br shadow-sm shrink-0 group-hover:scale-110 transition-transform", activity.gradient)}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{activity.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap font-medium">
                        {formatDistanceToNow(activity.time, { addSuffix: true, locale: ptBR })}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </motion.div>
  );
}
