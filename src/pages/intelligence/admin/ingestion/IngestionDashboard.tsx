/** Knowledge Ingestion — dashboard, upload and history (FASE 07 §1/§8/§9). */
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, History } from "lucide-react";
import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_LABEL,
  SOURCE_FORMAT_LABEL,
} from "@/modules/intelligence/domain/ingestion/SourceDocument";
import { ingestionContainer } from "@/modules/intelligence/infrastructure/ingestionContainer";
import { useIngestionMetrics } from "@/modules/intelligence/presentation/hooks/useIngestion";
import { FileImporter } from "@/modules/intelligence/presentation/components/ingestion/FileImporter";
import {
  CandidateStatusBadge,
  FormatBadge,
} from "@/modules/intelligence/presentation/components/ingestion/CandidateBadges";

const IngestionDashboard = () => {
  const { data, loading, recarregar } = useIngestionMetrics();
  const [busy, setBusy] = useState(false);

  const importar = async (files: File[], importadoPor: string, origem: string) => {
    setBusy(true);
    let sucesso = 0;
    for (const file of files) {
      const r = await ingestionContainer.importDocument({ file, importadoPor, origem });
      if (r.ok) sucesso += 1;
      else toast.error(`${file.name}: ${r.error}`);
    }
    if (sucesso > 0) toast.success(`${sucesso} candidato(s) criado(s). Nenhum foi publicado.`);
    await recarregar();
    setBusy(false);
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Ingestion</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Esteira de ingestão do acervo. Documentos viram candidatos rastreáveis; a
            criação de Knowledge Objects continua sendo uma decisão humana.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="../ingestion/candidatos">Ver candidatos</Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Arquivos importados</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {loading ? "—" : data?.arquivosImportados ?? 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Candidatos gerados</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {loading ? "—" : data?.candidatosGerados ?? 0}
          </p>
        </Card>
        {CANDIDATE_STATUSES.map((s) => (
          <Card key={s} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {CANDIDATE_STATUS_LABEL[s]}
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {loading ? "—" : data?.porStatus[s] ?? 0}
            </p>
          </Card>
        ))}
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Duplicidades</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {loading ? "—" : data?.comDuplicidade ?? 0}
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <FileImporter onImport={importar} busy={busy} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold text-foreground">Pendentes de revisão</h2>
          {!data || data.pendentes.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum candidato na fila.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.pendentes.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`../ingestion/candidatos/${c.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-foreground">
                      {c.escolhas.titulo || c.arquivoNome}
                    </span>
                    <FormatBadge formato={c.formato} />
                    <CandidateStatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {data && Object.keys(data.porFormato).length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              Por formato:{" "}
              {Object.entries(data.porFormato)
                .map(([f, n]) => `${SOURCE_FORMAT_LABEL[f as never]}: ${n}`)
                .join(" · ")}
            </p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <History className="h-4 w-4" /> Histórico de ingestão
          </h2>
          {!data || data.historico.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum evento registrado.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.historico.map((e) => (
                <li key={e.id} className="text-sm">
                  <p className="text-foreground">
                    <span className="font-medium capitalize">{e.evento}</span> · {e.arquivoNome}
                    {e.destino ? ` → ${e.destino}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.usuario} · {new Date(e.ocorridoEm).toLocaleString("pt-BR")} · origem:{" "}
                    {e.origem}
                    {e.draftId ? ` · objeto ${e.draftId.slice(0, 8)}` : ""}
                  </p>
                  {e.observacao && (
                    <p className="text-xs text-muted-foreground">{e.observacao}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

export default IngestionDashboard;