import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { SettingsCard } from './SettingsCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Key, Webhook, Zap, Box, Brain, Plus, Trash2, Edit, Copy, 
  RefreshCw, CheckCircle2, Loader2, Save, ExternalLink,
  CreditCard, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface APIKeysSettings {
  system_key: string | null;
  zapier_webhook: string;
  n8n_webhook: string;
  make_webhook: string;
  openai_key: string;
}

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  event: string;
  enabled: boolean;
}

const ASAAS_WEBHOOK_URL = 'https://afuqrzecokubogopgfgt.supabase.co/functions/v1/asaas-webhook';

const webhookEvents = [
  { value: 'lead.created', label: 'Novo Lead' },
  { value: 'lead.converted', label: 'Lead Convertido' },
  { value: 'contract.signed', label: 'Contrato Assinado' },
  { value: 'contract.link_generated', label: 'Link de Assinatura Gerado' },
  { value: 'payment.received', label: 'Pagamento Recebido' },
  { value: 'process.updated', label: 'Processo Atualizado' },
  { value: 'invoice.overdue', label: 'Fatura Vencida' },
  { value: 'sms.sent', label: 'SMS Enviado' },
  { value: 'whatsapp.sent', label: 'WhatsApp Enviado' },
  { value: 'notification.sent', label: 'Notificação Enviada' },
];

