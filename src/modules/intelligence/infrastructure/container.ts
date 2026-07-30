/**
 * Composition root for the Intelligence module.
 *
 * This is the ONLY place where concrete implementations are chosen. Swapping
 * the in-memory adapters for a persisted backend later means editing this file
 * and nothing else.
 */
import { makeGetHomeOverview, type KnowledgeTheme } from "../application/use-cases/getHomeOverview";
import { makeSearchKnowledge } from "../application/use-cases/searchKnowledge";
import {
  createInMemoryEntityRepository,
  createInMemoryKnowledgeObjectRepository,
  createInMemoryMemoryRepository,
  createNoopFabricPort,
  createRuleBasedIntelligencePort,
} from "./inMemoryAdapters";

/**
 * Themes are STRUCTURE, not content: they define the ontology's top-level
 * clusters so later phases have a place to attach objects. Counts are zero
 * because no knowledge has been reviewed and published yet.
 */
export const KNOWLEDGE_THEMES: readonly KnowledgeTheme[] = [
  { slug: "registro-de-marca", titulo: "Registro de Marca", descricao: "Do depósito à concessão no INPI.", objetos: 0 },
  { slug: "classes-e-ncl", titulo: "Classes e NCL", descricao: "Classificação de produtos e serviços.", objetos: 0 },
  { slug: "exigencias", titulo: "Exigências", descricao: "Como responder exigências do INPI.", objetos: 0 },
  { slug: "oposicao", titulo: "Oposição", descricao: "Defesa e impugnação de pedidos.", objetos: 0 },
  { slug: "recursos", titulo: "Recursos", descricao: "Indeferimento, recurso e nulidade.", objetos: 0 },
  { slug: "caducidade", titulo: "Caducidade", descricao: "Uso efetivo e perda de direito.", objetos: 0 },
  { slug: "alto-renome", titulo: "Alto Renome", descricao: "Proteção especial e notoriedade.", objetos: 0 },
  { slug: "licenciamento", titulo: "Licenciamento", descricao: "Contratos, cessão e averbação.", objetos: 0 },
];

/**
 * Canonical questions the knowledge base intends to answer. They are declared
 * up front so the Gap Engine has a target set — each will become a reviewed
 * Knowledge Object, never an auto-generated answer.
 */
export const FEATURED_QUESTIONS: readonly string[] = [
  "O que é registro de marca e o que ele protege?",
  "Quanto custam as taxas do INPI para PF, MEI e PJ?",
  "Qual o prazo para apresentar oposição a um pedido de marca?",
  "O que fazer ao receber uma exigência do INPI?",
  "Como escolher a classe correta na NCL?",
  "O que acontece se a marca for indeferida?",
];

export interface IntelligenceContainer {
  readonly searchKnowledge: ReturnType<typeof makeSearchKnowledge>;
  readonly getHomeOverview: ReturnType<typeof makeGetHomeOverview>;
}

export const createIntelligenceContainer = (): IntelligenceContainer => {
  const knowledgeObjects = createInMemoryKnowledgeObjectRepository();
  const entities = createInMemoryEntityRepository();
  const memory = createInMemoryMemoryRepository();
  const fabric = createNoopFabricPort();
  const intelligence = createRuleBasedIntelligencePort();

  // Referenced so later phases wire them without changing this signature.
  void entities;
  void fabric;

  return {
    searchKnowledge: makeSearchKnowledge(knowledgeObjects, intelligence),
    getHomeOverview: makeGetHomeOverview(
      knowledgeObjects,
      memory,
      KNOWLEDGE_THEMES,
      FEATURED_QUESTIONS,
    ),
  };
};

/** Single shared instance for the module's React tree. */
export const intelligenceContainer = createIntelligenceContainer();