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
import { generateDistratoSemMultaContent } from '@/lib/documentTemplates';

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

// Vencimento padrão: hoje + 10 dias corridos
function getDueDateIn10Days(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  d.setHours(12, 0, 0, 0);
  return d;
}

function fmtValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function generateEmailTemplate(client: ServiceActionPanelProps['client'], _stage: ServiceActionPanelProps['stage'], valor: number): string {
  const nome = client.full_name || 'Cliente';
  const marca = client.brand_name || 'sua marca';
  const protocolo = client.process_number ? ` (Protocolo: ${client.process_number})` : '';
  return `Prezad@ ${nome},

Venho informar, com urgência, que o INPI publicou uma exigência referente ao processo da marca "${marca}"${protocolo}.

Toda e qualquer publicação possui prazo de 60 (sessenta) dias corridos para o cumprimento desta exigência, contados a partir da data de publicação na Revista da Propriedade Industrial (RPI).

Conforme informado no atendimento inicial e no contrato assinado, de acordo com a Cláusula 5.2 do seu contrato, o cumprimento de exigências formais constitui serviço adicional. Conforme a Cláusula 10.3, será cobrado o valor correspondente a 1 (um) salário mínimo vigente no ano da publicação, o que ocorreu em seu processo, conforme segue em anexo e publicado no Diário Oficial.

Para dar continuidade ao processo, solicitamos o pagamento da taxa de serviço no valor de R$ ${fmtValor(valor)}. Vencimento em 10 dias.

Caso queira falar com o jurídico, informe o melhor dia e horário, pois precisamos resolver isso o quanto antes.

Estamos à disposição para esclarecer qualquer dúvida.

Atenciosamente,

Equipe WebMarcas
www.webmarcas.net
WhatsApp: (11) 91112-0225`;
}

function generateWhatsAppTemplate(client: ServiceActionPanelProps['client'], _stage: ServiceActionPanelProps['stage'], valor: number): string {
  const nome = client.full_name || 'Cliente';
  const marca = client.brand_name || 'sua marca';
  const primeiroNome = nome.split(' ')[0];
  const numero = client.process_number?.trim();
  const trechoNumero = numero ? `, sob o número ${numero}` : '';
  void valor;
  return `Olá, ${primeiroNome}, tudo bem?

Preciso te passar uma atualização importante sobre o seu processo no INPI…

Informamos que foi publicada uma exigência referente ao processo da marca ${marca}${trechoNumero}, na data de hoje!

Ressaltamos que toda publicação do INPI possui um prazo de 60 (sessenta) dias corridos para cumprimento, contados a partir da data de publicação na Revista da Propriedade Industrial (RPI).

Para que eu possa explicar os detalhes da publicação e orientá-lo(a) sobre os próximos passos, preciso agendar uma breve reunião.

Por gentileza, qual o melhor dia e horário para conversarmos?

Fico no aguardo.`;
}

function generateArquivadoEmail(client: ServiceActionPanelProps['client']): string {
  const nome = client.full_name || 'Cliente';
  const marca = client.brand_name?.trim() || '[NOME DA MARCA]';
  const numero = client.process_number?.trim() || '[Nº DO PROCESSO]';
  return `Prezado ${nome},

Venho informar que o INPI publicou o arquivamento do processo da marca "${marca}". N. PROCESSO: ${numero}

Conforme previsto contratualmente, a WebMarcas possui cláusula de garantia para os casos em que o arquivamento ocorra por decisão do INPI durante o exame do processo, possibilitando a abertura de um novo pedido sem cobrança de novos honorários advocatícios.

Entretanto, é importante esclarecer que a garantia contratual não se aplica em casos de arquivamento decorrente do não cumprimento de exigências ou publicações dentro do prazo legal estabelecido pelo INPI.

Dessa forma, precisamos agendar uma reunião com nosso departamento jurídico para análise completa do processo, verificação da aplicação da garantia contratual e definição das próximas medidas para eventual abertura de um novo pedido de registro.

Nos informe, por gentileza, o melhor dia e horário para alinharmos todos os detalhes da forma mais rápida e transparente possível.

Seguimos à disposição para quaisquer esclarecimentos.

Atenciosamente,

Equipe WebMarcas
www.webmarcas.net
WhatsApp: (11) 91112-0225`;
}

