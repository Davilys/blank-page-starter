import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, MessageCircle, Send, Sparkles } from 'lucide-react';
import { PROPOSTA_DESISTIU_TEMPLATE } from './cobrancaTemplates';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  publicacao: any | null;
  client: any | null;
  marca: string;
}

export function PropostaDesistiuDialog({ open, onOpenChange, publicacao, client, marca }: Props) {
  const [sending, setSending] = useState(false);

  const nome = client?.full_name || client?.email || 'Cliente';
  const email = client?.email || '';
  const phone = client?.phone || client?.whatsapp || '';

  if (!publicacao) return null;

  const tpl = PROPOSTA_DESISTIU_TEMPLATE;
  const subject = tpl.subject(marca);
  const html = tpl.email(nome, marca);
  const whatsappText = tpl.whatsapp(nome);

  const canEmail = !!email;
  const canWhatsApp = !!phone;

  const handleSend = async () => {
    if (!canEmail && !canWhatsApp) {
      toast.error('Cliente não tem e-mail nem WhatsApp cadastrado');
      return;
    }
    setSending(true);
    const channels: string[] = [];
    if (canEmail) channels.push('email');
    if (canWhatsApp) channels.push('whatsapp');
    try {
      const { error } = await supabase.functions.invoke('send-multichannel-notification', {
        body: {
          event_type: 'desistiu_proposta_699',
          channels,
          recipient: { nome, email, phone, user_id: publicacao.client_id },
          user_id: publicacao.client_id,
          custom_message: whatsappText,
          custom_html: html,
          custom_subject: subject,
          data: { marca, titulo: subject },
        },
      });
      if (error) throw error;

      // Best-effort: registrar histórico em publicacao_cobranca_schedule (não bloqueia)
      const now = new Date().toISOString();
      const channel = channels.length === 2 ? 'ambos' : channels[0];
      try {
        const { data: existing } = await supabase
          .from('publicacao_cobranca_schedule')
          .select('id')
          .eq('publicacao_id', publicacao.id)
          .maybeSingle();
        if (existing?.id) {
          await supabase
            .from('publicacao_cobranca_schedule')
            .update({ last_notif_at: now, last_notif_bucket: 'desistiu_proposta' })
            .eq('id', existing.id);
        }
        // log opcional ignorado para evitar dependência de schema específico
      } catch { /* opcional */ }

      toast.success(`Proposta enviada via ${channel === 'ambos' ? 'e-mail e WhatsApp' : channel}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao enviar proposta');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Enviar Proposta Especial — R$ 699,00
          </DialogTitle>
          <DialogDescription>
            Disparo único por e-mail e WhatsApp com a oferta excepcional para o cliente desistente retomar o processo da marca <strong>{marca}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
          <div><span className="text-muted-foreground">Cliente:</span> <strong>{nome}</strong></div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {email || <em className="text-muted-foreground">sem e-mail</em>}</span>
            <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {phone || <em className="text-muted-foreground">sem WhatsApp</em>}</span>
          </div>
          <div className="flex gap-2 pt-1">
            {canEmail && <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Enviará e-mail</Badge>}
            {canWhatsApp && <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Enviará WhatsApp</Badge>}
          </div>
        </div>

        <ScrollArea className="max-h-[50vh] pr-3">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold mb-1 flex items-center gap-1 text-muted-foreground"><Mail className="w-3.5 h-3.5" /> E-mail — Assunto</div>
              <div className="text-sm font-medium">{subject}</div>
              <div className="text-xs font-semibold mt-2 mb-1 text-muted-foreground">Corpo do e-mail</div>
              <div className="rounded border bg-background p-3 text-sm prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
            <div>
              <div className="text-xs font-semibold mb-1 flex items-center gap-1 text-muted-foreground"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</div>
              <div className="rounded border bg-background p-3 text-sm whitespace-pre-wrap">{whatsappText}</div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
          <Button onClick={handleSend} disabled={sending || (!canEmail && !canWhatsApp)} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
            <Send className="w-4 h-4" />
            {sending ? 'Enviando...' : 'Enviar agora (E-mail + WhatsApp)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}