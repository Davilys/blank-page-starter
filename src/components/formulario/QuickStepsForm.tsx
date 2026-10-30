import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, Layers } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { validateCPF, validateCNPJ, fetchAddressByCEP, formatCPF, formatCEP, formatPhone, formatCNPJ } from "@/lib/validators";
import { trackLead } from "@/lib/metaPixel";
import type { PersonalData } from "@/components/cliente/checkout/PersonalDataStep";
import type { BrandData } from "@/components/cliente/checkout/BrandDataStep";

export function StepDashes({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6" aria-label={`Etapa ${current} de ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full origin-left"
            initial={false}
            animate={{ scaleX: i < current ? 1 : 0 }}
            transition={{ duration: 0.4 }}
          />
        </div>
      ))}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label} <span className="text-destructive">*</span></Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

export interface QuickData { brandName: string; businessArea: string; fullName: string; email: string; phone: string }

export const quickSchema = z.object({
  brandName: z.string().trim().min(2, "Nome da marca obrigatório").max(100, "String must contain at most 100 character(s)"),
  businessArea: z.string().trim().min(3, "Ramo de atividade obrigatório").max(200, "String must contain at most 200 character(s)"),
  fullName: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100, "String must contain at most 100 character(s)"),
  email: z.string().trim().email("E-mail inválido").max(255, "String must contain at most 255 character(s)"),
  phone: z.string().min(14, "Celular inválido").max(15, "String must contain at most 15 character(s)"),
});

function collect(r: z.ZodSafeParseResult<unknown>) {
  const e: Record<string, string> = {};
  if (!r.success) r.error.issues.forEach((x) => { if (x.path[0]) e[x.path[0] as string] = x.message; });
  return e;
}

export function QuickLeadStep({ initial, onNext }: { initial: QuickData; onNext: (d: QuickData) => void }) {
  const [d, setD] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = quickSchema.safeParse(d);
    if (!r.success) return setErrors(collect(r));
    setErrors({});
    trackLead();
    onNext({ ...d, brandName: d.brandName.trim(), businessArea: d.businessArea.trim(), fullName: d.fullName.trim(), email: d.email.trim() });
  };
  const ic = (k: string) => cn("h-12 text-base", errors[k] && "border-destructive");
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">Informe seus dados</h2>
        <p className="text-sm text-muted-foreground">Complete suas informações para prosseguir para receber a proposta</p>
      </div>
      <Field label="Nome da Marca" error={errors.brandName}>
        <Input value={d.brandName} onChange={(e) => setD({ ...d, brandName: e.target.value })} placeholder="Ex: WebMarcas, TechFlow, BioVida..." maxLength={100} className={ic("brandName")} />
      </Field>
      <Field label="Ramo de Atividade" error={errors.businessArea}>
        <Input value={d.businessArea} onChange={(e) => setD({ ...d, businessArea: e.target.value })} placeholder="Ex: Serviços Jurídicos, Alimentação, Tecnologia..." maxLength={200} className={ic("businessArea")} />
      </Field>
      <Field label="Nome Completo" error={errors.fullName}>
        <Input value={d.fullName} onChange={(e) => setD({ ...d, fullName: e.target.value })} placeholder="Ex: Davilys Cunha" maxLength={100} className={ic("fullName")} />
      </Field>
      <Field label="E-mail" error={errors.email}>
        <Input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} placeholder="Ex: seu@email.com" maxLength={255} className={ic("email")} />
      </Field>
      <Field label="Celular" error={errors.phone}>
        <Input value={d.phone} onChange={(e) => setD({ ...d, phone: formatPhone(e.target.value) })} placeholder="Ex: (11) 91234-5678" maxLength={15} inputMode="tel" className={ic("phone")} />
      </Field>
      <Button type="submit" className="w-full h-12 rounded-xl font-bold text-base">
        Continuar <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </form>
  );
}

export const compSchema = z.object({
  cpf: z.string().refine((v) => validateCPF(v), "CPF inválido"),
  cep: z.string().regex(/^\d{5}-\d{3}$/, "CEP inválido"),
  address: z.string().min(5, "Endereço obrigatório").max(200, "String must contain at most 200 character(s)"),
  neighborhood: z.string().min(2, "Bairro obrigatório").max(100, "String must contain at most 100 character(s)"),
  city: z.string().min(2, "Cidade obrigatória").max(100, "String must contain at most 100 character(s)"),
  state: z.string().length(2, "UF obrigatória"),
});

export interface ClassPickerProps {
  suggested: number[];
  descriptions: string[];
  selected: number[];
  onChange: (c: number[]) => void;
  loading?: boolean;
  onRetry?: () => void;
}

