/**
 * Portões de validação. Nenhum Fact vira "Validado" sem passar por todos.
 */
import { hasSource, type VaultFact } from "./VaultFact";

export interface VaultGate {
  readonly id: string;
  readonly rotulo: string;
  readonly ok: boolean;
  readonly detalhe: string;
}

const isDate = (v?: string) => Boolean(v) && !Number.isNaN(Date.parse(v as string));

export const evaluateVaultGates = (f: VaultFact): readonly VaultGate[] => [
  {
    id: "titulo",
    rotulo: "Título informado",
    ok: f.titulo.trim().length >= 5,
    detalhe: "Dê um título curto e reconhecível ao fato.",
  },
  {
    id: "declaracao",
    rotulo: "Declaração objetiva",
    ok: f.declaracao.trim().length >= 15,
    detalhe: "A afirmação precisa ser verificável e autoexplicativa.",
  },
  {
    id: "fonte-primaria",
    rotulo: "Fonte primária preenchida",
    ok: hasSource(f.fontePrimaria),
    detalhe: "Lei, manual ou ato normativo que sustenta a afirmação.",
  },
  {
    id: "dispositivo",
    rotulo: "Dispositivo exato da fonte",
    ok: f.fontePrimaria.dispositivo.trim().length > 0,
    detalhe: "Artigo, inciso, seção ou tabela — para conferência pontual.",
  },
  {
    id: "revisor",
    rotulo: "Revisor definido",
    ok: Boolean(f.revisorId && f.revisorId.trim().length > 0),
    detalhe: "Nenhum fato é validado sem um segundo par de olhos.",
  },
  {
    id: "data-validacao",
    rotulo: "Data de validação registrada",
    ok: Boolean(f.ultimaValidacaoEm),
    detalhe: "Registre quando a fonte foi conferida por um humano.",
  },
  {
    id: "confianca",
    rotulo: "Grau de confiança informado",
    ok: Boolean(f.confianca),
    detalhe: "O revisor declara o grau de confiança do fato.",
  },
  {
    id: "vigencia",
    rotulo: "Data de vigência",
    ok: isDate(f.vigenciaInicio),
    detalhe: "Sem vigência não é possível responder 'o que valia em X?'.",
  },
  {
    id: "jurisdicao",
    rotulo: "Jurisdição informada",
    ok: f.jurisdicao.trim().length > 0,
    detalhe: "Um fato vale dentro de um recorte territorial/normativo.",
  },
];

export const canValidate = (f: VaultFact) => evaluateVaultGates(f).every((g) => g.ok);
export const blockingVaultGates = (f: VaultFact) =>
  evaluateVaultGates(f).filter((g) => !g.ok);