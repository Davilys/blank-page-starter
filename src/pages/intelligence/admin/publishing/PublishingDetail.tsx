/** Pipeline completo de um objeto: checklist → preview → publicação → versões. */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, RotateCcw, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ChecklistPanel } from "@/modules/intelligence/presentation/components/publishing/ChecklistPanel";
import { PublicationPreviewPanel } from "@/modules/intelligence/presentation/components/publishing/PublicationPreviewPanel";
import { ScorePill } from "@/modules/intelligence/presentation/components/publishing/PublishingBadges";
import { usePublicationPipeline } from "@/modules/intelligence/presentation/hooks/usePublishing";

const PublishingDetail = () => {
  const { id = "" } = useParams();
  const p = usePublicationPipeline(id);
  const [confirmando, setConfirmando] = useState(false);

  if (p.loading) return <p className="text-sm text-muted-foreground">Carregando objeto...</p>;
  if (!p.draft || !p.checklist || !p.preview)
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        {p.erro || "Objeto não encontrado."}{" "}
        <Link className="text-primary underline" to="..">
          Voltar ao pipeline
        </Link>
      </Card>
    );

  const liberado = p.checklist.liberado;

  const publicar = async () => {
    const ok = await p.publicar();
    setConfirmando(false);
    toast({
      title: ok ? "Publicado" : "Publicação bloqueada",
      description: ok
        ? "Nova versão publicada e registrada na auditoria."
        : "O checklist automático impediu a publicação.",
      variant: ok ? "default" : "destructive",
    });
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{p.draft.titulo}</h2>
          <p className="text-xs text-muted-foreground">
            /{p.draft.slug} · {p.draft.categoria || "sem categoria"} · estado:{" "}
            {p.draft.estado}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ScorePill label="Confiança" score={p.preview.confianca} />
          <ScorePill label="Cobertura" score={p.preview.cobertura} />
          <ScorePill label="IA" score={p.preview.aiReadiness} />
          {confirmando ? (
            <>
              <Button size="sm" onClick={publicar} disabled={p.publicando}>
                Confirmar publicação
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmando(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={!liberado} onClick={() => setConfirmando(true)}>
              <Send className="mr-1.5 h-4 w-4" /> Publicar
            </Button>
          )}
          {p.versoes.some((v) => v.ativa) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void p.despublicar();
              }}
            >
              Despublicar
            </Button>
          )}
        </div>
      </Card>

      {!liberado && (
        <Card className="flex items-start gap-2.5 border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-foreground">
            Publicação bloqueada por {p.checklist.bloqueios.length} item(ns):{" "}
            {p.checklist.bloqueios.map((b) => b.rotulo).join("; ")}.
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ChecklistPanel itens={p.checklist.itens} score={p.checklist.score} />
        </div>
        <div className="lg:col-span-2">
          <PublicationPreviewPanel draft={p.draft} preview={p.preview} />
        </div>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold text-foreground">Versões publicadas</h3>
        {p.versoes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma versão publicada até agora.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {p.versoes.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    v{v.versao} {v.ativa ? "· no ar" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(v.publicadoEm).toLocaleString("pt-BR")} · {v.autorId} · hash{" "}
                    <code>{v.hash}</code>
                    {v.restauradaDe ? ` · restaurada de v${v.restauradaDe}` : ""}
                  </p>
                </div>
                {!v.ativa && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void p.reverter(v.versao);
                    }}
                  >
                    <RotateCcw className="mr-1.5 h-4 w-4" /> Rollback
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default PublishingDetail;