function ClassPicker({ suggested, descriptions, selected, onChange, loading, onRetry }: ClassPickerProps) {
  const toggle = (c: number) => onChange(selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c]);
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
          <Layers className="w-4 h-4 text-primary" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Classes NCL Sugeridas</p>
          <p className="text-xs text-muted-foreground">A classe principal já vem marcada. Inclua as demais se quiser ampliar a proteção.</p>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Identificando as classes do seu ramo…</div>
      ) : suggested.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>Classes NCL serão definidas com base no seu ramo de atividade.</span>
          {onRetry && <Button type="button" variant="outline" size="sm" onClick={onRetry}>Tentar novamente</Button>}
        </div>
      ) : (
        <div className="space-y-2">
          {suggested.map((cls, idx) => {
            const checked = selected.includes(cls);
            return (
              <label key={cls} htmlFor={`fcls-${cls}`} className={cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all", checked ? "border-primary/40 bg-primary/5" : "border-border/50 bg-card hover:border-primary/20")}>
                <input id={`fcls-${cls}`} type="checkbox" checked={checked} onChange={() => toggle(cls)} className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Classe NCL {cls}{idx === 0 && <span className="ml-2 text-[11px] font-semibold text-primary">Principal</span>}</p>
                  <p className="text-xs text-muted-foreground break-words">{descriptions[idx] || `Classe ${cls}`}</p>
                </div>
              </label>
            );
          })}
          {selected.length > 0 && (
            <p className="pt-2 border-t border-border/50 text-xs text-muted-foreground">
              {selected.length} classe{selected.length > 1 ? "s" : ""} selecionada{selected.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ComplementStep({
  personal, brand, onNext, onBack, classes,
}: { personal: PersonalData; brand: BrandData; onNext: (p: PersonalData, b: BrandData) => void; onBack: () => void; classes?: ClassPickerProps }) {
  const [p, setP] = useState(personal);
  const [b, setB] = useState(brand);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingCep, setLoadingCep] = useState(false);

  const onCep = useCallback(async (v: string) => {
    const cep = formatCEP(v);
    setP((prev) => ({ ...prev, cep }));
    const clean = cep.replace(/\D/g, "");
    if (clean.length === 8) {
      setLoadingCep(true);
      const a = await fetchAddressByCEP(clean);
      setLoadingCep(false);
      if (a) setP((prev) => ({ ...prev, address: a.logradouro || prev.address, neighborhood: a.bairro || prev.neighborhood, city: a.localidade || prev.city, state: a.uf || prev.state }));
      else setErrors((e) => ({ ...e, cep: "CEP não encontrado" }));
    }
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = collect(compSchema.safeParse(p));
    if (b.hasCNPJ) {
      if (!b.cnpj || !validateCNPJ(b.cnpj)) errs.cnpj = "CNPJ inválido";
      if (!b.companyName || b.companyName.trim().length < 3) errs.companyName = "Razão social obrigatória";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onNext(p, b);
  };
  const ic = (k: string) => cn("h-11 text-sm", errors[k] && "border-destructive");

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">Dados pessoais e da marca</h2>
        <p className="text-sm text-muted-foreground">Marca <strong className="text-foreground">{b.brandName}</strong> · {p.fullName}</p>
      </div>
      <Field label="CPF" error={errors.cpf}>
        <Input value={p.cpf} onChange={(e) => setP({ ...p, cpf: formatCPF(e.target.value) })} placeholder="000.000.000-00" maxLength={14} className={ic("cpf")} />
      </Field>
      <Field label="CEP" error={errors.cep}>
        <div className="relative">
          <Input value={p.cep} onChange={(e) => onCep(e.target.value)} placeholder="00000-000" maxLength={9} className={ic("cep")} />
          {loadingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="sm:col-span-3">
          <Field label="Endereço" error={errors.address}>
            <Input value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} placeholder="Rua, Avenida..." className={ic("address")} />
          </Field>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Número</Label>
          <Input value={p.addressNumber} onChange={(e) => setP({ ...p, addressNumber: e.target.value })} placeholder="Nº" className="h-11 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Bairro" error={errors.neighborhood}>
          <Input value={p.neighborhood} onChange={(e) => setP({ ...p, neighborhood: e.target.value })} className={ic("neighborhood")} />
        </Field>
        <Field label="Cidade" error={errors.city}>
          <Input value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} className={ic("city")} />
        </Field>
        <Field label="UF" error={errors.state}>
          <Input value={p.state} onChange={(e) => setP({ ...p, state: e.target.value.toUpperCase() })} maxLength={2} className={ic("state")} />
        </Field>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <input type="checkbox" checked={b.hasCNPJ} onChange={(e) => setB({ ...b, hasCNPJ: e.target.checked })} className="h-4 w-4" />
          <span><strong>Tenho CNPJ</strong> <span className="text-muted-foreground">— quero vincular à marca (opcional)</span></span>
        </label>
        <AnimatePresence>
          {b.hasCNPJ && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="space-y-4 mt-4 pt-4 border-t border-border/50">
                <Field label="CNPJ" error={errors.cnpj}>
                  <Input value={b.cnpj} onChange={(e) => setB({ ...b, cnpj: formatCNPJ(e.target.value) })} placeholder="00.000.000/0000-00" maxLength={18} className={ic("cnpj")} />
                </Field>
                <Field label="Razão Social" error={errors.companyName}>
                  <Input value={b.companyName} onChange={(e) => setB({ ...b, companyName: e.target.value })} placeholder="Nome da empresa" className={ic("companyName")} />
                </Field>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {classes && <ClassPicker {...classes} />}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1 h-12 rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        <Button type="submit" className="flex-1 h-12 rounded-xl font-bold">
          Continuar <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </form>
  );
  }
