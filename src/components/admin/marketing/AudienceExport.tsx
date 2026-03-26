import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, Download, UserCheck, UserX, FileSpreadsheet } from 'lucide-react';

export default function AudienceExport() {
  const [exporting, setExporting] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ['audience-stats'],
    queryFn: async () => {
      const [clientsRes, leadsRes, contractsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('leads').select('id', { count: 'exact', head: true }).neq('status', 'convertido'),
        supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('signature_status', 'signed'),
      ]);
      return {
        totalClients: clientsRes.count || 0,
        unconvertedLeads: leadsRes.count || 0,
        signedContracts: contractsRes.count || 0,
      };
    },
  });

  const exportAudience = async (type: 'clients' | 'leads' | 'signed') => {
    setExporting(type);
    try {
      let emails: string[] = [];

      if (type === 'clients') {
        const { data } = await supabase.from('profiles').select('email').not('email', 'is', null);
        emails = (data || []).map(d => d.email).filter(Boolean) as string[];
      } else if (type === 'leads') {
        const { data } = await supabase.from('leads').select('email').neq('status', 'convertido').not('email', 'is', null);
        emails = (data || []).map(d => d.email).filter(Boolean) as string[];
      } else {
        const { data } = await supabase
          .from('contracts')
          .select('user_id, profiles:user_id(email)')
          .eq('signature_status', 'signed');
        emails = (data || [])
          .map((d: any) => d.profiles?.email)
          .filter(Boolean) as string[];
      }

      if (emails.length === 0) {
        toast.error('Nenhum email encontrado para exportar');
        return;
      }

      // Create CSV
      const csv = 'email\n' + [...new Set(emails)].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audiencia_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`${emails.length} emails exportados com sucesso`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setExporting(null);
    }
  };

  const audiences = [
    {
      key: 'clients' as const,
      icon: UserCheck,
      title: 'Clientes Ativos',
      description: 'Todos os clientes cadastrados no CRM',
      count: stats?.totalClients || 0,
      color: 'text-emerald-500',
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      metaUse: 'Custom Audience → Lookalike',
    },
    {
      key: 'leads' as const,
      icon: UserX,
      title: 'Leads Não Convertidos',
      description: 'Leads que ainda não se tornaram clientes',
      count: stats?.unconvertedLeads || 0,
      color: 'text-amber-500',
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      metaUse: 'Custom Audience → Remarketing',
    },
    {
      key: 'signed' as const,
      icon: FileSpreadsheet,
      title: 'Contratos Assinados',
      description: 'Clientes que assinaram contrato',
      count: stats?.signedContracts || 0,
      color: 'text-blue-500',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      metaUse: 'Custom Audience → Lookalike de compradores',
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Públicos para Meta Ads
          </CardTitle>
          <CardDescription>
            Exporte listas de emails para criar Custom Audiences e Lookalike Audiences no Meta Ads
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {audiences.map((aud) => (
          <Card key={aud.key} className="border-border/50">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${aud.bg}`}>
                  <aud.icon className={`h-5 w-5 ${aud.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{aud.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{aud.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">{aud.count} registros</Badge>
                <Badge variant="secondary" className="text-xs">{aud.metaUse}</Badge>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => exportAudience(aud.key)}
                disabled={exporting === aud.key || aud.count === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                {exporting === aud.key ? 'Exportando...' : 'Exportar CSV'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
