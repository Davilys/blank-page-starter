import { describe, expect, it } from "vitest";
import { emptyDraft, type KnowledgeDraft } from "../../factory/KnowledgeDraft";
import { blockingFailures, canPublish, checklistScore, runChecklist } from "../checklist";
import { buildSeo } from "../seo";
import { applicableSchemas, buildJsonLd, validateJsonLd } from "../schema";
import { renderSemanticHtml, aiReadinessScore } from "../html";
import { buildPreview, previewSurface } from "../preview";
import { activeVersion, healthBand, nextVersion, type PublishedVersion } from "../Publication";

const draft = (over: Partial<KnowledgeDraft> = {}): KnowledgeDraft =>
  ({
    ...emptyDraft(),
    id: "ko-1",
    slug: "registro-de-marca",
    titulo: "Registro de marca no INPI",
    descricao: "Guia completo sobre como registrar uma marca junto ao INPI no Brasil.",
    tipo: "processo",
    estado: "aprovado",
    categoria: "propriedade-industrial",
    entidadePrincipal: "ent-inpi",
    palavrasChave: ["marca", "inpi", "registro"],
    resumoCurto: "O registro de marca é concedido pelo INPI após exame formal e de mérito.",
    resumoTecnico: "Procedimento administrativo regido pela Lei 9.279/96.",
    explicacaoCompleta:
      "O registro de marca no INPI segue etapas de busca, depósito, publicação, oposição e deferimento, com prazos definidos pela LPI e acompanhamento pela RPI semanal do instituto brasileiro.",
    checklist: ["Busca de anterioridade", "Depósito do pedido"],
    faq: [{ pergunta: "Quanto tempo demora?", resposta: "Em média de 12 a 24 meses." }],
    fontes: [
      {
        id: "src-1",
        titulo: "Lei 9.279/96",
        url: "https://www.planalto.gov.br",
        tier: "oficial",
        acessadoEm: "2026-01-01T00:00:00.000Z",
      },
    ],
    relacionamentos: [],
    autorId: "autor-1",
    revisorId: "revisor-1",
    dataRevisao: "2026-01-02T00:00:00.000Z",
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-02T00:00:00.000Z",
    versao: 1,
    ...over,
  }) satisfies KnowledgeDraft;

describe("checklist de publicação", () => {
  it("libera um objeto aprovado e completo", () => {
    const itens = runChecklist(draft());
    expect(blockingFailures(itens)).toHaveLength(0);
    expect(canPublish(draft())).toBe(true);
    expect(checklistScore(itens)).toBe(100);
  });

  it("bloqueia objeto não aprovado", () => {
    expect(canPublish(draft({ estado: "rascunho" }))).toBe(false);
  });

  it("bloqueia objeto sem fontes", () => {
    expect(canPublish(draft({ fontes: [] }))).toBe(false);
  });

  it("bloqueia relações contraditórias", () => {
    expect(
      canPublish(draft({ relacionamentos: [{ tipo: "contradiz", alvoSlug: "outro" }] })),
    ).toBe(false);
  });

  it("bloqueia links internos quebrados", () => {
    expect(canPublish(draft({ linksInternos: ["slug-inexistente"] }))).toBe(false);
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
    const json = buildJsonLd(draft());
    expect(validateJsonLd(json)).toHaveLength(0);
    expect(applicableSchemas(draft())).toContain("BreadcrumbList");
  });
});

describe("HTML e AI readiness", () => {
  it("renderiza HTML semântico com heading principal", () => {
    const html = renderSemanticHtml(draft());
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
    const versoes = [
      { versao: 1, ativa: false },
      { versao: 3, ativa: true },
    ] as unknown as readonly PublishedVersion[];
    expect(nextVersion([])).toBe(1);
    expect(nextVersion(versoes)).toBe(4);
    expect(activeVersion(versoes)?.versao).toBe(3);
    expect(healthBand(90)).toBe("saudavel");
    expect(healthBand(60)).toBe("atencao");
    expect(healthBand(10)).toBe("critico");
  });

  it("expõe todas as superfícies de preview", () => {
    const d = draft();
    const p = buildPreview(d);
    expect(previewSurface(d, p, "pagina")).toContain("<article");
    expect(previewSurface(d, p, "schema")).toContain("schema.org");
  });
});