/** Fila de candidatos, com filtros por status, formato, autor e duplicidade. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Search } from "lucide-react";
import type { CandidateFilter } from "@/modules/intelligence/application/ports/ingestion";
import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_LABEL,
  SOURCE_FORMATS,
  SOURCE_FORMAT_LABEL,
} from "@/modules/intelligence/domain/ingestion/SourceDocument";
import { structureCounts } from "@/modules/intelligence/domain/ingestion/structure";
import { useCandidateList } from "@/modules/intelligence/presentation/hooks/useIngestion";
import {
  CandidateStatusBadge,
  FormatBadge,
} from "@/modules/intelligence/presentation/components/ingestion/CandidateBadges";

const TODOS = "__todos__";

const CandidateList = () => {
  const [filter, setFilter] = useState<CandidateFilter>({});
  const { items, loading } = useCandidateList(filter);

  const setF = (patch: Partial<CandidateFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const pick = (v: string) => (v === TODOS ? undefined : v);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Candidatos</h1>
        <Button asChild variant="outline">
          <Link to="../ingestion">Importar documentos</Link>
        </Button>
      </div>

      <Card className="mt-6 space-y-3 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por arquivo, título ou categoria"
            value={filter.texto ?? ""}
            onChange={(e) => setF({ texto: e.target.value })}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={filter.status ?? TODOS} onValueChange={(v) => setF({ status: pick(v) as never })}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os status</SelectItem>
              {CANDIDATE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{CANDIDATE_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filter.formato ?? TODOS} onValueChange={(v) => setF({ formato: pick(v) as never })}>
            <SelectTrigger><SelectValue placeholder="Formato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os formatos</SelectItem>
              {SOURCE_FORMATS.map((f) => (
                <SelectItem key={f} value={f}>{SOURCE_FORMAT_LABEL[f]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Importado por"
            value={filter.importadoPor ?? ""}
            onChange={(e) => setF({ importadoPor: e.target.value || undefined })}
          />

          <div className="flex items-center gap-2">
            <Button
              variant={filter.apenasComDuplicidade ? "default" : "outline"}
              size="sm"
              onClick={() => setF({ apenasComDuplicidade: !filter.apenasComDuplicidade || undefined })}
            >
              <AlertTriangle className="mr-1.5 h-4 w-4" /> Duplicidades
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setFilter({})}>
              Limpar
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-6 space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && items.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum candidato. Importe documentos para alimentar a fila editorial.
            </p>
          </Card>
        )}

        {items.map((c) => {
          const n = structureCounts(c.estrutura);
          return (
            <Link key={c.id} to={`../ingestion/candidatos/${c.id}`}>
              <Card className="flex flex-wrap items-center gap-3 p-4 transition-shadow hover:shadow-md">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {c.escolhas.titulo || c.estrutura.tituloSugerido || c.arquivoNome}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.arquivoNome} · {n.paragrafos} parágrafos · {n.listas} listas · {n.tabelas} tabelas ·{" "}
                    {c.importadoPor}
                  </p>
                </div>
                {c.duplicidades.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-accent">
                    <AlertTriangle className="h-3.5 w-3.5" /> {c.duplicidades.length}
                  </span>
                )}
                <FormatBadge formato={c.formato} />
                <CandidateStatusBadge status={c.status} />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default CandidateList;