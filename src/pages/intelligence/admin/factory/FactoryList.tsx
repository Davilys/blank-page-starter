/** Busca e filtros restritos aos Knowledge Objects (FASE 06 §7). */
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
import { Plus, Search } from "lucide-react";
import type { DraftFilter } from "@/modules/intelligence/application/ports/factory";
import {
  EDITORIAL_STATES,
  EDITORIAL_STATE_LABEL,
  PRIORITIES,
} from "@/modules/intelligence/domain/factory/KnowledgeDraft";
import { completeness } from "@/modules/intelligence/domain/factory/validation";
import { KNOWLEDGE_OBJECT_TYPES } from "@/modules/intelligence/domain/shared/taxonomy";
import { useDraftList } from "@/modules/intelligence/presentation/hooks/useFactory";
import {
  PriorityBadge,
  StatusBadge,
} from "@/modules/intelligence/presentation/components/factory/StatusBadge";

const TODOS = "__todos__";

const FactoryList = () => {
  const [filter, setFilter] = useState<DraftFilter>({});
  const { items, loading } = useDraftList(filter);

  const setF = (patch: Partial<DraftFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const pick = (v: string) => (v === TODOS ? undefined : v);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Knowledge Objects</h1>
        <Button asChild>
          <Link to="../factory/novo">
            <Plus className="mr-1.5 h-4 w-4" /> Novo objeto
          </Link>
        </Button>
      </div>

      <Card className="mt-6 space-y-3 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por título, resumo, categoria ou palavra-chave"
            value={filter.texto ?? ""}
            onChange={(e) => setF({ texto: e.target.value })}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Select value={filter.estado ?? TODOS} onValueChange={(v) => setF({ estado: pick(v) as never })}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os status</SelectItem>
              {EDITORIAL_STATES.map((e) => (
                <SelectItem key={e} value={e}>{EDITORIAL_STATE_LABEL[e]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filter.tipo ?? TODOS} onValueChange={(v) => setF({ tipo: pick(v) as never })}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os tipos</SelectItem>
              {KNOWLEDGE_OBJECT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filter.prioridade ?? TODOS}
            onValueChange={(v) => setF({ prioridade: pick(v) as never })}
          >
            <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas as prioridades</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Categoria"
            value={filter.categoria ?? ""}
            onChange={(e) => setF({ categoria: e.target.value || undefined })}
          />
          <Input
            placeholder="Autor"
            value={filter.autorId ?? ""}
            onChange={(e) => setF({ autorId: e.target.value || undefined })}
          />
          <Input
            placeholder="Entidade"
            value={filter.entidadePrincipal ?? ""}
            onChange={(e) => setF({ entidadePrincipal: e.target.value || undefined })}
          />
        </div>

        <div className="flex items-center gap-2">
          <Input
            className="max-w-[180px]"
            placeholder="Idioma (ex.: pt-BR)"
            value={filter.idioma ?? ""}
            onChange={(e) => setF({ idioma: e.target.value || undefined })}
          />
          <Button variant="ghost" size="sm" onClick={() => setFilter({})}>
            Limpar filtros
          </Button>
        </div>
      </Card>

      <div className="mt-6 space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && items.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum Knowledge Object encontrado. A base começa vazia por princípio:
              nada é publicado sem revisão humana.
            </p>
          </Card>
        )}

        {items.map((d) => (
          <Link key={d.id} to={`../factory/objetos/${d.id}`}>
            <Card className="flex flex-wrap items-center gap-3 p-4 transition-shadow hover:shadow-md">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{d.titulo}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {d.tipo} · {d.categoria || "sem categoria"} · v{d.versao} · {d.autorId || "sem autor"}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{completeness(d)}%</span>
              <PriorityBadge prioridade={d.prioridade} />
              <StatusBadge estado={d.estado} />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default FactoryList;