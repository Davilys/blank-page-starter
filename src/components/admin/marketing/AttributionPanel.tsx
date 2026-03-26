import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Link2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AttributionPanel() {
  const { data: attributions = [] } = useQuery({
    queryKey: ['marketing-attributions-detail'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_attribution')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Atribuição de Leads
        </CardTitle>
      </CardHeader>
      <CardContent>
        {attributions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Link2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma atribuição registrada</p>
            <p className="text-sm mt-1">
              Quando leads chegarem via UTM (ex: ?utm_source=facebook), a origem será registrada aqui automaticamente
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Meio</TableHead>
                  <TableHead>Conteúdo</TableHead>
                  <TableHead>FBCLID</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attributions.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm">
                      {format(new Date(a.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{a.utm_source || '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{a.utm_campaign || '—'}</TableCell>
                    <TableCell className="text-sm">{a.utm_medium || '—'}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">{a.utm_content || '—'}</TableCell>
                    <TableCell>
                      {a.fbclid ? (
                        <Badge variant="secondary" className="text-xs font-mono">
                          {a.fbclid.substring(0, 10)}…
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(a.revenue || 0) > 0
                        ? `R$ ${Number(a.revenue).toFixed(2)}`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
