import { useState } from 'react';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChannelAnalyticsDashboard } from './ChannelAnalyticsDashboard';
import { ChannelNotificationTemplates } from './ChannelNotificationTemplates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function AutomatedWhatsAppSettings() {
  const [telefone, setTelefone] = useState('');
  const [nome, setNome] = useState('Cliente Teste');
  const [mensagem, setMensagem] = useState('Teste de integração WebMarcas');
  const [sending, setSending] = useState(false);

  const handleSendTest = async () => {
    if (!telefone.trim()) {
      toast({ title: 'Telefone obrigatório', description: 'Informe o número de telefone para o teste.', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-multichannel-notification', {
        body: {
          event_type: 'teste_webhook',
          channels: ['whatsapp'],
          recipient: {
            nome: nome.trim(),
            phone: telefone.trim(),
          },
          data: {
            mensagem_custom: mensagem.trim(),
          },
        },
      });

      if (error) throw error;

      const whatsappResult = data?.results?.whatsapp;
      if (whatsappResult?.success) {
        toast({ title: 'Teste enviado com sucesso!', description: 'A requisição foi enviada ao webhook do BotConversa. Agora você pode mapear os campos na interface deles.' });
      } else {
        toast({
          title: 'Erro no envio',
          description: whatsappResult?.error || 'Erro desconhecido ao enviar para o BotConversa.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({ title: 'Erro', description: (err as Error)?.message || 'Falha ao invocar a função.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20">
          <MessageCircle className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">WhatsApp Relatórios</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os templates e acompanhe o desempenho das notificações relatórios via BotConversa
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" />
            Teste de Webhook
          </CardTitle>
          <CardDescription>
            Envie uma requisição de teste ao webhook do BotConversa para que ele detecte os campos automaticamente (telefone, nome, mensagem).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="test-telefone">Telefone</Label>
              <Input id="test-telefone" placeholder="11999999999" value={telefone} onChange={e => setTelefone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-nome">Nome</Label>
              <Input id="test-nome" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-mensagem">Mensagem</Label>
              <Input id="test-mensagem" value={mensagem} onChange={e => setMensagem(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSendTest} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar Requisição de Teste
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <MessageCircle className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <ChannelAnalyticsDashboard channel="whatsapp" />
        </TabsContent>

        <TabsContent value="templates">
          <ChannelNotificationTemplates channel="whatsapp" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
