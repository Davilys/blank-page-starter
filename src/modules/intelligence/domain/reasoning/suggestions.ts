/**
 * ENGINE 7 — KNOWLEDGE SUGGESTIONS (estruturais, sem IA).
 *
 * Cada sugestão nasce de uma condição verificável no snapshot. Nada é
 * "gerado"; tudo é deduzido da própria estrutura e sempre acompanhado do
 * motivo e do link para a ação humana.
 */
import type { Severity } from "./Reasoning";
import type { BrokenReport } from "./broken";
import type { ConfidenceReportSummary } from "./confidence";
import type { CoverageReport } from "./coverage";
import type { ReasoningSnapshot } from "./snapshot";
import { SEVERITY_ORDER } from "./Reasoning";

export const SUGGESTION_KINDS = [
  "criar-fato",
  "criar-relacionamento",
  "adicionar-fonte",
  "revisar-entidade",
  "atualizar-artigo",
  "validar-relacionamento",
  "adicionar-faq",
  "completar-cobertura",
] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export const SUGGESTION_KIND_LABEL: Readonly<Record<SuggestionKind, string>> = {
  "criar-fato": "Criar novo fato",
  "criar-relacionamento": "Criar relacionamento",
  "adicionar-fonte": "Adicionar fonte",
  "revisar-entidade": "Revisar entidade",
  "atualizar-artigo": "Atualizar artigo",
  "validar-relacionamento": "Validar relacionamento",
  "adicionar-faq": "Adicionar FAQ",
  "completar-cobertura": "Completar cobertura",
};

export interface KnowledgeSuggestion {
  readonly id: string;
  readonly tipo: SuggestionKind;
  readonly prioridade: Severity;
  readonly titulo: string;
  readonly motivo: string;
  readonly alvo: string;
  readonly rota?: string;
}

const STALE_DAYS = 365;

const daysSince = (iso?: string): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86_400_000);
};

