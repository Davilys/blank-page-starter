/** Linha do tempo completa do fato: criação, alterações, revisões, validações. */
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VAULT_EVENT_LABEL, type VaultEvent } from "../../../domain/vault/VaultFact";

const formatar = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR");
};

export const VaultTimeline = ({ eventos }: { eventos: readonly VaultEvent[] }) => (
  <Card className="p-5">
    <h2 className="font-semibold text-foreground">Linha do tempo</h2>
    {eventos.length === 0 ? (
      <p className="mt-3 text-sm text-muted-foreground">
        Nenhum evento registrado para este fato.
      </p>
    ) : (
      <ol className="mt-4 space-y-4 border-l border-border pl-4">
        {eventos.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{VAULT_EVENT_LABEL[e.tipo]}</Badge>
              <span className="text-xs text-muted-foreground">{formatar(e.em)}</span>
              <span className="text-xs text-muted-foreground">· por {e.autorId}</span>
            </div>
            <p className="mt-1 text-sm text-foreground">{e.motivo}</p>
            {e.mudancas.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Alterado: {e.mudancas.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ol>
    )}
  </Card>
);