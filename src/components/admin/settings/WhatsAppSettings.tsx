import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Save, Loader2, Smartphone } from 'lucide-react';

interface WhatsAppSettings {
  number: string;
  enabled: boolean;
  welcome_message: string;
}

export function WhatsAppSettings() {
  const queryClient = useQueryClient();

  const { data: whatsappData, isLoading } = useQuery({
    queryKey: ['system-settings', 'whatsapp'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'whatsapp')
        .single();
      
      if (error) throw error;
      return data?.value as unknown as WhatsAppSettings;
    },
  });

  const { data: whatsappConfig } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const [settings, setSettings] = useState<WhatsAppSettings>({
    number: '',
    enabled: true,
    welcome_message: 'Olá! Como posso ajudar?',
  });

  useEffect(() => {
    if (whatsappData) {
      setSettings(whatsappData);
    }
  }, [whatsappData]);

  const saveMutation = useMutation({
    mutationFn: async (data: WhatsAppSettings) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: JSON.parse(JSON.stringify(data)), updated_at: new Date().toISOString() })
        .eq('key', 'whatsapp');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings', 'whatsapp'] });
      toast.success('Configurações do WhatsApp salvas!');
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* WhatsApp Basic Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              <CardTitle>WhatsApp</CardTitle>
            </div>
            <Badge variant={settings.enabled ? 'default' : 'secondary'}>
              {settings.enabled ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <CardDescription>
            Configure o número do WhatsApp e mensagens automáticas para atendimento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Botão Flutuante no Site</Label>
              <p className="text-sm text-muted-foreground">Exibir botão de WhatsApp no canto do site</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp-number" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Número do WhatsApp
            </Label>
            <Input
              id="whatsapp-number"
              value={settings.number}
              onChange={(e) => setSettings({ ...settings, number: e.target.value })}
              placeholder="5511999999999"
            />
            <p className="text-xs text-muted-foreground">
              Digite o número com código do país (55) e DDD, sem espaços ou caracteres especiais
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcome-message">Mensagem de Boas-Vindas</Label>
            <Textarea
              id="welcome-message"
              value={settings.welcome_message}
              onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
              placeholder="Olá! Como posso ajudar?"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Mensagem pré-definida que aparecerá quando o cliente clicar no botão de WhatsApp
            </p>
          </div>

          <Button 
            onClick={() => saveMutation.mutate(settings)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>

      {/* WhatsApp API Config (from whatsapp_config table) */}
      {whatsappConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuração da API WhatsApp Business</CardTitle>
            <CardDescription>
              Configuração avançada para automação via Evolution API ou similar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Instância:</span>
                <span className="font-medium">{whatsappConfig.instance_name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Servidor:</span>
                <span className="font-medium">{whatsappConfig.server_url || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={whatsappConfig.is_active ? 'default' : 'secondary'}>
                  {whatsappConfig.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
