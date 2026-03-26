import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { X, Mail, MessageCircle, Upload, Loader2, Send, FileText, DollarSign, CreditCard, Paperclip, AlertCircle } from 'lucide-react';

interface ServiceActionPanelProps {
  client: {
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    brand_name?: string | null;
    process_number?: string | null;
    process_id?: string | null;
  };
  stage: {
    id: string;
    label: string;
    description?: string;
  };
  onClose: () => void;
  onUpdate: () => void;
  alreadySent?: { sent_at: string; description: string } | null;
}

const SALARIO_MINIMO_2025 = 1518;

function generateTemplate(client: ServiceActionPanelProps['client'], stage: ServiceActionPanelProps['stage'], valor: number): string {
  return `Prezado(a) ${client.full_name || 'Cliente'},

Informamos que o INPI publicou uma exigência referente ao processo da marca "${client.brand_name || 'sua marca'}"${client.process_number ? ` (Protocolo: ${client.process_number})` : ''}.

Conforme o prazo legal, você tem 60 (sessenta) dias corridos para o cumprimento desta exigência, contados a partir da data de publicação na Revista da Propriedade Industrial (RPI).

De acordo com a Cláusula 5.2 do seu contrato, o cumprimento de exigências formais constitui serviço adicional. Conforme a Cláusula 10.3, será cobrado o valor correspondente a 1 (um) salário mínimo vigente no ano da publicação.

Para dar continuidade ao processo, solicitamos o pagamento da taxa de serviço no valor de R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.

Estamos à disposição para esclarecer qualquer dúvida.

Atenciosamente,
Equipe WebMarcas
www.webmarcas.net | WhatsApp: (11) 91112-0225`;
}

