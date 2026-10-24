import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import {
  validateCPF,
  validateCNPJ,
  fetchAddressByCEP,
  formatCPF,
  formatCEP,
  formatPhone,
  formatCNPJ,
} from "@/lib/validators";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  fullName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().min(14, "Telefone inválido"),
  cpf: z.string().refine((val) => validateCPF(val), "CPF inválido"),
  cep: z.string().regex(/^\d{5}-\d{3}$/, "CEP inválido"),
  address: z.string().min(5, "Endereço obrigatório"),
  addressNumber: z.string().optional(),
  neighborhood: z.string().min(2, "Bairro obrigatório"),
  city: z.string().min(2, "Cidade obrigatória"),
  state: z.string().length(2, "UF obrigatória"),
  brandName: z.string().min(2, "Nome da marca obrigatório"),
  businessArea: z.string().min(3, "Ramo de atividade obrigatório"),
  hasCNPJ: z.boolean(),
  cnpj: z.string().optional(),
  companyName: z.string().optional(),
}).refine((data) => {
  if (data.hasCNPJ) {
    if (!data.cnpj || !validateCNPJ(data.cnpj)) return false;
    if (!data.companyName || data.companyName.length < 3) return false;
  }
  return true;
}, { message: "CNPJ ou Razão Social inválidos", path: ["cnpj"] });

interface CreateClientDialogProps {
  onClientCreated: () => void;
}

export function CreateClientDialog({ onClientCreated }: CreateClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCEP, setIsLoadingCEP] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", cpf: "",
    cep: "", address: "", addressNumber: "", neighborhood: "", city: "", state: "",
    brandName: "", businessArea: "",
    hasCNPJ: false, cnpj: "", companyName: "",
  });

  const resetForm = () => {
    setForm({
      fullName: "", email: "", phone: "", cpf: "",
      cep: "", address: "", addressNumber: "", neighborhood: "", city: "", state: "",
      brandName: "", businessArea: "",
      hasCNPJ: false, cnpj: "", companyName: "",
    });
    setErrors({});
  };

  const handleCEPChange = useCallback(async (cep: string) => {
    const formattedCEP = formatCEP(cep);
    setForm(prev => ({ ...prev, cep: formattedCEP }));
    const cleanCEP = formattedCEP.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      setIsLoadingCEP(true);
      const addressData = await fetchAddressByCEP(cleanCEP);
      setIsLoadingCEP(false);
      if (addressData) {
        setForm(prev => ({
          ...prev,
          address: addressData.logradouro || prev.address,
          neighborhood: addressData.bairro || prev.neighborhood,
          city: addressData.localidade || prev.city,
          state: addressData.uf || prev.state,
        }));
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = formSchema.safeParse(form);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) newErrors[err.path[0] as string] = err.message;
      });
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Get current admin user for created_by
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase.functions.invoke('create-client-user', {
        body: {
          email: form.email,
          full_name: form.fullName,
          phone: form.phone,
          cpf_cnpj: form.cpf,
          cpf: form.cpf,
          cnpj: form.hasCNPJ ? form.cnpj : null,
          company_name: form.hasCNPJ ? form.companyName : null,
          address: form.address,
          neighborhood: form.neighborhood,
          city: form.city,
          state: form.state,
          zip_code: form.cep,
          brand_name: form.brandName,
          business_area: form.businessArea,
          client_funnel_type: 'juridico',
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar cliente');

      // Set created_by and assigned_to for the new client
      if (user && data.userId) {
        await supabase
          .from('profiles')
          .update({
            created_by: user.id,
            assigned_to: user.id,
            origin: 'admin',
          })
          .eq('id', data.userId);
      }

      toast.success(data.isExisting
        ? 'Cliente já existente. Novo processo vinculado!'
        : `Cliente criado com sucesso! Senha padrão: 123Mudar@`
      );
      resetForm();
      setOpen(false);
      onClientCreated();
    } catch (err) {
      console.error('Error creating client:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao criar cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
          <p className="text-sm text-muted-foreground">
            O cliente será criado com login automático (senha: 123Mudar@) e encaminhado para o Jurídico → Protocolado.
          </p>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {/* Dados Pessoais */}
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dados Pessoais</h3>

            <div className="space-y-1">
              <Label htmlFor="c-fullName">Nome Completo *</Label>
              <Input id="c-fullName" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Nome completo" />
              {errors.fullName && <p className="text-destructive text-xs">{errors.fullName}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="c-email">E-mail *</Label>
                <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
                {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-phone">Telefone *</Label>
                <Input id="c-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} placeholder="(00) 00000-0000" maxLength={15} />
                {errors.phone && <p className="text-destructive text-xs">{errors.phone}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="c-cpf">CPF *</Label>
              <Input id="c-cpf" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })} placeholder="000.000.000-00" maxLength={14} />
              {errors.cpf && <p className="text-destructive text-xs">{errors.cpf}</p>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="c-cep">CEP *</Label>
                <div className="relative">
                  <Input id="c-cep" value={form.cep} onChange={(e) => handleCEPChange(e.target.value)} placeholder="00000-000" maxLength={9} />
                  {isLoadingCEP && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                {errors.cep && <p className="text-destructive text-xs">{errors.cep}</p>}
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="c-address">Endereço *</Label>
                <Input id="c-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, Avenida..." />
                {errors.address && <p className="text-destructive text-xs">{errors.address}</p>}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="c-num">Nº</Label>
                <Input id="c-num" value={form.addressNumber} onChange={(e) => setForm({ ...form, addressNumber: e.target.value })} placeholder="Nº" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-neighborhood">Bairro *</Label>
                <Input id="c-neighborhood" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} placeholder="Bairro" />
                {errors.neighborhood && <p className="text-destructive text-xs">{errors.neighborhood}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-city">Cidade *</Label>
                <Input id="c-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Cidade" />
                {errors.city && <p className="text-destructive text-xs">{errors.city}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-state">UF *</Label>
                <Input id="c-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} placeholder="UF" maxLength={2} />
                {errors.state && <p className="text-destructive text-xs">{errors.state}</p>}
              </div>
            </div>

            {/* Dados da Marca */}
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide pt-2">Dados da Marca</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="c-brand">Nome da Marca *</Label>
                <Input id="c-brand" value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} placeholder="Nome da marca" />
                {errors.brandName && <p className="text-destructive text-xs">{errors.brandName}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-area">Ramo de Atividade *</Label>
                <Input id="c-area" value={form.businessArea} onChange={(e) => setForm({ ...form, businessArea: e.target.value })} placeholder="Ex: Alimentação" />
                {errors.businessArea && <p className="text-destructive text-xs">{errors.businessArea}</p>}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="c-hasCNPJ" checked={form.hasCNPJ} onCheckedChange={(v) => setForm({ ...form, hasCNPJ: !!v })} />
              <Label htmlFor="c-hasCNPJ" className="text-sm font-normal cursor-pointer">Vincular CNPJ</Label>
            </div>

            {form.hasCNPJ && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg border">
                <div className="space-y-1">
                  <Label htmlFor="c-cnpj">CNPJ *</Label>
                  <Input id="c-cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })} placeholder="00.000.000/0000-00" maxLength={18} />
                  {errors.cnpj && <p className="text-destructive text-xs">{errors.cnpj}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="c-company">Razão Social *</Label>
                  <Input id="c-company" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Razão Social" />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</>
              ) : (
                <><UserPlus className="h-4 w-4 mr-2" /> Criar Cliente</>
              )}
            </Button>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
