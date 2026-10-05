import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard, CheckCircle2, XCircle, Loader2, Save, RefreshCw,
  Mail, MessageCircle, MessageSquare, Brain, Shield, Send,
  Sparkles, Globe, FolderSync, Trash2,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────
interface AsaasSettings { environment: 'sandbox' | 'production'; enabled: boolean; api_key: string; }
interface EmailProviderSettings { enabled: boolean; provider: string; api_key: string; from_email: string; from_name: string; }
interface BotconversaSettings { enabled: boolean; webhook_url: string; auth_token: string; test_phone: string; }
interface BotconversaServiceAgentSettings extends BotconversaSettings { company_id: '8572'; }
interface SmsSettings { enabled: boolean; provider: string; api_key: string; sender_name: string; test_phone: string; }
interface OpenAISettings { enabled: boolean; api_key: string; model: string; }
interface INPISettings { enabled: boolean; sync_interval_hours: number; last_sync_at: string | null; }
interface FirecrawlSettings { enabled: boolean; api_key: string; }
interface LovableAISettings { enabled: boolean; }
interface PerfexSettings { enabled: boolean; api_url: string; api_token: string; }

// ── Helpers ──────────────────────────────────────────────────
function useSystemSetting<T>(key: string, fallback: T) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['system-settings', key],
    queryFn: async () => {
      const { data, error } = await supabase.from('system_settings').select('value').eq('key', key).single();
      if (error) throw error;
      return data?.value as unknown as T;
    },
  });

  const [local, setLocal] = useState<T>(fallback);
  useEffect(() => { if (data) setLocal(data); }, [data]);

  const mutation = useMutation({
    mutationFn: async (val: T) => {
      const { error } = await supabase.from('system_settings')
        .upsert({ key, value: JSON.parse(JSON.stringify(val)), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['system-settings', key] }); toast.success('Configurações salvas!'); },
    onError: () => toast.error('Erro ao salvar configurações'),
  });

  return { local, setLocal, isLoading, save: () => mutation.mutate(local), isSaving: mutation.isPending, saved: data ?? fallback };
}

