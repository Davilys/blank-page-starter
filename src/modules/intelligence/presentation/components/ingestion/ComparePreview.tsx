/**
 * Side-by-side preview (FASE 07 §6): original document ↓ Knowledge Draft.
 * Shows exactly what was reused and what remains manual.
 */
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight } from "lucide-react";
import { mappingReport } from "../../../domain/ingestion/mapping";
import { structureCounts } from "../../../domain/ingestion/structure";
import type { IngestionCandidate } from "../../../domain/ingestion/SourceDocument";

const Bloco = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div className="mt-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
    <div className="mt-1 text-sm text-foreground">{children}</div>
  </div>
);

export const ComparePreview = ({ candidato }: { candidato: IngestionCandidate }) => {
  const est = candidato.estrutura;
  const contagem = structureCounts(est);
  const relatorio = mappingReport(candidato);

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-foreground">Preview: original → Knowledge Draft</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Somente estrutura é aproveitada. Nada é resumido, reescrito ou interpretado.
      </p>

      <Tabs defaultValue="original" className="mt-4">
        <TabsList>
          <TabsTrigger value="original">Documento original</TabsTrigger>
          <TabsTrigger value="estrutura">Estrutura extraída</TabsTrigger>
          <TabsTrigger value="draft">Draft gerado</TabsTrigger>
        </TabsList>

        <TabsContent value="original">
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-xs text-foreground">
            {candidato.texto || "— sem texto —"}
          </pre>
        </TabsContent>

        <TabsContent value="estrutura">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(contagem).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-muted p-3">
                <p className="text-xs capitalize text-muted-foreground">{k}</p>
                <p className="text-lg font-bold text-foreground">{v}</p>
              </div>
            ))}
          </div>

          <Bloco titulo="Título sugerido">{est.tituloSugerido || "—"}</Bloco>
          {est.subtitulos.length > 0 && (
            <Bloco titulo="Subtítulos">
              <ul className="list-disc space-y-0.5 pl-5">
                {est.subtitulos.slice(0, 25).map((s, i) => (
                  <li key={`${s}-${i}`}>{s}</li>
                ))}
              </ul>
            </Bloco>
          )}
          {est.tabelas.length > 0 && (
            <Bloco titulo={`Tabelas (${est.tabelas.length})`}>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {est.tabelas[0].cabecalho.map((c, i) => (
                        <th key={`${c}-${i}`} className="border border-border px-2 py-1 text-left">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {est.tabelas[0].linhas.slice(0, 5).map((l, i) => (
                      <tr key={i}>
                        {l.map((c, j) => (
                          <td key={j} className="border border-border px-2 py-1">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Bloco>
          )}
          {est.datas.length > 0 && <Bloco titulo="Datas">{est.datas.join(" · ")}</Bloco>}
          {est.links.length > 0 && (
            <Bloco titulo="Links">
              <span className="break-all text-xs text-muted-foreground">
                {est.links.slice(0, 20).join("  ")}
              </span>
            </Bloco>
          )}
          {est.palavrasChave.length > 0 && (
            <Bloco titulo="Palavras-chave (frequência)">{est.palavrasChave.join(", ")}</Bloco>
          )}
        </TabsContent>

        <TabsContent value="draft">
          <ul className="space-y-3">
            {relatorio.aproveitado.map((l) => (
              <li key={l.campo} className="rounded-lg border border-border p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {l.origem} <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /> {l.campo}
                </p>
                <p className="mt-1 break-words text-xs text-muted-foreground">{l.amostra}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Preenchimento manual obrigatório do editor: {relatorio.manual.join(", ")}.
          </p>
        </TabsContent>
      </Tabs>
    </Card>
  );
};