function generateArquivadoWhatsApp(client: ServiceActionPanelProps['client']): string {
  const marca = client.brand_name?.trim();
  const numero = client.process_number?.trim();
  const refs: string[] = [];
  if (marca) refs.push(`marca "${marca}"`);
  if (numero) refs.push(`processo nº ${numero}`);
  const ref = refs.length ? ` (${refs.join(' — ')})` : '';
  return `Olá, tudo bem?

Verificamos que o INPI publicou o arquivamento do processo da sua marca${ref}. Precisamos agendar um breve alinhamento com o nosso jurídico para analisar a aplicação da cláusula de garantia contratual e verificar a possibilidade de abertura de um novo processo sem cobrança de novos honorários.

Importante: a garantia é válida para casos de arquivamento por decisão do INPI, não se aplicando quando ocorre perda de prazo para cumprimento de exigência/publicação.

Qual o melhor horário para conversarmos? 🙏

Equipe WebMarcas`;
}

const DISTRATO_LINK_PLACEHOLDER = '[INSERIR LINK]';

function generateDistratoEmail(client: ServiceActionPanelProps['client']): string {
  const nome = client.full_name || 'Cliente';
  const marca = client.brand_name?.trim() || '[NOME DA MARCA]';
  const numero = client.process_number?.trim() || '[Nº DO PROCESSO]';
  return `Prezado(a) ${nome},

Servimo-nos da presente NOTIFICAÇÃO EXTRAJUDICIAL para formalizar o DISTRATO CONTRATUAL e o ENCERRAMENTO DE RESPONSABILIDADE referente ao processo da marca "${marca}" (Nº ${numero}) junto ao INPI.

Conforme a Cláusula 9.1 do contrato firmado entre as partes, o encerramento contratual pode ocorrer mediante comunicação prévia, por escrito, com prazo de 30 (trinta) dias.

Segue abaixo o link do distrato para assinatura digital:

${DISTRATO_LINK_PLACEHOLDER}

Importante: ainda que o instrumento de distrato não seja assinado, esta notificação possui validade jurídica. Caso o distrato não seja assinado dentro do prazo de 30 (trinta) dias, a WebMarcas deixará de possuir qualquer vínculo, responsabilidade de acompanhamento ou obrigação perante o referido processo junto ao INPI.

Permanecemos à disposição para resolver a presente questão de forma amigável e transparente.

Atenciosamente,

Equipe WebMarcas
www.webmarcas.net
WhatsApp: (11) 91112-0225`;
}

function generateDistratoWhatsApp(client: ServiceActionPanelProps['client']): string {
  const marca = client.brand_name?.trim() || '[NOME DA MARCA]';
  return `Olá, tudo bem?

Estamos encaminhando formalmente a NOTIFICAÇÃO EXTRAJUDICIAL referente ao encerramento contratual do processo da marca "${marca}".

Conforme cláusula 9.1 do contrato, o encerramento pode ocorrer mediante comunicação prévia por escrito com prazo de 30 dias.

Segue abaixo o link do distrato para assinatura digital:

${DISTRATO_LINK_PLACEHOLDER}

Importante: mesmo sem assinatura, esta notificação possui validade jurídica. Caso o distrato não seja assinado dentro do prazo de 30 dias, a WebMarcas deixará de possuir qualquer vínculo, responsabilidade de acompanhamento ou obrigação perante o processo junto ao INPI.

Ficamos à disposição para resolver de forma amigável e transparente.

Equipe WebMarcas`;
}

// Distrato HTML é gerado a partir do template padrão `generateDistratoSemMultaContent`.

