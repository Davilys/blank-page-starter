import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageCircle, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const fmtDate = (s?: string) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

function buildMessages(nome: string, valor: string, link: string) {
  const linkLine = link || "(link indisponível)";
  const linkHtml = link
    ? `<a href="${link}" target="_blank" rel="noopener">${link}</a>`
    : "(link indisponível)";

  const emailMsg = `Prezado(a) ${nome},

Identificamos que uma das parcelas do acordo firmado para regularização do seu débito encontra-se pendente de pagamento.

Lembramos que esta condição foi concedida de forma excepcional para facilitar a regularização dos valores em aberto e manter as condições negociadas entre as partes.

Solicitamos, por gentileza, a verificação da parcela pendente para evitar o cancelamento dos benefícios concedidos na renegociação e eventual retorno do débito às condições originais.

Segue o boleto vencido — valor ${valor}: ${linkLine}

Caso o pagamento já tenha sido realizado, pedimos desconsiderar este aviso.

Permanecemos à disposição para qualquer esclarecimento.

Atenciosamente,
Financeiro WebMarcas
(11) 91112-0225`;

  const whatsappMsg = `Olá, ${nome}. Tudo bem?

Verificamos que a parcela do acordo realizado anteriormente encontra-se em aberto.

Como essa condição foi criada especialmente para regularização do seu débito, pedimos a gentileza de verificar o pagamento para evitar o cancelamento dos benefícios concedidos na negociação.

Segue o boleto vencido — valor ${valor}: ${linkLine}

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.

Estamos à disposição.`;

  const linkHtmlBlock = linkHtml;
  return { emailMsg, whatsappMsg, linkHtmlBlock };
}