export function APIWebhooksSettings() {
  const queryClient = useQueryClient();
  const [isWebhookDialogOpen, setIsWebhookDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [webhookForm, setWebhookForm] = useState({ name: '', url: '', event: 'lead.created' });

  const { data: apiKeysData, isLoading: loadingApiKeys } = useQuery({
    queryKey: ['system-settings', 'api_keys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'api_keys')
        .single();
      if (error) throw error;
      return data?.value as unknown as APIKeysSettings;
    },
  });

  const { data: webhooksData, isLoading: loadingWebhooks } = useQuery({
    queryKey: ['system-settings', 'webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'webhooks')
        .single();
      if (error) throw error;
      return (data?.value as unknown as WebhookConfig[]) || [];
    },
  });

  const [apiKeys, setApiKeys] = useState<APIKeysSettings>({
    system_key: null,
    zapier_webhook: '',
    n8n_webhook: '',
    make_webhook: '',
    openai_key: '',
  });

  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);

  useEffect(() => {
    if (apiKeysData) setApiKeys(apiKeysData);
    if (webhooksData) setWebhooks(webhooksData);
  }, [apiKeysData, webhooksData]);

  const saveApiKeysMutation = useMutation({
    mutationFn: async (data: APIKeysSettings) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: JSON.parse(JSON.stringify(data)), updated_at: new Date().toISOString() })
        .eq('key', 'api_keys');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings', 'api_keys'] });
      toast.success('Configurações de API salvas!');
    },
    onError: () => toast.error('Erro ao salvar configurações'),
  });

  const saveWebhooksMutation = useMutation({
    mutationFn: async (data: WebhookConfig[]) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: JSON.parse(JSON.stringify(data)), updated_at: new Date().toISOString() })
        .eq('key', 'webhooks');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings', 'webhooks'] });
      toast.success('Webhooks salvos!');
    },
    onError: () => toast.error('Erro ao salvar webhooks'),
  });

  const generateApiKey = () => {
    const key = 'wm_live_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    setApiKeys({ ...apiKeys, system_key: key });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  };

  const handleAddWebhook = () => {
    if (!webhookForm.name || !webhookForm.url) return;
    
    const newWebhook: WebhookConfig = {
      id: crypto.randomUUID(),
      name: webhookForm.name,
      url: webhookForm.url,
      event: webhookForm.event,
      enabled: true,
    };

    const updated = editingWebhook 
      ? webhooks.map(w => w.id === editingWebhook.id ? { ...newWebhook, id: editingWebhook.id } : w)
      : [...webhooks, newWebhook];
    
    setWebhooks(updated);
    saveWebhooksMutation.mutate(updated);
    setIsWebhookDialogOpen(false);
    setEditingWebhook(null);
    setWebhookForm({ name: '', url: '', event: 'lead.created' });
  };

  const toggleWebhook = (id: string) => {
    const updated = webhooks.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w);
    setWebhooks(updated);
    saveWebhooksMutation.mutate(updated);
  };

  const deleteWebhook = (id: string) => {
    const updated = webhooks.filter(w => w.id !== id);
    setWebhooks(updated);
    saveWebhooksMutation.mutate(updated);
  };

  const openEditDialog = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook);
    setWebhookForm({ name: webhook.name, url: webhook.url, event: webhook.event });
    setIsWebhookDialogOpen(true);
  };

  const isLoading = loadingApiKeys || loadingWebhooks;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* System API Key */}
      <SettingsCard
        icon={Key}
        iconColor="text-amber-500"
        title="API WebMarcas"
        description="Gere sua chave de API para integrações externas"
        badge={apiKeys.system_key ? 'Configurado' : 'Não configurado'}
        badgeVariant={apiKeys.system_key ? 'default' : 'secondary'}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Chave de API</Label>
            {apiKeysData?.system_key && apiKeys.system_key === apiKeysData.system_key ? (
              <div className="flex gap-2">
                <Input type="password" value="••••••••••••••••" readOnly className="font-mono text-sm bg-muted/40 cursor-not-allowed flex-1" tabIndex={-1} />
                <Button variant="destructive" size="sm" onClick={() => setApiKeys({ ...apiKeys, system_key: null })}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Apagar
                </Button>
                <Button variant="outline" onClick={generateApiKey}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerar
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={apiKeys.system_key || ''}
                  readOnly
                  type="text"
                  placeholder="Clique em gerar para criar uma nova chave"
                  className="font-mono text-sm flex-1"
                />
                <Button variant="outline" onClick={generateApiKey}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {apiKeys.system_key ? 'Regenerar' : 'Gerar'}
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Uma vez salva, a chave não poderá mais ser visualizada. Guarde-a em local seguro.</p>
          </div>

          <Button onClick={() => saveApiKeysMutation.mutate(apiKeys)} disabled={saveApiKeysMutation.isPending}>
            {saveApiKeysMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </SettingsCard>

      {/* Webhooks */}
      <SettingsCard
        icon={Webhook}
        iconColor="text-purple-500"
        title="Webhooks de Saída"
        description="Receba notificações quando eventos acontecerem no sistema"
      >
        <Dialog open={isWebhookDialogOpen} onOpenChange={(open) => {
          setIsWebhookDialogOpen(open);
          if (!open) { setEditingWebhook(null); setWebhookForm({ name: '', url: '', event: 'lead.created' }); }
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full border-dashed">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Webhook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingWebhook ? 'Editar Webhook' : 'Novo Webhook'}</DialogTitle>
              <DialogDescription>Configure um webhook para receber notificações de eventos</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={webhookForm.name} onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })} placeholder="Meu Webhook" />
              </div>
              <div className="space-y-2">
                <Label>Evento</Label>
                <Select value={webhookForm.event} onValueChange={(v) => setWebhookForm({ ...webhookForm, event: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {webhookEvents.map((e) => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <Input value={webhookForm.url} onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsWebhookDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddWebhook} disabled={!webhookForm.name || !webhookForm.url}>
                {editingWebhook ? 'Atualizar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AnimatePresence>
          {webhooks.length > 0 && (
            <div className="space-y-3 mt-4">
              {webhooks.map((webhook) => (
                <motion.div
                  key={webhook.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between p-3 rounded-xl border bg-muted/30"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn("w-2 h-2 rounded-full", webhook.enabled ? "bg-green-500" : "bg-muted-foreground")} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{webhook.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {webhookEvents.find(e => e.value === webhook.event)?.label || webhook.event}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{webhook.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={webhook.enabled} onCheckedChange={() => toggleWebhook(webhook.id)} />
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(webhook)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteWebhook(webhook.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </SettingsCard>

      {/* Asaas Incoming Webhook */}
      <SettingsCard
        icon={CreditCard}
        iconColor="text-emerald-500"
        title="Webhook de Entrada — Asaas"
        description="Configure esta URL no painel do Asaas para receber notificações de pagamento automaticamente"
        badge="Configuração necessária"
        badgeVariant="secondary"
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-xl border bg-muted/30">
            <Info className="h-4 w-4 text-sky-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Cole esta URL em <strong>Asaas → Integrações → Webhooks</strong> para receber eventos de pagamento (confirmado, vencido, estornado) diretamente no CRM.
            </p>
          </div>
          <div className="space-y-2">
            <Label>URL do Webhook</Label>
            <div className="flex gap-2">
              <Input
                value={ASAAS_WEBHOOK_URL}
                readOnly
                className="font-mono text-xs bg-muted/40"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(ASAAS_WEBHOOK_URL)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Eventos suportados: <strong>PAYMENT_RECEIVED</strong>, <strong>PAYMENT_CONFIRMED</strong>, <strong>PAYMENT_OVERDUE</strong>, <strong>PAYMENT_REFUNDED</strong>
          </p>
        </div>
      </SettingsCard>

      {/* External Integrations */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Zapier */}
        <SettingsCard icon={Zap} iconColor="text-orange-500" title="Zapier" badge="BETA" badgeVariant="secondary">
          <p className="text-sm text-muted-foreground mb-3">Conecte com milhares de aplicativos</p>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              value={apiKeys.zapier_webhook}
              onChange={(e) => setApiKeys({ ...apiKeys, zapier_webhook: e.target.value })}
              placeholder="https://hooks.zapier.com/hooks/..."
            />
          </div>
          <Button size="sm" onClick={() => saveApiKeysMutation.mutate(apiKeys)} disabled={saveApiKeysMutation.isPending} className="mt-3">
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </SettingsCard>

        {/* n8n */}
        <SettingsCard icon={Box} iconColor="text-red-500" title="n8n" badge="BETA" badgeVariant="secondary">
          <p className="text-sm text-muted-foreground mb-3">Automação open-source</p>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              value={apiKeys.n8n_webhook}
              onChange={(e) => setApiKeys({ ...apiKeys, n8n_webhook: e.target.value })}
              placeholder="https://n8n.seu-servidor.com/webhook/..."
            />
          </div>
          <Button size="sm" onClick={() => saveApiKeysMutation.mutate(apiKeys)} disabled={saveApiKeysMutation.isPending} className="mt-3">
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </SettingsCard>

        {/* Make */}
        <SettingsCard icon={Box} iconColor="text-violet-500" title="Make (Integromat)" badge="BETA" badgeVariant="secondary">
          <p className="text-sm text-muted-foreground mb-3">Conecte e automatize fluxos</p>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              value={apiKeys.make_webhook}
              onChange={(e) => setApiKeys({ ...apiKeys, make_webhook: e.target.value })}
              placeholder="https://hook.us1.make.com/..."
            />
          </div>
          <Button size="sm" onClick={() => saveApiKeysMutation.mutate(apiKeys)} disabled={saveApiKeysMutation.isPending} className="mt-3">
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </SettingsCard>

        {/* OpenAI */}
        <SettingsCard icon={Brain} iconColor="text-emerald-500" title="OpenAI" badge="IA" badgeVariant="secondary">
          <p className="text-sm text-muted-foreground mb-3">Use IA para automatizar respostas</p>
          <div className="space-y-2">
            <Label>API Key</Label>
            {apiKeysData?.openai_key && apiKeys.openai_key === apiKeysData.openai_key ? (
              <div className="flex gap-2">
                <Input type="password" value="••••••••••••••••" readOnly className="font-mono text-sm bg-muted/40 cursor-not-allowed" tabIndex={-1} />
                <Button variant="destructive" size="sm" onClick={() => setApiKeys({ ...apiKeys, openai_key: '' })}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Apagar
                </Button>
              </div>
            ) : (
              <Input
                value={apiKeys.openai_key}
                onChange={(e) => setApiKeys({ ...apiKeys, openai_key: e.target.value })}
                type="password"
                placeholder="sk-proj-..."
              />
            )}
          </div>
          <Button size="sm" onClick={() => saveApiKeysMutation.mutate(apiKeys)} disabled={saveApiKeysMutation.isPending} className="mt-3">
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </SettingsCard>
      </div>
    </motion.div>
  );
}
