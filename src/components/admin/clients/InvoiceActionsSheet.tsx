import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, Send, Handshake, AlertTriangle, RefreshCw, Lock, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { FazerAcordoDialog } from "./FazerAcordoDialog";
import { classificarCobranca, contaNoTotalAtivo, LABEL_ORIGEM, LABEL_CLASSIFICACAO, type OrigemCobranca } from "@/lib/financeiro/statusCobranca";

export interface InvoiceLike {
  id: string;
  description: string | null;
  amount: number;
  status: string;
  due_date: string;
  invoice_url?: string | null;
  asaas_invoice_id?: string | null;
  acordo_id?: string | null;
  sync_status?: string | null;
  origem?: string | null;
}

interface Props {
  invoice: InvoiceLike | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canManageFinance: boolean;
  onChanged: () => void;
}

const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (iso: string) => { const [y, m, d] = (iso || "").split("-"); return d ? `${d}/${m}/${y}` : "—"; };

export function InvoiceActionsSheet({ invoice, open, onOpenChange, canManageFinance, onChanged }: Props) {
  const [asaas, setAsaas] = useState<{ status: string; link: string | null } | null>(null);
  const [loadingAsaas, setLoadingAsaas] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [acordo, setAcordo] = useState<any>(null);
  const [showAcordo, setShowAcordo] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const busy = cobrando || retrying || excluindo;
  const classificacao = invoice
    ? classificarCobranca({ status: invoice.status, due_date: invoice.due_date, sync_status: invoice.sync_status })
    : "inativo";
  // Ações financeiras apenas em cobranças realmente ativas (a vencer ou vencidas).
  const isOpenInvoice = !!invoice && contaNoTotalAtivo(classificacao);
  const origem: OrigemCobranca = invoice?.origem === "asaas" || invoice?.origem === "acordo" || invoice?.origem === "interna"
    ? invoice.origem
    : (invoice?.asaas_invoice_id ? "asaas" : "interna");
  const diasAtraso = invoice
    ? Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date + "T00:00:00").getTime()) / 86400000))
    : 0;

  useEffect(() => {
    if (!open || !invoice) { setAsaas(null); setAcordo(null); return; }
    let cancelled = false;
    (async () => {
      if (canManageFinance && invoice.asaas_invoice_id) {
        setLoadingAsaas(true);
        const { data } = await supabase.functions.invoke("criar-acordo-cliente", {
          body: { action: "consultar", invoice_id: invoice.id },
        });
        if (!cancelled) {
          setAsaas((data as any)?.asaas ? { status: (data as any).asaas.status, link: (data as any).link } : null);
          setLoadingAsaas(false);
        }
      }
      if (canManageFinance) {
        const { data: ac } = await supabase
          .from("acordos_cliente" as any)
          .select("*")
          .eq("invoice_original_id", invoice.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled) setAcordo(ac || null);
      }
    })();
    return () => { cancelled = true; };
  }, [open, invoice?.id, canManageFinance]);

  const link = asaas?.link || invoice?.invoice_url || null;

  const handleCobrar = async () => {
    if (!invoice || cobrando) return;
    setCobrando(true);
    try {
      const { data, error } = await supabase.functions.invoke("cobrar-fatura-vencida", {
        body: { invoice_id: invoice.id, channels: ["whatsapp", "email"], force: true },
      });
      if (error) throw error;
      if ((data as any)?.error) { toast.error((data as any).error); return; }
      const canais: string[] = (data as any)?.channels || [];
      toast.success("Cobrança enviada", {
        description: `WhatsApp: ${canais.includes("whatsapp") ? "enviado" : "cliente sem telefone"} · E-mail: ${canais.includes("email") ? "enviado" : "cliente sem e-mail"}`,
      });
      onChanged();
    } catch (e) {
      toast.error("Não foi possível enviar a cobrança", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setCobrando(false);
    }
  };

  const handleRetryCancel = async () => {
    if (!acordo || retrying) return;
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("criar-acordo-cliente", {
        body: { action: "retry-cancelamento", acordo_id: acordo.id },
      });
      if (error) throw error;
      if ((data as any)?.success) { toast.success("Cobrança original cancelada no Asaas."); onChanged(); onOpenChange(false); }
      else toast.error((data as any)?.message || (data as any)?.error || "O Asaas ainda não permitiu o cancelamento.");
    } catch (e) {
      toast.error("Falha ao tentar cancelar novamente", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setRetrying(false);
    }
  };

  const handleExcluir = async () => {
    if (!invoice || excluindo) return;
    if (motivo.trim().length < 3) { toast.error("Informe o motivo do cancelamento"); return; }
    setExcluindo(true);
    try {
      const { data, error } = await supabase.functions.invoke("criar-acordo-cliente", {
        body: { action: "excluir", invoice_id: invoice.id, motivo: motivo.trim(), crm_action_id: `excluir:${invoice.id}` },
      });
      if (error) throw error;
      if (!(data as any)?.success) { toast.error((data as any)?.error || "Não foi possível excluir a cobrança"); return; }
      toast.success("Cobrança cancelada", { description: "Ela continua no histórico como cancelada." });
      setConfirmExcluir(false);
      setMotivo("");
      onChanged();
      onOpenChange(false);
    } catch (e) {
      toast.error("Falha ao excluir a cobrança", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setExcluindo(false);
    }
  };

  if (!invoice) return null;

  const statusCls = classificacao === "vencido"
    ? "bg-red-500/15 text-red-500 border-red-500/30"
    : classificacao === "a_vencer"
      ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
      : classificacao === "pago"
        ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
        : "bg-muted text-muted-foreground border-border";
  const removida = !!invoice.sync_status && invoice.sync_status !== "ativa";
  const statusLabel = removida ? "Removida do Asaas" : LABEL_CLASSIFICACAO[classificacao];


  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => busy && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-base">Detalhes da cobrança</DialogTitle>
            <DialogDescription className="line-clamp-2">{invoice.description || "Sem descrição"}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
              {[
                { l: "Origem", v: LABEL_ORIGEM[origem] },
                { l: "Valor", v: brl(invoice.amount) },
                { l: "Vencimento", v: fmt(invoice.due_date) },
                ...(classificacao === "vencido" ? [{ l: "Dias em atraso", v: `${diasAtraso} dia${diasAtraso !== 1 ? "s" : ""}` }] : []),
              ].map((x) => (
                <div key={x.l} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{x.l}</span>
                  <span className="font-medium">{x.v}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Situação no CRM</span>
                <Badge variant="outline" className={cn("h-5 text-[10px]", statusCls)}>{statusLabel}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Situação no Asaas</span>
                <span className="font-medium">
                  {!canManageFinance ? "—" : loadingAsaas ? <Loader2 className="h-3 w-3 animate-spin" /> : (asaas?.status || "indisponível")}
                </span>
              </div>
            </div>

            {!canManageFinance && (
              <div className="flex gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <Lock className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>Somente administradores com permissão financeira podem cobrar ou gerar acordos.</p>
              </div>
            )}

            {acordo?.bloqueado_por_pendencia && canManageFinance && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs space-y-2">
                <p className="flex gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  Existe um acordo com pendência: a cobrança original não foi cancelada no Asaas.
                </p>
                <Button size="sm" variant="outline" className="h-8 text-xs w-full" disabled={retrying} onClick={handleRetryCancel}>
                  {retrying ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                  Tentar cancelar novamente
                </Button>
              </div>
            )}

            {canManageFinance && isOpenInvoice && !acordo?.bloqueado_por_pendencia && (
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" className="h-9 text-xs" disabled={cobrando} onClick={handleCobrar}>
                  {cobrando ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Enviando...</> : <><Send className="h-3.5 w-3.5 mr-1" />Cobrar cliente</>}
                </Button>
                <Button size="sm" variant="outline" className="h-9 text-xs border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                  disabled={busy} onClick={() => setShowAcordo(true)}>
                  <Handshake className="h-3.5 w-3.5 mr-1" />Fazer acordo
                </Button>
                <Button size="sm" variant="outline" className="h-9 text-xs col-span-2 border-red-500/40 text-red-600 hover:bg-red-500/10"
                  disabled={busy} onClick={() => setConfirmExcluir(true)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />Excluir cobrança
                </Button>
              </div>
            )}

            {!isOpenInvoice && (
              <p className="text-[11px] text-muted-foreground text-center">
                Cobrança {invoice.status} — disponível apenas para consulta.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {link ? (
              <Button variant="ghost" size="sm" className="h-9 text-xs" asChild>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />Abrir no Asaas
                </a>
              </Button>
            ) : <span />}
            <Button variant="outline" size="sm" className="h-9 text-xs" disabled={busy} onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showAcordo && (
        <FazerAcordoDialog
          open={showAcordo}
          onOpenChange={setShowAcordo}
          invoice={invoice}
          onCreated={() => { onChanged(); onOpenChange(false); }}
        />
      )}

      <AlertDialog open={confirmExcluir} onOpenChange={(v) => { if (!excluindo) setConfirmExcluir(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta cobrança?</AlertDialogTitle>
            <AlertDialogDescription>
              A cobrança será cancelada no Asaas e ficará no histórico como <strong>cancelada</strong>. O cliente deixa de poder pagá-la.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Motivo do cancelamento</label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: cobrança gerada em duplicidade"
              className="min-h-[72px] text-sm"
              disabled={excluindo}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo || motivo.trim().length < 3}
              onClick={(e) => { e.preventDefault(); handleExcluir(); }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {excluindo ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Excluindo...</> : "Excluir cobrança"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
