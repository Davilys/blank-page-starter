import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Share2, Instagram, Phone, Globe, Mail, MessageCircle, HelpCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { DateRange } from './lib/period';
import { formatRate, rate } from './lib/metrics';
import { BlockEmpty, BlockError, BlockSkeleton, DataGapNote, InfoTip, type BlockStatus } from './DashboardStates';

const SOURCE_CONFIG: Record<string, { icon: typeof Share2; color: string; label: string }> = {
  site: { icon: Globe, color: '#3b82f6', label: 'Site' },
  landpage: { icon: Globe, color: '#0ea5e9', label: 'Landing page' },
  instagram: { icon: Instagram, color: '#e1306c', label: 'Instagram' },
  whatsapp: { icon: MessageCircle, color: '#25d366', label: 'WhatsApp' },
  telefone: { icon: Phone, color: '#f59e0b', label: 'Telefone' },
  email: { icon: Mail, color: '#8b5cf6', label: 'E-mail' },
  indicacao: { icon: Share2, color: '#10b981', label: 'Indicação' },
  google: { icon: Globe, color: '#4285f4', label: 'Google' },
  facebook: { icon: Globe, color: '#1877f2', label: 'Facebook' },
  manual: { icon: Share2, color: '#64748b', label: 'Manual/CRM' },
  crm: { icon: Share2, color: '#64748b', label: 'Manual/CRM' },
};

const UNKNOWN = { icon: HelpCircle, color: '#94a3b8', label: 'Origem não informada' };

interface SourceRow {
  key: string;
  label: string;
  color: string;
  icon: typeof Share2;
  count: number;
  converted: number;
}

export function LeadSourceChart({ range }: { range: DateRange }) {
  const [status, setStatus] = useState<BlockStatus>('loading');
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [unknownCount, setUnknownCount] = useState(0);

  const fetchData = useCallback(async () => {
    setStatus('loading');
    try {
      let q = supabase.from('leads').select('origin, converted_to_client_id');
      if (range.start) q = q.gte('created_at', range.start.toISOString());
      if (range.end) q = q.lt('created_at', range.end.toISOString());
      const { data, error } = await q.limit(5000);
      if (error) throw error;

      const leads = data || [];
      const grouped: Record<string, SourceRow> = {};
      let unknown = 0;

      leads.forEach((lead) => {
        const raw = (lead.origin || '').trim().toLowerCase();
        const key = raw || 'nao_informado';
        if (!raw) unknown += 1;
        const cfg = SOURCE_CONFIG[key] || (raw ? { icon: Share2, color: '#64748b', label: raw } : UNKNOWN);
        if (!grouped[key]) {
          grouped[key] = { key, label: cfg.label, color: cfg.color, icon: cfg.icon, count: 0, converted: 0 };
        }
        grouped[key].count += 1;
        if (lead.converted_to_client_id) grouped[key].converted += 1;
      });

      const list = Object.values(grouped).sort((a, b) => b.count - a.count);
      setRows(list);
      setTotal(leads.length);
      setUnknownCount(unknown);
      setStatus(leads.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      console.warn('[Origem dos leads] erro:', err);
      setStatus('error');
    }
  }, [range.start, range.end]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const unknownPct = rate(unknownCount, total);

  return (
    <Card className="border-0 bg-transparent shadow-none h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/25">
            <Share2 className="h-4 w-4 text-rose-500" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Origem dos Leads</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{range.label} · {total.toLocaleString('pt-BR')} leads</p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {status === 'loading' && <BlockSkeleton height={260} />}
        {status === 'error' && <BlockError onRetry={fetchData} height={260} />}
        {status === 'empty' && (
          <BlockEmpty height={260} message="Nenhum lead neste período" hint="Não há origem a ranquear para o intervalo selecionado." />
        )}

        {status === 'ready' && (
          <>
            <ul className="space-y-3" aria-label="Ranking de origem dos leads">
              {rows.map((row, index) => {
                const Icon = row.icon;
                const share = rate(row.count, total) ?? 0;
                const conv = rate(row.converted, row.count);
                return (
                  <motion.li
                    key={row.key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.06 }}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-4 w-4 shrink-0" style={{ color: row.color }} aria-hidden="true" />
                        <span className="text-sm font-medium truncate">{row.label}</span>
                      </div>
                      <div className="flex items-baseline gap-2 shrink-0">
                        <span className="text-sm font-bold tabular-nums">{row.count.toLocaleString('pt-BR')}</span>
                        <span className="text-[10px] text-muted-foreground">{formatRate(share)}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: row.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(share, 3)}%` }}
                        transition={{ duration: 0.8, delay: 0.1 + index * 0.06 }}
                      />
                    </div>
                    <InfoTip text="Leads desta origem que possuem cliente vinculado.">
                      <p className="text-[10px] text-muted-foreground">
                        Conversão: {formatRate(conv)} ({row.converted}/{row.count})
                      </p>
                    </InfoTip>
                  </motion.li>
                );
              })}
            </ul>

            {unknownPct !== null && unknownPct >= 10 && (
              <DataGapNote text={`${formatRate(unknownPct)} dos leads deste período estão sem origem informada — preencher o campo permite medir o retorno por canal.`} />
            )}
            {rows.length === 1 && unknownCount === 0 && (
              <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
                Todos os leads do período vieram de uma única origem cadastrada. Registre outras origens no CRM para comparar canais.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
