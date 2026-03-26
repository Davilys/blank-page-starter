import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, User, Mail, Phone, CreditCard, MapPin, Home, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import {
  validateCPF,
  fetchAddressByCEP,
  formatCPF,
  formatCEP,
  formatPhone,
} from "@/lib/validators";
import { trackLead } from "@/lib/metaPixel";
import { cn } from "@/lib/utils";

const personalDataSchema = z.object({
  fullName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  email: z.string().email("E-mail inválido").max(255),
  phone: z.string().min(14, "Telefone inválido"),
  cpf: z.string().refine((val) => validateCPF(val), "CPF inválido"),
  cep: z.string().regex(/^\d{5}-\d{3}$/, "CEP inválido"),
  address: z.string().min(5, "Endereço obrigatório").max(200),
  neighborhood: z.string().min(2, "Bairro obrigatório").max(100),
  city: z.string().min(2, "Cidade obrigatória").max(100),
  state: z.string().length(2, "UF obrigatória"),
});

export interface PersonalData {
  fullName: string;
  email: string;
  phone: string;
  cpf: string;
  cep: string;
  address: string;
  addressNumber: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface PersonalDataStepProps {
  initialData: PersonalData;
  onNext: (data: PersonalData) => void;
  onBack: () => void;
}

interface FieldProps {
  label: string;
  error?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  required?: boolean;
}

function Field({ label, error, icon: Icon, children, required }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-destructive text-xs flex items-center gap-1"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

export function PersonalDataStep({ initialData, onNext, onBack }: PersonalDataStepProps) {
  const [data, setData] = useState<PersonalData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoadingCEP, setIsLoadingCEP] = useState(false);

  const handleCEPChange = useCallback(async (cep: string) => {
    const formattedCEP = formatCEP(cep);
    setData(prev => ({ ...prev, cep: formattedCEP }));
    const cleanCEP = formattedCEP.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      setIsLoadingCEP(true);
      const addressData = await fetchAddressByCEP(cleanCEP);
      setIsLoadingCEP(false);
      if (addressData) {
        setData(prev => ({
          ...prev,
          address: addressData.logradouro || prev.address,
          neighborhood: addressData.bairro || prev.neighborhood,
          city: addressData.localidade || prev.city,
          state: addressData.uf || prev.state,
        }));
        setErrors(prev => ({ ...prev, cep: "" }));
      } else {
        setErrors(prev => ({ ...prev, cep: "CEP não encontrado" }));
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = personalDataSchema.safeParse(data);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) newErrors[err.path[0] as string] = err.message;
      });
      setErrors(newErrors);
      return;
    }
    trackLead();
    onNext(data);
  };

  const inputClass = "h-11 text-sm";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <User className="w-3.5 h-3.5" />
            Dados do Titular
          </div>
          <h2 className="text-2xl font-bold">Informações Pessoais</h2>
          <p className="text-muted-foreground text-sm">Estes dados serão utilizados no contrato e no registro junto ao INPI.</p>
        </div>

        {/* Section: Contato */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Dados de Contato</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Field label="Nome Completo" icon={User} error={errors.fullName} required>
            <Input
              value={data.fullName}
              onChange={(e) => setData({ ...data, fullName: e.target.value })}
              placeholder="Seu nome completo"
              className={cn(inputClass, errors.fullName && "border-destructive")}
            />
          </Field>

          <Field label="E-mail" icon={Mail} error={errors.email} required>
            <Input
              type="email"
              value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
              placeholder="seu@email.com"
              className={cn(inputClass, errors.email && "border-destructive")}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Telefone" icon={Phone} error={errors.phone} required>
              <Input
                value={data.phone}
                onChange={(e) => setData({ ...data, phone: formatPhone(e.target.value) })}
                placeholder="(00) 00000-0000"
                maxLength={15}
                className={cn(inputClass, errors.phone && "border-destructive")}
              />
            </Field>
            <Field label="CPF" icon={CreditCard} error={errors.cpf} required>
              <Input
                value={data.cpf}
                onChange={(e) => setData({ ...data, cpf: formatCPF(e.target.value) })}
                placeholder="000.000.000-00"
                maxLength={14}
                className={cn(inputClass, errors.cpf && "border-destructive")}
              />
            </Field>
          </div>
        </div>

        {/* Section: Endereço */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Endereço</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Field label="CEP" icon={MapPin} error={errors.cep} required>
            <div className="relative">
              <Input
                value={data.cep}
                onChange={(e) => handleCEPChange(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
                className={cn(inputClass, errors.cep && "border-destructive")}
              />
              {isLoadingCEP && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-3">
              <Field label="Endereço" icon={Home} error={errors.address} required>
                <Input
                  value={data.address}
                  onChange={(e) => setData({ ...data, address: e.target.value })}
                  placeholder="Rua, Avenida..."
                  className={cn(inputClass, errors.address && "border-destructive")}
                />
              </Field>
            </div>
            <Field label="Número">
              <Input
                value={data.addressNumber || ''}
                onChange={(e) => setData({ ...data, addressNumber: e.target.value })}
                placeholder="Nº"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Bairro" icon={Building} error={errors.neighborhood} required>
              <Input
                value={data.neighborhood}
                onChange={(e) => setData({ ...data, neighborhood: e.target.value })}
                placeholder="Bairro"
                className={cn(inputClass, errors.neighborhood && "border-destructive")}
              />
            </Field>
            <Field label="Cidade" error={errors.city} required>
              <Input
                value={data.city}
                onChange={(e) => setData({ ...data, city: e.target.value })}
                placeholder="Cidade"
                className={cn(inputClass, errors.city && "border-destructive")}
              />
            </Field>
            <Field label="UF" error={errors.state} required>
              <Input
                value={data.state}
                onChange={(e) => setData({ ...data, state: e.target.value.toUpperCase() })}
                placeholder="UF"
                maxLength={2}
                className={cn(inputClass, "sm:col-span-1", errors.state && "border-destructive")}
              />
            </Field>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onBack} className="flex-1 h-12 rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button type="submit" className="flex-1 h-12 rounded-xl shadow-[var(--shadow-button)]">
            Continuar
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
