/** Lista de fatos com filtros por status, fonte, entidade, revisor e pendências. */
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
import { AlertTriangle, CalendarClock, Plus, Search } from "lucide-react";
import type { FactFilter } from "@/modules/intelligence/application/ports/facts";
import {
  FACT_STATUSES,
  FACT_STATUS_LABEL,
  SOURCE_TIERS,
  SOURCE_TIER_LABEL,
} from "@/modules/intelligence/domain/facts/Fact";
import { useFactList } from "@/modules/intelligence/presentation/hooks/useFacts";
import {
  ConfidenceBadge,
  FactStatusBadge,
  TierBadge,
} from "@/modules/intelligence/presentation/components/facts/FactBadges";

const TODOS = "__todos__";

const FactsList = () => {
  const [filter, setFilter] = useState<FactFilter>({});
  const { items, loading } = useFactList(filter);

  const setF = (patch: Partial<FactFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const pick = (v: string) => (v === TODOS ? undefined : v);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Fatos verificáveis</h1>
        <Button asChild>
          <Link to="../fatos/novo">
            <Plus className="mr-1.5 h-4 w-4" /> Novo fato
          </Link>
        </Button>
      </div>

      <Card className="mt-6 space-y-3 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por enunciado, fonte ou dispositivo"
            value={filter.texto ?? ""}
            onChange={(e) => setF({ texto: e.target.value })}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={filter.status ?? TODOS} onValueChange={(v) => setF({ status: pick(v) as never })}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os status</SelectItem>
              {FACT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{FACT_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filter.tier ?? TODOS} onValueChange={(v) => setF({ tier: pick(v) as never })}>
            <SelectTrigger><SelectValue placeholder="Fonte" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas as fontes</SelectItem>
              {SOURCE_TIERS.map((t) => (
                <SelectItem key={t} value={t}>{SOURCE_TIER_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Entidade principal"
            value={filter.entidadePrincipal ?? ""}
            onChange={(e) => setF({ entidadePrincipal: e.target.value || undefined })}
          />

          <Input
            placeholder="Revisor"
            value={filter.revisorId ?? ""}
            onChange={(e) => setF({ revisorId: e.target.value || undefined })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={filter.apenasVencidos ? "default" : "outline"}
            size="sm"
            onClick={() => setF({ apenasVencidos: !filter.apenasVencidos || undefined })}
          >
            <CalendarClock className="mr-1.5 h-4 w-4" /> Revalidação vencida
          </Button>
          <Button
            variant={filter.apenasContradicoes ? "default" : "outline"}
            size="sm"
            onClick={() => setF({ apenasContradicoes: !filter.apenasContradicoes || undefined })}
          >
            <AlertTriangle className="mr-1.5 h-4 w-4" /> Contradições
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setFilter({})}>
            Limpar
          </Button>
        </div>
      </Card>

      <div className="mt-6 space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && items.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum fato cadastrado. Comece pelas afirmações que o site já faz hoje.
            </p>
          </Card>
        )}

        {items.map(({ fato, confianca }) => (
          <Link key={fato.id} to={`../fatos/${fato.id}`}>
            <Card className="p-4 transition-shadow hover:shadow-md">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {fato.enunciado || "(sem enunciado)"}
                </p>
                <span className="text-xs text-muted-foreground">v{fato.versao}</span>
                <TierBadge tier={fato.fonte.tier} />
                <FactStatusBadge status={fato.status} />
                <ConfidenceBadge score={confianca.score} faixa={confianca.faixa} />
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {fato.fonte.titulo}
                {fato.fonte.dispositivo ? `, ${fato.fonte.dispositivo}` : ""} · vigência desde{" "}
                {fato.vigenciaInicio || "—"} · {fato.objetosAfetados.length} objeto(s) afetado(s) ·
                revisor {fato.revisorId || "pendente"}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default FactsList;