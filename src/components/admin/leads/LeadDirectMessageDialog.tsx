import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Send, Mail, MessageCircle, Loader2, Eye, Info, Zap,
  ShoppingCart, Megaphone, RefreshCw
} from 'lucide-react';

interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  onSent?: () => void;
}

const TEMPLATE_VARS = ['{{nome}}', '{{email}}', '{{empresa}}'];

const CAMPAIGN_TYPES = [
  { value: 'personalizado', label: 'Personalizado', icon: Mail },
  { value: 'abandono_carrinho', label: 'Abandono de Carrinho', icon: ShoppingCart },
  { value: 'promocao', label: 'Promoção', icon: Megaphone },
  { value: 'reengajamento', label: 'Reengajamento', icon: RefreshCw },
];

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
  personalizado: { subject: '', body: '' },
};

export function LeadDirectMessageDialog({ open, onOpenChange, leads, onSent }: Props) {
  const [campaignType, setCampaignType] = useState('personalizado');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelWhatsApp, setChannelWhatsApp] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleTypeChange = (type: string) => {
    setCampaignType(type);
    const tpl = CAMPAIGN_TEMPLATES[type];
    if (tpl) { setSubject(tpl.subject); setBody(tpl.body); }
  };

  const leadsWithEmail = leads.filter(l => l.email).length;
  const leadsWithPhone = leads.filter(l => l.phone).length;

  const getSelectedChannels = () => {
    const ch: string[] = [];
    if (channelEmail) ch.push('email');
    if (channelWhatsApp) ch.push('whatsapp');
    return ch;
  };

  const previewBody = body
    .replace(/\{\{nome\}\}/g, leads[0]?.full_name || 'João Silva')
    .replace(/\{\{email\}\}/g, leads[0]?.email || 'joao@exemplo.com')
    .replace(/\{\{empresa\}\}/g, leads[0]?.company_name || 'Empresa XYZ');

  const handleSend = async () => {
    if (!subject || !body) {
      toast.error('Preencha assunto e corpo da mensagem');
      return;
    }
    if (!channelEmail && !channelWhatsApp) {
      toast.error('Selecione pelo menos um canal');
      return;
    }

    const channels = getSelectedChannels();
    const eligibleLeads = leads.filter(l => {
      if (channelEmail && l.email) return true;
      if (channelWhatsApp && l.phone) return true;
      return false;
    });

    if (eligibleLeads.length === 0) {
      toast.error('Nenhum lead possui contato para os canais selecionados');
      return;
    }

    setSending(true);
    try {
      // Create campaign
      const campaignName = leads.length === 1
        ? `Envio direto - ${leads[0].full_name}`
        : `Envio direto - ${leads.length} leads`;

      const { data: campaign, error: cErr } = await supabase
        .from('lead_remarketing_campaigns')
        .insert({
          name: campaignName,
          type: campaignType,
          subject,
          body,
          status: 'em_andamento',
          total_sent: 0,
          channels,
        } as any)
        .select()
        .single();
      if (cErr) throw cErr;

      const { data, error } = await supabase.functions.invoke('send-lead-remarketing', {
        body: {
          lead_ids: eligibleLeads.map(l => l.id),
          campaign_id: (campaign as any).id,
          subject,
          body,
          channels,
          immediate: true,
        },
      });
      if (error) throw error;

      const emailsSent = data?.emails_sent || 0;
      const whatsappSent = data?.whatsapp_sent || 0;
      const sendErrors = data?.errors || [];

      if (emailsSent > 0 || whatsappSent > 0) {
        const parts: string[] = [];
        if (emailsSent > 0) parts.push(`${emailsSent} e-mail(s)`);
        if (whatsappSent > 0) parts.push(`${whatsappSent} WhatsApp(s)`);
        toast.success(`✅ Enviado com sucesso: ${parts.join(' e ')}!`, { duration: 5000 });
      }
      if (sendErrors.length > 0) {
        toast.error(`Alguns envios falharam: ${sendErrors.slice(0, 2).join('; ')}`, { duration: 6000 });
      }
      onOpenChange(false);
      setSubject('');
      setBody('');
      setCampaignType('personalizado');
      onSent?.();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Enviar Mensagem — {leads.length === 1 ? leads[0].full_name : `${leads.length} leads`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipients */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/30 space-y-2">
            <span className="text-xs font-bold text-muted-foreground">Destinatários:</span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {leads.map(l => (
                <Badge key={l.id} variant="secondary" className="text-[10px] gap-1">
                  {l.full_name}
                  {l.email && <Mail className="h-2.5 w-2.5 text-blue-500" />}
                  {l.phone && <MessageCircle className="h-2.5 w-2.5 text-emerald-500" />}
                </Badge>
              ))}
            </div>
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span>{leadsWithEmail} com e-mail</span>
              <span>{leadsWithPhone} com telefone</span>
            </div>
          </div>

          {/* Limits info */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Limites:</strong> E-mail: 100/dia · WhatsApp: 10/dia (intervalo 10min) ·
              Horário: Seg-Sex 10h–17h. Envios distribuídos automaticamente.
            </p>
          </div>

          {/* Channels */}
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

          {/* Template */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Template</label>
            <Select value={campaignType} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-9 text-sm rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAMPAIGN_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Assunto do E-mail</label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Assunto..."
              className="h-9 text-sm rounded-xl"
            />
          </div>

          {/* Body */}
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
              rows={6}
              placeholder="Olá {{nome}}, temos uma oferta especial..."
              className="text-sm rounded-xl resize-none"
            />
          </div>

          {/* Preview */}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-3.5 w-3.5" />
            {showPreview ? 'Ocultar Preview' : 'Pré-visualizar'}
          </Button>

          {showPreview && (
            <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-2">
              <p className="text-xs font-bold text-foreground">Assunto: {subject.replace(/\{\{nome\}\}/g, leads[0]?.full_name || '')}</p>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {previewBody}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSend}
              disabled={sending || (!subject || !body)}
              className="flex-1 gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:opacity-90"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Enviar Agora
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
