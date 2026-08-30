import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export type SituacaoCobranca = "recebida" | "aguardando" | "vencida" | "negativado";

const CFG: Record<SituacaoCobranca, { label: string; className: string; Icon: typeof Clock }> = {
  recebida:   { label: "Recebida",             className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", Icon: CheckCircle2 },
  aguardando: { label: "Aguardando pagamento", className: "bg-amber-500/15 text-amber-600 border-amber-500/30",      Icon: Clock },
  vencida:    { label: "Vencida",              className: "bg-red-500/15 text-red-600 border-red-500/30",            Icon: AlertTriangle },
  negativado: { label: "Negativado",           className: "bg-zinc-800 text-white border-zinc-700",                  Icon: Ban },
};

/**
 * Deriva a situação da cobrança a partir do histórico:
 * - paga (status/situação) -> recebida
 * - cliente negativado -> negativado
 * - prazo da próxima ação vencido -> vencida
 * - caso contrário -> aguardando pagamento
 */
export function derivarSituacao(row: {
  situacao?: string | null;
  status?: string | null;
  proxima_acao_em?: string | null;
  negativado?: boolean | null;
}): SituacaoCobranca {
  if (row.situacao === "recebida" || row.status === "confirmada_paga") return "recebida";
  if (row.negativado) return "negativado";
  if (row.situacao === "vencida") return "vencida";
  if (row.proxima_acao_em && new Date(row.proxima_acao_em).getTime() < Date.now()) return "vencida";
  return "aguardando";
}

export function SituacaoCobrancaBadge({ situacao, className }: { situacao: SituacaoCobranca; className?: string }) {
  const cfg = CFG[situacao];
  const Icon = cfg.Icon;
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium whitespace-nowrap", cfg.className, className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}
