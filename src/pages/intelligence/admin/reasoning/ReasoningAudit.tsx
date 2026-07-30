/** Auditoria imutável das execuções: nada pode ser apagado ou editado. */
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { ANALYSIS_KIND_LABEL } from "@/modules/intelligence/domain/reasoning/Reasoning";
import {
  useReasoningAudit,
  useReasoningOperator,
} from "@/modules/intelligence/presentation/hooks/useReasoning";

const ReasoningAudit = () => {
  const { items, loading } = useReasoningAudit(200);
  const { operador, setOperador } = useReasoningOperator();

  return (
    <div>
      <Card className="p-5">
        <Label htmlFor="op">Identificação do operador</Label>
        <Input
          id="op"
          className="mt-2 max-w-sm"
          value={operador}
          onChange={(e) => setOperador(e.target.value)}
          placeholder="Nome de quem executa as análises"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Registrado em toda execução. Sem identificação, o log grava “sistema”.
        </p>
      </Card>

      <Card className="mt-6">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Trilha imutável</h2>
          <span className="ml-auto tabular-nums text-sm text-muted-foreground">
            {items.length} registro(s)
          </span>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando auditoria...</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Data</th>
                  <th className="p-3 font-medium">Análise</th>
                  <th className="p-3 font-medium">Alvo</th>
                  <th className="p-3 font-medium">Operador</th>
                  <th className="p-3 text-right font-medium">Impactos</th>
                  <th className="p-3 text-right font-medium">Inconsist.</th>
                  <th className="p-3 text-right font-medium">Tempo</th>
                  <th className="p-3 font-medium">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/50">
                    <td className="whitespace-nowrap p-3 text-muted-foreground">
                      {new Date(r.executadoEm).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 text-foreground">{ANALYSIS_KIND_LABEL[r.tipo]}</td>
                    <td className="max-w-[220px] truncate p-3 text-muted-foreground">
                      {r.alvoRotulo ?? "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">{r.executadoPor}</td>
                    <td className="p-3 text-right tabular-nums text-foreground">{r.impactos}</td>
                    <td className="p-3 text-right tabular-nums text-foreground">
                      {r.inconsistencias}
                    </td>
                    <td className="p-3 text-right tabular-nums text-muted-foreground">
                      {r.duracaoMs} ms
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{r.hash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ReasoningAudit;