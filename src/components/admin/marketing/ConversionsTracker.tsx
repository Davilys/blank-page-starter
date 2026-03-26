import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { ArrowRight, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ConversionsTracker() {
  const [modelFilter, setModelFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');

  const { data: conversions = [] } = useQuery({
    queryKey: ['marketing-conversions', modelFilter, eventFilter],
    queryFn: async () => {
      let query = supabase
        .from('marketing_conversions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (modelFilter !== 'all') {
        query = query.eq('attribution_model', modelFilter);
      }
      if (eventFilter !== 'all') {
        query = query.eq('event_name', eventFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Summary stats
  const totalConversions = conversions.length;
  const totalValue = conversions.reduce((s, c) => s + Number(c.event_value || 0), 0);
  const byEvent = conversions.reduce((acc: Record<string, number>, c) => {
    acc[c.event_name] = (acc[c.event_name] || 0) + 1;
    return acc;
  }, {});

  const eventBadgeColor = (event: string) => {
    switch (event) {
      case 'LeadCreated': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'ContractSigned': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'PaymentCompleted': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'ContractGenerated': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(byEvent).map(([event, count]) => (
          <Card key={event} className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{event}</p>
              <p className="text-2xl font-bold text-foreground">{count}</p>
            </CardContent>
          </Card>
        ))}
        {totalConversions > 0 && (
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-2xl font-bold text-foreground">
                R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Conversões Registradas
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Eventos</SelectItem>
                  <SelectItem value="LeadCreated">Lead Criado</SelectItem>
                  <SelectItem value="ContractGenerated">Contrato Gerado</SelectItem>
                  <SelectItem value="ContractSigned">Contrato Assinado</SelectItem>
                  <SelectItem value="PaymentCompleted">Pagamento</SelectItem>
                </SelectContent>
              </Select>
              <Select value={modelFilter} onValueChange={setModelFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Modelo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Modelos</SelectItem>
                  <SelectItem value="last_click">Last Click</SelectItem>
                  <SelectItem value="first_click">First Click</SelectItem>
                  <SelectItem value="linear">Linear</SelectItem>
                  <SelectItem value="data_driven">Data Driven</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {conversions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <ArrowRight className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma conversão registrada</p>
              <p className="text-xs mt-1">As conversões são registradas automaticamente quando leads viram clientes</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversions.slice(0, 50).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">
                        {format(new Date(c.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${eventBadgeColor(c.event_name)}`}>
                          {c.event_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{c.utm_source || c.platform || '—'}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">{c.utm_campaign || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{c.attribution_model || 'last_click'}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {Number(c.event_value || 0) > 0 ? `R$ ${Number(c.event_value).toFixed(2)}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
