import { useEffect, useState } from 'react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, MessageCircle, CheckCircle2, PauseCircle, RotateCcw, Send } from 'lucide-react';
import { COBRANCA_TEMPLATES, type CobrancaTemplate } from './cobrancaTemplates';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  publicacao: any | null;
  client: any | null;
  marca: string;
}

interface Schedule {
  id?: string;
  publicacao_id: string;
  client_id: string | null;
  data_inicio: string;
  notif_1_at: string | null;
  notif_2_at: string | null;
  notif_3_at: string | null;
  notif_1_channel: string | null;
  notif_2_channel: string | null;
  notif_3_channel: string | null;
  status: string;
  client_responded_at: string | null;
}

export function NotificarClienteDialog({ open, onOpenChange, publicacao, client, marca }: Props) {
  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTpl, setActiveTpl] = useState<CobrancaTemplate>(COBRANCA_TEMPLATES[0]);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);

  const nome = client?.full_name || client?.email || 'Cliente';
  const email = client?.email || '';
  const phone = client?.phone || client?.whatsapp || '';

  // Load or create schedule
  useEffect(() => {
    if (!open || !publicacao) return;
    const load = async () => {
      setLoading(true);
      const { data: existing } = await supabase
        .from('publicacao_cobranca_schedule')
        .select('*')
        .eq('publicacao_id', publicacao.id)
        .maybeSingle();
      if (existing) {
        setSchedule(existing as any);
      } else {
        const dataInicio = publicacao.data_publicacao_rpi || format(new Date(), 'yyyy-MM-dd');
        const { data: user } = await supabase.auth.getUser();
        const { data: created } = await supabase
          .from('publicacao_cobranca_schedule')
          .insert({
            publicacao_id: publicacao.id,
            client_id: publicacao.client_id,
            data_inicio: dataInicio,
            responsavel_admin_id: user.user?.id || null,
          })
          .select()
          .single();
        setSchedule(created as any);
      }
      setLoading(false);
    };
    load();
  }, [open, publicacao]);

  // Suggest next pending template
  useEffect(() => {
    if (!schedule) return;
    const next = !schedule.notif_1_at ? COBRANCA_TEMPLATES[0]
      : !schedule.notif_2_at ? COBRANCA_TEMPLATES[1]
      : !schedule.notif_3_at ? COBRANCA_TEMPLATES[2]
      : COBRANCA_TEMPLATES[2];
    setActiveTpl(next);
    setCustomMessage(next.whatsapp(nome));
  }, [schedule, nome]);

  if (!publicacao) return null;

  const dataInicio = schedule?.data_inicio ? parseISO(schedule.data_inicio) : new Date();
  const daysSince = differenceInDays(new Date(), dataInicio);
  const tpls = [
    { tpl: COBRANCA_TEMPLATES[0], at: schedule?.notif_1_at, ch: schedule?.notif_1_channel },
    { tpl: COBRANCA_TEMPLATES[1], at: schedule?.notif_2_at, ch: schedule?.notif_2_channel },
    { tpl: COBRANCA_TEMPLATES[2], at: schedule?.notif_3_at, ch: schedule?.notif_3_channel },
  ];

  const handleSend = async () => {
    if (!schedule) return;
    if (!sendEmail && !sendWhatsApp) { toast.error('Selecione ao menos um canal'); return; }
    setSending(true);
    const channels: string[] = [];
    if (sendEmail) channels.push('email');
    if (sendWhatsApp) channels.push('whatsapp');

    try {
      const html = activeTpl.email(nome, marca);
      const subject = activeTpl.subject(marca);
      const text = customMessage || activeTpl.whatsapp(nome);

      const { error } = await supabase.functions.invoke('send-multichannel-notification', {
        body: {
          event_type: 'publicacao_cobranca',
          channels,
          recipient: { nome, email, phone, user_id: publicacao.client_id },
          user_id: publicacao.client_id,
          custom_message: text,
          custom_html: html,
          custom_subject: subject,
          data: { marca, titulo: subject },
        },
      });
      if (error) throw error;

      const channel = channels.length === 2 ? 'ambos' : channels[0];
      const now = new Date().toISOString();
      const updates: any = {};
      if (activeTpl.id === 1) { updates.notif_1_at = now; updates.notif_1_channel = channel; }
      if (activeTpl.id === 2) { updates.notif_2_at = now; updates.notif_2_channel = channel; }
      if (activeTpl.id === 3) { updates.notif_3_at = now; updates.notif_3_channel = channel; }

      const { data: upd } = await supabase
        .from('publicacao_cobranca_schedule')
        .update(updates)
        .eq('id', schedule.id!)
        .select()
        .single();
      setSchedule(upd as any);
      queryClient.invalidateQueries({ queryKey: ['publicacao-cobranca'] });
      toast.success(`${activeTpl.label} enviada (${channels.join(' + ')})`);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao enviar notificação');
    } finally {
      setSending(false);
    }
  };

  const handleMarkResponded = async () => {
    if (!schedule?.id) return;
    const { data } = await supabase
      .from('publicacao_cobranca_schedule')
      .update({ status: 'pausado_resposta', client_responded_at: new Date().toISOString() })
      .eq('id', schedule.id)
      .select()
      .single();
    setSchedule(data as any);
    toast.success('Cronograma pausado — cliente respondeu');
  };

  const handleResume = async () => {
    if (!schedule?.id) return;
    const { data } = await supabase
      .from('publicacao_cobranca_schedule')
      .update({ status: 'ativo', client_responded_at: null })
      .eq('id', schedule.id)
      .select()
      .single();
    setSchedule(data as any);
    toast.success('Cronograma reativado');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notificar Cliente — {marca}</DialogTitle>
          <DialogDescription>
            Cronograma de cobrança de 15 / 30 / 50 dias para o cumprimento de exigência do INPI.
          </DialogDescription>
        </DialogHeader>

        {loading || !schedule ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando cronograma...</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/30 text-sm space-y-1">
              <div><span className="text-muted-foreground">Cliente:</span> <strong>{nome}</strong></div>
              <div><span className="text-muted-foreground">Email:</span> {email || <em>não informado</em>}</div>
              <div><span className="text-muted-foreground">WhatsApp:</span> {phone || <em>não informado</em>}</div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-muted-foreground">Status:</span>
                {schedule.status === 'pausado_resposta' ? (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Pausado — cliente respondeu</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Ativo</Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">Dia {daysSince} desde {format(dataInicio, 'dd/MM/yyyy', { locale: ptBR })}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {tpls.map(({ tpl, at, ch }) => {
                const planned = format(addDays(dataInicio, tpl.dueDays), 'dd/MM/yyyy', { locale: ptBR });
                const isActive = activeTpl.id === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => { setActiveTpl(tpl); setCustomMessage(tpl.whatsapp(nome)); }}
                    className={cn(
                      'rounded-lg border p-2 text-left text-xs space-y-1 transition-all',
                      isActive ? 'ring-2 ring-primary border-transparent' : 'border-border hover:border-foreground/30',
                      at && 'bg-emerald-50 dark:bg-emerald-950/30'
                    )}
                  >
                    <div className="font-semibold">{tpl.label}</div>
                    <div className="text-muted-foreground">Programada: {planned}</div>
                    {at ? (
                      <div className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Enviada {format(parseISO(at), 'dd/MM HH:mm', { locale: ptBR })} {ch && `(${ch})`}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">Pendente</div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Canais de envio</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={sendEmail} onCheckedChange={v => setSendEmail(!!v)} disabled={!email} />
                  <Mail className="w-4 h-4" /> Email {!email && <span className="text-xs text-muted-foreground">(sem email)</span>}
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={sendWhatsApp} onCheckedChange={v => setSendWhatsApp(!!v)} disabled={!phone} />
                  <MessageCircle className="w-4 h-4" /> WhatsApp {!phone && <span className="text-xs text-muted-foreground">(sem telefone)</span>}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Mensagem (WhatsApp / texto). Email usa template HTML.</Label>
              <Textarea
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
                rows={10}
                className="text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">Assunto do email: <strong>{activeTpl.subject(marca)}</strong></p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          {schedule?.status === 'pausado_resposta' ? (
            <Button variant="outline" size="sm" onClick={handleResume} className="gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Reativar cronograma
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleMarkResponded} className="gap-1">
              <PauseCircle className="w-3.5 h-3.5" /> Cliente respondeu (pausar)
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button size="sm" onClick={handleSend} disabled={sending || !schedule} className="gap-1">
            <Send className="w-3.5 h-3.5" /> {sending ? 'Enviando...' : `Enviar ${activeTpl.label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}