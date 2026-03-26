import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Search, Megaphone } from 'lucide-react';

export default function CampaignTable() {
  const [search, setSearch] = useState('');

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['marketing-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .order('spend', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = campaigns.filter(c =>
    (c.campaign_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.adset_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.ad_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Ativa</Badge>;
      case 'paused': return <Badge variant="secondary">Pausada</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Campanhas
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar campanha..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma campanha encontrada</p>
            <p className="text-sm mt-1">Sincronize suas campanhas do Meta Ads na aba Configuração</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Investimento</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const roiVal = Number(c.spend) > 0 ? ((Number(c.revenue || 0) - Number(c.spend)) / Number(c.spend)) * 100 : 0;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{c.campaign_name}</p>
                          {c.adset_name && <p className="text-xs text-muted-foreground">{c.adset_name}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(c.status || 'unknown')}</TableCell>
                      <TableCell className="text-right font-medium">R$ {Number(c.spend || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{Number(c.impressions || 0).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{Number(c.clicks || 0).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right font-medium">{c.leads_count || 0}</TableCell>
                      <TableCell className="text-right">R$ {Number(c.cpl || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">R$ {Number(c.revenue || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <span className={roiVal >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                          {roiVal.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
