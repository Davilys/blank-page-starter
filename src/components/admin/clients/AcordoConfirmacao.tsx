import { AlertTriangle, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export const brlFromCents = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDateBR = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export interface AcordoPreview {
  valorOriginalCentavos: number;
  jurosPercentual: number;
  jurosCentavos: number;
  totalCentavos: number;
  parcelas: { numero: number; valorCentavos: number; vencimento: string }[];
}

interface Props {
  descricaoOriginal: string;
  vencimentoOriginal: string;
  preview: AcordoPreview;
}

/** Tela de conferência exibida antes de gerar o acordo no Asaas. */
export function AcordoConfirmacao({ descricaoOriginal, vencimentoOriginal, preview }: Props) {
  const linhas = [
    { label: "Cobrança original", value: descricaoOriginal || "—" },
    { label: "Vencimento original", value: fmtDateBR(vencimentoOriginal) },
    { label: "Valor original", value: brlFromCents(preview.valorOriginalCentavos) },
    { label: "Juros aplicados", value: `${preview.jurosPercentual}% · ${brlFromCents(preview.jurosCentavos)}` },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
        {linhas.map((l) => (
          <div key={l.label} className="flex items-start justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{l.label}</span>
            <span className="font-medium text-right break-words">{l.value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 pt-2 mt-1 border-t border-border">
          <span className="text-sm font-semibold">Total do acordo</span>
          <span className="text-base font-bold text-emerald-600">{brlFromCents(preview.totalCentavos)}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          {preview.parcelas.length} parcela{preview.parcelas.length !== 1 ? "s" : ""} em boleto
        </p>
        <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border">
          {preview.parcelas.map((p) => (
            <div key={p.numero} className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                Parcela {p.numero} de {preview.parcelas.length}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-muted-foreground">{fmtDateBR(p.vencimento)}</span>
                <span className="font-semibold">{brlFromCents(p.valorCentavos)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={cn("flex gap-2 rounded-xl border p-3 text-xs",
        "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400")}>
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <p>
          Ao confirmar, as parcelas serão criadas no Asaas e a cobrança original será cancelada
          somente depois que todas forem geradas com sucesso. O valor definitivo é recalculado
          pelo servidor.
        </p>
      </div>
    </div>
  );
}
