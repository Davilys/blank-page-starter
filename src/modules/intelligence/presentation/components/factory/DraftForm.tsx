/**
 * Manual authoring form (FASE 06 §2). Presentation only: all rules live in
 * the domain layer. No AI, no generation, no auto-fill of meaning.
 */
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
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import {
  PRIORITIES,
  type DraftFaqItem,
  type DraftRelationship,
  type DraftSource,
  type KnowledgeDraft,
} from "../../../domain/factory/KnowledgeDraft";
import type { EntityId } from "../../../domain/shared/primitives";
import {
  KNOWLEDGE_OBJECT_TYPES,
  RELATIONSHIP_TYPES,
} from "../../../domain/shared/taxonomy";

export type DraftFormValue = Omit<
  KnowledgeDraft,
  "id" | "criadoEm" | "atualizadoEm" | "versao"
> & { readonly id?: string };

interface Props {
  readonly value: DraftFormValue;
  readonly onChange: (next: DraftFormValue) => void;
}

const linesToArray = (v: string) =>
  v
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label className="text-sm">{label}</Label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

export const DraftForm = ({ value, onChange }: Props) => {
  const set = <K extends keyof DraftFormValue>(key: K, v: DraftFormValue[K]) =>
    onChange({ ...value, [key]: v });

  const updateSource = (i: number, patch: Partial<DraftSource>) =>
    set(
      "fontes",
      value.fontes.map((f, idx) => (idx === i ? { ...f, ...patch } : f)),
    );

  const updateRel = (i: number, patch: Partial<DraftRelationship>) =>
    set(
      "relacionamentos",
      value.relacionamentos.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );

  const updateFaq = (i: number, patch: Partial<DraftFaqItem>) =>
    set(
      "faq",
      value.faq.map((f, idx) => (idx === i ? { ...f, ...patch } : f)),
    );

  return (
    <div className="space-y-5">
      {/* Identificação */}
      <Card className="space-y-4 p-5">
        <h3 className="font-semibold text-foreground">Identificação</h3>

        <Field label="Título">
          <Input value={value.titulo} onChange={(e) => set("titulo", e.target.value)} />
        </Field>

        <Field label="Descrição">
          <Textarea
            rows={2}
            value={value.descricao}
            onChange={(e) => set("descricao", e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <Select value={value.tipo} onValueChange={(v) => set("tipo", v as never)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KNOWLEDGE_OBJECT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Categoria">
            <Input value={value.categoria} onChange={(e) => set("categoria", e.target.value)} />
          </Field>

          <Field label="Entidade principal" hint="Slug canônico, ex.: inpi, registro-de-marca.">
            <Input
              value={String(value.entidadePrincipal ?? "")}
              onChange={(e) => set("entidadePrincipal", e.target.value as EntityId)}
            />
          </Field>

          <Field label="Prioridade">
            <Select value={value.prioridade} onValueChange={(v) => set("prioridade", v as never)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Idioma">
            <Input value={value.idioma} onChange={(e) => set("idioma", e.target.value)} />
          </Field>

          <Field label="Jurisdição">
            <Input value={value.jurisdicao} onChange={(e) => set("jurisdicao", e.target.value)} />
          </Field>

          <Field label="Autor (responsável)">
            <Input value={value.autorId} onChange={(e) => set("autorId", e.target.value)} />
          </Field>

          <Field label="Revisor">
            <Input
              value={value.revisorId ?? ""}
              onChange={(e) => set("revisorId", e.target.value)}
            />
          </Field>

          <Field label="Data de revisão">
            <Input
              type="date"
              value={value.dataRevisao ?? ""}
              onChange={(e) => set("dataRevisao", e.target.value)}
            />
          </Field>

          <Field label="Palavras-chave" hint="Separadas por vírgula.">
            <Input
              value={value.palavrasChave.join(", ")}
              onChange={(e) =>
                set(
                  "palavrasChave",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </Field>
        </div>
      </Card>

      {/* Conteúdo */}
      <Card className="space-y-4 p-5">
        <h3 className="font-semibold text-foreground">Conteúdo</h3>

        <Field label="Resumo curto">
          <Textarea
            rows={2}
            value={value.resumoCurto}
            onChange={(e) => set("resumoCurto", e.target.value)}
          />
        </Field>

        <Field label="Resumo técnico">
          <Textarea
            rows={3}
            value={value.resumoTecnico}
            onChange={(e) => set("resumoTecnico", e.target.value)}
          />
        </Field>

        <Field label="Explicação completa" hint="Mínimo de 120 caracteres para publicar.">
          <Textarea
            rows={8}
            value={value.explicacaoCompleta}
            onChange={(e) => set("explicacaoCompleta", e.target.value)}
          />
        </Field>

        <Field label="Checklist" hint="Um item por linha.">
          <Textarea
            rows={4}
            value={value.checklist.join("\n")}
            onChange={(e) => set("checklist", linesToArray(e.target.value))}
          />
        </Field>

        <Field label="Fluxograma (texto)" hint="Ex.: Depósito → Publicação → Exame → Decisão.">
          <Textarea
            rows={4}
            value={value.fluxograma}
            onChange={(e) => set("fluxograma", e.target.value)}
          />
        </Field>

        <Field label="Observações">
          <Textarea
            rows={2}
            value={value.observacoes}
            onChange={(e) => set("observacoes", e.target.value)}
          />
        </Field>
      </Card>

      {/* FAQ */}
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">FAQ</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => set("faq", [...value.faq, { pergunta: "", resposta: "" }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>

        {value.faq.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma pergunta cadastrada.</p>
        )}

        {value.faq.map((f, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex gap-2">
              <Input
                placeholder="Pergunta"
                value={f.pergunta}
                onChange={(e) => updateFaq(i, { pergunta: e.target.value })}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => set("faq", value.faq.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <Textarea
              rows={2}
              placeholder="Resposta"
              value={f.resposta}
              onChange={(e) => updateFaq(i, { resposta: e.target.value })}
            />
          </div>
        ))}
      </Card>

      {/* Fontes */}
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Fontes</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              set("fontes", [
                ...value.fontes,
                { id: `src_${Date.now()}`, titulo: "", url: "", tier: "oficial" },
              ])
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>

        {value.fontes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sem fonte não há publicação — todo fato precisa de origem verificável.
          </p>
        )}

        {value.fontes.map((f, i) => (
          <div key={f.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_150px_40px]">
            <Input
              placeholder="Título da fonte"
              value={f.titulo}
              onChange={(e) => updateSource(i, { titulo: e.target.value })}
            />
            <Input
              placeholder="URL (opcional)"
              value={f.url ?? ""}
              onChange={(e) => updateSource(i, { url: e.target.value })}
            />
            <Select value={f.tier} onValueChange={(v) => updateSource(i, { tier: v as never })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oficial">oficial</SelectItem>
                <SelectItem value="jurisprudencia">jurisprudência</SelectItem>
                <SelectItem value="doutrina">doutrina</SelectItem>
                <SelectItem value="secundaria">secundária</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => set("fontes", value.fontes.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </Card>

      {/* Relacionamentos e links */}
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Relacionamentos</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              set("relacionamentos", [
                ...value.relacionamentos,
                { tipo: "complementa", alvoSlug: "", motivo: "" },
              ])
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>

        {value.relacionamentos.map((r, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[160px_1fr_1fr_40px]">
            <Select value={r.tipo} onValueChange={(v) => updateRel(i, { tipo: v as never })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="slug do objeto alvo"
              value={r.alvoSlug}
              onChange={(e) => updateRel(i, { alvoSlug: e.target.value })}
            />
            <Input
              placeholder="motivo (opcional)"
              value={r.motivo ?? ""}
              onChange={(e) => updateRel(i, { motivo: e.target.value })}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() =>
                set("relacionamentos", value.relacionamentos.filter((_, idx) => idx !== i))
              }
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Links internos" hint="Uma URL por linha.">
            <Textarea
              rows={3}
              value={value.linksInternos.join("\n")}
              onChange={(e) => set("linksInternos", linesToArray(e.target.value))}
            />
          </Field>
          <Field label="Links externos" hint="Uma URL por linha.">
            <Textarea
              rows={3}
              value={value.linksExternos.join("\n")}
              onChange={(e) => set("linksExternos", linesToArray(e.target.value))}
            />
          </Field>
        </div>
      </Card>
    </div>
  );
};