/** Composition root do Knowledge Publishing Engine (FASE 11). */
import { makeGetPublishingMetrics } from "../application/use-cases/publishing/getPublishingMetrics";
import { makePublishingUseCases } from "../application/use-cases/publishing/publishObject";
import { createLocalDraftRepository } from "./localDraftAdapters";
import {
  createLocalPublicationAuditRepository,
  createLocalPublicationRepository,
} from "./localPublishingAdapters";

/** Limite mínimo de confiança estrutural exigido para publicar. */
export const CONFIDENCE_THRESHOLD = 70;

const drafts = createLocalDraftRepository();
const publications = createLocalPublicationRepository();
const audit = createLocalPublicationAuditRepository();

export const publishingContainer = {
  ...makePublishingUseCases(drafts, publications, audit, CONFIDENCE_THRESHOLD),
  getMetrics: makeGetPublishingMetrics(drafts, publications, audit, CONFIDENCE_THRESHOLD),
  listActive: () => publications.listActive(),
  listAudit: (limit?: number) => audit.list(limit),
};

export type PublishingContainer = typeof publishingContainer;