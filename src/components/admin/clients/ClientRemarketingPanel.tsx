import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Send, Rocket, Filter, Eye, Users, Mail,
  Loader2, CheckCircle2, Clock, AlertCircle,
  ShoppingCart, Megaphone, RefreshCw,
  MessageCircle, TestTube2, Info, Pause, Trash2, Play,
  CalendarClock, Zap
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Client {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  company_name?: string | null;
  priority?: string | null;
  pipeline_stage?: string | null;
}

interface Campaign {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  status: string;
  total_sent: number;
  total_opened: number;
  total_queued?: number;
  channels?: string[];
  sent_at: string | null;
  created_at: string;
}

interface ClientRemarketingPanelProps {
  clients: Client[];
  onRefresh: () => void;
}

// CAMPAIGN_TYPES moved below TEMPLATE_VARS

const PIPELINE_FILTER_OPTIONS = [
  { value: 'assinou_contrato', label: 'Assinou Contrato' },
  { value: 'pagamento_pendente', label: 'Pgto. Pendente' },
  { value: 'protocolado', label: 'Protocolado' },
  { value: 'publicacao', label: 'Publicação' },
  { value: 'deferido', label: 'Deferido' },
  { value: 'registrada', label: 'Registrada' },
];

const TEMPLATE_VARS = ['{{nome}}', '{{email}}', '{{empresa}}', '{{marca}}'];

const CAMPAIGN_TYPES = [
  { value: 'acesso_area_cliente', label: '🔑 Acesso Área do Cliente', icon: Users, color: 'text-blue-500' },
  { value: 'institucional', label: '🏢 Institucional (Fortalecimento)', icon: Megaphone, color: 'text-violet-500' },
  { value: 'alerta_educativo', label: '⚠️ Alerta Educativo', icon: AlertCircle, color: 'text-amber-500' },
  { value: 'data_comemorativa', label: '🎉 Data Comemorativa', icon: CalendarClock, color: 'text-pink-500' },
  { value: 'renovacao', label: '🔁 Renovação Futura', icon: RefreshCw, color: 'text-orange-500' },
  { value: 'registro_classe', label: '🛡️ Registro de Nova Classe', icon: ShoppingCart, color: 'text-emerald-500' },
  { value: 'personalizado', label: '✏️ Personalizado', icon: Mail, color: 'text-muted-foreground' },
];

