/** Mostra a conta da confiabilidade. Score sem explicação é opinião. */
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ConfidenceReport } from "../../../domain/facts/confidence";
import { ConfidenceBadge } from "./FactBadges";

export const ConfidencePanel = ({ relatorio }: { relatorio: ConfidenceReport }) => (
  <Card className="p-5">
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-semibold text-foreground">Confiabilidade</h2>
      <ConfidenceBadge score={relatorio.score} faixa={relatorio.faixa} />
    </div>

    <Progress value={relatorio.score} className="mt-3" />

    <ul className="mt-4 space-y-2">
      {relatorio.fatores.map((f, i) => (
        <li key={`${f.rotulo}-${i}`} className="flex items-start justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{f.rotulo}</span> — {f.detalhe}
          </span>
          <span
            className={
              f.pontos < 0 ? "shrink-0 text-destructive" : "shrink-0 text-foreground"
            }
          >
            {f.pontos > 0 ? `+${f.pontos}` : f.pontos}
          </span>
        </li>
      ))}
    </ul>

    <p className="mt-4 text-xs text-muted-foreground">
      {relatorio.diasDesdeValidacao === null
        ? "Nunca validado por um humano."
        : `Última validação há ${relatorio.diasDesdeValidacao} dias.`}
      {relatorio.validacaoVencida ? " Revalidação pendente." : ""}
    </p>
  </Card>
);