// ── Card wrapper ─────────────────────────────────────────────
function IntegrationCard({
  icon: Icon, iconColor, title, description, badge, badgeVariant = 'secondary', children,
}: {
  icon: React.ElementType; iconColor: string; title: string; description?: string;
  badge?: string; badgeVariant?: 'default' | 'secondary' | 'outline'; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${iconColor}`} />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

// ── Secure API Key input ─────────────────────────────────────
// Once saved (savedValue has content), the key is masked and cannot be viewed, copied or edited.
// The user can only delete it to enter a new one.
function SecretInput({ value, onChange, placeholder, savedValue }: { 
  value: string; onChange: (v: string) => void; placeholder?: string; savedValue?: string;
}) {
  const isSaved = !!(savedValue && savedValue.length > 0 && value === savedValue);

  if (isSaved) {
    return (
      <div className="flex gap-2">
        <Input
          type="password"
          value="••••••••••••••••"
          readOnly
          className="font-mono text-sm bg-muted/40 cursor-not-allowed"
          tabIndex={-1}
        />
        <Button variant="destructive" size="sm" type="button"
          onClick={() => onChange('')}
          className="shrink-0">
          <Trash2 className="h-4 w-4 mr-1" />
          Apagar
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-sm"
      />
    </div>
  );
}

// ── STATUS BADGE ─────────────────────────────────────────────
function StatusBadge({ ok, label }: { ok: boolean; label?: string }) {
  return ok
    ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle2 className="h-3.5 w-3.5" />{label || 'Configurado'}</span>
    : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><XCircle className="h-3.5 w-3.5" />{label || 'Não configurado'}</span>;
}

// ── Section title ────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pt-4 first:pt-0">{children}</h3>;
}

// ── Service chips ────────────────────────────────────────────
function ServiceChips({ services }: { services: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {services.map(s => (
        <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/50">
          {s}
        </span>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
export function IntegrationSettings() {
  // ── Asaas ────────────────────────────────────────────────
  const asaas = useSystemSetting<AsaasSettings>('asaas', { environment: 'sandbox', enabled: false, api_key: '' });
  const [testingAsaas, setTestingAsaas] = useState(false);
  const [asaasStatus, setAsaasStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const testAsaas = async () => {
    setTestingAsaas(true); setAsaasStatus('idle');
    try {
      const { error } = await supabase.functions.invoke('create-asaas-payment', { body: { test: true } });
      if (error?.message?.includes('API')) { setAsaasStatus('error'); toast.error('API Key do Asaas inválida'); }
      else { setAsaasStatus('success'); toast.success('Conexão com Asaas funcionando!'); }
    } catch { setAsaasStatus('error'); toast.error('Erro ao testar conexão com Asaas'); }
    finally { setTestingAsaas(false); }
  };

  // ── Email (Resend) ───────────────────────────────────────
  const email = useSystemSetting<EmailProviderSettings>('email_provider', {
    enabled: true, provider: 'resend', api_key: '', from_email: 'noreply@webmarcas.net', from_name: 'WebMarcas',
  });
  const [testingEmail, setTestingEmail] = useState(false);

  const testEmail = async () => {
    setTestingEmail(true);
    try {
      const { error } = await supabase.functions.invoke('trigger-email-automation', {
        body: { trigger_event: 'test', data: { nome: 'Admin', email: email.local.from_email } },
      });
      if (error) toast.error('Falha ao testar e-mail'); else toast.success('E-mail de teste enviado!');
    } catch { toast.error('Erro ao testar e-mail'); }
    finally { setTestingEmail(false); }
  };

  // ── BotConversa ─────────────────────────────────────────
  const botconversa = useSystemSetting<BotconversaSettings>('botconversa', {
    enabled: false, webhook_url: '', auth_token: '', test_phone: '',
  });
  const [testingBot, setTestingBot] = useState(false);
  const serviceAgentBot = useSystemSetting<BotconversaServiceAgentSettings>('botconversa_service_agent', {
    enabled: false, webhook_url: '', auth_token: '', test_phone: '', company_id: '8572',
  });
  const [testingServiceAgentBot, setTestingServiceAgentBot] = useState(false);

  const testServiceAgentBot = async () => {
    if (!serviceAgentBot.local.webhook_url) { toast.error('Configure a URL do webhook da companhia FINANCEIRO'); return; }
    if (!serviceAgentBot.local.test_phone) { toast.error('Informe um telefone de teste'); return; }
    setTestingServiceAgentBot(true);
    try {
      const { error } = await supabase.functions.invoke('send-multichannel-notification', {
        body: {
          event_type: 'service_agent_test',
          channels: ['whatsapp'],
          recipient: { nome: 'Teste WebMarcas', phone: serviceAgentBot.local.test_phone },
          metadata: { company_id: '8572', source: 'integration_test' },
          data: { mensagem_custom: 'Teste do webhook isolado BotConversa — FINANCEIRO (8572).' },
        },
      });
      if (error) toast.error('Falha ao testar o webhook FINANCEIRO'); else toast.success('Webhook da companhia FINANCEIRO testado!');
    } catch { toast.error('Erro ao testar webhook FINANCEIRO'); }
    finally { setTestingServiceAgentBot(false); }
  };

  const testBotConversa = async () => {
    if (!botconversa.local.webhook_url) { toast.error('Configure a URL do webhook primeiro'); return; }
    if (!botconversa.local.test_phone) { toast.error('Informe um telefone de teste'); return; }
    setTestingBot(true);
    try {
      const { error } = await supabase.functions.invoke('send-multichannel-notification', {
        body: {
          event_type: 'manual',
          channels: ['whatsapp'],
          recipient: { nome: 'Teste WebMarcas', phone: botconversa.local.test_phone },
          data: { mensagem_custom: 'Teste de integração BotConversa — WebMarcas CRM.' },
        },
      });
      if (error) toast.error('Falha ao testar BotConversa'); else toast.success('Mensagem de teste enviada via BotConversa!');
    } catch { toast.error('Erro ao testar BotConversa'); }
    finally { setTestingBot(false); }
  };

  // ── SMS (Zenvia) ────────────────────────────────────────
  const sms = useSystemSetting<SmsSettings>('sms_provider', {
    enabled: false, provider: 'zenvia', api_key: '', sender_name: 'WebMarcas', test_phone: '',
  });
  const [testingSms, setTestingSms] = useState(false);

  const testSms = async () => {
    if (!sms.local.api_key) { toast.error('Configure a API Key primeiro'); return; }
    if (!sms.local.test_phone) { toast.error('Informe um telefone de teste'); return; }
    setTestingSms(true);
    try {
      const { error } = await supabase.functions.invoke('send-multichannel-notification', {
        body: {
          event_type: 'manual',
          channels: ['sms'],
          recipient: { nome: 'Teste WebMarcas', phone: sms.local.test_phone },
          data: { mensagem_custom: 'Teste de SMS — WebMarcas CRM.' },
        },
      });
      if (error) toast.error('Falha ao enviar SMS de teste'); else toast.success('SMS de teste enviado!');
    } catch { toast.error('Erro ao enviar SMS de teste'); }
    finally { setTestingSms(false); }
  };

  // ── OpenAI ──────────────────────────────────────────────
  const openai = useSystemSetting<OpenAISettings>('openai_config', { enabled: true, api_key: '', model: 'gpt-4o-mini' });
  const [testingOpenai, setTestingOpenai] = useState(false);
  const [openaiStatus, setOpenaiStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const testOpenai = async () => {
    setTestingOpenai(true); setOpenaiStatus('idle');
    try {
      const { error } = await supabase.functions.invoke('chat-support', {
        body: { message: 'Olá, teste de conexão.', conversation_id: 'test', test: true },
      });
      if (error) { setOpenaiStatus('error'); toast.error('Falha na conexão com OpenAI'); }
      else { setOpenaiStatus('success'); toast.success('Conexão com OpenAI funcionando!'); }
    } catch { setOpenaiStatus('error'); toast.error('Erro ao testar OpenAI'); }
    finally { setTestingOpenai(false); }
  };

  // ── Firecrawl ───────────────────────────────────────────
  const firecrawl = useSystemSetting<FirecrawlSettings>('firecrawl_config', { enabled: true, api_key: '' });

  // ── Lovable AI ──────────────────────────────────────────
  const lovableAI = useSystemSetting<LovableAISettings>('lovable_ai_config', { enabled: true });

  // ── Perfex CRM ──────────────────────────────────────────
  const perfex = useSystemSetting<PerfexSettings>('perfex_config', { enabled: false, api_url: '', api_token: '' });

  // ── INPI ────────────────────────────────────────────────
  const inpi = useSystemSetting<INPISettings>('inpi_sync', { enabled: true, sync_interval_hours: 24, last_sync_at: null });

  if (asaas.isLoading || email.isLoading || botconversa.isLoading || sms.isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ═══════════════════════ PAGAMENTOS ═══════════════════════ */}
      <SectionTitle>💳 Pagamentos</SectionTitle>

      {/* ── Asaas ─────────────────────────────────────────── */}
      <IntegrationCard
        icon={CreditCard}
        iconColor="text-emerald-500"
        title="Asaas — Gateway de Pagamentos"
        description="Processar pagamentos PIX, Boleto e Cartão de Crédito"
        badge={asaas.local.enabled ? 'Ativo' : 'Inativo'}
        badgeVariant={asaas.local.enabled ? 'default' : 'secondary'}
      >
        <div className="flex items-center justify-between">
          <div>
            <Label>Ativar Integração</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Habilitar processamento de pagamentos</p>
          </div>
          <Switch checked={asaas.local.enabled} onCheckedChange={v => asaas.setLocal({ ...asaas.local, enabled: v })} />
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>API Key Asaas</Label>
            <SecretInput value={asaas.local.api_key} onChange={v => asaas.setLocal({ ...asaas.local, api_key: v })} placeholder="$aact_xxxxxxxxxxxxxxxx" savedValue={(asaas.saved as AsaasSettings).api_key} />
            <p className="text-xs text-muted-foreground">Obtenha em asaas.com → Configurações → Integrações → API. O secret do servidor (ASAAS_API_KEY) tem prioridade.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Ambiente</Label>
            <Select value={asaas.local.environment}
              onValueChange={(v: 'sandbox' | 'production') => asaas.setLocal({ ...asaas.local, environment: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (Testes)</SelectItem>
                <SelectItem value="production">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" onClick={testAsaas} disabled={testingAsaas}>
            {testingAsaas ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Testar Conexão
          </Button>
          {asaasStatus === 'success' && <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />Conectado</span>}
          {asaasStatus === 'error' && <span className="flex items-center gap-1 text-sm text-destructive"><XCircle className="h-4 w-4" />Falha na conexão</span>}
          <Button onClick={asaas.save} disabled={asaas.isSaving} className="ml-auto">
            {asaas.isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
        <StatusBadge ok={!!(asaas.local.api_key || asaas.local.enabled)} />
      </IntegrationCard>

      {/* ═══════════════════════ COMUNICAÇÃO ═══════════════════════ */}
      <SectionTitle>📧 Comunicação</SectionTitle>

      {/* ── Resend (E-mail) ───────────────────────────────── */}
      <IntegrationCard
        icon={Mail}
        iconColor="text-sky-500"
        title="Resend — E-mail Transacional"
        description="Envio de e-mails automáticos para clientes (confirmação, contrato, cobrança)"
        badge={email.local.api_key ? 'Configurado' : 'Não configurado'}
        badgeVariant={email.local.api_key ? 'default' : 'secondary'}
      >
        <div className="flex items-center justify-between">
          <div>
            <Label>Ativar Envio de E-mails</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Habilitar notificações por e-mail</p>
          </div>
          <Switch checked={email.local.enabled} onCheckedChange={v => email.setLocal({ ...email.local, enabled: v })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>API Key Resend</Label>
            <SecretInput value={email.local.api_key} onChange={v => email.setLocal({ ...email.local, api_key: v })} placeholder="re_xxxxxxxxxxxxxxxxxx" savedValue={(email.saved as EmailProviderSettings).api_key} />
            <p className="text-xs text-muted-foreground">Obtenha em resend.com → API Keys</p>
          </div>
          <div className="space-y-1.5">
            <Label>E-mail Remetente</Label>
            <Input value={email.local.from_email} onChange={e => email.setLocal({ ...email.local, from_email: e.target.value })} placeholder="noreply@webmarcas.net" />
          </div>
          <div className="space-y-1.5">
            <Label>Nome do Remetente</Label>
            <Input value={email.local.from_name} onChange={e => email.setLocal({ ...email.local, from_name: e.target.value })} placeholder="WebMarcas" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={testEmail} disabled={testingEmail}>
            {testingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Testar E-mail
          </Button>
          <Button onClick={email.save} disabled={email.isSaving}>
            {email.isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
        <StatusBadge ok={!!email.local.api_key} />
      </IntegrationCard>

      {/* ── BotConversa (WhatsApp) ────────────────────────── */}
      <IntegrationCard
        icon={MessageCircle}
        iconColor="text-green-500"
        title="BotConversa — WhatsApp"
        description="Enviar mensagens automáticas via WhatsApp usando webhook do BotConversa"
        badge={botconversa.local.enabled && botconversa.local.webhook_url ? 'Ativo' : 'Inativo'}
        badgeVariant={botconversa.local.enabled && botconversa.local.webhook_url ? 'default' : 'secondary'}
      >
        <div className="flex items-center justify-between">
          <div>
            <Label>Ativar WhatsApp via BotConversa</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Disparar mensagens automáticas por WhatsApp</p>
          </div>
          <Switch checked={botconversa.local.enabled} onCheckedChange={v => botconversa.setLocal({ ...botconversa.local, enabled: v })} />
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>URL do Webhook BotConversa</Label>
            <Input value={botconversa.local.webhook_url} onChange={e => botconversa.setLocal({ ...botconversa.local, webhook_url: e.target.value })}
              placeholder="https://backend.botconversa.com.br/api/v1/webhooks/..." />
            <p className="text-xs text-muted-foreground">No painel BotConversa → Fluxos → Gatilho "Webhook Externo" → copie a URL</p>
          </div>
          <div className="space-y-1.5">
            <Label>Token de Autenticação (opcional)</Label>
            <SecretInput value={botconversa.local.auth_token} onChange={v => botconversa.setLocal({ ...botconversa.local, auth_token: v })} placeholder="Bearer token se necessário" savedValue={(botconversa.saved as BotconversaSettings).auth_token} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone para Teste (com DDD)</Label>
            <Input value={botconversa.local.test_phone} onChange={e => botconversa.setLocal({ ...botconversa.local, test_phone: e.target.value })}
              placeholder="5511999999999" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={testBotConversa} disabled={testingBot}>
            {testingBot ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
            Testar Webhook
          </Button>
          <Button onClick={botconversa.save} disabled={botconversa.isSaving}>
            {botconversa.isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
        <StatusBadge ok={!!(botconversa.local.webhook_url)} />
      </IntegrationCard>

      {/* ── BotConversa — agente jurídico (companhia FINANCEIRO) ── */}
      <IntegrationCard
        icon={Brain}
        iconColor="text-blue-500"
        title="BotConversa — Agente de processos (FINANCEIRO 8572)"
        description="Webhook exclusivo para eventos do botão Serviços. O webhook BotConversa deve iniciar o fluxo/agente de IA da companhia FINANCEIRO."
        badge={serviceAgentBot.local.enabled && serviceAgentBot.local.webhook_url ? 'Configurado' : 'Inativo'}
        badgeVariant={serviceAgentBot.local.enabled && serviceAgentBot.local.webhook_url ? 'default' : 'secondary'}
      >
        <div className="flex items-center justify-between">
          <div>
            <Label>Ativar agente de processos</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Destino fixo: companhia FINANCEIRO — ID 8572</p>
          </div>
          <Switch checked={serviceAgentBot.local.enabled} onCheckedChange={v => serviceAgentBot.setLocal({ ...serviceAgentBot.local, enabled: v, company_id: '8572' })} />
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>URL do webhook da companhia FINANCEIRO</Label>
            <Input value={serviceAgentBot.local.webhook_url} onChange={e => serviceAgentBot.setLocal({ ...serviceAgentBot.local, webhook_url: e.target.value, company_id: '8572' })}
              placeholder="URL do gatilho webhook do fluxo duplicado" />
          </div>
          <div className="space-y-1.5">
            <Label>Token de autenticação (opcional)</Label>
            <SecretInput value={serviceAgentBot.local.auth_token} onChange={v => serviceAgentBot.setLocal({ ...serviceAgentBot.local, auth_token: v, company_id: '8572' })} placeholder="Bearer token se necessário" savedValue={(serviceAgentBot.saved as BotconversaServiceAgentSettings).auth_token} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone de teste (com DDD)</Label>
            <Input value={serviceAgentBot.local.test_phone} onChange={e => serviceAgentBot.setLocal({ ...serviceAgentBot.local, test_phone: e.target.value, company_id: '8572' })} placeholder="5511999999999" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={testServiceAgentBot} disabled={testingServiceAgentBot}>
            {testingServiceAgentBot ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
            Testar webhook FINANCEIRO
          </Button>
          <Button onClick={() => serviceAgentBot.save()} disabled={serviceAgentBot.isSaving}>
            {serviceAgentBot.isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
        <StatusBadge ok={serviceAgentBot.local.enabled && !!serviceAgentBot.local.webhook_url} />
      </IntegrationCard>

      {/* ── SMS (Zenvia) ──────────────────────────────────── */}
      <IntegrationCard
        icon={MessageSquare}
        iconColor="text-violet-500"
        title="Zenvia — SMS"
        description="Enviar SMS automáticos para clientes (recomendado: Zenvia, líder no Brasil)"
        badge={sms.local.enabled && sms.local.api_key ? 'Ativo' : 'Inativo'}
        badgeVariant={sms.local.enabled && sms.local.api_key ? 'default' : 'secondary'}
      >
        <div className="flex items-center justify-between">
          <div>
            <Label>Ativar Envio de SMS</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Disparar SMS automáticos para clientes</p>
          </div>
          <Switch checked={sms.local.enabled} onCheckedChange={v => sms.setLocal({ ...sms.local, enabled: v })} />
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>API Key Zenvia</Label>
            <SecretInput value={sms.local.api_key} onChange={v => sms.setLocal({ ...sms.local, api_key: v })} placeholder="Seu token da Zenvia" savedValue={(sms.saved as SmsSettings).api_key} />
            <p className="text-xs text-muted-foreground">Obtenha em zenvia.com → Integrações → API Token. Plano gratuito disponível.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Nome do Remetente</Label>
            <Input value={sms.local.sender_name} onChange={e => sms.setLocal({ ...sms.local, sender_name: e.target.value })} placeholder="WebMarcas" maxLength={11} />
            <p className="text-xs text-muted-foreground">Máx. 11 caracteres, sem espaços (aparece como remetente do SMS)</p>
          </div>
          <div className="space-y-1.5">
            <Label>Telefone para Teste (com DDD)</Label>
            <Input value={sms.local.test_phone} onChange={e => sms.setLocal({ ...sms.local, test_phone: e.target.value })} placeholder="5511999999999" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={testSms} disabled={testingSms}>
            {testingSms ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
            Enviar SMS Teste
          </Button>
          <Button onClick={sms.save} disabled={sms.isSaving}>
            {sms.isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
        <StatusBadge ok={!!(sms.local.api_key)} />
      </IntegrationCard>

      {/* ═══════════════════════ INTELIGÊNCIA ARTIFICIAL ═══════════════════════ */}
      <SectionTitle>🤖 Inteligência Artificial</SectionTitle>

      {/* ── OpenAI ───────────────────────────────────────── */}
      <IntegrationCard
        icon={Brain}
        iconColor="text-emerald-500"
        title="OpenAI — ChatGPT / Whisper"
        description="IA para chat, e-mails, recursos jurídicos INPI e transcrição de áudio"
        badge={openai.local.enabled ? 'Ativo' : 'Inativo'}
        badgeVariant={openai.local.enabled ? 'default' : 'secondary'}
      >
        <div className="flex items-center justify-between">
          <div>
            <Label>Ativar Respostas com IA</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Usar OpenAI para automação e respostas inteligentes</p>
          </div>
          <Switch checked={openai.local.enabled} onCheckedChange={v => openai.setLocal({ ...openai.local, enabled: v })} />
        </div>
        <div className="space-y-1.5">
          <Label>Modelo Padrão</Label>
          <Select value={openai.local.model || 'gpt-4o-mini'}
            onValueChange={v => openai.setLocal({ ...openai.local, model: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">GPT-4o (Mais capaz, multimodal)</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o Mini (Rápido e econômico)</SelectItem>
              <SelectItem value="gpt-4.1">GPT-4.1 (Última geração)</SelectItem>
              <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini (Rápido, última geração)</SelectItem>
              <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano (Ultra rápido)</SelectItem>
              <SelectItem value="gpt-4-turbo">GPT-4 Turbo (128k contexto)</SelectItem>
              <SelectItem value="gpt-4">GPT-4 (Clássico)</SelectItem>
              <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Mais barato)</SelectItem>
              <SelectItem value="o4-mini">o4-mini (Raciocínio avançado)</SelectItem>
              <SelectItem value="o3">o3 (Raciocínio complexo)</SelectItem>
              <SelectItem value="o3-mini">o3-mini (Raciocínio econômico)</SelectItem>
              <SelectItem value="gpt-5.1">GPT-5.1 (Mais avançado)</SelectItem>
              <SelectItem value="gpt-5.1-mini">GPT-5.1 Mini (Avançado e econômico)</SelectItem>
              <SelectItem value="o1">o1 (Raciocínio profundo)</SelectItem>
              <SelectItem value="o1-mini">o1-mini (Raciocínio leve)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Este modelo será usado em todos os serviços que dependem da OpenAI.</p>
        </div>
        <div className="space-y-1.5">
          <Label>API Key OpenAI</Label>
          <SecretInput value={openai.local.api_key} onChange={v => openai.setLocal({ ...openai.local, api_key: v })} placeholder="sk-proj-..." savedValue={(openai.saved as OpenAISettings).api_key} />
          <p className="text-xs text-muted-foreground">Obtenha em platform.openai.com → API Keys. O secret do servidor (OPENAI_API_KEY) tem prioridade.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Serviços que utilizam esta chave:</Label>
          <ServiceChips services={[
            'Chat Suporte', 'Assistente de E-mail', 'Recursos INPI',
            'Transcrição de Áudio', 'Análise RPI', 'Chat Jurídico INPI',
          ]} />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" onClick={testOpenai} disabled={testingOpenai}>
            {testingOpenai ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Testar Conexão
          </Button>
          {openaiStatus === 'success' && <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />Conectado</span>}
          {openaiStatus === 'error' && <span className="flex items-center gap-1 text-sm text-destructive"><XCircle className="h-4 w-4" />Falha</span>}
          <Button onClick={openai.save} disabled={openai.isSaving} className="ml-auto">
            {openai.isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
        <StatusBadge ok={openai.local.enabled} />
      </IntegrationCard>

      {/* ── Lovable AI ───────────────────────────────────── */}
      <IntegrationCard
        icon={Sparkles}
        iconColor="text-purple-500"
        title="Lovable AI — IA Integrada"
        description="IA integrada para viabilidade de marca, extração de documentos e notificações multicanal"
        badge={lovableAI.local.enabled ? 'Ativo' : 'Inativo'}
        badgeVariant={lovableAI.local.enabled ? 'default' : 'secondary'}
      >
        <div className="flex items-center justify-between">
          <div>
            <Label>Ativar Lovable AI</Label>
            <p className="text-xs text-muted-foreground mt-0.5">IA com modelos Gemini e GPT-5 para tarefas internas</p>
          </div>
          <Switch checked={lovableAI.local.enabled} onCheckedChange={v => lovableAI.setLocal({ ...lovableAI.local, enabled: v })} />
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/30 p-3">
          <p className="text-xs text-purple-700 dark:text-purple-300">
            🔑 A chave da API Lovable AI (LOVABLE_API_KEY) é provisionada automaticamente pelo sistema. Não é necessário configurar manualmente.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Serviços que utilizam esta chave:</Label>
          <ServiceChips services={[
            'Viabilidade de Marca', 'Extração de Documentos',
            'Processamento de Documentos INPI', 'Notificações Multicanal',
          ]} />
        </div>
        <div className="flex gap-2">
          <Button onClick={lovableAI.save} disabled={lovableAI.isSaving}>
            {lovableAI.isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
        <StatusBadge ok={true} label="Configurado automaticamente" />
      </IntegrationCard>

      {/* ── Firecrawl ────────────────────────────────────── */}
      <IntegrationCard
        icon={Globe}
        iconColor="text-orange-500"
        title="Firecrawl — Web Scraping"
        description="Usado para busca de viabilidade de marca (scraping de sites do INPI e bases públicas)"
        badge={firecrawl.local.enabled && firecrawl.local.api_key ? 'Ativo' : 'Inativo'}
        badgeVariant={firecrawl.local.enabled && firecrawl.local.api_key ? 'default' : 'secondary'}
      >
        <div className="flex items-center justify-between">
          <div>
            <Label>Ativar Firecrawl</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Habilitar web scraping para viabilidade de marca</p>
          </div>
          <Switch checked={firecrawl.local.enabled} onCheckedChange={v => firecrawl.setLocal({ ...firecrawl.local, enabled: v })} />
        </div>
        <div className="space-y-1.5">
          <Label>API Key Firecrawl</Label>
          <SecretInput value={firecrawl.local.api_key} onChange={v => firecrawl.setLocal({ ...firecrawl.local, api_key: v })} placeholder="fc-xxxxxxxxxxxxxxxx" savedValue={(firecrawl.saved as FirecrawlSettings).api_key} />
          <p className="text-xs text-muted-foreground">Obtenha em firecrawl.dev → Dashboard → API Keys. O secret do servidor (FIRECRAWL_API_KEY) tem prioridade.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Serviços que utilizam esta chave:</Label>
          <ServiceChips services={['Viabilidade de Marca (Scraping)']} />
        </div>
        <div className="flex gap-2">
          <Button onClick={firecrawl.save} disabled={firecrawl.isSaving}>
            {firecrawl.isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
        <StatusBadge ok={!!(firecrawl.local.api_key)} />
      </IntegrationCard>

      {/* ═══════════════════════ SISTEMAS EXTERNOS ═══════════════════════ */}
      <SectionTitle>🔗 Sistemas Externos</SectionTitle>

      {/* ── Perfex CRM ───────────────────────────────────── */}
      <IntegrationCard
        icon={FolderSync}
        iconColor="text-blue-500"
        title="Perfex CRM — Sincronização"
        description="Sincronização de projetos e clientes com Perfex CRM externo"
        badge={perfex.local.enabled && perfex.local.api_url ? 'Ativo' : 'Inativo'}
        badgeVariant={perfex.local.enabled && perfex.local.api_url ? 'default' : 'secondary'}
      >
        <div className="flex items-center justify-between">
          <div>
            <Label>Ativar Perfex CRM</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Sincronizar projetos automaticamente</p>
          </div>
          <Switch checked={perfex.local.enabled} onCheckedChange={v => perfex.setLocal({ ...perfex.local, enabled: v })} />
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>URL da API Perfex</Label>
            <Input value={perfex.local.api_url} onChange={e => perfex.setLocal({ ...perfex.local, api_url: e.target.value })}
              placeholder="https://seudominio.com/perfex/api" />
            <p className="text-xs text-muted-foreground">URL base da API do seu Perfex CRM</p>
          </div>
          <div className="space-y-1.5">
            <Label>Token da API</Label>
            <SecretInput value={perfex.local.api_token} onChange={v => perfex.setLocal({ ...perfex.local, api_token: v })} placeholder="Token de autenticação Perfex" savedValue={(perfex.saved as PerfexSettings).api_token} />
            <p className="text-xs text-muted-foreground">Obtenha em Perfex → Configurações → API. Os secrets do servidor (PERFEX_API_URL / PERFEX_API_TOKEN) têm prioridade.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Serviços que utilizam esta integração:</Label>
          <ServiceChips services={['Sincronização de Projetos', 'Sincronização de Clientes']} />
        </div>
        <div className="flex gap-2">
          <Button onClick={perfex.save} disabled={perfex.isSaving}>
            {perfex.isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
        <StatusBadge ok={!!(perfex.local.api_url && perfex.local.api_token)} />
      </IntegrationCard>

      {/* ── INPI ─────────────────────────────────────────── */}
      <IntegrationCard
        icon={Shield}
        iconColor="text-amber-500"
        title="INPI — Monitoramento de Marcas"
        description="Sincronização com a base de dados do INPI para consultas de viabilidade e acompanhamento"
        badge={inpi.local.enabled ? 'Sincronizando' : 'Pausado'}
        badgeVariant={inpi.local.enabled ? 'default' : 'secondary'}
      >
        <div className="flex items-center justify-between">
          <div>
            <Label>Sincronização Automática</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Atualizar base INPI periodicamente</p>
          </div>
          <Switch checked={inpi.local.enabled} onCheckedChange={v => inpi.setLocal({ ...inpi.local, enabled: v })} />
        </div>
        <div className="space-y-1.5">
          <Label>Intervalo de Sincronização (horas)</Label>
          <Input
            type="number"
            min={1}
            max={168}
            value={inpi.local.sync_interval_hours}
            onChange={e => inpi.setLocal({ ...inpi.local, sync_interval_hours: Number(e.target.value) })}
          />
        </div>
        {inpi.local.last_sync_at && (
          <p className="text-xs text-muted-foreground">
            Última sincronização: {new Date(inpi.local.last_sync_at).toLocaleString('pt-BR')}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Credenciais INPI (usuário/senha) são configuradas nos secrets do servidor (INPI_USERNAME / INPI_PASSWORD).
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Serviços que utilizam esta integração:</Label>
          <ServiceChips services={['Revista da Propriedade Industrial', 'Base de Conhecimento', 'Monitoramento de Processos']} />
        </div>
        <Button onClick={inpi.save} disabled={inpi.isSaving}>
          {inpi.isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
        <StatusBadge ok={inpi.local.enabled} />
      </IntegrationCard>

    </div>
  );
}