export function ServiceActionPanel({ client, stage, onClose, onUpdate, alreadySent }: ServiceActionPanelProps) {
  const isArquivado = stage.id === 'arquivado';
  const isDistrato = stage.id === 'distrato';
  const isNotificationOnly = isArquivado || isDistrato;
  const [message, setMessage] = useState(() =>
    isDistrato
      ? generateDistratoEmail(client)
      : isArquivado
        ? generateArquivadoEmail(client)
        : generateEmailTemplate(client, stage, SALARIO_MINIMO_2025)
  );
  const [whatsappMessage, setWhatsappMessage] = useState(() =>
    isDistrato
      ? generateDistratoWhatsApp(client)
      : isArquivado
        ? generateArquivadoWhatsApp(client)
        : generateWhatsAppTemplate(client, stage, SALARIO_MINIMO_2025)
  );
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

  // Vencimento sempre 10 dias corridos após a criação
  const dueDate = getDueDateIn10Days();
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
    if (!isNotificationOnly && valor <= 0) {
      toast.error('Informe o valor da cobrança');
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Upload documents if any
      const docUrls: { url: string; filename: string }[] = [];
      for (const f of files) {
        const fd = new FormData();
        fd.append('clientId', client.id);
        fd.append('file', f);
        const { data: upData, error: upErr } = await supabase.functions.invoke('admin-upload-client-document', {
          body: fd,
        });
        if (upErr || !upData?.success) {
          const msg = (upData as any)?.error || upErr?.message || `Erro ao fazer upload: ${f.name}`;
          throw new Error(msg);
        }
        docUrls.push({ url: upData.document.file_url, filename: f.name });
      }

      // 2. Create invoice via edge function (skip in notification-only modes — arquivado/distrato)
      let invoiceData: any = null;
      let paymentLink = '';
      if (!isNotificationOnly) {
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
        invoiceData = invoiceRes.data;
        paymentLink = invoiceData?.invoice_url || '';
      }

      // 2b. Distrato: criar contrato sem multa e gerar link de assinatura
      let distratoContractId: string | null = null;
      let distratoSignatureUrl = '';
      if (isDistrato) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, cpf, cnpj, cpf_cnpj, company_name, address, city, state, zip_code, email, phone')
          .eq('id', client.id)
          .maybeSingle();
        const nome = (profile?.full_name || client.full_name || 'Cliente').trim();
        const cpf = (profile?.cpf || (profile?.cpf_cnpj && profile.cpf_cnpj.replace(/\D/g, '').length === 11 ? profile.cpf_cnpj : null)) as string | null;
        const cnpj = (profile?.cnpj || (profile?.cpf_cnpj && profile.cpf_cnpj.replace(/\D/g, '').length === 14 ? profile.cpf_cnpj : null)) as string | null;
        const marca = client.brand_name?.trim() || '[Nome da Marca]';
        const nomeEmpresa = profile?.company_name || nome;
        const vars = {
          nome_empresa: nomeEmpresa,
          cnpj: cnpj || cpf || '[a informar]',
          endereco: profile?.address || '[Endereço a informar]',
          cidade: profile?.city || '[Cidade]',
          estado: profile?.state || '[UF]',
          cep: profile?.zip_code || '[CEP]',
          nome_representante: nome,
          cpf_representante: cpf || '[CPF a informar]',
          email: profile?.email || client.email || '',
          telefone: profile?.phone || client.phone || '',
          marca,
        };
        const text = generateDistratoSemMultaContent(vars);
        const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Distrato Contratual sem Multa</title></head><body style="font-family: Arial, Helvetica, sans-serif; color:#111; line-height:1.6; max-width:800px; margin:0 auto; padding:24px; white-space:pre-wrap;">${escaped}</body></html>`;
        const today = new Date().toISOString().split('T')[0];
        const contractNumber = `DIST-${Date.now()}`;

        const { data: created, error: cErr } = await supabase
          .from('contracts')
          .insert({
            user_id: client.id,
            process_id: client.process_id || null,
            contract_number: contractNumber,
            contract_type: 'distrato',
            document_type: 'distrato_sem_multa',
            subject: `Distrato Contratual sem Multa – ${marca}`,
            description: 'Distrato sem multa – encerramento de responsabilidade',
            contract_value: 0,
            penalty_value: 0,
            contract_html: html,
            signature_status: 'pending',
            visible_to_client: true,
            start_date: today,
            created_by: user?.id,
            signatory_name: nome,
            signatory_cpf: cpf,
            signatory_cnpj: cnpj,
            suggested_classes: [],
          })
          .select('id')
          .single();
        if (cErr || !created) throw new Error(cErr?.message || 'Erro ao criar contrato de distrato');
        distratoContractId = created.id;

        const { data: linkRes, error: linkErr } = await supabase.functions.invoke('generate-signature-link', {
          body: { contractId: created.id, baseUrl: window.location.origin },
        });
        if (linkErr || !linkRes?.success) throw new Error(linkErr?.message || 'Erro ao gerar link de assinatura');
        distratoSignatureUrl = linkRes.data?.url || '';
      }

      // Build messages
      let finalEmailMessage: string;
      let finalWhatsappMessage: string;
      if (isDistrato) {
        finalEmailMessage = message.split(DISTRATO_LINK_PLACEHOLDER).join(distratoSignatureUrl || '(link indisponível)');
        finalWhatsappMessage = whatsappMessage.split(DISTRATO_LINK_PLACEHOLDER).join(distratoSignatureUrl || '(link indisponível)');
      } else {
        const linkBlock = paymentLink ? `\n\nLink de pagamento:\n${paymentLink}` : '';
        finalEmailMessage = message + linkBlock;
        finalWhatsappMessage = whatsappMessage + linkBlock;
      }

      // 3. Send multichannel notification (CRM + WhatsApp)
      const notifChannels: string[] = ['crm'];
      if (sendWhatsApp) notifChannels.push('whatsapp');

      await supabase.functions.invoke('send-multichannel-notification', {
        body: {
          user_id: client.id,
          event_type: isDistrato ? 'distrato_enviado' : isArquivado ? 'arquivamento' : 'cobranca_gerada',
          channels: notifChannels,
          custom_message: finalWhatsappMessage,
          data: {
            link: isDistrato ? distratoSignatureUrl : paymentLink,
            valor: String(valor),
            marca: client.brand_name || 'sua marca',
            ...(isDistrato ? { contract_id: distratoContractId } : {}),
          },
        },
      });

      // 4. If email, also send rich email with attachments
      if (sendEmail && client.email) {
        const attachments = docUrls.length > 0 ? docUrls : [];
        await supabase.functions.invoke('send-email', {
          body: {
            to: [client.email],
            subject: isDistrato
              ? 'Notificação Extrajudicial – Distrato Contratual e Encerramento de Responsabilidade'
              : isArquivado
                ? `Arquivamento do processo – ${client.brand_name || 'Marca'} – WebMarcas`
                : `Exigência INPI – ${stage.label} – ${client.brand_name || 'Marca'}`,
            body: finalEmailMessage,
            attachments,
          },
        });
      }

      // 5. Log activity
      await supabase.from('client_activities').insert({
        user_id: client.id,
        admin_id: user?.id,
        activity_type: isDistrato
          ? 'notificacao_distrato'
          : isArquivado
            ? 'notificacao_arquivamento'
            : 'notificacao_cobranca',
        description: isDistrato
          ? `Notificação extrajudicial de distrato enviada: ${stage.label}`
          : isArquivado
            ? `Notificação de arquivamento enviada: ${stage.label}`
            : `Notificação + cobrança enviada: ${stage.label} - R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        metadata: ({
          stage_id: stage.id,
          stage_label: stage.label,
          ...(isDistrato
            ? { contract_id: distratoContractId, signature_url: distratoSignatureUrl }
            : isArquivado
              ? {}
              : {
                  valor,
                  payment_type: paymentType,
                  payment_method: paymentType === 'avista' ? 'pix' : paymentMethod,
                  invoice_id: invoiceData?.invoice_id,
                }),
          channels: { email: sendEmail, whatsapp: sendWhatsApp },
          document_urls: docUrls.map(d => d.url),
        }) as any,
      });

      toast.success(
        isDistrato
          ? 'Notificação de distrato enviada com sucesso!'
          : isArquivado
            ? 'Notificação de arquivamento enviada com sucesso!'
            : 'Notificação e cobrança enviadas com sucesso!'
      );
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
              <p className="text-xs text-muted-foreground">{isDistrato ? 'Notificação Extrajudicial – Distrato' : isArquivado ? 'Notificação ao cliente' : 'Notificação + Cobrança'}</p>
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

        {/* WhatsApp message */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5 text-green-500" /> Mensagem WhatsApp
          </Label>
          <Textarea
            value={whatsappMessage}
            onChange={(e) => setWhatsappMessage(e.target.value)}
            rows={8}
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

        {!isNotificationOnly && <Separator />}

        {/* Billing Section */}
        {!isNotificationOnly && (
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
              setMessage(generateEmailTemplate(client, stage, v));
              setWhatsappMessage(generateWhatsAppTemplate(client, stage, v));
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
            <span>Vencimento: <strong>{dueDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</strong> (10 dias corridos)</span>
          </div>
        </div>
        )}

        {/* Send Button */}
        <Button
          className="w-full h-11 text-sm font-semibold"
          onClick={handleSend}
          disabled={sending || (!sendEmail && !sendWhatsApp) || (!isNotificationOnly && valor <= 0)}
        >
          {sending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
          ) : isDistrato ? (
            <><Send className="h-4 w-4 mr-2" /> {alreadySent ? 'Reenviar Notificação + Distrato' : 'Enviar Notificação + Distrato sem multa'}</>
          ) : isArquivado ? (
            <><Send className="h-4 w-4 mr-2" /> {alreadySent ? 'Reenviar Notificação' : 'Enviar Notificação'}</>
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
