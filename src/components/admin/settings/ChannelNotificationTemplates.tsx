import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, Edit, Save, Copy, Loader2, Trash2,
  FileSignature, CreditCard, Bell, MessageCircle, Smartphone,
  AlertCircle, Key
} from 'lucide-react';
import { cn } from '@/lib/utils';

const triggerConfig: Record<string, { label: string; description: string; icon: any; color: string }> = {
  contrato_assinado: {
    label: 'Contrato Assinado',
    description: 'Enviado quando um contrato é assinado',
    icon: FileSignature,
    color: 'bg-green-500/10 text-green-500 border-green-500/20'
  },
  link_assinatura_gerado: {
    label: 'Link de Assinatura',
    description: 'Enviado quando o link de assinatura é gerado',
    icon: FileSignature,
    color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
  },
  pagamento_confirmado: {
    label: 'Pagamento Confirmado',
    description: 'Enviado quando o pagamento é confirmado',
    icon: CreditCard,
    color: 'bg-sky-500/10 text-sky-500 border-sky-500/20'
  },
  cobranca_gerada: {
    label: 'Cobrança Gerada',
    description: 'Enviado quando uma cobrança é criada',
    icon: CreditCard,
    color: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
  },
  fatura_vencida: {
    label: 'Fatura Vencida',
    description: 'Enviado quando uma fatura vence',
    icon: Bell,
    color: 'bg-red-500/10 text-red-500 border-red-500/20'
  },
  formulario_preenchido: {
    label: 'Formulário Preenchido',
    description: 'Enviado quando um lead preenche o formulário',
    icon: Bell,
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
  },
  manual: {
    label: 'Manual',
    description: 'Template para envio manual',
    icon: MessageCircle,
    color: 'bg-muted text-muted-foreground border-border'
  },
  form_abandoned: {
    label: 'Formulário Abandonado',
    description: 'Enviado quando o formulário é abandonado por 24h',
    icon: AlertCircle,
    color: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
  },
  user_created: {
    label: 'Credenciais de Acesso',
    description: 'Enviado quando as credenciais do cliente são criadas',
    icon: Key,
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
  },
};

const availableVariables = [
  { key: '{{nome}}', description: 'Nome do cliente' },
  { key: '{{marca}}', description: 'Nome da marca' },
  { key: '{{numero_processo}}', description: 'Número do processo' },
  { key: '{{link_assinatura}}', description: 'Link para assinatura' },
  { key: '{{data_expiracao}}', description: 'Data de expiração' },
];

interface ChannelNotificationTemplatesProps {
  channel: 'sms' | 'whatsapp';
}

export function ChannelNotificationTemplates({ channel }: ChannelNotificationTemplatesProps) {
  const queryClient = useQueryClient();
  const channelLabel = channel === 'sms' ? 'SMS' : 'WhatsApp';
  const ChannelIcon = channel === 'sms' ? Smartphone : MessageCircle;

  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    trigger_event: '',
    is_active: true
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ['channel-notification-templates', channel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channel_notification_templates')
        .select('*')
        .eq('channel', channel)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase
        .from('channel_notification_templates')
        .insert({ ...payload, channel });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-notification-templates', channel] });
      toast.success('Template criado com sucesso!');
      setIsCreating(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Erro ao criar template: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      const { error } = await supabase
        .from('channel_notification_templates')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-notification-templates', channel] });
      toast.success('Template atualizado!');
      setEditingTemplate(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('channel_notification_templates')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-notification-templates', channel] });
      toast.success('Status atualizado!');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('channel_notification_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-notification-templates', channel] });
      toast.success('Template excluído!');
    }
  });

  const resetForm = () => {
    setFormData({ name: '', message: '', trigger_event: '', is_active: true });
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      message: template.message,
      trigger_event: template.trigger_event,
      is_active: template.is_active
    });
  };

  const handleSave = () => {
    if (!formData.name || !formData.message || !formData.trigger_event) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const insertVariable = (variable: string) => {
    setFormData({ ...formData, message: formData.message + variable });
    toast.success(`Variável ${variable} inserida!`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Provider Info */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <ChannelIcon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-primary">
            Provedor: {channel === 'sms' ? 'Zenvia' : 'BotConversa'}
          </p>
          <p className="text-muted-foreground mt-1">
            {channel === 'sms'
              ? 'Os SMS são enviados via Zenvia. Configure as credenciais em Configurações → Integrações.'
              : 'As mensagens são enviadas via BotConversa. Configure o token em Configurações → Integrações.'
            }
          </p>
        </div>
      </div>

      {/* Create Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => { setIsCreating(true); resetForm(); }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo Template {channelLabel}
        </Button>
      </div>

      {/* Templates List */}
      <div className="grid gap-4">
        {templates?.map((template, index) => {
          const config = triggerConfig[template.trigger_event || ''];
          const TriggerIcon = config?.icon || ChannelIcon;

          return (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="group hover:shadow-lg transition-all duration-300 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={cn("p-3 rounded-xl border shrink-0", config?.color || "bg-muted text-muted-foreground")}>
                        <TriggerIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{template.name}</h3>
                          <Badge
                            variant={template.is_active ? "default" : "secondary"}
                            className={cn(
                              "text-[10px] h-5",
                              template.is_active
                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {template.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {config?.description || 'Gatilho automático'}
                        </p>
                        <p className="text-xs text-muted-foreground/80 line-clamp-2 font-mono bg-muted/30 p-2 rounded">
                          {template.message}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={template.is_active ?? false}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: template.id, is_active: checked })
                        }
                      />
                      <Button variant="outline" size="sm" onClick={() => handleEdit(template)} className="gap-1.5">
                        <Edit className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => {
                          if (confirm('Excluir este template?')) {
                            deleteMutation.mutate(template.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {(!templates || templates.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <ChannelIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum template de {channelLabel} criado ainda.</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Clique em "Novo Template" para começar.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreating || !!editingTemplate} onOpenChange={(open) => { if (!open) { setIsCreating(false); setEditingTemplate(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingTemplate ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {editingTemplate ? `Editar Template ${channelLabel}` : `Novo Template ${channelLabel}`}
            </DialogTitle>
            <DialogDescription>
              {channel === 'sms'
                ? 'Configure a mensagem SMS que será enviada automaticamente.'
                : 'Configure a mensagem WhatsApp que será enviada via BotConversa.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Template *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={`Ex: Confirmação de contrato via ${channelLabel}`}
              />
            </div>

            <div className="space-y-2">
              <Label>Gatilho *</Label>
              <Select value={formData.trigger_event} onValueChange={(v) => setFormData({ ...formData, trigger_event: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o gatilho" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(triggerConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="min-h-[150px]"
                placeholder={`Olá {{nome}}, seu contrato da marca {{marca}} foi assinado com sucesso!`}
              />
            </div>

            {/* Variables */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Variáveis disponíveis</Label>
              <div className="flex flex-wrap gap-1.5">
                {availableVariables.map((v) => (
                  <Button
                    key={v.key}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 font-mono"
                    onClick={() => insertVariable(v.key)}
                    title={v.description}
                  >
                    <Copy className="h-3 w-3" />
                    {v.key}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Template ativo</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setIsCreating(false); setEditingTemplate(null); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
