/** Indicadores visuais do Vault. Cor comunica estado, nunca decoração. */
import { Badge } from "@/components/ui/badge";
import {
  CONFIDENCE_LABEL,
  FACT_KIND_LABEL,
  VAULT_STATUS_LABEL,
  type VaultConfidence,
  type VaultFactKind,
  type VaultFactStatus,
} from "../../../domain/vault/VaultFact";
import { RELATION_LABEL, type VaultRelationType } from "../../../domain/vault/relations";

export const VaultStatusBadge = ({ status }: { status: VaultFactStatus }) => (
  <Badge
    variant={status === "validado" ? "default" : status === "obsoleto" ? "destructive" : "secondary"}
  >
    {VAULT_STATUS_LABEL[status]}
  </Badge>
);

export const VaultKindBadge = ({ tipo }: { tipo: VaultFactKind }) => (
  <Badge variant="outline">{FACT_KIND_LABEL[tipo]}</Badge>
);

export const ConfidenceBadge = ({ nivel }: { nivel?: VaultConfidence }) => (
  <Badge variant={nivel === "baixa" || !nivel ? "secondary" : "outline"}>
    Confiança: {nivel ? CONFIDENCE_LABEL[nivel] : "não informada"}
  </Badge>
);

export const RelationBadge = ({ tipo }: { tipo: VaultRelationType }) => (
  <Badge variant={tipo === "contradiz" ? "destructive" : "outline"}>
    {RELATION_LABEL[tipo]}
  </Badge>
);