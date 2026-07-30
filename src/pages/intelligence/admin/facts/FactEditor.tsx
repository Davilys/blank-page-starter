/**
 * Editor do fato: cadeia completa em uma tela.
 * Fato → Fonte → Data → Versão → Confiabilidade → Relacionamentos →
 * Objetos afetados → Última validação → Revisor.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, Save, ShieldAlert } from "lucide-react";
import { emptyFact, type Fact } from "@/modules/intelligence/domain/facts/Fact";
import { evaluateFactGates } from "@/modules/intelligence/domain/facts/validation";
import { computeConfidence } from "@/modules/intelligence/domain/facts/confidence";
import { useFact, useFactLinkOptions } from "@/modules/intelligence/presentation/hooks/useFacts";
import {
  FactForm,
  type FactFormValue,
} from "@/modules/intelligence/presentation/components/facts/FactForm";
import { ConfidencePanel } from "@/modules/intelligence/presentation/components/facts/ConfidencePanel";
import { FactChain } from "@/modules/intelligence/presentation/components/facts/FactChain";
import {
  FactStatusBadge,
  TierBadge,
} from "@/modules/intelligence/presentation/components/facts/FactBadges";

const FactEditor = () => {
  const { id } = useParams();
  const novo = !id || id === "novo";
  const navigate = useNavigate();
  const { detalhe, loading, salvar, validar } = useFact(id);
  const { fatos, objetos } = useFactLinkOptions();

  const [form, setForm] = useState<FactFormValue>(emptyFact());
  const [revisorId, setRevisorId] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (detalhe) {
      setForm(detalhe.fato);
      setRevisorId(detalhe.fato.revisorId ?? "");
    }
  }, [detalhe]);

  const bloqueado = detalhe?.fato.status === "substituido";

  /** Prévia ao vivo: portões e confiabilidade recalculados enquanto se digita. */
  const previa = useMemo(() => {
    const base = {
      ...emptyFact(),
      ...(detalhe?.fato ?? {}),
      ...form,
      validacoes: detalhe?.fato.validacoes ?? [],
    } as Fact;
    return {
      portoes: evaluateFactGates(base),
      confianca: computeConfidence(base, detalhe?.contradicoesAtivas ?? 0),
    };
  }, [form, detalhe]);

  const onSalvar = async () => {
    const r = await salvar(form, String(form.autorId ?? "").trim());
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    const { fato, novaVersao } = r.value;
    toast.success(
      novaVersao && !novo
        ? `Sentido alterado: criada a versão v${fato.versao}. A anterior foi congelada.`
        : "Fato gravado.",
    );
    if (novo || fato.id !== id) navigate(`/intelligence/admin/fatos/${fato.id}`);
  };

  const executarValidacao = async (
    resultado: "confirmado" | "ajustado" | "contestado" | "revogado",
  ) => {
    const r = await validar(revisorId.trim(), resultado, observacao);
    if (r.ok) {
      toast.success("Validação registrada.");
      setObservacao("");
    } else toast.error(r.error);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/intelligence/admin/fatos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {novo ? "Novo fato" : `Fato v${detalhe?.fato.versao ?? 1}`}
          </h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {form.enunciado || "Descreva uma afirmação verificável."}
          </p>
        </div>
        {detalhe && <TierBadge tier={detalhe.fato.fonte.tier} />}
        {detalhe && <FactStatusBadge status={detalhe.fato.status} />}
      </div>

      {bloqueado && (
        <Card className="mt-4 border-accent/40 bg-accent/5 p-4">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <ShieldAlert className="h-4 w-4 text-accent" />
            Esta versão foi substituída e é imutável. Abra a versão vigente da cadeia para editar.
          </p>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          <FactForm
            value={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            fatosDisponiveis={fatos.filter((f) => f.id !== detalhe?.fato.id)}
            objetosDisponiveis={objetos}
            bloqueado={bloqueado}
          />

          {!bloqueado && (
            <Button className="mt-6" onClick={onSalvar}>
              <Save className="mr-1.5 h-4 w-4" /> Gravar fato
            </Button>
          )}
        </div>

        <div className="space-y-6">
          <ConfidencePanel relatorio={previa.confianca} />

          <Card className="p-5">
            <h2 className="font-semibold text-foreground">Portões de vigência</h2>
            <ul className="mt-3 space-y-2">
              {previa.portoes.map((g) => (
                <li key={g.id} className="flex items-start gap-2 text-sm">
                  <span
                    className={
                      g.ok
                        ? "mt-0.5 h-4 w-4 shrink-0 rounded-full bg-primary/15 text-center text-[10px] leading-4 text-primary"
                        : "mt-0.5 h-4 w-4 shrink-0 rounded-full bg-destructive/15 text-center text-[10px] leading-4 text-destructive"
                    }
                  >
                    {g.ok ? "✓" : "!"}
                  </span>
                  <span>
                    <span className="text-foreground">{g.rotulo}</span>
                    {!g.ok && (
                      <span className="block text-xs text-muted-foreground">{g.detalhe}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {detalhe && !bloqueado && (
            <Card className="p-5">
              <h2 className="font-semibold text-foreground">Validação e revisor</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                O revisor precisa ser diferente do autor. Confirmar coloca o fato em vigência.
              </p>

              <div className="mt-3 space-y-3">
                <div>
                  <Label htmlFor="v-revisor">Revisor</Label>
                  <Input
                    id="v-revisor"
                    className="mt-1"
                    value={revisorId}
                    onChange={(e) => setRevisorId(e.target.value)}
                  />
                </div>
                <Textarea
                  rows={2}
                  placeholder="Observação da conferência (opcional)"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={() => executarValidacao("confirmado")}>
                    <Check className="mr-1.5 h-4 w-4" /> Confirmar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => executarValidacao("ajustado")}>
                    Ajustado
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => executarValidacao("contestado")}>
                    Contestar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => executarValidacao("revogado")}>
                    Revogar
                  </Button>
                </div>
              </div>

              {detalhe.fato.validacoes.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-border pt-3">
                  {[...detalhe.fato.validacoes].reverse().map((v) => (
                    <li key={v.id} className="text-xs text-muted-foreground">
                      <span className="capitalize text-foreground">{v.resultado}</span> ·{" "}
                      {v.revisorId} · {new Date(v.validadoEm).toLocaleString("pt-BR")}
                      {v.observacao ? ` — ${v.observacao}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {detalhe && detalhe.objetos.length > 0 && (
            <Card className="p-5">
              <h2 className="font-semibold text-foreground">Objetos afetados</h2>
              <ul className="mt-3 space-y-2">
                {detalhe.objetos.map((o) => (
                  <li key={o.id} className="text-sm">
                    <Link
                      to={`/intelligence/admin/factory/objetos/${o.id}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {o.titulo}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">{o.estado}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {detalhe && detalhe.relacionados.length > 0 && (
            <Card className="p-5">
              <h2 className="font-semibold text-foreground">Relacionamentos</h2>
              <ul className="mt-3 space-y-2">
                {detalhe.relacionados.map((r, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-muted-foreground">{r.tipo}</span>{" "}
                    {r.alvo ? (
                      <Link
                        to={`/intelligence/admin/fatos/${r.alvo.id}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {r.alvo.enunciado.slice(0, 60)}
                      </Link>
                    ) : (
                      <span className="text-destructive">alvo não encontrado</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {detalhe && detalhe.cadeia.length > 0 && (
            <FactChain cadeia={detalhe.cadeia} atualId={String(detalhe.fato.id)} />
          )}
        </div>
      </div>
    </div>
  );
};

export default FactEditor;