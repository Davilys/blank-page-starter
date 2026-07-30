/** Editor de fato. Nada é preenchido automaticamente: todo dado é humano. */
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
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_LEVELS,
  FACT_KINDS,
  FACT_KIND_LABEL,
  type VaultFact,
  type VaultSource,
} from "../../../domain/vault/VaultFact";

interface Props {
  readonly valor: VaultFact;
  readonly onChange: (patch: Partial<VaultFact>) => void;
}

const SourceFields = ({
  titulo,
  fonte,
  onChange,
}: {
  titulo: string;
  fonte: VaultSource;
  onChange: (f: VaultSource) => void;
}) => (
  <Card className="p-4">
    <p className="text-sm font-semibold text-foreground">{titulo}</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div>
        <Label>Título da fonte</Label>
        <Input
          value={fonte.titulo}
          onChange={(e) => onChange({ ...fonte, titulo: e.target.value })}
          placeholder="Lei 9.279/96, Manual de Marcas do INPI…"
        />
      </div>
      <div>
        <Label>Dispositivo</Label>
        <Input
          value={fonte.dispositivo}
          onChange={(e) => onChange({ ...fonte, dispositivo: e.target.value })}
          placeholder="Art. 158, item 5.9"
        />
      </div>
      <div>
        <Label>URL</Label>
        <Input
          value={fonte.url}
          onChange={(e) => onChange({ ...fonte, url: e.target.value })}
          placeholder="https://…"
        />
      </div>
      <div>
        <Label>Publicado em</Label>
        <Input
          type="date"
          value={fonte.publicadoEm}
          onChange={(e) => onChange({ ...fonte, publicadoEm: e.target.value })}
        />
      </div>
    </div>
  </Card>
);

export const VaultFactForm = ({ valor, onChange }: Props) => (
  <div className="space-y-4">
    <Card className="p-5">
      <div className="grid gap-4">
        <div>
          <Label>Título</Label>
          <Input
            value={valor.titulo}
            onChange={(e) => onChange({ titulo: e.target.value })}
            placeholder="Prazo de oposição a pedido de registro"
          />
        </div>

        <div>
          <Label>Declaração objetiva</Label>
          <Textarea
            rows={3}
            value={valor.declaracao}
            onChange={(e) => onChange({ declaracao: e.target.value })}
            placeholder="Oposição pode ser apresentada em até 60 dias contados da publicação do pedido."
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Uma afirmação verificável, sem interpretação nem opinião.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Tipo</Label>
            <Select value={valor.tipo} onValueChange={(v) => onChange({ tipo: v as never })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FACT_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {FACT_KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Jurisdição</Label>
            <Input
              value={valor.jurisdicao}
              onChange={(e) => onChange({ jurisdicao: e.target.value })}
              placeholder="BR"
            />
          </div>
          <div>
            <Label>Grau de confiança</Label>
            <Select
              value={valor.confianca ?? ""}
              onValueChange={(v) => onChange({ confianca: v as never })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Não informado" />
              </SelectTrigger>
              <SelectContent>
                {CONFIDENCE_LEVELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CONFIDENCE_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Vigência — início</Label>
            <Input
              type="date"
              value={valor.vigenciaInicio}
              onChange={(e) => onChange({ vigenciaInicio: e.target.value })}
            />
          </div>
          <div>
            <Label>Vigência — fim (opcional)</Label>
            <Input
              type="date"
              value={valor.vigenciaFim ?? ""}
              onChange={(e) => onChange({ vigenciaFim: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Tags (separadas por vírgula)</Label>
            <Input
              value={valor.tags.join(", ")}
              onChange={(e) =>
                onChange({
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              placeholder="oposicao, prazo, marcas"
            />
          </div>
          <div>
            <Label>Entidades relacionadas (separadas por vírgula)</Label>
            <Input
              value={valor.entidadesRelacionadas.map(String).join(", ")}
              onChange={(e) =>
                onChange({
                  entidadesRelacionadas: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean) as never,
                })
              }
              placeholder="INPI, Marca, Oposição"
            />
          </div>
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea
            rows={2}
            value={valor.observacoes}
            onChange={(e) => onChange({ observacoes: e.target.value })}
          />
        </div>
      </div>
    </Card>

    <SourceFields
      titulo="Fonte primária (obrigatória para validar)"
      fonte={valor.fontePrimaria}
      onChange={(f) => onChange({ fontePrimaria: f })}
    />
    <SourceFields
      titulo="Fonte secundária (opcional)"
      fonte={
        valor.fonteSecundaria ?? { titulo: "", dispositivo: "", url: "", publicadoEm: "" }
      }
      onChange={(f) => onChange({ fonteSecundaria: f })}
    />
  </div>
);