import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { Filter, TrendingDown } from 'lucide-react';

const FUNNEL_STAGES = [
  { key: 'visitors', label: 'Visitantes', color: 'bg-blue-500' },
  { key: 'leads', label: 'Leads', color: 'bg-indigo-500' },
  { key: 'contracts_sent', label: 'Contratos Enviados', color: 'bg-violet-500' },
  { key: 'contracts_signed', label: 'Contratos Assinados', color: 'bg-emerald-500' },
  { key: 'paid', label: 'Clientes Pagos', color: 'bg-amber-500' },
];

export default function ConversionFunnelModule() {
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('30d');

  const periodDays = periodFilter === '7d' ? 7 : periodFilter === '30d' ? 30 : periodFilter === '90d' ? 90 : 365;
  const sinceDate = new Date(Date.now() - periodDays * 86400000).toISOString();

  const { data: leads = [] } = useQuery({
    queryKey: ['funnel-leads', sinceDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, status, created_at, origin')
        .gte('created_at', sinceDate);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['funnel-contracts', sinceDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, signature_status, created_at, contract_value')
        .gte('created_at', sinceDate);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['funnel-invoices', sinceDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, status, created_at')
        .gte('created_at', sinceDate)
        .eq('status', 'paid');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: attributions = [] } = useQuery({
    queryKey: ['funnel-attributions', sinceDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_attribution')
        .select('*')
        .gte('created_at', sinceDate);
      if (error) throw error;
      return data || [];
    },
  });

  const campaigns = useMemo(() => {
    const set = new Set(attributions.map(a => a.utm_campaign).filter(Boolean));
    return Array.from(set) as string[];
  }, [attributions]);

  const funnelData = useMemo(() => {
    const totalLeads = leads.length;
    const contractsSent = contracts.length;
    const contractsSigned = contracts.filter(c => c.signature_status === 'signed').length;
    const paidClients = invoices.length;
    // Estimate visitors as leads * 10 (typical ~10% conversion rate estimate)
    const estimatedVisitors = Math.max(totalLeads * 10, totalLeads);

    return [
      { ...FUNNEL_STAGES[0], value: estimatedVisitors },
      { ...FUNNEL_STAGES[1], value: totalLeads },
      { ...FUNNEL_STAGES[2], value: contractsSent },
      { ...FUNNEL_STAGES[3], value: contractsSigned },
      { ...FUNNEL_STAGES[4], value: paidClients },
    ];
  }, [leads, contracts, invoices]);

  const maxValue = Math.max(...funnelData.map(d => d.value), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Funil de Conversão
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="90d">90 dias</SelectItem>
                <SelectItem value="365d">1 ano</SelectItem>
              </SelectContent>
            </Select>
            {campaigns.length > 0 && (
              <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {campaigns.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {funnelData.map((stage, i) => {
            const widthPct = maxValue > 0 ? Math.max((stage.value / maxValue) * 100, 8) : 8;
            const prevValue = i > 0 ? funnelData[i - 1].value : stage.value;
            const dropRate = prevValue > 0 ? ((prevValue - stage.value) / prevValue * 100).toFixed(1) : '0';

            return (
              <div key={stage.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {stage.label}
                    {stage.key === 'visitors' && (
                      <span className="ml-1 text-xs text-muted-foreground" title="Estimativa baseada em taxa de conversão média de ~10%">(estimado*)</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{stage.value.toLocaleString('pt-BR')}</span>
                    {i > 0 && (
                      <span className="text-xs text-muted-foreground">
                        (-{dropRate}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-8 bg-muted/30 rounded-lg overflow-hidden">
                  <div
                    className={`h-full ${stage.color} rounded-lg transition-all duration-500 flex items-center justify-end pr-2`}
                    style={{ width: `${widthPct}%` }}
                  >
                    {widthPct > 15 && (
                      <span className="text-xs font-medium text-white">{stage.value}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Conversion rates */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Lead → Contrato', rate: funnelData[1].value > 0 ? (funnelData[2].value / funnelData[1].value * 100).toFixed(1) : '0' },
            { label: 'Contrato → Assinado', rate: funnelData[2].value > 0 ? (funnelData[3].value / funnelData[2].value * 100).toFixed(1) : '0' },
            { label: 'Assinado → Pago', rate: funnelData[3].value > 0 ? (funnelData[4].value / funnelData[3].value * 100).toFixed(1) : '0' },
            { label: 'Lead → Pago', rate: funnelData[1].value > 0 ? (funnelData[4].value / funnelData[1].value * 100).toFixed(1) : '0' },
          ].map(item => (
            <div key={item.label} className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-lg font-bold text-foreground">{item.rate}%</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