function textToHtml(text: string, link: string) {
  const linkHtml = link
    ? `<a href="${link}" target="_blank" rel="noopener">${link}</a>`
    : "(link indisponível)";
  // Replace literal link occurrence with anchor
  const replaced = link ? text.split(link).join(linkHtml) : text;
  return replaced
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

interface Parcela {
  id: string;
  numero_parcela?: number | string;
  data_vencimento?: string;
  valor?: number;
  invoice_url?: string;
  link_boleto?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parcela: Parcela | null;
  clienteNome?: string | null;
  clienteCpfCnpj?: string | null;
  onSent?: () => void;
}

export function CobrarParcelaAcordoDialog({
  open,
  onOpenChange,
  parcela,
  clienteNome,
  clienteCpfCnpj,
  onSent,
}: Props) {
  const [loadingContato, setLoadingContato] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhats, setSendWhats] = useState(true);
  const [subject, setSubject] = useState("Parcela do acordo em aberto — WebMarcas");
  const [emailBody, setEmailBody] = useState("");
  const [whatsBody, setWhatsBody] = useState("");
  const [sending, setSending] = useState(false);

  const link = parcela?.invoice_url || parcela?.link_boleto || "";
  const valor = useMemo(() => fmtBRL(Number(parcela?.valor) || 0), [parcela]);
  const nome = clienteNome || "Cliente";

  useEffect(() => {
    if (!open || !parcela) return;
    const { emailMsg, whatsappMsg } = buildMessages(nome, valor, link);
    setEmailBody(emailMsg);
    setWhatsBody(whatsappMsg);
    setSubject("Parcela do acordo em aberto — WebMarcas");
    setSendEmail(true);
    setSendWhats(true);

    (async () => {
      if (!clienteCpfCnpj) {
        setEmail("");
        setPhone("");
        return;
      }
      setLoadingContato(true);
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("email, phone")
          .or(`cpf.eq.${clienteCpfCnpj},cpf_cnpj.eq.${clienteCpfCnpj}`)
          .maybeSingle();
        setEmail(prof?.email || "");
        setPhone(prof?.phone || "");
      } finally {
        setLoadingContato(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, parcela?.id]);

  useEffect(() => {
    if (!email) setSendEmail(false);
  }, [email]);
  useEffect(() => {
    if (!phone) setSendWhats(false);
  }, [phone]);

  const canSend =
    !!parcela && !sending && (sendEmail && !!email) || (sendWhats && !!phone);

  const sendLabel =
    sendEmail && sendWhats ? "Enviar pelos dois"
    : sendEmail ? "Enviar por E-mail"
    : sendWhats ? "Enviar por WhatsApp"
    : "Selecione um canal";

  const handleSend = async () => {
    if (!parcela) return;
    if (!sendEmail && !sendWhats) {
      toast.error("Selecione ao menos um canal.");
      return;
    }
    if (!link) {
      toast.error("Parcela sem link de boleto.");
      return;
    }
    setSending(true);
    try {
      const tasks: Promise<any>[] = [];
      if (sendEmail && email) {
        tasks.push(
          supabase.functions.invoke("send-multichannel-notification", {
            body: {
              event_type: "parcela_acordo_vencida",
              channels: ["email"],
              recipient: { nome, email },
              custom_message: emailBody,
              custom_html: textToHtml(emailBody, link),
              custom_subject: subject,
              data: { link, valor },
            },
          })
        );
      }
      if (sendWhats && phone) {
        tasks.push(
          supabase.functions.invoke("send-multichannel-notification", {
            body: {
              event_type: "parcela_acordo_vencida",
              channels: ["whatsapp"],
              recipient: { nome, phone },
              custom_message: whatsBody,
              data: { link, valor },
            },
          })
        );
      }
      const results = await Promise.all(tasks);
      const failed = results.filter((r: any) => r?.error).length;
      if (failed > 0) {
        toast.warning(`Cobrança enviada com ${failed} falha(s).`);
      } else {
        const canais = [sendEmail && email && "e-mail", sendWhats && phone && "WhatsApp"]
          .filter(Boolean)
          .join(" + ");
        toast.success(`Cobrança enviada por ${canais}.`);
      }
      onSent?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao cobrar: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cobrar parcela do acordo — {nome}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Parcela {parcela?.numero_parcela ?? "—"} · Vencimento {fmtDate(parcela?.data_vencimento)} · Valor {valor}
          </p>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
          <div><span className="text-muted-foreground">Cliente:</span> <strong>{nome}</strong></div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Email:</span>
            {loadingContato ? <Loader2 className="h-3 w-3 animate-spin" /> : (email || <Badge variant="outline" className="text-red-600 border-red-500/40">não cadastrado</Badge>)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">WhatsApp:</span>
            {loadingContato ? <Loader2 className="h-3 w-3 animate-spin" /> : (phone || <Badge variant="outline" className="text-red-600 border-red-500/40">não cadastrado</Badge>)}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium">Canais de envio</div>
          <div className="flex items-center gap-4">
            <label className={`flex items-center gap-2 text-sm ${!email ? "opacity-50" : ""}`}>
              <Checkbox checked={sendEmail} disabled={!email} onCheckedChange={(v) => setSendEmail(!!v)} />
              <Mail className="h-4 w-4" /> Email
            </label>
            <label className={`flex items-center gap-2 text-sm ${!phone ? "opacity-50" : ""}`}>
              <Checkbox checked={sendWhats} disabled={!phone} onCheckedChange={(v) => setSendWhats(!!v)} />
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </label>
          </div>
        </div>

        <Tabs defaultValue="email">
          <TabsList>
            <TabsTrigger value="email"><Mail className="h-3 w-3 mr-1" /> Email</TabsTrigger>
            <TabsTrigger value="whats"><MessageCircle className="h-3 w-3 mr-1" /> WhatsApp</TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="space-y-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Assunto</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Mensagem (texto). Será convertida em HTML no envio.</label>
              <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={12} />
            </div>
          </TabsContent>
          <TabsContent value="whats" className="space-y-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Mensagem WhatsApp</label>
              <Textarea value={whatsBody} onChange={(e) => setWhatsBody(e.target.value)} rows={12} />
            </div>
          </TabsContent>
        </Tabs>

        <p className="text-[11px] text-muted-foreground">
          Link do boleto: {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{link}</a> : "indisponível"}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
          <Button
            onClick={handleSend}
            disabled={sending || (!sendEmail && !sendWhats) || !link}
            className="gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sendLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}