const CAMPAIGN_TEMPLATES: Record<string, { subject: string; body: string }> = {
  acesso_area_cliente: {
    subject: 'Acompanhe seu processo na Área do Cliente',
    body: `Olá {{nome}},

Sua Área do Cliente está disponível para acompanhamento completo do seu processo de registro da marca {{marca}}.

Acesse:
https://www.webmarcas.net/cliente/login

Login: seu e-mail cadastrado
Senha provisória: 123Mudar@

Recomendamos alterar sua senha no primeiro acesso.

Lá você pode:
✅ Acompanhar a situação do processo
✅ Visualizar atualizações
✅ Baixar o contrato
✅ Acessar todas as documentações

Atenciosamente,
WebMarcas Intelligence PI™`,
  },
  institucional: {
    subject: 'Sua marca está protegida? 🔒',
    body: `Olá {{nome}},

Agradecemos por confiar na WebMarcas Intelligence PI™ para a proteção da marca {{marca}}.

Seguimos acompanhando seu processo junto ao INPI com monitoramento contínuo.

Qualquer atualização relevante será informada imediatamente.

Nosso compromisso é garantir que sua marca esteja sempre protegida e em conformidade com as exigências do INPI.

Estamos à disposição para qualquer dúvida.

Atenciosamente,
WebMarcas Intelligence PI™
www.webmarcas.net | (11) 91112-0225`,
  },
  alerta_educativo: {
    subject: 'Dono da marca é quem registra primeiro ⚠️',
    body: `Olá {{nome}},

Lembramos que o direito sobre a marca pertence a quem registra primeiro junto ao INPI — independentemente de quem a criou ou usa há mais tempo.

Se a {{empresa}} possui novas linhas de produtos, serviços ou está expandindo para novos segmentos, é fundamental ampliar a proteção da marca {{marca}}.

📌 Marcas não registradas em todas as classes de atuação ficam vulneráveis a:
• Concorrentes registrando o mesmo nome
• Perda do direito de uso
• Ações judiciais

Fale conosco para avaliar a proteção completa da sua marca.

Atenciosamente,
WebMarcas Intelligence PI™
www.webmarcas.net | (11) 91112-0225`,
  },
  data_comemorativa: {
    subject: '🎉 Uma mensagem especial da WebMarcas Intelligence PI™',
    body: `Olá {{nome}},

A WebMarcas Intelligence PI™ deseja sucesso e prosperidade para a {{empresa}} e para a marca {{marca}}.

Seguimos protegendo o que é seu com dedicação e tecnologia.

Que este momento especial traga ainda mais conquistas para o seu negócio! 🚀

Um grande abraço,
WebMarcas Intelligence PI™
www.webmarcas.net | (11) 91112-0225`,
  },
  renovacao: {
    subject: 'Informação importante sobre a validade da sua marca',
    body: `Olá {{nome}},

Sua marca {{marca}} possui validade de 10 anos após a concessão pelo INPI.

É fundamental manter seus dados atualizados conosco para garantir que a renovação seja realizada no momento correto, evitando:
❌ Perda do registro
❌ Abertura para terceiros registrarem o mesmo nome
❌ Custos extras com processos emergenciais

📋 Recomendamos:
✅ Verificar se os dados cadastrais estão atualizados
✅ Manter o contato ativo conosco
✅ Acompanhar as publicações do INPI pela Área do Cliente

Estamos monitorando seu processo e entraremos em contato quando o prazo de renovação se aproximar.

Atenciosamente,
WebMarcas Intelligence PI™
www.webmarcas.net | (11) 91112-0225`,
  },
  registro_classe: {
    subject: '🛡️ Amplie a proteção da marca {{marca}} — Registro em novas classes',
    body: `Olá {{nome}},

Você já deu um passo importante ao registrar a marca {{marca}} — parabéns pela decisão!

Mas sabia que sua marca pode estar desprotegida em outros segmentos de atuação?

O registro de marca no INPI é feito por classe (NCL), e cada classe cobre um grupo específico de produtos ou serviços. Se a {{empresa}} atua ou pretende atuar em mais de uma área, é essencial registrar a marca nas classes correspondentes.

🔒 Benefícios do registro em múltiplas classes:
✅ Proteção contra concorrentes em outros segmentos
✅ Exclusividade de uso em todas as áreas de atuação
✅ Blindagem jurídica completa
✅ Valorização do ativo intangível da empresa

💡 Clientes que ampliam o registro reduzem em 90% o risco de disputas de marca.

📌 Exemplos comuns:
• Restaurante → Classe 43 (serviços) + Classe 29/30 (produtos alimentícios)
• Loja de roupas → Classe 35 (comércio) + Classe 25 (vestuário)
• Escola → Classe 41 (educação) + Classe 16 (material didático)

Quer saber quais classes são estratégicas para a {{empresa}}? Responda este e-mail ou fale conosco!

Condições especiais para quem já é cliente WebMarcas. 🎯

Atenciosamente,
WebMarcas Intelligence PI™
www.webmarcas.net | (11) 91112-0225`,
  },
  personalizado: { subject: '', body: '' },
};

