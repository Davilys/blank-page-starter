/**
 * Editor de Knowledge Object: formulário + workflow + validação + preview +
 * histórico. Toda regra vem do domínio; esta página só orquestra.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import {
  EDITORIAL_STATE_LABEL,
  emptyDraft,
  type EditorialState,
  type KnowledgeDraft,
} from "@/modules/intelligence/domain/factory/KnowledgeDraft";
import { CHANGE_REASONS, type ChangeReason } from "@/modules/intelligence/domain/memory/KnowledgeVersion";
import { nextStates } from "@/modules/intelligence/domain/factory/workflow";
import { asIsoDateTime, asKnowledgeObjectId } from "@/modules/intelligence/domain/shared/primitives";
import { useDraft } from "@/modules/intelligence/presentation/hooks/useFactory";
import {
  DraftForm,
  type DraftFormValue,
} from "@/modules/intelligence/presentation/components/factory/DraftForm";
import { HistoryTimeline } from "@/modules/intelligence/presentation/components/factory/HistoryTimeline";
import { PreviewPanel } from "@/modules/intelligence/presentation/components/factory/PreviewPanel";
import { StatusBadge } from "@/modules/intelligence/presentation/components/factory/StatusBadge";
import { ValidationChecklist } from "@/modules/intelligence/presentation/components/factory/ValidationChecklist";

const FactoryEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { draft, versoes, loading, salvar, transicionar } = useDraft(id);

  const [value, setValue] = useState<DraftFormValue>(emptyDraft());
  const [motivo, setMotivo] = useState<ChangeReason>("melhoria-editorial");
  const [resumoMudanca, setResumoMudanca] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (draft) setValue(draft);
  }, [draft]);

  /** Objeto usado apenas para validação e preview em tempo real. */
  const projecao = useMemo<KnowledgeDraft>(
    () => ({
      ...(value as Omit<KnowledgeDraft, "id" | "criadoEm" | "atualizadoEm" | "versao">),
      id: asKnowledgeObjectId(draft?.id ?? "preview"),
      criadoEm: draft?.criadoEm ?? asIsoDateTime(new Date()),
      atualizadoEm: draft?.atualizadoEm ?? asIsoDateTime(new Date()),
      versao: draft?.versao ?? 0,
    }),
    [value, draft],
  );

  const handleSalvar = async () => {
    setSalvando(true);
    const r = await salvar({ draft: { ...value, id: draft?.id }, motivo, resumoMudanca });
    setSalvando(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`Objeto salvo (v${r.value.versao}).`);
    setResumoMudanca("");
    if (!id) navigate(`/intelligence/admin/factory/objetos/${r.value.id}`, { replace: true });
  };

  const handleTransicao = async (para: EditorialState) => {
    if (!draft) return;
    const r = await transicionar({
      id: draft.id,
      para,
      atorId: value.autorId || "editor",
      justificativa: resumoMudanca,
    });
    if (!r.ok) toast.error(r.error);
    else toast.success(`Estado alterado para "${EDITORIAL_STATE_LABEL[para]}".`);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/intelligence/admin/factory/objetos")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {draft ? draft.titulo || "Sem título" : "Novo Knowledge Object"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {draft ? `v${draft.versao} · atualizado em ${new Date(draft.atualizadoEm).toLocaleString("pt-BR")}` : "Ainda não salvo"}
            </p>
          </div>
        </div>
        {draft && <StatusBadge estado={draft.estado} />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <DraftForm value={value} onChange={setValue} />
        </div>

        <div className="space-y-5">
          <Card className="space-y-3 p-5">
            <h3 className="font-semibold text-foreground">Registrar alteração</h3>

            <div className="space-y-1.5">
              <Label className="text-sm">Motivo</Label>
              <Select value={motivo} onValueChange={(v) => setMotivo(v as ChangeReason)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANGE_REASONS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Resumo da mudança</Label>
              <Input
                value={resumoMudanca}
                onChange={(e) => setResumoMudanca(e.target.value)}
                placeholder="O que mudou e por quê"
              />
            </div>

            <Button className="w-full" onClick={handleSalvar} disabled={salvando}>
              <Save className="mr-1.5 h-4 w-4" />
              {salvando ? "Salvando…" : "Salvar nova versão"}
            </Button>
          </Card>

          {draft && (
            <Card className="space-y-3 p-5">
              <h3 className="font-semibold text-foreground">Workflow editorial</h3>
              <p className="text-xs text-muted-foreground">
                Publicação direta é impossível: um objeto só chega a “Publicado” depois
                de revisão e aprovação humanas.
              </p>
              <div className="flex flex-wrap gap-2">
                {nextStates(draft.estado).map((s) => (
                  <Button key={s} size="sm" variant="outline" onClick={() => handleTransicao(s)}>
                    {EDITORIAL_STATE_LABEL[s]}
                  </Button>
                ))}
              </div>
            </Card>
          )}

          <ValidationChecklist draft={projecao} />
          <PreviewPanel draft={projecao} />
          {draft && <HistoryTimeline versoes={versoes} />}
        </div>
      </div>
    </div>
  );
};

export default FactoryEditor;