import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Handshake, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AcordoConfirmacao, AcordoPreview, brlFromCents } from "./AcordoConfirmacao";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: { id: string; description: string | null; amount: number; due_date: string };
  onCreated: () => void;
}

/** Soma meses preservando o dia; dia inexistente no mês usa o último dia válido. */
function addMonthsKeepDay(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const idx = m - 1 + months;
  const year = y + Math.floor(idx / 12);
  const month = ((idx % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dividirCentavos(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const arr = Array.from({ length: n }, () => base);
  arr[n - 1] = total - base * (n - 1);
  return arr;
}

export function FazerAcordoDialog({ open, onOpenChange, invoice, onCreated }: Props) {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [parcelas, setParcelas] = useState("3");
  const [jurosStr, setJurosStr] = useState("10");
  const [primeiraData, setPrimeiraData] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [sending, setSending] = useState(false);
  const [actionId] = useState(() => crypto.randomUUID());

  const numParcelas = parseInt(parcelas, 10) || 0;
  const juros = Number(String(jurosStr).replace(",", "."));
  const valorOriginalCentavos = Math.round(Number(invoice.amount) * 100);

  const preview: AcordoPreview | null = useMemo(() => {
    if (!numParcelas || numParcelas < 1 || !Number.isFinite(juros) || juros < 0) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(primeiraData)) return null;
    const jurosCentavos = Math.round(valorOriginalCentavos * (juros / 100));
    const totalCentavos = valorOriginalCentavos + jurosCentavos;
    const valores = dividirCentavos(totalCentavos, numParcelas);
    return {
      valorOriginalCentavos,
      jurosPercentual: juros,
      jurosCentavos,
      totalCentavos,
      parcelas: valores.map((v, i) => ({
        numero: i + 1,
        valorCentavos: v,
        vencimento: addMonthsKeepDay(primeiraData, i),
      })),
    };
  }, [numParcelas, juros, primeiraData, valorOriginalCentavos]);

  const erro = (() => {
    if (!numParcelas || numParcelas < 1) return "Informe uma quantidade de parcelas maior que zero.";
    if (numParcelas > 24) return "Máximo de 24 parcelas.";
    if (!Number.isFinite(juros) || juros < 0) return "Percentual de juros inválido.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(primeiraData)) return "Informe a data da primeira parcela.";
    if (preview && preview.parcelas.some((p) => p.valorCentavos <= 0)) return "Parcelas com valor zerado — reduza a quantidade.";
    return null;
  })();

  const handleConfirm = async () => {
    if (sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("criar-acordo-cliente", {
        body: {
          action: "criar",
          invoice_id: invoice.id,
          crm_action_id: actionId,
          num_parcelas: numParcelas,
          juros_percentual: juros,
          primeira_parcela_data: primeiraData,
          preview_total_centavos: preview?.totalCentavos ?? null,
        },
      });
      if (error) throw error;
      if ((data as any)?.duplicated) {
        toast.info("Este acordo já havia sido gerado.");
        onCreated();
        onOpenChange(false);
        return;
      }
      if ((data as any)?.error) {
        toast.error((data as any).error, {
          description: (data as any).pendencia_critica
            ? "Pendência crítica: parcelas no Asaas não puderam ser canceladas."
            : (data as any).aviso,
          duration: 12000,
        });
        onCreated();
        return;
      }
      if ((data as any)?.success) {
        toast.success(`Acordo gerado — ${(data as any).parcelas_criadas} parcelas`, {
          description: `Total ${brlFromCents((data as any).total_centavos)}. Cobrança original cancelada no Asaas.`,
        });
      } else {
        toast.warning("Parcelas criadas, mas a cobrança original não foi cancelada.", {
          description: (data as any)?.aviso, duration: 14000,
        });
      }
      onCreated();
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível gerar o acordo", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!sending) { onOpenChange(v); if (!v) setStep("form"); } }}>
      <DialogContent className="max-w-lg" onInteractOutside={(e) => sending && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-4 w-4 text-primary" />
            {step === "form" ? "Fazer acordo" : "Confirmar acordo"}
          </DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Parcelamento em boleto criado diretamente no Asaas."
              : "Confira os valores antes de gerar as cobranças."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Valor original</span>
              <span className="font-bold">{brlFromCents(valorOriginalCentavos)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantidade de parcelas</Label>
                <Select value={parcelas} onValueChange={setParcelas}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: 24 }, (_, i) => String(i + 1)).map((n) => (
                      <SelectItem key={n} value={n}>{n}x</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Juros (%)</Label>
                <Input inputMode="decimal" value={jurosStr}
                  onChange={(e) => setJurosStr(e.target.value.replace(/[^\d,.]/g, ""))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Data da primeira parcela</Label>
              <Input type="date" value={primeiraData} onChange={(e) => setPrimeiraData(e.target.value)} />
              <p className="text-[10px] text-muted-foreground">
                As demais vencem mensalmente no mesmo dia; quando o dia não existir no mês, no último dia válido.
              </p>
            </div>

            {preview && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { l: "Juros", v: brlFromCents(preview.jurosCentavos) },
                  { l: "Total", v: brlFromCents(preview.totalCentavos) },
                  { l: "Parcela", v: brlFromCents(preview.parcelas[0].valorCentavos) },
                ].map((x) => (
                  <div key={x.l}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{x.l}</p>
                    <p className="text-sm font-bold">{x.v}</p>
                  </div>
                ))}
              </div>
            )}

            {erro && <p className="text-xs text-red-500">{erro}</p>}
          </div>
        ) : preview ? (
          <AcordoConfirmacao
            descricaoOriginal={invoice.description || ""}
            vencimentoOriginal={invoice.due_date}
            preview={preview}
          />
        ) : null}

        <DialogFooter className="gap-2">
          {step === "form" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button disabled={!!erro || !preview} onClick={() => setStep("confirm")}>Revisar acordo</Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={sending} onClick={() => setStep("form")}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />Voltar
              </Button>
              <Button disabled={sending} onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700">
                {sending ? (<><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Gerando acordo...</>) : "Confirmar e gerar acordo"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
