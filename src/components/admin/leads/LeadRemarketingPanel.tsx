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
  ShoppingCart, Megaphone, RefreshCw, Flame,
  MessageCircle, TestTube2, Info, Pause, Trash2, Play,
  CalendarClock, Zap
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone?: string | null;
  status: string;
  origin: string | null;
  lead_temperature?: string | null;
  tags?: string[] | null;
  created_at: string;
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

interface LeadRemarketingPanelProps {
  leads: Lead[];
  onRefresh: () => void;
}

const CAMPAIGN_TYPES = [
  { value: 'abandono_carrinho', label: 'Abandono de Carrinho', icon: ShoppingCart, color: 'text-orange-500' },
  { value: 'promocao', label: 'Promoção', icon: Megaphone, color: 'text-violet-500' },
  { value: 'reengajamento', label: 'Reengajamento', icon: RefreshCw, color: 'text-blue-500' },
  { value: 'personalizado', label: 'Personalizado', icon: Mail, color: 'text-emerald-500' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'novo', label: 'Novo' },
  { value: 'contato', label: 'Em Contato' },
  { value: 'qualificado', label: 'Qualificado' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'perdido', label: 'Perdido' },
];

const TEMPLATE_VARS = ['{{nome}}', '{{email}}', '{{empresa}}'];

const CAMPAIGN_TEMPLATES: Record<string, { subject: string; body: string }> = {
  abandono_carrinho: {
    subject: '{{nome}}, sua marca {{empresa}} ainda está desprotegida ⚠️',
    body: `Olá {{nome}},

Notamos que você iniciou o processo de registro da marca {{empresa}}, mas não finalizou. Sabemos que a rotina é corrida, por isso viemos te lembrar!

⚠️ A cada dia sem registro, sua marca fica vulnerável a:
• Ser registrada por terceiros (e você perder o direito de uso)
• Processos judiciais por uso indevido
• Perda total do investimento na sua marca

🎯 Retome agora de onde parou — leva menos de 5 minutos para concluir.

Nosso time está à disposição para te ajudar em cada etapa.

Conte com a Webmarcas!
Equipe Webmarcas
www.webmarcas.net | (11) 91112-0225`,
  },
  promocao: {
    subject: '🔥 Oferta Exclusiva — Registre a marca {{empresa}} com condições especiais!',
    body: `Olá {{nome}},

Temos uma oferta EXCLUSIVA e por tempo limitado para você registrar a marca {{empresa}}:

🏷️ PROMOÇÃO ESPECIAL DE REGISTRO DE MARCA

✅ Entrada facilitada
✅ Parcelamento em até 12x
✅ Acompanhamento completo do processo no INPI
✅ Consultoria de viabilidade GRATUITA

⏰ Essa condição é válida apenas esta semana!

Não perca a chance de proteger legalmente o nome da sua empresa, produto ou serviço com o melhor custo-benefício.

👉 Responda este e-mail ou fale com nosso time agora mesmo.

Abraços,
Equipe Webmarcas
www.webmarcas.net | (11) 91112-0225`,
  },
  reengajamento: {
    subject: '{{nome}}, sentimos sua falta! Novidades da Webmarcas para você 💼',
    body: `Olá {{nome}},

Faz um tempo que não conversamos, e muita coisa mudou por aqui!

📢 Novidades que podem te interessar:

🔹 Processo 100% digital — acompanhe tudo pelo nosso portal exclusivo
🔹 Alertas automáticos de prazos e publicações do INPI
🔹 Suporte dedicado via WhatsApp

💡 Sabia que mais de 70% das marcas no Brasil NÃO são registradas? Proteger a sua é um investimento que valoriza seu negócio e evita dores de cabeça futuras.

Que tal agendar uma conversa rápida com nosso especialista? Sem compromisso!

Estamos aqui para te ajudar.

Um abraço,
Equipe Webmarcas
www.webmarcas.net | (11) 91112-0225`,
  },
  personalizado: {
    subject: '',
    body: '',
  },
};

