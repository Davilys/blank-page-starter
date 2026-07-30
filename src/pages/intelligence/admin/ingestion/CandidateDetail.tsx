/**
 * Candidate detail: editorial choices, duplicate alert, original↔draft preview
 * and the approve/reject decision. Promotion always lands in the FASE 06
 * workflow — publication from here is impossible by construction.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Check, RotateCcw, Save, X } from "lucide-react";
import { PRIORITIES } from "@/modules/intelligence/domain/factory/KnowledgeDraft";
import type { CandidateChoices } from "@/modules/intelligence/domain/ingestion/SourceDocument";
import { KNOWLEDGE_OBJECT_TYPES } from "@/modules/intelligence/domain/shared/taxonomy";
import { useCandidate } from "@/modules/intelligence/presentation/hooks/useIngestion";
import { ComparePreview } from "@/modules/intelligence/presentation/components/ingestion/ComparePreview";
import { DuplicateAlert } from "@/modules/intelligence/presentation/components/ingestion/DuplicateAlert";
import {
  CandidateStatusBadge,
  FormatBadge,
} from "@/modules/intelligence/presentation/components/ingestion/CandidateBadges";

const CandidateDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { candidato, eventos, loading, salvarEscolhas, aprovar, rejeitar, reabrir } =
    useCandidate(id);

  const [escolhas, setEscolhas] = useState<CandidateChoices | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  useEffect(() => {
    if (candidato) setEscolhas(candidato.escolhas);
  }, [candidato]);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!candidato || !escolhas) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Candidato não encontrado.</p>
      </Card>
    );
  }

  const pendente = candidato.status === "pendente";
  const set = (patch: Partial<CandidateChoices>) =>
    setEscolhas((e) => (e ? { ...e, ...patch } : e));

  const onSalvar = async () => {
    const r = await salvarEscolhas(escolhas);
    if (r.ok) toast.success("Escolhas salvas. Duplicidades reavaliadas.");
    else toast.error(r.error);
  };

  const onAprovar = async () => {
    const s = await salvarEscolhas(escolhas);
    if (!s.ok) {
      toast.error(s.error);
      return;
    }
    const r = await aprovar(escolhas.autorId);
    if (r.ok) {
      toast.success("Knowledge Object criado no workflow editorial. Nada foi publicado.");
      navigate(`/intelligence/admin/factory/objetos/${r.value.draftId}`);
    } else toast.error(r.error);
  };

  const onRejeitar = async () => {
    const r = await rejeitar(escolhas.autorId, motivoRejeicao);
    if (r.ok) toast.success("Candidato rejeitado e registrado no histórico.");
    else toast.error(r.error);
  };

  return (
    <div>
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="../ingestion/candidatos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold text-foreground">
            {candidato.escolhas.titulo || candidato.arquivoNome}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {candidato.arquivoNome} · {Math.round(candidato.tamanhoBytes / 1024)} KB · importado por{" "}
            {candidato.importadoPor} em{" "}
            {new Date(candidato.importadoEm).toLocaleString("pt-BR")} · origem: {candidato.origem}
          </p>
        </div>
        <FormatBadge formato={candidato.formato} />
        <CandidateStatusBadge status={candidato.status} />
      </div>

      {candidato.avisos.length > 0 && (
        <Card className="mt-4 border-muted p-4">
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {candidato.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <ComparePreview candidato={candidato} />
        </div>

        <div className="space-y-6">
          <DuplicateAlert itens={candidato.duplicidades} />

          <Card className="p-5">
            <h2 className="font-semibold text-foreground">Definições do editor</h2>

            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="c-titulo">Título</Label>
                <Input
                  id="c-titulo"
                  className="mt-1"
                  value={escolhas.titulo}
                  disabled={!pendente}
                  onChange={(e) => set({ titulo: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="c-categoria">Categoria</Label>
                  <Input
                    id="c-categoria"
                    className="mt-1"
                    value={escolhas.categoria}
                    disabled={!pendente}
                    onChange={(e) => set({ categoria: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={escolhas.tipo}
                    disabled={!pendente}
                    onValueChange={(v) => set({ tipo: v as never })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KNOWLEDGE_OBJECT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="c-entidade">Entidade principal</Label>
                <Input
                  id="c-entidade"
                  className="mt-1"
                  placeholder="inpi, registro-de-marca…"
                  value={escolhas.entidadePrincipal}
                  disabled={!pendente}
                  onChange={(e) => set({ entidadePrincipal: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="c-idioma">Idioma</Label>
                  <Input
                    id="c-idioma"
                    className="mt-1"
                    value={escolhas.idioma}
                    disabled={!pendente}
                    onChange={(e) => set({ idioma: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="c-jurisdicao">Jurisdição</Label>
                  <Input
                    id="c-jurisdicao"
                    className="mt-1"
                    value={escolhas.jurisdicao}
                    disabled={!pendente}
                    onChange={(e) => set({ jurisdicao: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prioridade</Label>
                  <Select
                    value={escolhas.prioridade}
                    disabled={!pendente}
                    onValueChange={(v) => set({ prioridade: v as never })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status inicial</Label>
                  <Select
                    value={escolhas.estadoInicial}
                    disabled={!pendente}
                    onValueChange={(v) => set({ estadoInicial: v as never })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="em-revisao">Em Revisão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="c-autor">Autor</Label>
                  <Input
                    id="c-autor"
                    className="mt-1"
                    value={escolhas.autorId}
                    disabled={!pendente}
                    onChange={(e) => set({ autorId: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="c-revisor">Revisor</Label>
                  <Input
                    id="c-revisor"
                    className="mt-1"
                    value={escolhas.revisorId}
                    disabled={!pendente}
                    onChange={(e) => set({ revisorId: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {pendente ? (
              <div className="mt-5 space-y-2">
                <Button className="w-full" variant="outline" onClick={onSalvar}>
                  <Save className="mr-1.5 h-4 w-4" /> Salvar escolhas
                </Button>
                <Button className="w-full" onClick={onAprovar}>
                  <Check className="mr-1.5 h-4 w-4" /> Aprovar e criar Knowledge Object
                </Button>
                <p className="text-xs text-muted-foreground">
                  O objeto entra em "{escolhas.estadoInicial}". Publicação só pelo workflow
                  editorial, após validação.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-2">
                {candidato.draftId && (
                  <Button className="w-full" variant="outline" asChild>
                    <Link to={`/intelligence/admin/factory/objetos/${candidato.draftId}`}>
                      Abrir Knowledge Object gerado
                    </Link>
                  </Button>
                )}
                {candidato.status === "rejeitado" && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={async () => {
                      const r = await reabrir(escolhas.autorId);
                      if (r.ok) toast.success("Candidato reaberto.");
                      else toast.error(r.error);
                    }}
                  >
                    <RotateCcw className="mr-1.5 h-4 w-4" /> Reabrir
                  </Button>
                )}
              </div>
            )}
          </Card>

          {pendente && (
            <Card className="p-5">
              <h2 className="font-semibold text-foreground">Rejeitar</h2>
              <Textarea
                className="mt-2"
                rows={3}
                placeholder="Motivo da rejeição (obrigatório)"
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
              />
              <Button className="mt-3 w-full" variant="destructive" onClick={onRejeitar}>
                <X className="mr-1.5 h-4 w-4" /> Rejeitar candidato
              </Button>
            </Card>
          )}

          {candidato.motivoRejeicao && (
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Motivo da rejeição
              </p>
              <p className="mt-1 text-sm text-foreground">{candidato.motivoRejeicao}</p>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="font-semibold text-foreground">Histórico deste arquivo</h2>
            <ul className="mt-3 space-y-2">
              {eventos.map((e) => (
                <li key={e.id} className="text-sm">
                  <p className="capitalize text-foreground">{e.evento}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.usuario} · {new Date(e.ocorridoEm).toLocaleString("pt-BR")}
                    {e.destino ? ` · ${e.destino}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CandidateDetail;