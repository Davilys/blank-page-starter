/**
 * Criação/edição de relações — sempre humana, sempre validada, sempre auditada.
 * Zero IA, zero inferência automática.
 */
import type { GraphAuditRepository, GraphEdgeRepository, ManualNodeRepository } from "../../ports/graph";
import { describeEdge, diffEdges, type GraphAuditAction } from "../../../domain/graph/audit";
import {
  DEFAULT_EDGE_REVALIDATION_DAYS,
  type EdgeStatus,
  type GraphEdge,
} from "../../../domain/graph/GraphEdge";
import type { ManualNodeInput } from "../../../domain/graph/GraphNode";
import {
  blockers,
  evaluateEdgeGates,
  hasBlockers,
  type EdgeCandidate,
} from "../../../domain/graph/validation";
import { asIsoDateTime, err, ok, type Result } from "../../../domain/shared/primitives";
import type { GraphUniverseView, makeLoadGraph } from "./loadGraph";

const uid = () =>
  `edge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export interface SaveEdgeInput extends EdgeCandidate {
  readonly status?: EdgeStatus;
  readonly periodicidadeDias?: number;
  readonly observacoes?: string;
  readonly motivo: string;
}

export const makeSaveEdge =
  (
    loadGraph: ReturnType<typeof makeLoadGraph>,
    edges: GraphEdgeRepository,
    audit: GraphAuditRepository,
  ) =>
  async (input: SaveEdgeInput): Promise<Result<GraphEdge>> => {
    const g = await loadGraph();
    if (!g.ok) return err<GraphEdge>(g.error as string);
    const universo = g.value as GraphUniverseView;

    const gates = evaluateEdgeGates(input, universo);
    if (hasBlockers(gates)) {
      return err<GraphEdge>(
        `Relação inválida: ${blockers(gates).map((b) => b.rotulo).join(", ")}.`,
      );
    }
    if (!input.motivo?.trim()) return err<GraphEdge>("Informe o motivo desta alteração (auditoria).");

    const agora = asIsoDateTime(new Date());
    const anterior = input.id ? universo.edges.find((e) => e.id === input.id) ?? null : null;

    const edge: GraphEdge = {
      id: anterior?.id ?? uid(),
      origem: input.origem,
      destino: input.destino,
      tipo: input.tipo,
      direcao: input.direcao,
      peso: Math.round(input.peso),
      confianca: Math.round(input.confianca),
      fonte: input.fonte?.titulo?.trim() ? input.fonte : undefined,
      justificativa: input.justificativa.trim(),
      criadoPor: anterior?.criadoPor ?? input.criadoPor.trim(),
      criadoEm: anterior?.criadoEm ?? agora,
      atualizadoEm: agora,
      ultimaValidacaoEm: anterior?.ultimaValidacaoEm,
      revisorId: anterior?.revisorId,
      periodicidadeDias: input.periodicidadeDias ?? anterior?.periodicidadeDias ?? DEFAULT_EDGE_REVALIDATION_DAYS,
      status: input.status ?? anterior?.status ?? "proposta",
      versao: anterior ? anterior.versao + 1 : 1,
      observacoes: input.observacoes ?? "",
    };

    const saved = await edges.save(edge);
    if (!saved.ok) return err<GraphEdge>(saved.error as string);

    await audit.append({
      id: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      acao: (anterior ? "editou" : "criou") as GraphAuditAction,
      autorId: input.criadoPor.trim(),
      em: agora,
      alvoId: edge.id,
      relacao: describeEdge(edge),
      motivo: input.motivo.trim(),
      versao: edge.versao,
      alteracoes: anterior ? diffEdges(anterior, edge) : undefined,
    });

    return ok(edge);
  };

export interface EdgeTransitionInput {
  readonly id: string;
  readonly status: EdgeStatus;
  readonly autorId: string;
  readonly motivo: string;
  /** Marcar como revalidada agora (registra revisor e data). */
  readonly registrarValidacao?: boolean;
}

const ACTION_BY_STATUS: Readonly<Record<EdgeStatus, GraphAuditAction>> = {
  proposta: "editou",
  ativa: "validou",
  suspensa: "suspendeu",
  invalida: "invalidou",
  arquivada: "arquivou",
};

export const makeTransitionEdge =
  (edges: GraphEdgeRepository, audit: GraphAuditRepository) =>
  async (input: EdgeTransitionInput): Promise<Result<GraphEdge>> => {
    if (!input.autorId?.trim()) return err<GraphEdge>("Informe quem está realizando a ação.");
    if (!input.motivo?.trim()) return err<GraphEdge>("Informe o motivo da mudança de status.");

    const found = await edges.findById(input.id);
    if (!found.ok) return err<GraphEdge>(found.error as string);
    const atual = found.value as GraphEdge;

    const agora = asIsoDateTime(new Date());
    const validar = input.registrarValidacao || input.status === "ativa";
    const proximo: GraphEdge = {
      ...atual,
      status: input.status,
      atualizadoEm: agora,
      versao: atual.versao + 1,
      ultimaValidacaoEm: validar ? agora : atual.ultimaValidacaoEm,
      revisorId: validar ? input.autorId.trim() : atual.revisorId,
    };

    const saved = await edges.save(proximo);
    if (!saved.ok) return err<GraphEdge>(saved.error as string);

    await audit.append({
      id: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      acao: ACTION_BY_STATUS[input.status],
      autorId: input.autorId.trim(),
      em: agora,
      alvoId: proximo.id,
      relacao: describeEdge(proximo),
      motivo: input.motivo.trim(),
      versao: proximo.versao,
      alteracoes: ["status"],
    });

    return ok(proximo);
  };

export const makeRemoveEdge =
  (edges: GraphEdgeRepository, audit: GraphAuditRepository) =>
  async (id: string, autorId: string, motivo: string): Promise<Result<true>> => {
    if (!autorId?.trim() || !motivo?.trim()) {
      return err<true>("Remoção exige autor e motivo (auditoria obrigatória).");
    }
    const found = await edges.findById(id);
    if (!found.ok) return err<true>(found.error as string);
    const atual = found.value as GraphEdge;

    const r = await edges.remove(id);
    if (!r.ok) return err<true>(r.error as string);

    await audit.append({
      id: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      acao: "removeu",
      autorId: autorId.trim(),
      em: asIsoDateTime(new Date()),
      alvoId: id,
      relacao: describeEdge(atual),
      motivo: motivo.trim(),
      versao: atual.versao,
    });
    return ok(true);
  };

export const makeSaveManualNode =
  (manual: ManualNodeRepository, audit: GraphAuditRepository) =>
  async (input: ManualNodeInput, autorId: string, motivo: string) => {
    if (!autorId?.trim()) return err("Informe o autor do nó.");
    if (!input.rotulo?.trim()) return err("O nó precisa de um rótulo.");
    const r = await manual.save(input, autorId.trim());
    if (!r.ok) return r;
    await audit.append({
      id: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      acao: "criou-no",
      autorId: autorId.trim(),
      em: asIsoDateTime(new Date()),
      alvoId: (r.value as { id: string }).id,
      relacao: `${input.kind}: ${input.rotulo}`,
      motivo: motivo?.trim() || "Cadastro manual de nó.",
      versao: 1,
    });
    return r;
  };