export const generateSuggestions = (
  snapshot: ReasoningSnapshot,
  broken: BrokenReport,
  confidence: ConfidenceReportSummary,
  coverage: CoverageReport,
): readonly KnowledgeSuggestion[] => {
  const out: KnowledgeSuggestion[] = [];

  // Objetos sem lastro → criar fato.
  for (const issue of broken.issues) {
    if (issue.tipo === "objeto-sem-fato") {
      out.push({
        id: `criar-fato:${issue.alvo}`,
        tipo: "criar-fato",
        prioridade: issue.severidade,
        titulo: `Criar fato para "${issue.rotulo}"`,
        motivo: "O objeto explica algo que nenhum fato verificável sustenta.",
        alvo: issue.alvo,
        rota: "/intelligence/admin/fatos/novo",
      });
    }
    if (issue.tipo === "fato-sem-objeto") {
      out.push({
        id: `criar-relacionamento:${issue.alvo}`,
        tipo: "criar-relacionamento",
        prioridade: "media",
        titulo: `Vincular o fato "${issue.rotulo.slice(0, 60)}" a um objeto`,
        motivo: "Fato existente que ainda não gera conhecimento publicável.",
        alvo: issue.alvo,
        rota: "/intelligence/admin/graph/relacoes",
      });
    }
    if (issue.tipo === "entidade-orfa" || issue.tipo === "no-orfao") {
      out.push({
        id: `revisar-entidade:${issue.alvo}`,
        tipo: "revisar-entidade",
        prioridade: issue.severidade,
        titulo: `Conectar "${issue.rotulo}" ao grafo`,
        motivo: "Nó isolado não participa de nenhum raciocínio estrutural.",
        alvo: issue.alvo,
        rota: "/intelligence/admin/graph/relacoes",
      });
    }
  }

  // Fatos sem fonte forte ou sem revisor → adicionar fonte / validar.
  for (const f of snapshot.facts) {
    if (!f.fonte?.dispositivo?.trim() || !f.fonte?.titulo?.trim()) {
      out.push({
        id: `adicionar-fonte:${f.id}`,
        tipo: "adicionar-fonte",
        prioridade: f.status === "vigente" ? "critica" : "alta",
        titulo: `Completar a fonte do fato "${f.enunciado.slice(0, 60)}"`,
        motivo: "Sem título e dispositivo exatos, a afirmação não é conferível.",
        alvo: String(f.id),
        rota: `/intelligence/admin/fatos/${f.id}`,
      });
    }
    const dias = daysSince(f.ultimaValidacaoEm);
    const limite = Math.max(30, f.periodicidadeDias || 180);
    if (dias === null || dias > limite) {
      out.push({
        id: `validar-relacionamento:${f.id}`,
        tipo: "validar-relacionamento",
        prioridade: f.status === "vigente" ? "alta" : "media",
        titulo: `Revalidar "${f.enunciado.slice(0, 60)}"`,
        motivo:
          dias === null
            ? "Fato nunca passou por conferência humana."
            : `Última validação há ${dias} dias (limite: ${limite}).`,
        alvo: String(f.id),
        rota: `/intelligence/admin/fatos/${f.id}`,
      });
    }
  }

  // Relações propostas há tempo demais → validar.
  for (const e of snapshot.edges) {
    if (e.status !== "proposta") continue;
    out.push({
      id: `validar-relacao:${e.id}`,
      tipo: "validar-relacionamento",
      prioridade: "media",
      titulo: "Validar relação ainda em proposta",
      motivo: e.justificativa || "Relação proposta sem revisão registrada.",
      alvo: e.id,
      rota: "/intelligence/admin/graph/relacoes",
    });
  }

  // Objetos desatualizados ou frágeis.
  for (const o of confidence.objetos) {
    const draft = snapshot.drafts.find((d) => String(d.id) === o.id);
    const dias = daysSince(draft?.atualizadoEm);
    if (dias !== null && dias > STALE_DAYS) {
      out.push({
        id: `atualizar-artigo:${o.id}`,
        tipo: "atualizar-artigo",
        prioridade: "media",
        titulo: `Atualizar "${o.titulo}"`,
        motivo: `Sem revisão editorial há ${dias} dias.`,
        alvo: o.id,
        rota: `/intelligence/admin/factory/objetos/${o.id}`,
      });
    }
    if (draft && draft.faq.length === 0) {
      out.push({
        id: `adicionar-faq:${o.id}`,
        tipo: "adicionar-faq",
        prioridade: draft.estado === "publicado" ? "alta" : "baixa",
        titulo: `Adicionar FAQ em "${o.titulo}"`,
        motivo: "Objetos sem perguntas não respondem a buscas reais.",
        alvo: o.id,
        rota: `/intelligence/admin/factory/objetos/${o.id}`,
      });
    }
    if (o.score < 50) {
      out.push({
        id: `completar-cobertura:${o.id}`,
        tipo: "completar-cobertura",
        prioridade: "alta",
        titulo: `Reforçar "${o.titulo}" (confiança ${o.score}%)`,
        motivo: o.fatores
          .filter((f) => f.pontos <= 0 || f.pontos < f.maximo / 2)
          .map((f) => f.rotulo)
          .slice(0, 3)
          .join(" · "),
        alvo: o.id,
        rota: `/intelligence/admin/factory/objetos/${o.id}`,
      });
    }
  }

  // Lacunas de cobertura por entidade.
  for (const e of coverage.entidades) {
    if (!e.lacunas.length) continue;
    out.push({
      id: `completar-cobertura:entidade:${e.entidade}`,
      tipo: "completar-cobertura",
      prioridade: e.faixa,
      titulo: `Cobertura de "${e.entidade}" em ${e.cobertura}%`,
      motivo: `Lacunas: ${e.lacunas.join(" · ")}.`,
      alvo: e.entidade,
      rota: "/intelligence/admin/reasoning/cobertura",
    });
  }

  const unicas = new Map<string, KnowledgeSuggestion>();
  for (const s of out) unicas.set(s.id, s);

  return [...unicas.values()].sort(
    (a, b) => SEVERITY_ORDER[a.prioridade] - SEVERITY_ORDER[b.prioridade],
  );
};