/**
 * Impact Analysis — "se este fato cair, o que quebra?".
 * Tudo derivado do grafo real; nada é estimado.
 */
import { EDGE_TYPE_LABEL, type GraphEdge } from "../../../domain/graph/GraphEdge";
import type { GraphNode, NodeId } from "../../../domain/graph/GraphNode";
import { dependents, incidences } from "../../../domain/graph/traversal";
import { evaluateEdgeGates } from "../../../domain/graph/validation";
import { err, ok, type Result } from "../../../domain/shared/primitives";
import type { GraphUniverseView, makeLoadGraph } from "./loadGraph";

export interface ImpactedNode {
  readonly no: GraphNode;
  readonly profundidade: number;
  readonly viaRelacao: string;
  /** Peso máximo do caminho direto, quando existir. */
  readonly peso: number;
}

export interface ImpactReport {
  readonly alvo: GraphNode;
  readonly dependentesDiretos: readonly ImpactedNode[];
  readonly dependentesIndiretos: readonly ImpactedNode[];
  readonly respostasAfetadas: readonly ImpactedNode[];
  readonly faqsAfetadas: readonly ImpactedNode[];
  readonly objetosAfetados: readonly ImpactedNode[];
  readonly entidadesImpactadas: readonly string[];
  /** Relações que ficariam estruturalmente inválidas se o nó for removido. */
  readonly relacoesQueFicamInvalidas: readonly GraphEdge[];
  /** Relações já inválidas hoje envolvendo o nó. */
  readonly relacoesJaInvalidas: readonly GraphEdge[];
  readonly severidade: "critica" | "alta" | "media" | "baixa";
}

const severityOf = (diretos: number, pesoTotal: number): ImpactReport["severidade"] => {
  if (diretos >= 8 || pesoTotal >= 500) return "critica";
  if (diretos >= 4 || pesoTotal >= 240) return "alta";
  if (diretos >= 1) return "media";
  return "baixa";
};

export const makeAnalyzeImpact =
  (loadGraph: ReturnType<typeof makeLoadGraph>) =>
  async (id: NodeId, profundidadeMax = 3): Promise<Result<ImpactReport>> => {
    const g = await loadGraph();
    if (!g.ok) return err<ImpactReport>(g.error as string);
    const { nodes, edges } = g.value as GraphUniverseView;

    const alvo = nodes.find((n) => n.id === id);
    if (!alvo) return err<ImpactReport>("Nó não encontrado no grafo.");

    const operacionais = edges.filter((e) => e.status === "ativa" || e.status === "proposta");
    const deps = dependents(id, operacionais, profundidadeMax);

    const mapear = (entry: { id: NodeId; profundidade: number; viaTipo?: string }): ImpactedNode | null => {
      const no = nodes.find((n) => n.id === entry.id);
      if (!no) return null;
      const direta = operacionais.find(
        (e) => (e.origem === entry.id && e.destino === id) || (e.destino === entry.id && e.origem === id),
      );
      return {
        no,
        profundidade: entry.profundidade,
        viaRelacao: entry.viaTipo ? EDGE_TYPE_LABEL[entry.viaTipo] ?? entry.viaTipo : "—",
        peso: direta?.peso ?? 0,
      };
    };

    const impactados = deps.map(mapear).filter(Boolean) as ImpactedNode[];
    const diretos = impactados.filter((i) => i.profundidade === 1);
    const indiretos = impactados.filter((i) => i.profundidade > 1);

    const porKind = (kind: string) => impactados.filter((i) => i.no.kind === kind);

    const pesoTotal = diretos.reduce((s, d) => s + d.peso, 0);

    const incidentes = incidences(id, edges).map((i) => i.edge);
    const relacoesJaInvalidas = incidentes.filter(
      (e) => e.status === "invalida" || evaluateEdgeGates(e, { nodes, edges }).some((p) => !p.ok && p.severidade === "bloqueio"),
    );

    const entidades = [
      ...new Set(impactados.map((i) => i.no.entidade).filter(Boolean)),
    ] as string[];

    return ok({
      alvo,
      dependentesDiretos: diretos,
      dependentesIndiretos: indiretos,
      respostasAfetadas: porKind("answer"),
      faqsAfetadas: porKind("question"),
      objetosAfetados: porKind("knowledge-object"),
      entidadesImpactadas: entidades,
      relacoesQueFicamInvalidas: incidentes,
      relacoesJaInvalidas,
      severidade: severityOf(diretos.length, pesoTotal),
    });
  };