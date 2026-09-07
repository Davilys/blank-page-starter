import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, UserPlus, FileText, CreditCard, FileCheck, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { BlockEmpty, BlockError, BlockSkeleton, type BlockStatus } from './DashboardStates';

type ActivityType = 'lead' | 'client' | 'process' | 'invoice' | 'contract';

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  time: Date;
  href?: string;
}

const TYPE_CONFIG: Record<ActivityType, { icon: typeof Clock; color: string; label: string }> = {
  lead: { icon: UserPlus, color: '#3b82f6', label: 'Novo lead' },
  client: { icon: UserPlus, color: '#8b5cf6', label: 'Novo cliente' },
  process: { icon: FileText, color: '#f59e0b', label: 'Novo processo' },
  invoice: { icon: CreditCard, color: '#10b981', label: 'Nova fatura' },
  contract: { icon: FileCheck, color: '#ec4899', label: 'Novo contrato' },
};

const safeDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return isValid(d) ? d : null;
};

export function RecentActivity() {
  const [status, setStatus] = useState<BlockStatus>('loading');
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const fetchActivities = useCallback(async () => {
    setStatus('loading');
    try {
      const [leadsRes, clientsRes, processesRes, invoicesRes, contractsRes] = await Promise.all([
        supabase.from('leads').select('id, full_name, created_at').order('created_at', { ascending: false }).limit(6),
        supabase.from('profiles').select('id, full_name, email, created_at').order('created_at', { ascending: false }).limit(6),
        supabase.from('brand_processes').select('id, brand_name, created_at').order('created_at', { ascending: false }).limit(6),
        supabase.from('invoices').select('id, description, created_at').order('created_at', { ascending: false }).limit(6),
        supabase.from('contracts').select('id, subject, created_at').order('created_at', { ascending: false }).limit(6),
      ]);

      const errored = [leadsRes, clientsRes, processesRes, invoicesRes, contractsRes].find((r) => r.error);
      if (errored?.error) throw errored.error;

      const all: ActivityItem[] = [];

      (leadsRes.data || []).forEach((l) => {
        const time = safeDate(l.created_at);
        if (time) all.push({ id: `lead-${l.id}`, type: 'lead', title: TYPE_CONFIG.lead.label, description: l.full_name || 'Lead sem nome', time, href: '/admin/leads' });
      });
      (clientsRes.data || []).forEach((c) => {
        const time = safeDate(c.created_at);
        if (time) all.push({ id: `client-${c.id}`, type: 'client', title: TYPE_CONFIG.client.label, description: c.full_name || c.email || 'Cliente', time, href: `/admin/clientes/${c.id}` });
      });
      (processesRes.data || []).forEach((p) => {
        const time = safeDate(p.created_at);
        if (time) all.push({ id: `process-${p.id}`, type: 'process', title: TYPE_CONFIG.process.label, description: p.brand_name || 'Marca sem nome', time, href: '/admin/processos' });
      });
      (invoicesRes.data || []).forEach((i) => {
        const time = safeDate(i.created_at);
        if (time) all.push({ id: `invoice-${i.id}`, type: 'invoice', title: TYPE_CONFIG.invoice.label, description: i.description || 'Fatura', time, href: '/admin/financeiro' });
      });
      (contractsRes.data || []).forEach((c) => {
        const time = safeDate(c.created_at);
        if (time) all.push({ id: `contract-${c.id}`, type: 'contract', title: TYPE_CONFIG.contract.label, description: c.subject || 'Contrato', time, href: '/admin/contratos' });
      });

      all.sort((a, b) => b.time.getTime() - a.time.getTime());
      const list = all.slice(0, 12);
      setActivities(list);
      setStatus(list.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      console.warn('[Atividade recente] erro:', err);
      setStatus('error');
    }
  }, []);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  return (
    <Card className="border-0 bg-transparent shadow-none h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/25">
            <Bell className="h-4 w-4 text-cyan-500" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Atividade Recente</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Últimos registros criados no sistema</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {status === 'loading' && <BlockSkeleton height={340} rows={5} />}
        {status === 'error' && <BlockError onRetry={fetchActivities} height={340} />}
        {status === 'empty' && <BlockEmpty height={340} message="Nenhuma atividade registrada" />}

        {status === 'ready' && (
          <ScrollArea className="h-[340px] pr-2">
            <ul className="space-y-1">
              {activities.map((activity, index) => {
                const cfg = TYPE_CONFIG[activity.type];
                const Icon = cfg.icon;
                const content = (
                  <>
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                      style={{ background: `${cfg.color}1f`, border: `1px solid ${cfg.color}33` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: cfg.color }} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{activity.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-semibold tabular-nums text-foreground">
                        {format(activity.time, 'dd/MM HH:mm')}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(activity.time, { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </>
                );

                return (
                  <motion.li
                    key={activity.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    {activity.href ? (
                      <Link
                        to={activity.href}
                        className={cn('flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40')}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 p-2.5 rounded-xl">{content}</div>
                    )}
                  </motion.li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
