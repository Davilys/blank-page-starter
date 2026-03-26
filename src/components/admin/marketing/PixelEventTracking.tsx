import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useState } from 'react';
import { Send, Loader2, Zap, CheckCircle2 } from 'lucide-react';

interface ConversionEvent {
  name: string;
  label: string;
  description: string;
  count: number;
}

export default function PixelEventTracking() {
  const [sendingEvent, setSendingEvent] = useState<string | null>(null);

  const { data: eventCounts } = useQuery({
    queryKey: ['pixel-event-counts'],
    queryFn: async () => {
      const [leadsRes, contractsSentRes, contractsSignedRes, paidRes] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        supabase.from('contracts').select('id', { count: 'exact', head: true }),
        supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('signature_status', 'signed'),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
      ]);
      return {
        LeadCreated: leadsRes.count || 0,
        ContractSent: contractsSentRes.count || 0,
        ContractSigned: contractsSignedRes.count || 0,
        PaymentConfirmed: paidRes.count || 0,
      };
    },
  });

  const events: ConversionEvent[] = [
    { name: 'Lead', label: 'Lead Criado', description: 'Quando um novo lead é capturado', count: eventCounts?.LeadCreated || 0 },
    { name: 'ViewContent', label: 'Consulta de Viabilidade', description: 'Quando alguém consulta a viabilidade da marca', count: 0 },
    { name: 'InitiateCheckout', label: 'Contrato Enviado', description: 'Quando um contrato é gerado para o cliente', count: eventCounts?.ContractSent || 0 },
    { name: 'CompleteRegistration', label: 'Contrato Assinado', description: 'Quando o cliente assina digitalmente', count: eventCounts?.ContractSigned || 0 },
    { name: 'Purchase', label: 'Pagamento Confirmado', description: 'Quando o pagamento é confirmado (PIX, Boleto, Cartão)', count: eventCounts?.PaymentConfirmed || 0 },
  ];

  const sendTestEvent = async (eventName: string) => {
    setSendingEvent(eventName);
    try {
      const { data, error } = await supabase.functions.invoke('send-meta-conversion', {
        body: {
          event_name: eventName,
          email: 'test@webmarcas.com.br',
          custom_data: { source: 'manual_test' },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Evento "${eventName}" enviado com sucesso`);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSendingEvent(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Pixel Event Tracking
          </CardTitle>
          <CardDescription>
            Eventos de conversão enviados para Meta Conversions API.
            Os eventos são disparados automaticamente nos momentos-chave do CRM.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {events.map((event, i) => (
          <Card key={event.name} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold text-muted-foreground">
                    {i + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-foreground">{event.label}</p>
                      <Badge variant="outline" className="text-[10px] font-mono">{event.name}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">
                    {event.count} registros
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendTestEvent(event.name)}
                    disabled={sendingEvent === event.name}
                  >
                    {sendingEvent === event.name ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Send className="h-3 w-3 mr-1" />
                    )}
                    Testar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-foreground">Automação de Eventos</p>
              <p className="text-xs text-muted-foreground mt-1">
                Os eventos são enviados automaticamente quando as ações correspondentes ocorrem no CRM.
                Use o botão "Testar" para enviar um evento de teste e verificar a integração com o Meta Pixel.
                Os dados do usuário (email, telefone) são hasheados com SHA-256 antes do envio.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