export function LeadRemarketingPanel({ leads, onRefresh }: LeadRemarketingPanelProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const [campaignName, setCampaignName] = useState('');
  const [campaignType, setCampaignType] = useState('personalizado');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterTemp, setFilterTemp] = useState('all');
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleHour, setScheduleHour] = useState('10');
  const [scheduleMinute, setScheduleMinute] = useState('00');

  // Channel selection
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelWhatsApp, setChannelWhatsApp] = useState(true);

  useEffect(() => { fetchCampaigns(); }, []);

  const handleTypeChange = (type: string) => {
    setCampaignType(type);
    const tpl = CAMPAIGN_TEMPLATES[type];
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
    }
  };

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const { data } = await supabase
        .from('lead_remarketing_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setCampaigns((data as any[]) || []);
    } catch { /* ignore */ }
    finally { setLoadingCampaigns(false); }
  };

  const filteredLeads = leads.filter(l => {
    if (!l.email && !l.phone) return false;
    if (channelEmail && !channelWhatsApp && !l.email) return false;
    if (channelWhatsApp && !channelEmail && !l.phone) return false;
    if (filterStatus.length > 0 && !filterStatus.includes(l.status)) return false;
    if (filterTemp !== 'all' && l.lead_temperature !== filterTemp) return false;
    return true;
  });

  const leadsWithEmail = filteredLeads.filter(l => l.email).length;
  const leadsWithPhone = filteredLeads.filter(l => l.phone).length;

  const toggleStatusFilter = (status: string) => {
    setFilterStatus(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const getSelectedChannels = () => {
    const ch: string[] = [];
    if (channelEmail) ch.push('email');
    if (channelWhatsApp) ch.push('whatsapp');
    return ch;
  };

  const handleTestSend = async () => {
    if (!subject || !body) {
      toast.error('Preencha assunto e corpo antes de testar');
      return;
    }
    if (filteredLeads.length === 0) {
      toast.error('Nenhum lead disponível para teste');
      return;
    }

    setTesting(true);
    try {
      const testLead = filteredLeads[0];
      const { data, error } = await supabase.functions.invoke('send-lead-remarketing', {
        body: {
          test: true,
          lead_ids: [testLead.id],
          subject,
          body,
        },
      });

      if (error) throw error;

      const results = data?.results || {};
      const emailOk = results.email?.success;
      const waOk = results.whatsapp?.success;

      toast.success(
        `Teste enviado para ${testLead.full_name}: E-mail=${emailOk ? '✅' : '❌'} | WhatsApp=${waOk ? '✅' : '❌'}`,
        { duration: 6000 }
      );
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar teste');
    } finally {
      setTesting(false);
    }
  };

  const handleSendCampaign = async (sendNow: boolean = false) => {
    if (!campaignName || !subject || !body) {
      toast.error('Preencha todos os campos da campanha');
      return;
    }
    if (filteredLeads.length === 0) {
      toast.error('Nenhum lead encontrado para os filtros selecionados');
      return;
    }
    if (!channelEmail && !channelWhatsApp) {
      toast.error('Selecione pelo menos um canal de envio');
      return;
    }
    if (!sendNow && !scheduleDate) {
      toast.error('Selecione uma data para agendar');
      return;
    }

    let scheduledFor: string | undefined;
    if (!sendNow && scheduleDate) {
      const d = new Date(scheduleDate);
      d.setHours(parseInt(scheduleHour), parseInt(scheduleMinute), 0, 0);
      scheduledFor = d.toISOString();
    }

    setSending(true);
    try {
      const { data: campaign, error: cErr } = await supabase
        .from('lead_remarketing_campaigns')
        .insert({
          name: campaignName,
          type: campaignType,
          subject,
          body,
          target_status: filterStatus,
          status: sendNow ? 'em_andamento' : 'agendada',
          total_sent: 0,
          channels: getSelectedChannels(),
        } as any)
        .select()
        .single();
      if (cErr) throw cErr;

      const { data, error } = await supabase.functions.invoke('send-lead-remarketing', {
        body: {
          lead_ids: filteredLeads.map(l => l.id),
          campaign_id: (campaign as any).id,
          subject,
          body,
          channels: getSelectedChannels(),
          ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
        },
      });
      if (error) throw error;

      const queued = data?.queued || 0;
      toast.success(
        sendNow
          ? `${queued} envios iniciados! Serão distribuídos em horário comercial (Seg-Sex, 10h-17h).`
          : `${queued} envios agendados para ${format(scheduleDate!, 'dd/MM/yyyy', { locale: ptBR })} às ${scheduleHour}:${scheduleMinute}.`,
        { duration: 6000 }
      );
      setCampaignName('');
      setSubject('');
      setBody('');
      setShowScheduler(false);
      setScheduleDate(undefined);
      fetchCampaigns();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar campanha');
    } finally {
      setSending(false);
    }
  };

  const previewBody = body
    .replace(/\{\{nome\}\}/g, 'João Silva')
    .replace(/\{\{email\}\}/g, 'joao@exemplo.com')
    .replace(/\{\{empresa\}\}/g, 'Empresa XYZ');

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
      await supabase
        .from('lead_remarketing_campaigns')
        .update({ status: newStatus } as any)
        .eq('id', campaignId);

      // Pause/resume pending queue items
      await supabase
        .from('lead_remarketing_queue')
        .update({ status: queueStatus } as any)
        .eq('campaign_id', campaignId)
        .in('status', ['pending', 'paused']);

      toast.success(newStatus === 'pausada' ? 'Campanha pausada' : 'Campanha retomada');
      fetchCampaigns();
    } catch {
      toast.error('Erro ao atualizar campanha');
    }
  };

  const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
    if (!confirm(`Excluir a campanha "${campaignName}"? Os envios pendentes serão cancelados.`)) return;
    try {
      // Delete pending queue items
      await supabase
        .from('lead_remarketing_queue')
        .delete()
        .eq('campaign_id', campaignId)
        .in('status', ['pending', 'paused']);

      await supabase
        .from('lead_remarketing_campaigns')
        .delete()
        .eq('id', campaignId);

      toast.success('Campanha excluída');
      fetchCampaigns();
    } catch {
      toast.error('Erro ao excluir campanha');
    }
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
          <h3 className="text-lg font-black text-foreground">Nova Campanha</h3>
        </div>

        {/* Limits info */}
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
            <Input
              value={campaignName}
              onChange={e => setCampaignName(e.target.value)}
              placeholder="Ex: Reengajamento Fevereiro"
              className="h-9 text-sm rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Tipo</label>
            <Select value={campaignType} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-9 text-sm rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAMPAIGN_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Channel selection */}
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
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Assunto..."
              className="h-9 text-sm rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Corpo da Mensagem
              <span className="ml-2 text-[10px] text-muted-foreground/60">
                Variáveis: {TEMPLATE_VARS.join(', ')}
              </span>
            </label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={5}
              placeholder="Olá {{nome}}, temos uma oferta especial..."
              className="text-sm rounded-xl resize-none"
            />
          </div>

          {/* Filters */}
          <div className="space-y-2 p-3 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground">Filtros de Audiência</span>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground">Status:</label>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTER_OPTIONS.map(s => (
                  <Badge
                    key={s.value}
                    variant={filterStatus.includes(s.value) ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px]"
                    onClick={() => toggleStatusFilter(s.value)}
                  >
                    {s.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Temperatura:</label>
              <Select value={filterTemp} onValueChange={setFilterTemp}>
                <SelectTrigger className="h-8 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="quente">🔥 Quente</SelectItem>
                  <SelectItem value="morno">🌡️ Morno</SelectItem>
                  <SelectItem value="frio">❄️ Frio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 pt-1">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold text-primary">
                  {filteredLeads.length} leads selecionados
                </span>
              </div>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {leadsWithEmail} com e-mail
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" /> {leadsWithPhone} com telefone
                </span>
              </div>
            </div>
          </div>

          {/* Preview toggle */}
          {body && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="w-full rounded-xl gap-2 text-xs"
            >
              <Eye className="h-3.5 w-3.5" />
              {showPreview ? 'Ocultar Preview' : 'Visualizar Preview'}
            </Button>
          )}

          {showPreview && body && (() => {
            const previewSubject = subject
              .replace(/\{\{nome\}\}/g, 'João Silva')
              .replace(/\{\{email\}\}/g, 'joao@exemplo.com')
              .replace(/\{\{empresa\}\}/g, 'Empresa XYZ');

            // Build WhatsApp preview: subject context + key points + CTA
            const cleanSubject = previewSubject
              .replace(/[⚠️🔥💼🏷️🎯📢✅⏰👉💡]/g, '')
              .replace(/\s+/g, ' ')
              .trim();

            const bodyLines = previewBody
              .split('\n')
              .map(l => l.trim())
              .filter(l => l.length > 10 && !l.startsWith('Olá') && !l.startsWith('Conte com') && !l.startsWith('Equipe') && !l.startsWith('www.') && !l.startsWith('Um abraço') && !l.startsWith('Abraços') && !l.startsWith('Nosso time') && !l.startsWith('Estamos aqui'));
            
            const keyPoints = bodyLines.slice(0, 2).join(' ').substring(0, 150);
            const waPreview = `Olá João Silva! ${cleanSubject}.\n\n${keyPoints}${keyPoints.length >= 150 ? '...' : ''}\n\n👉 Acesse: www.webmarcas.net\n\nPosso te ligar para explicar melhor ou prefere continuar por aqui?`;

            return (
              <div className="space-y-3">
                {/* Email Preview */}
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

                {/* WhatsApp Preview */}
                {channelWhatsApp && (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800">
                      <MessageCircle className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Preview WhatsApp</span>
                      <Badge variant="outline" className="ml-auto text-[9px] border-emerald-300 text-emerald-600 dark:text-emerald-400">
                        Resumida por IA
                      </Badge>
                    </div>
                    <div className="p-4 bg-[#e5ddd5] dark:bg-[#0b141a]">
                      <div className="max-w-[85%] ml-auto">
                        <div className="bg-[#dcf8c6] dark:bg-[#005c4b] rounded-lg rounded-tr-none p-3 shadow-sm">
                          <p className="text-sm text-[#111b21] dark:text-[#e9edef] leading-relaxed">{waPreview}</p>
                          <p className="text-[9px] text-[#667781] dark:text-[#8696a0] text-right mt-1">
                            10:00 ✓✓
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-center text-muted-foreground mt-3 italic">
                        A mensagem será resumida automaticamente por IA para evitar banimentos
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Test button */}
          <Button
            variant="outline"
            onClick={handleTestSend}
            disabled={testing || !subject || !body || filteredLeads.length === 0}
            className="w-full rounded-xl gap-2 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
          >
            {testing ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando teste...</>
            ) : (
              <><TestTube2 className="h-3.5 w-3.5" /> Enviar Teste (1 e-mail + 1 WhatsApp)</>
            )}
          </Button>

          {/* Send Now / Schedule buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => handleSendCampaign(true)}
              disabled={sending || filteredLeads.length === 0 || (!channelEmail && !channelWhatsApp)}
              className="flex-1 rounded-xl gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 border-0 text-white"
            >
              {sending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
              ) : (
                <><Zap className="h-4 w-4" /> Enviar Agora</>
              )}
            </Button>
            <Button
              onClick={() => setShowScheduler(!showScheduler)}
              disabled={sending || filteredLeads.length === 0 || (!channelEmail && !channelWhatsApp)}
              variant={showScheduler ? 'default' : 'outline'}
              className="flex-1 rounded-xl gap-2"
            >
              <CalendarClock className="h-4 w-4" /> Agendar
            </Button>
          </div>

          {/* Scheduler */}
          {showScheduler && (
            <div className="space-y-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
              <p className="text-xs font-semibold text-foreground">Escolha data e horário:</p>
              <Calendar
                mode="single"
                selected={scheduleDate}
                onSelect={setScheduleDate}
                locale={ptBR}
                disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                className="rounded-xl border mx-auto"
              />
              <div className="flex items-center gap-2 justify-center">
                <Select value={scheduleHour} onValueChange={setScheduleHour}>
                  <SelectTrigger className="w-20 h-8 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 14 }, (_, i) => i + 7).map(h => (
                      <SelectItem key={h} value={String(h).padStart(2, '0')}>{String(h).padStart(2, '0')}h</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm font-bold">:</span>
                <Select value={scheduleMinute} onValueChange={setScheduleMinute}>
                  <SelectTrigger className="w-20 h-8 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['00', '15', '30', '45'].map(m => (
                      <SelectItem key={m} value={m}>{m}min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => handleSendCampaign(false)}
                disabled={sending || !scheduleDate}
                className="w-full rounded-xl gap-2 bg-gradient-to-r from-violet-600 to-purple-500 border-0 text-white"
              >
                {sending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Agendando...</>
                ) : (
                  <><Send className="h-4 w-4" /> Agendar Campanha ({filteredLeads.length} Leads)
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
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhuma campanha enviada ainda
          </div>
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
                      {c.status === 'em_andamento' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <StatusIcon className="h-3 w-3" />
                      )}
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Send className="h-3 w-3" /> {c.total_sent}/{totalQueued || c.total_sent}
                    </span>
                    {channels.includes('email') && (
                      <Mail className="h-3 w-3 text-blue-500" />
                    )}
                    {channels.includes('whatsapp') && (
                      <MessageCircle className="h-3 w-3 text-emerald-500" />
                    )}
                    <span className="ml-auto">
                      {format(new Date(c.created_at), 'dd/MM/yy', { locale: ptBR })}
                    </span>
                  </div>
                  {totalQueued > 0 && c.total_sent < totalQueued && (
                    <div className="mt-2">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all"
                          style={{ width: `${Math.min(100, (c.total_sent / totalQueued) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {/* Actions */}
                  {(c.status === 'agendada' || c.status === 'em_andamento' || c.status === 'pausada') && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/20">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] gap-1 rounded-lg"
                        onClick={() => handlePauseCampaign(c.id, c.status)}
                      >
                        {c.status === 'pausada' ? (
                          <><Play className="h-3 w-3 text-emerald-500" /> Retomar</>
                        ) : (
                          <><Pause className="h-3 w-3 text-orange-500" /> Pausar</>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] gap-1 rounded-lg text-destructive hover:text-destructive"
                        onClick={() => handleDeleteCampaign(c.id, c.name)}
                      >
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