export function ServiceActionPanel({ client, stage, onClose, onUpdate, alreadySent }: ServiceActionPanelProps) {
  const [message, setMessage] = useState(() => generateTemplate(client, stage, SALARIO_MINIMO_2025));
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Billing
  const [valor, setValor] = useState(SALARIO_MINIMO_2025);
  const [paymentType, setPaymentType] = useState<'avista' | 'parcelado'>('avista');
  const [paymentMethod, setPaymentMethod] = useState<'boleto' | 'cartao'>('boleto');
  const [installments, setInstallments] = useState(2);

  const [sending, setSending] = useState(false);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 10);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!sendEmail && !sendWhatsApp) {
      toast.error('Selecione pelo menos um canal de envio');
      return;
    }
    if (valor <= 0) {
      toast.error('Informe o valor da cobrança');
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Upload documents if any
      const docUrls: { url: string; filename: string }[] = [];
      for (const f of files) {
        const sanitizedName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${client.id}/${Date.now()}_${sanitizedName}`;
        const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, f);
        if (uploadErr) throw new Error(`Erro ao fazer upload: ${f.name}`);
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
        const docUrl = urlData.publicUrl;
        docUrls.push({ url: docUrl, filename: f.name });

        await supabase.from('documents').insert({
          user_id: client.id,
          name: f.name,
          file_url: docUrl,
          file_size: f.size,
          mime_type: f.type,
          document_type: 'notificacao',
          uploaded_by: user?.id,
          process_id: client.process_id || null,
        });
      }

      // 2. Create invoice via edge function
      const invoiceRes = await supabase.functions.invoke('create-admin-invoice', {
        body: {
          user_id: client.id,
          process_id: client.process_id || null,
          description: `Serviço: ${stage.label} - Exigência INPI`,
          payment_method: paymentType === 'avista' ? 'pix' : paymentMethod,
          payment_type: paymentType,
          installments: paymentType === 'parcelado' ? installments : 1,
          total_value: valor,
          due_date: dueDateStr,
        },
      });

      if (invoiceRes.error) throw new Error(invoiceRes.error.message || 'Erro ao criar cobrança');
      const invoiceData = invoiceRes.data;
      const paymentLink = invoiceData?.invoice_url || '';

      // Build message with payment link
      const finalMessage = paymentLink
        ? message + `\n\nLink de pagamento: ${paymentLink}`
        : message;

      // 3. Send multichannel notification (CRM + WhatsApp)
      const notifChannels: string[] = ['crm'];
      if (sendWhatsApp) notifChannels.push('whatsapp');

      await supabase.functions.invoke('send-multichannel-notification', {
        body: {
          user_id: client.id,
          event_type: 'cobranca_gerada',
          channels: notifChannels,
          custom_message: finalMessage,
          data: {
            link: paymentLink,
            valor: String(valor),
            marca: client.brand_name || 'sua marca',
          },
        },
      });

      // 4. If email, also send rich email with attachments
      if (sendEmail && client.email) {
        const attachments = docUrls.length > 0 ? docUrls : [];
        await supabase.functions.invoke('send-email', {
          body: {
            to: [client.email],
            subject: `Exigência INPI – ${stage.label} – ${client.brand_name || 'Marca'}`,
            body: finalMessage,
            attachments,
          },
        });
      }

      // 5. Log activity
      await supabase.from('client_activities').insert({
        user_id: client.id,
        admin_id: user?.id,
        activity_type: 'notificacao_cobranca',
        description: `Notificação + cobrança enviada: ${stage.label} - R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        metadata: {
          stage_id: stage.id,
          stage_label: stage.label,
          valor,
          payment_type: paymentType,
          payment_method: paymentType === 'avista' ? 'pix' : paymentMethod,
          channels: { email: sendEmail, whatsapp: sendWhatsApp },
          invoice_id: invoiceData?.invoice_id,
          document_urls: docUrls.map(d => d.url),
        } as any,
      });

      toast.success('Notificação e cobrança enviadas com sucesso!');
      onUpdate();
      onClose();
    } catch (err: any) {
      console.error('ServiceActionPanel send error:', err);
      toast.error(err.message || 'Erro ao enviar');
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-4 mt-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Send className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Painel de Ação – {stage.label}</p>
              <p className="text-xs text-muted-foreground">Notificação + Cobrança</p>
            </div>
          </div>
          <button className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Already sent warning */}
        {alreadySent && (
          <Alert className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-700">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-700 dark:text-yellow-300 text-xs">
              Esta notificação já foi enviada em <strong>{new Date(alreadySent.sent_at).toLocaleDateString('pt-BR')}</strong>. Deseja enviar novamente?
            </AlertDescription>
          </Alert>
        )}

        {/* Message */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Mensagem
          </Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={10}
            className="text-xs resize-none bg-background"
          />
        </div>

        {/* Channels */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(!!v)} />
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Email</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={sendWhatsApp} onCheckedChange={(v) => setSendWhatsApp(!!v)} />
            <MessageCircle className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs font-medium">WhatsApp</span>
          </label>
        </div>

        {/* Document Upload */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" /> Documentos (opcional)
          </Label>
          <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />
          <div className="flex flex-col gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs w-fit" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Anexar arquivos
            </Button>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1.5">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[150px]">{f.name}</span>
                    <button onClick={() => removeFile(i)} className="hover:text-destructive shrink-0">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Billing Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Cobrança</span>
          </div>

          {/* Value */}
          <div className="space-y-1">
            <Label className="text-xs">Valor (R$)</Label>
            <Input
              type="number"
              value={valor}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0;
                setValor(v);
                setMessage(generateTemplate(client, stage, v));
              }}
              className="h-9 text-sm bg-background"
              min={0}
              step={0.01}
            />
          </div>

          {/* Payment Type */}
          <div className="space-y-1">
            <Label className="text-xs">Método</Label>
            <RadioGroup value={paymentType} onValueChange={(v) => setPaymentType(v as 'avista' | 'parcelado')} className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="avista" />
                <span className="text-xs">À Vista (PIX)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="parcelado" />
                <span className="text-xs">Parcelado</span>
              </label>
            </RadioGroup>
          </div>

          {/* Installment options */}
          {paymentType === 'parcelado' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Forma</Label>
                <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'boleto' | 'cartao')} className="flex gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <RadioGroupItem value="boleto" />
                    <span className="text-xs">Boleto</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <RadioGroupItem value="cartao" />
                    <span className="text-xs">Cartão</span>
                  </label>
                </RadioGroup>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Parcelas</Label>
                <Select value={String(installments)} onValueChange={(v) => setInstallments(parseInt(v))}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                      <SelectItem key={n} value={String(n)}>
                        {n}x de R$ {(valor / n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Due date info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
            <CreditCard className="h-3.5 w-3.5" />
            <span>Vencimento: <strong>{new Date(dueDateStr).toLocaleDateString('pt-BR')}</strong> (+10 dias)</span>
          </div>
        </div>

        {/* Send Button */}
        <Button
          className="w-full h-11 text-sm font-semibold"
          onClick={handleSend}
          disabled={sending || (!sendEmail && !sendWhatsApp) || valor <= 0}
        >
          {sending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
          ) : alreadySent ? (
            <><Send className="h-4 w-4 mr-2" /> Reenviar Notificação + Cobrança</>
          ) : (
            <><Send className="h-4 w-4 mr-2" /> Enviar Notificação + Cobrança</>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
