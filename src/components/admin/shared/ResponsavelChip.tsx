import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { User, UserPlus, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAdminList, atribuirResponsavel, removerResponsavel, type Entidade, type ResponsavelInfo } from "@/hooks/useResponsaveis";

interface Props {
  entidade: Entidade;
  entidadeId: string;
  responsavel?: ResponsavelInfo;
  /** Tamanho do chip */
  size?: "sm" | "md";
  /** Mostrar somente avatar (sem nome) */
  iconOnly?: boolean;
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function firstName(name: string | null | undefined) {
  if (!name) return "—";
  return name.trim().split(/\s+/)[0];
}

export function ResponsavelChip({ entidade, entidadeId, responsavel, size = "sm", iconOnly = false }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { admins, loading } = useAdminList();

  const has = !!responsavel?.user_id;

  const handleSelect = async (a: { user_id: string; full_name: string }) => {
    setBusy(true);
    try {
      await atribuirResponsavel(entidade, entidadeId, {
        userId: a.user_id,
        userNome: a.full_name,
        acao: "atribuiu",
      });
      toast.success(`Responsável: ${firstName(a.full_name)}`);
      setOpen(false);
    } catch (e: any) {
      toast.error("Falha ao atribuir: " + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    try {
      await removerResponsavel(entidade, entidadeId);
      toast.success("Responsável removido");
      setOpen(false);
    } catch (e: any) {
      toast.error("Falha: " + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={has ? `Responsável: ${responsavel?.user_nome}` : "Atribuir responsável"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border transition-colors",
            size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
            has
              ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-300 hover:bg-blue-500/20"
              : "border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted/60",
          )}
        >
          {has ? (
            <>
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full bg-blue-500 text-white font-semibold",
                  size === "sm" ? "h-4 w-4 text-[9px]" : "h-5 w-5 text-[10px]",
                )}
              >
                {initials(responsavel?.user_nome)}
              </span>
              {!iconOnly && <span className="truncate max-w-[120px]">{firstName(responsavel?.user_nome)}</span>}
            </>
          ) : (
            <>
              <UserPlus className="h-3 w-3" />
              {!iconOnly && <span>Sem responsável</span>}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder="Buscar admin..." />
          <CommandList>
            <CommandEmpty>{loading ? "Carregando..." : "Nenhum admin encontrado"}</CommandEmpty>
            <CommandGroup heading="Atribuir a">
              {admins.map((a) => (
                <CommandItem
                  key={a.user_id}
                  value={a.full_name + " " + (a.email || "")}
                  onSelect={() => handleSelect(a)}
                  disabled={busy}
                >
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-500 text-white text-[10px] font-semibold mr-2">
                    {initials(a.full_name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{a.full_name}</div>
                    {a.email && <div className="text-[10px] text-muted-foreground truncate">{a.email}</div>}
                  </div>
                  {responsavel?.user_id === a.user_id && <Check className="h-3 w-3 text-emerald-500" />}
                </CommandItem>
              ))}
            </CommandGroup>
            {has && (
              <div className="border-t p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={handleClear}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <X className="h-3 w-3 mr-2" />}
                  Remover responsável
                </Button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default ResponsavelChip;