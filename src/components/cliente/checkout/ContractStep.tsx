import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Download, Printer, Check, Shield, FileText, Lock, Sparkles, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useContractTemplate, replaceContractVariables, type PlanType } from "@/hooks/useContractTemplate";
import { ContractRenderer, generateContractPrintHTML } from "@/components/contracts/ContractRenderer";
import { downloadUnifiedContractPDF, printUnifiedContract } from "@/hooks/useUnifiedContractDownload";
import type { PersonalData } from "./PersonalDataStep";
import type { BrandData } from "./BrandDataStep";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePricing } from "@/hooks/usePricing";

interface ContractStepProps {
  personalData: PersonalData;
  brandData: BrandData;
  paymentMethod: string;
  paymentValue: number;
  onSubmit: (contractHtml: string) => void;
  onBack: () => void;
  isSubmitting: boolean;
  selectedClasses?: number[];
  classDescriptions?: string[];
  suggestedClasses?: number[];
  suggestedClassDescriptions?: string[];
  onSelectedClassesChange?: (classes: number[]) => void;
  onPaymentValueChange?: (value: number) => void;
  plan?: PlanType;
}

const PLAN_TEMPLATE_NAMES: Record<PlanType, string> = {
  essencial: 'Contrato Padrão - Registro de Marca INPI',
  premium: 'Contrato Premium - Registro de Marca INPI',
  corporativo: 'Contrato Corporativo - Registro de Marca INPI',
};

