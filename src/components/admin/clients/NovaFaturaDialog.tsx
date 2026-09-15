import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  clientName?: string | null;
  onCreated: () => void;
}

const centsToBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const hojeISO = () => new Date().toISOString().slice(0, 10);
const emDiasISO = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

export function NovaFaturaDialog({ open, onOpenChange, userId, clientName, onCreated }: Props) {
  const [descricao, setDescricao] = useState("");
  const [valorCents, setValorCents] = useState(0);
  const [vencimento, setVencimento] = useState(emDiasISO(7));
  const [metodo, setMetodo] = useState<"boleto" | "pix" | "cartao">("boleto");
  const [avisar, setAvisar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [actionId, setActionId] = useState<string>("");

  useEffect(() => {
    if (open) {
      setDescricao("");
      setValorCents(0);
      setVencimento(emDiasISO(7));
      setMetodo("boleto");
      setAvisar(false);
      setActionId(crypto.randomUUID());
    }
  }, [open]);

  const erro = useMemo(() => {
    if (descricao.trim().length < 3) return "Informe a descrição do serviço";
    if (valorCents <= 0) return "Informe um valor maior que zero";
    if (!vencimento) return "Informe o vencimento";
    if (vencimento < hojeISO()) return "O vencimento não pode ser anterior a hoje";
    return null;
  }, [descricao, valorCents, vencimento]);

  const handleValor = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    setValorCents(digits ? parseInt(digits, 10) : 0);
  };

  const handleCriar = async () => {
    if (salvando || erro) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke("criar-acordo-cliente", {
        body: {
          action: "criar-fatura",
          crm_action_id: actionId,
          user_id: userId,
          description: descricao.trim(),
          amount: valorCents / 100,
          due_date: vencimento,
          payment_method: metodo,
          notify: avisar,
        },
      });
      if (error) throw error;
      if (!(data as any)?.success) { toast.error((data as any)?.error || "Não foi possível criar a fatura"); return; }
      const d = data as any;
      const envio = d.envio
        ? ` · WhatsApp: ${d.envio.whatsapp} · E-mail: ${d.envio.email}`
        : "";
      toast.success(d.already ? "Fatura já criada" : "Fatura criada", {
        description: `${d.warning ? d.warning + " " : ""}${centsToBRL(valorCents)}${envio}`,
      });
      onCreated();
      onOpenChange(false);
    } catch (e) {
      toast.error("Falha ao criar a fatura", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!salvando) onOpenChange(v); }}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => salvando && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-base">Nova fatura</DialogTitle>
          <DialogDescription>{clientName ? `Cobrança para ${clientName}` : "Gerar uma nova cobrança para o cliente"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição do serviço</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={salvando}
              placeholder="Ex.: Taxa de registro de marca" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor</Label>
              <Input inputMode="numeric" value={valorCents ? centsToBRL(valorCents) : ""}
                onChange={(e) => handleValor(e.target.value)} disabled={salvando} placeholder="R$ 0,00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vencimento</Label>
              <Input type="date" min={hojeISO()} value={vencimento}
                onChange={(e) => setVencimento(e.target.value)} disabled={salvando} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Forma de cobrança</Label>
            <Select value={metodo} onValueChange={(v) => setMetodo(v as typeof metodo)} disabled={salvando}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 cursor-pointer">
            <Checkbox checked={avisar} onCheckedChange={(v) => setAvisar(!!v)} disabled={salvando} className="mt-0.5" />
            <span className="text-xs text-muted-foreground">
              Avisar o cliente por WhatsApp e e-mail com o link de pagamento
            </span>
          </label>

          {erro && <p className="text-[11px] text-red-500">{erro}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="h-9 text-xs" disabled={salvando} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" className="h-9 text-xs" disabled={salvando || !!erro} onClick={handleCriar}>
            {salvando ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Criando...</> : <><FilePlus2 className="h-3.5 w-3.5 mr-1" />Criar fatura</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