export function ClientRemarketingPanel({ clients, onRefresh }: ClientRemarketingPanelProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const [campaignName, setCampaignName] = useState('');
  const [campaignType, setCampaignType] = useState('personalizado');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [filterPipeline, setFilterPipeline] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState('all');
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleHour, setScheduleHour] = useState('10');
  const [scheduleMinute, setScheduleMinute] = useState('00');

  const [channelEmail, setChannelEmail] = useState(true);
  const [channelWhatsApp, setChannelWhatsApp] = useState(true);

  useEffect(() => { fetchCampaigns(); }, []);

  const handleTypeChange = (type: string) => {
    setCampaignType(type);
    const tpl = CAMPAIGN_TEMPLATES[type];
    if (tpl) { setSubject(tpl.subject); setBody(tpl.body); }
  };

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const { data } = await supabase
        .from('client_remarketing_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setCampaigns((data as any[]) || []);
    } catch { /* ignore */ }
    finally { setLoadingCampaigns(false); }
  };

  const filteredClients = clients.filter(c => {
    if (!c.email && !c.phone) return false;
    if (channelEmail && !channelWhatsApp && !c.email) return false;
    if (channelWhatsApp && !channelEmail && !c.phone) return false;
    if (filterPipeline.length > 0 && !filterPipeline.includes(c.pipeline_stage || '')) return false;
    if (filterPriority !== 'all' && c.priority !== filterPriority) return false;
    return true;
  });

  const clientsWithEmail = filteredClients.filter(c => c.email).length;
  const clientsWithPhone = filteredClients.filter(c => c.phone).length;

  const togglePipelineFilter = (stage: string) => {
    setFilterPipeline(prev =>
      prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
    );
  };

  const getSelectedChannels = () => {
    const ch: string[] = [];
    if (channelEmail) ch.push('email');
    if (channelWhatsApp) ch.push('whatsapp');
    return ch;
  };

  const handleTestSend = async () => {
    if (!subject || !body) { toast.error('Preencha assunto e corpo antes de testar'); return; }
    if (filteredClients.length === 0) { toast.error('Nenhum cliente disponível para teste'); return; }

    setTesting(true);
    try {
      const testClient = filteredClients[0];
      const { data, error } = await supabase.functions.invoke('send-client-remarketing', {
        body: { test: true, client_ids: [testClient.id], subject, body },
      });
      if (error) throw error;

      const results = data?.results || {};
      toast.success(
        `Teste enviado para ${testClient.full_name}: E-mail=${results.email?.success ? '✅' : '❌'} | WhatsApp=${results.whatsapp?.success ? '✅' : '❌'}`,
        { duration: 6000 }
      );
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar teste');
    } finally { setTesting(false); }
  };

  const handleSendCampaign = async (sendNow: boolean = false) => {
    if (!campaignName || !subject || !body) { toast.error('Preencha todos os campos da campanha'); return; }
    if (filteredClients.length === 0) { toast.error('Nenhum cliente encontrado para os filtros'); return; }
    if (!channelEmail && !channelWhatsApp) { toast.error('Selecione pelo menos um canal'); return; }
    if (!sendNow && !scheduleDate) { toast.error('Selecione uma data para agendar'); return; }

    let scheduledFor: string | undefined;
    if (!sendNow && scheduleDate) {
      const d = new Date(scheduleDate);
      d.setHours(parseInt(scheduleHour), parseInt(scheduleMinute), 0, 0);
      scheduledFor = d.toISOString();
    }

    setSending(true);
    try {
      const { data: campaign, error: cErr } = await supabase
        .from('client_remarketing_campaigns')
        .insert({
          name: campaignName,
          type: campaignType,
          subject,
          body,
          target_status: filterPipeline,
          status: sendNow ? 'em_andamento' : 'agendada',
          total_sent: 0,
          channels: getSelectedChannels(),
        } as any)
        .select()
        .single();
      if (cErr) throw cErr;

      const { data, error } = await supabase.functions.invoke('send-client-remarketing', {
        body: {
          client_ids: filteredClients.map(c => c.id),
          campaign_id: (campaign as any).id,
          subject, body,
          channels: getSelectedChannels(),
          ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
        },
      });
      if (error) throw error;

      const queued = data?.queued || 0;
      toast.success(
        sendNow
          ? `${queued} envios iniciados! Distribuídos em horário comercial (Seg-Sex, 10h-17h).`
          : `${queued} envios agendados para ${format(scheduleDate!, 'dd/MM/yyyy', { locale: ptBR })} às ${scheduleHour}:${scheduleMinute}.`,
        { duration: 6000 }
      );
      setCampaignName(''); setSubject(''); setBody('');
      setShowScheduler(false); setScheduleDate(undefined);
      fetchCampaigns(); onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar campanha');
    } finally { setSending(false); }
  };

  const previewBody = body
    .replace(/\{\{nome\}\}/g, 'João Silva')
    .replace(/\{\{email\}\}/g, 'joao@exemplo.com')
    .replace(/\{\{empresa\}\}/g, 'Empresa XYZ')
    .replace(/\{\{marca\}\}/g, 'MinhaMarca');

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'agendada': return { label: 'Agendada', color: 'text-blue-500', icon: Clock };
      case 'em_andamento': return { label: 'Em Andamento', color: 'text-amber-500', icon: Loader2 };
      case 'concluida': return { label: 'Concluída', color: 'text-emerald-500', icon: CheckCircle2 };
      case 'enviada': return { label: 'Enviada', color: 'text-emerald-500', icon: CheckCircle2 };
      case 'pausada': return { label: 'Pausada', color: 'text-orange-500', icon: Pause };
      default: return { label: status, color: 'text-muted-foreground', icon: AlertCircle };
    }
  };

  const handlePauseCampaign = async (campaignId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'pausada' ? 'agendada' : 'pausada';
    const queueStatus = currentStatus === 'pausada' ? 'pending' : 'paused';
    try {
      await supabase.from('client_remarketing_campaigns').update({ status: newStatus } as any).eq('id', campaignId);
      await supabase.from('client_remarketing_queue').update({ status: queueStatus } as any).eq('campaign_id', campaignId).in('status', ['pending', 'paused']);
      toast.success(newStatus === 'pausada' ? 'Campanha pausada' : 'Campanha retomada');
      fetchCampaigns();
    } catch { toast.error('Erro ao atualizar campanha'); }
  };

  const handleDeleteCampaign = async (campaignId: string, name: string) => {
    if (!confirm(`Excluir a campanha "${name}"? Os envios pendentes serão cancelados.`)) return;
    try {
      await supabase.from('client_remarketing_queue').delete().eq('campaign_id', campaignId).in('status', ['pending', 'paused']);
      await supabase.from('client_remarketing_campaigns').delete().eq('id', campaignId);
      toast.success('Campanha excluída');
      fetchCampaigns();
    } catch { toast.error('Erro ao excluir campanha'); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* LEFT: New Campaign */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-black text-foreground">Nova Campanha (Clientes)</h3>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Limites:</strong> E-mail: 100/dia · WhatsApp: 10/dia (intervalo 10min) · 
            Horário: Seg-Sex 10h–17h. Os envios são distribuídos automaticamente.
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Nome da Campanha</label>
            <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Ex: Upsell Março" className="h-9 text-sm rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Tipo</label>
            <Select value={campaignType} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-9 text-sm rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAMPAIGN_TYPES.map(t => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Canais de Envio</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={channelEmail} onCheckedChange={(v) => setChannelEmail(!!v)} />
                <Mail className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs">E-mail</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={channelWhatsApp} onCheckedChange={(v) => setChannelWhatsApp(!!v)} />
                <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs">WhatsApp</span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Assunto do E-mail</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Assunto..." className="h-9 text-sm rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Corpo da Mensagem
              <span className="ml-2 text-[10px] text-muted-foreground/60">Variáveis: {TEMPLATE_VARS.join(', ')}</span>
            </label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={5} placeholder="Olá {{nome}}, temos uma oferta especial..." className="text-sm rounded-xl resize-none" />
          </div>

          {/* Filters */}
          <div className="space-y-2 p-3 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground">Filtros de Audiência</span>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground">Etapa do Pipeline:</label>
              <div className="flex flex-wrap gap-1.5">
                {PIPELINE_FILTER_OPTIONS.map(s => (
                  <Badge
                    key={s.value}
                    variant={filterPipeline.includes(s.value) ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px]"
                    onClick={() => togglePipelineFilter(s.value)}
                  >
                    {s.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Prioridade:</label>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="h-8 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="high">🔴 Alta</SelectItem>
                  <SelectItem value="medium">🟡 Média</SelectItem>
                  <SelectItem value="low">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 pt-1">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold text-primary">{filteredClients.length} clientes selecionados</span>
              </div>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {clientsWithEmail} com e-mail</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {clientsWithPhone} com telefone</span>
              </div>
            </div>
          </div>

          {/* Preview toggle */}
          {body && (
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="w-full rounded-xl gap-2 text-xs">
              <Eye className="h-3.5 w-3.5" />
              {showPreview ? 'Ocultar Preview' : 'Visualizar Preview'}
            </Button>
          )}

          {showPreview && body && (() => {
            const previewSubject = subject.replace(/\{\{nome\}\}/g, 'João Silva').replace(/\{\{email\}\}/g, 'joao@exemplo.com').replace(/\{\{empresa\}\}/g, 'Empresa XYZ').replace(/\{\{marca\}\}/g, 'MinhaMarca');
            const cleanSubject = previewSubject.replace(/[⚠️🔥💼🏷️🎯📢✅⏰👉💡🛡️🌎📋🔒]/g, '').replace(/\s+/g, ' ').trim();
            const bodyLines = previewBody.split('\n').map(l => l.trim()).filter(l => l.length > 10 && !l.startsWith('Olá') && !l.startsWith('Conte com') && !l.startsWith('Equipe') && !l.startsWith('www.') && !l.startsWith('Um abraço') && !l.startsWith('Abraços'));
            const keyPoints = bodyLines.slice(0, 2).join(' ').substring(0, 150);
            const waPreview = `Olá João Silva! ${cleanSubject}.\n\n${keyPoints}${keyPoints.length >= 150 ? '...' : ''}\n\n👉 Acesse: www.webmarcas.net\n\nPosso te ligar para explicar melhor ou prefere continuar por aqui?`;

            return (
              <div className="space-y-3">
                {channelEmail && (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800">
                      <Mail className="h-4 w-4 text-blue-500" />
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Preview E-mail</span>
                    </div>
                    <div className="p-4 bg-background">
                      <div className="text-[10px] text-muted-foreground mb-1">De: Webmarcas &lt;noreply@webmarcas.net&gt;</div>
                      <div className="text-[10px] text-muted-foreground mb-2">Assunto: <strong className="text-foreground">{previewSubject}</strong></div>
                      <hr className="border-border/50 mb-3" />
                      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{previewBody}</div>
                      <hr className="border-border/30 my-3" />
                      <p className="text-[10px] text-muted-foreground">Webmarcas - Registro de Marcas</p>
                    </div>
                  </div>
                )}
                {channelWhatsApp && (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800">
                      <MessageCircle className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Preview WhatsApp</span>
                      <Badge variant="outline" className="ml-auto text-[9px] border-emerald-300 text-emerald-600 dark:text-emerald-400">Resumida por IA</Badge>
                    </div>
                    <div className="p-4 bg-[#e5ddd5] dark:bg-[#0b141a]">
                      <div className="max-w-[85%] ml-auto">
                        <div className="bg-[#dcf8c6] dark:bg-[#005c4b] rounded-lg rounded-tr-none p-3 shadow-sm">
                          <p className="text-sm text-[#111b21] dark:text-[#e9edef] leading-relaxed">{waPreview}</p>
                          <p className="text-[9px] text-[#667781] dark:text-[#8696a0] text-right mt-1">10:00 ✓✓</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-center text-muted-foreground mt-3 italic">A mensagem será resumida automaticamente por IA</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Test button */}
          <Button variant="outline" onClick={handleTestSend} disabled={testing || !subject || !body || filteredClients.length === 0} className="w-full rounded-xl gap-2 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10">
            {testing ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando teste...</>) : (<><TestTube2 className="h-3.5 w-3.5" /> Enviar Teste (1 e-mail + 1 WhatsApp)</>)}
          </Button>

          {/* Send Now / Schedule buttons */}
          <div className="flex gap-2">
            <Button onClick={() => handleSendCampaign(true)} disabled={sending || filteredClients.length === 0 || (!channelEmail && !channelWhatsApp)} className="flex-1 rounded-xl gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 border-0 text-white">
              {sending ? (<><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>) : (<><Zap className="h-4 w-4" /> Enviar Agora</>)}
            </Button>
            <Button onClick={() => setShowScheduler(!showScheduler)} disabled={sending || filteredClients.length === 0 || (!channelEmail && !channelWhatsApp)} variant={showScheduler ? 'default' : 'outline'} className="flex-1 rounded-xl gap-2">
              <CalendarClock className="h-4 w-4" /> Agendar
            </Button>
          </div>

          {/* Scheduler */}
          {showScheduler && (
            <div className="space-y-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
              <p className="text-xs font-semibold text-foreground">Escolha data e horário:</p>
              <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} locale={ptBR} disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} className="rounded-xl border mx-auto" />
              <div className="flex items-center gap-2 justify-center">
                <Select value={scheduleHour} onValueChange={setScheduleHour}>
                  <SelectTrigger className="w-20 h-8 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 14 }, (_, i) => i + 7).map(h => (<SelectItem key={h} value={String(h).padStart(2, '0')}>{String(h).padStart(2, '0')}h</SelectItem>))}
                  </SelectContent>
                </Select>
                <span className="text-sm font-bold">:</span>
                <Select value={scheduleMinute} onValueChange={setScheduleMinute}>
                  <SelectTrigger className="w-20 h-8 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['00', '15', '30', '45'].map(m => (<SelectItem key={m} value={m}>{m}min</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => handleSendCampaign(false)} disabled={sending || !scheduleDate} className="w-full rounded-xl gap-2 bg-gradient-to-r from-violet-600 to-purple-500 border-0 text-white">
                {sending ? (<><Loader2 className="h-4 w-4 animate-spin" /> Agendando...</>) : (
                  <><Send className="h-4 w-4" /> Agendar Campanha ({filteredClients.length} Clientes)
                    {scheduleDate && ` — ${format(scheduleDate, 'dd/MM', { locale: ptBR })} ${scheduleHour}:${scheduleMinute}`}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* RIGHT: Campaign History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-black text-foreground">Histórico de Campanhas</h3>
        </div>

        {loadingCampaigns ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma campanha enviada ainda</div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {campaigns.map(c => {
              const typeConfig = CAMPAIGN_TYPES.find(t => t.value === c.type);
              const TypeIcon = typeConfig?.icon || Mail;
              const statusInfo = getStatusLabel(c.status);
              const StatusIcon = statusInfo.icon;
              const totalQueued = (c as any).total_queued || 0;
              const channels = (c as any).channels || ['email'];

              return (
                <div key={c.id} className="p-3 rounded-xl border border-border/30 bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <TypeIcon className={cn('h-4 w-4', typeConfig?.color)} />
                    <span className="text-sm font-bold text-foreground truncate">{c.name}</span>
                    <span className={cn('ml-auto flex items-center gap-1 text-[10px] font-bold', statusInfo.color)}>
                      {c.status === 'em_andamento' ? <Loader2 className="h-3 w-3 animate-spin" /> : <StatusIcon className="h-3 w-3" />}
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Send className="h-3 w-3" /> {c.total_sent}/{totalQueued || c.total_sent}</span>
                    {channels.includes('email') && <Mail className="h-3 w-3 text-blue-500" />}
                    {channels.includes('whatsapp') && <MessageCircle className="h-3 w-3 text-emerald-500" />}
                    <span className="ml-auto">{format(new Date(c.created_at), 'dd/MM/yy', { locale: ptBR })}</span>
                  </div>
                  {totalQueued > 0 && c.total_sent < totalQueued && (
                    <div className="mt-2">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all" style={{ width: `${Math.min(100, (c.total_sent / totalQueued) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                  {(c.status === 'agendada' || c.status === 'em_andamento' || c.status === 'pausada') && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/20">
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 rounded-lg" onClick={() => handlePauseCampaign(c.id, c.status)}>
                        {c.status === 'pausada' ? (<><Play className="h-3 w-3 text-emerald-500" /> Retomar</>) : (<><Pause className="h-3 w-3 text-orange-500" /> Pausar</>)}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 rounded-lg text-destructive hover:text-destructive" onClick={() => handleDeleteCampaign(c.id, c.name)}>
                        <Trash2 className="h-3 w-3" /> Excluir
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