export function ContractStep({
  personalData,
  brandData,
  paymentMethod,
  paymentValue,
  onSubmit,
  onBack,
  isSubmitting,
  selectedClasses,
  classDescriptions,
  suggestedClasses,
  suggestedClassDescriptions,
  onSelectedClassesChange,
  onPaymentValueChange,
  plan = 'essencial',
}: ContractStepProps) {
  const [accepted, setAccepted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const templateName = PLAN_TEMPLATE_NAMES[plan];
  const { template, isLoading, documentType } = useContractTemplate(templateName, plan);
  const { pricing } = usePricing();
  const initialSelectedRef = useRef<number[]>(selectedClasses || []);

  // Price per class by payment method / plan
  const getUnitPrice = useCallback(() => {
    // Recurring plans: price per class = monthly value
    if (plan === 'premium') return 398;
    if (plan === 'corporativo') return 0; // incluso
    // Essencial: price varies by payment method
    switch (paymentMethod) {
      case 'avista': return pricing.avista.value;
      case 'cartao6x': case 'cartao': return pricing.cartao.value;
      case 'boleto3x': case 'boleto': return pricing.boleto.value;
      default: return pricing.avista.value;
    }
  }, [paymentMethod, pricing, plan]);

  const handleToggleClass = useCallback((cls: number) => {
    const currentSelected = selectedClasses || [];
    const isSelected = currentSelected.includes(cls);
    const newList = isSelected
      ? currentSelected.filter(c => c !== cls)
      : [...currentSelected, cls];

    onSelectedClassesChange?.(newList);

    // Corporativo: unlimited registrations, no price change
    if (plan !== 'corporativo') {
      const classCount = Math.max(newList.length, 1);
      const newValue = classCount * getUnitPrice();
      onPaymentValueChange?.(newValue);
    }
  }, [selectedClasses, onSelectedClassesChange, onPaymentValueChange, getUnitPrice, plan]);

  const getProcessedContract = useCallback(() => {
    if (!template) return '';
    return replaceContractVariables(template.content, {
      personalData,
      brandData,
      paymentMethod,
      selectedClasses,
      classDescriptions,
      plan,
    });
  }, [template, personalData, brandData, paymentMethod, selectedClasses, classDescriptions, plan]);

  // Extract contract title from the template content for the renderer
  const getContractTitle = useCallback(() => {
    if (!template) return undefined;
    const firstLine = template.content.split('\n')[0]?.trim();
    if (firstLine && firstLine.includes('CONTRATO PARTICULAR')) {
      return firstLine;
    }
    return undefined;
  }, [template]);

  const printContract = async () => {
    try {
      const contractContent = getProcessedContract();
      await printUnifiedContract({ content: contractContent, documentType, subject: brandData.brandName, signatoryName: personalData.fullName, signatoryCpf: personalData.cpf, contractTitle: getContractTitle() });
    } catch (error) {
      toast.error("Não foi possível abrir a janela de impressão.");
    }
  };

  const downloadContract = async () => {
    setIsDownloading(true);
    try {
      const contractContent = getProcessedContract();
      await downloadUnifiedContractPDF({ content: contractContent, documentType, subject: brandData.brandName, signatoryName: personalData.fullName, signatoryCpf: personalData.cpf, contractTitle: getContractTitle() });
    } catch (error) {
      toast.error("Erro ao abrir visualização do contrato.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSubmit = () => {
    if (!accepted) {
      toast.error("Por favor, leia e aceite o contrato para continuar.");
      return;
    }
    const contractContent = getProcessedContract();
    const fullContractHtml = generateContractPrintHTML(contractContent, brandData.brandName, personalData.fullName, personalData.cpf, undefined, true, documentType, undefined, getContractTitle());
    onSubmit(fullContractHtml);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getPaymentLabel = () => {
    if (plan === 'premium' || plan === 'corporativo') {
      return `Assinatura Mensal (Cartão)`;
    }
    switch (paymentMethod) {
      case 'avista': return 'PIX — À Vista';
      case 'cartao6x': return 'Cartão de Crédito (6x)';
      case 'boleto3x': return 'Boleto Parcelado (3x)';
      default: return 'Pagamento';
    }
  };

  const isRecurring = plan === 'premium' || plan === 'corporativo';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-muted" />
          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-medium">Preparando seu contrato...</p>
          <p className="text-sm text-muted-foreground mt-1">Aguarde um momento</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
          <FileText className="w-3.5 h-3.5" />
          Contrato Digital
        </div>
        <h2 className="text-2xl font-bold">Revise e Assine</h2>
        <p className="text-muted-foreground text-sm">Leia o contrato completo antes de confirmar.</p>
      </div>

      {/* Summary Card */}
      <div className="rounded-2xl border border-border bg-muted/20 overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo do Pedido</p>
        </div>
        <div className="grid grid-cols-2 gap-0 divide-x divide-border">
          {[
            { label: "Marca", value: brandData.brandName, highlight: false },
            { label: "Titular", value: personalData.fullName, highlight: false },
            { label: "Pagamento", value: getPaymentLabel(), highlight: false },
            { label: isRecurring ? "Mensal" : "Total", value: `${formatCurrency(paymentValue)}${isRecurring ? '/mês' : ''}`, highlight: true },
          ].map((item, i) => (
            <div key={i} className={cn("p-4", i >= 2 && "border-t border-border")}>
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className={cn("text-sm font-semibold truncate", item.highlight && "text-primary text-base")}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Contract Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={printContract} className="flex-1 h-9 rounded-lg text-xs">
          <Printer className="w-3.5 h-3.5 mr-1.5" />
          Imprimir
        </Button>
        <Button variant="outline" size="sm" onClick={downloadContract} disabled={isDownloading} className="flex-1 h-9 rounded-lg text-xs">
          {isDownloading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 mr-1.5" />
          )}
          Baixar PDF
        </Button>
      </div>

      {/* Contract Content */}
      <div className="rounded-2xl border-2 border-border overflow-hidden shadow-sm">
        <div className="bg-muted/40 px-4 py-3 border-b border-border flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Contrato de Prestação de Serviços</span>
          <div className="ml-auto flex items-center gap-1">
            <Shield className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Protegido</span>
          </div>
        </div>
        <div className="h-[360px] overflow-y-auto">
          <div className="p-5">
            <ContractRenderer
              content={getProcessedContract()}
              showLetterhead={true}
              showCertificationSection={false}
              documentType={documentType}
              contractTitle={getContractTitle()}
            />
          </div>
        </div>
      </div>

      {/* Upsell: suggested classes not in initial selection — all plans */}
      {(() => {
        const extraClasses = (suggestedClasses || []).filter(
          cls => !initialSelectedRef.current.includes(cls)
        );
        if (extraClasses.length === 0) return null;
        const unitPrice = getUnitPrice();
        const totalSuggested = (suggestedClasses || []).length;
        const isCorporativo = plan === 'corporativo';
        return (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 overflow-hidden">
            <div className="p-4 border-b border-primary/20 bg-primary/10 flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-primary">
                Orientação Jurídica
              </p>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">
                O ideal é registrar nas {totalSuggested} classes para máxima proteção.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sem o registro nestas categorias, terceiros podem usar sua marca legalmente nesses segmentos. A proteção parcial deixa sua marca vulnerável.
              </p>
              {isCorporativo && (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  ✓ Todas as classes estão inclusas no seu Plano Corporativo — sem custo adicional.
                </p>
              )}
              <div className="space-y-2 pt-1">
                {extraClasses.map((cls) => {
                  const idx = (suggestedClasses || []).indexOf(cls);
                  const desc = idx >= 0 && suggestedClassDescriptions?.[idx]
                    ? suggestedClassDescriptions[idx]
                    : `Classe ${cls}`;
                  const isChecked = (selectedClasses || []).includes(cls);
                  return (
                    <label
                      key={cls}
                      onClick={() => handleToggleClass(cls)}
                      className={cn(
                        "w-full flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer",
                        isChecked
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : "border-border bg-background/60 hover:border-primary/40 hover:bg-primary/5"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="mt-0.5 shrink-0 h-4 w-4 rounded border-border text-primary cursor-pointer"
                      />
                      <span className={cn(
                        "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors",
                        isChecked
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {cls}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                      </div>
                      <span className={cn(
                        "shrink-0 text-xs font-semibold",
                        isCorporativo ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
                      )}>
                        {isCorporativo ? 'Incluso' : plan === 'premium' ? `+${formatCurrency(unitPrice)}/mês` : `+${formatCurrency(unitPrice)}`}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Accept Checkbox */}
      <motion.div
        className={cn(
          "flex items-start gap-3 p-4 rounded-xl border-2 transition-all duration-200",
          accepted
            ? "border-primary/30 bg-primary/5"
            : "border-border bg-muted/20"
        )}
        whileTap={{ scale: 0.99 }}
      >
        <input
          id="accept"
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 shrink-0 h-4 w-4 rounded border-border text-primary"
        />
        <Label htmlFor="accept" className="text-sm leading-relaxed cursor-pointer">
          <span className="font-semibold">Li e aceito os termos do contrato</span> de prestação de serviços.
          Declaro que todas as informações fornecidas são verdadeiras e autorizo a
          WebMarcas Intelligence PI a prosseguir com o registro da marca junto ao INPI.
        </Label>
      </motion.div>

      {/* Submit */}
      <div className="space-y-3">
        <Button
          onClick={handleSubmit}
          className="w-full h-14 text-base font-semibold rounded-xl shadow-[var(--shadow-button)]"
          disabled={!accepted || isSubmitting}
          size="lg"
        >
          {isSubmitting ? (
            <motion.div
              className="flex items-center gap-3"
              animate={{ opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Loader2 className="w-5 h-5 animate-spin" />
              Processando pagamento...
            </motion.div>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              {isRecurring ? 'Assinar e Iniciar' : 'Finalizar e Pagar'}
              <Check className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>

        <Button type="button" variant="ghost" onClick={onBack} disabled={isSubmitting} className="w-full h-10 text-sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao pagamento
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" />
        Dados protegidos com criptografia SSL
      </p>
    </motion.div>
  );
}
