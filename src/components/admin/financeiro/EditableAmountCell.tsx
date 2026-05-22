import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parseBRL = (input: string): number | null => {
  const cleaned = input.replace(/[R$\s.]/g, "").replace(",", ".").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
};

interface Props {
  value: number;
  onSave: (newValue: number) => Promise<void> | void;
  className?: string;
  disabled?: boolean;
  title?: string;
}

export function EditableAmountCell({ value, onSave, className, disabled, title }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.toFixed(2).replace(".", ","));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value.toFixed(2).replace(".", ","));
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing, value]);

  const commit = async () => {
    const parsed = parseBRL(draft);
    if (parsed === null) {
      toast.error("Valor inválido");
      return;
    }
    if (parsed === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(parsed);
      setEditing(false);
    } catch (e: any) {
      toast.error("Falha ao salvar: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs text-muted-foreground">R$</span>
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          disabled={saving}
          className="h-7 w-28 text-right"
        />
        {saving && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      title={title || "Clique para editar o valor"}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) setEditing(true);
      }}
      className={
        "inline-flex items-center gap-1 hover:text-primary hover:underline transition-colors disabled:opacity-60 disabled:cursor-not-allowed " +
        (className || "")
      }
    >
      {fmtBRL(value)}
      <Pencil className="h-3 w-3 opacity-50" />
    </button>
  );
}