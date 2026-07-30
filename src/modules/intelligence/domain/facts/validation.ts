/** Portões de entrada em vigência. Sem fonte, data e revisor, o fato não vale. */
import type { Fact } from "./Fact";

export interface FactGate {
  readonly id: string;
  readonly rotulo: string;
  readonly ok: boolean;
  readonly detalhe: string;
}

const isDate = (v?: string) => Boolean(v) && !Number.isNaN(Date.parse(v as string));

export const evaluateFactGates = (f: Fact): readonly FactGate[] => [
  {
    id: "enunciado",
    rotulo: "Existe enunciado verificável?",
    ok: f.enunciado.trim().length >= 15,
    detalhe: "O fato precisa de uma afirmação clara, com no mínimo 15 caracteres.",
  },
  {
    id: "fonte",
    rotulo: "Existe fonte?",
    ok: f.fonte.titulo.trim().length > 0,
    detalhe: "Toda afirmação exige uma fonte nomeada (lei, manual, ato normativo).",
  },
  {
    id: "dispositivo",
    rotulo: "Existe dispositivo exato?",
    ok: f.fonte.dispositivo.trim().length > 0,
    detalhe: "Informe artigo, inciso ou seção para tornar a conferência pontual.",
  },
  {
    id: "data",
    rotulo: "Existe data de vigência?",
    ok: isDate(f.vigenciaInicio),
    detalhe: "Sem data de início não é possível responder 'o que valia em X?'.",
  },
  {
    id: "entidade",
    rotulo: "Existe entidade principal?",
    ok: String(f.entidadePrincipal).trim().length > 0,
    detalhe: "O fato precisa estar ancorado em uma entidade do grafo.",
  },
  {
    id: "autor",
    rotulo: "Existe autor?",
    ok: f.autorId.trim().length > 0,
    detalhe: "Autoria é pré-requisito de auditoria.",
  },
  {
    id: "revisor",
    rotulo: "Existe revisor?",
    ok: Boolean(f.revisorId && f.revisorId.trim().length > 0),
    detalhe: "Nenhum fato entra em vigência sem um segundo par de olhos.",
  },
  {
    id: "validacao",
    rotulo: "Existe validação registrada?",
    ok: Boolean(f.ultimaValidacaoEm),
    detalhe: "Registre ao menos uma conferência humana da fonte.",
  },
];

export const canGoLive = (f: Fact) => evaluateFactGates(f).every((g) => g.ok);

export const blockingGates = (f: Fact) => evaluateFactGates(f).filter((g) => !g.ok);