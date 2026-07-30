import { describe, expect, it } from "vitest";
import type { KnowledgeDraft } from "../../factory/KnowledgeDraft";
import { runChecklist } from "../checklist";
import { buildSeo } from "../seo";
import { buildSchemas, validateSchemas } from "../schema";
import { renderSemanticHtml, aiReadinessScore } from "../html";
import { buildPreview } from "../preview";
import { canRollbackTo, nextVersionNumber } from "../Publication";

const draft = (over: Partial<KnowledgeDraft> = {}): KnowledgeDraft =>
  ({
    id: "ko-1",
    slug: "registro-de-marca",
    titulo: "Registro de marca no INPI",
    descricao: "Como registrar uma marca no INPI.",
    tipo: "guia",
    estado: "aprovado",
    categoria: "propriedade-industrial",
    idioma: "pt-BR",
    jurisdicao: "BR",
    entidadePrincipal: "ent-inpi",
    resumoCurto: "O registro de marca é concedido pelo INPI.",
    explicacaoCompleta:
      "O registro de marca no INPI segue etapas de busca, depósito, publicação, oposição e deferimento, com prazos definidos pela LPI e acompanhamento pela RPI semanal do instituto.",
    fontes: [{ id: "src-1", titulo: "Lei 9.279/96", tier: "oficial", acessadoEm: "2026-01-01T00:00:00.000Z" }],
    relacionamentos: [],
    autorId: "autor-1",
    revisorId: "revisor-1",
    dataRevisao: "2026-01-02T00:00:00.000Z",
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-02T00:00:00.000Z",
    versao: 1,
    ...over,
  }) as KnowledgeDraft;

describe("checklist de publicação", () => {
  it("libera um objeto aprovado e completo", () => {
    const r = runChecklist(draft());
    expect(r.liberado).toBe(true);
    expect(r.bloqueios).toHaveLength(0);
    expect(r.score).toBe(100);
  });

  it("bloqueia objeto não aprovado", () => {
    const r = runChecklist(draft({ estado: "rascunho" }));
    expect(r.liberado).toBe(false);
  });

  it("bloqueia objeto sem fontes", () => {
    const r = runChecklist(draft({ fontes: [] }));
    expect(r.liberado).toBe(false);
  });

  it("bloqueia relações contraditórias", () => {
    const r = runChecklist(
      draft({ relacionamentos: [{ tipo: "contradiz", alvo: "ko-2" }] as never }),
    );
    expect(r.liberado).toBe(false);
  });
});

describe("SEO e schema", () => {
  it("gera title, description e canonical determinísticos", () => {
    const a = buildSeo(draft());
    const b = buildSeo(draft());
    expect(a).toEqual(b);
    expect(a.canonical).toContain("/registro-de-marca");
    expect(a.title.length).toBeGreaterThan(0);
  });

  it("produz JSON-LD válido", () => {
    const schemas = buildSchemas(draft(), buildSeo(draft()));
    expect(validateSchemas(schemas)).toHaveLength(0);
    expect(schemas.some((s) => s["@type"] === "BreadcrumbList")).toBe(true);
  });
});

describe("HTML e AI readiness", () => {
  it("renderiza HTML semântico com heading principal", () => {
    const html = renderSemanticHtml(draft(), buildSeo(draft()));
    expect(html).toContain("<article");
    expect(html).toContain("<h1>");
  });

  it("pontua legibilidade para IA entre 0 e 100", () => {
    const s = aiReadinessScore(draft());
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("preview e versionamento", () => {
  it("hash do preview é estável para o mesmo conteúdo", () => {
    expect(buildPreview(draft()).hash).toBe(buildPreview(draft()).hash);
  });

  it("hash muda quando o conteúdo muda", () => {
    expect(buildPreview(draft()).hash).not.toBe(
      buildPreview(draft({ titulo: "Outro título" })).hash,
    );
  });

  it("calcula a próxima versão e valida rollback", () => {
    expect(nextVersionNumber([])).toBe(1);
    expect(nextVersionNumber([{ versao: 3 } as never])).toBe(4);
    expect(canRollbackTo([{ versao: 2, ativa: false } as never], 2)).toBe(true);
    expect(canRollbackTo([{ versao: 2, ativa: true } as never], 2)).toBe(false);
  });
});