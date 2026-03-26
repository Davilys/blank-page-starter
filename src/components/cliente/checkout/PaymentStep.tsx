import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { trackInitiateCheckout } from "@/lib/metaPixel";
import { ArrowLeft, ArrowRight, Check, CreditCard, QrCode, FileText, Loader2, Shield, Clock, Zap, Crown, Infinity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePricing } from "@/hooks/usePricing";
import type { PlanType } from "@/hooks/useContractTemplate";

interface PaymentOption {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  totalLabel: string;
  priceValue: number;
  icon: typeof CreditCard;
  badge?: string;
  badgeColor?: string;
  features: string[];
}

interface PaymentStepProps {
  selectedMethod: string;
  onNext: (method: string, value: number) => void;
  onBack: () => void;
  classCount?: number;
  plan?: PlanType;
}

export function PaymentStep({ selectedMethod, onNext, onBack, classCount = 1, plan = 'essencial' }: PaymentStepProps) {
  const [selected, setSelected] = useState(selectedMethod || "");
  const [error, setError] = useState("");
  const { pricing, isLoading } = usePricing();
  const isRecurring = plan === 'premium' || plan === 'corporativo';

  useEffect(() => {
    trackInitiateCheckout();
  }, []);

  const qty = Math.max(classCount, 1);

  const baseRecurring = plan === 'premium' ? 398 : plan === 'corporativo' ? 1621 : 0;
  const recurringValue = plan === 'premium' ? baseRecurring * qty : baseRecurring;
  const planLabel = plan === 'premium' ? 'Plano Premium' : 'Plano Corporativo';

  const paymentOptions: PaymentOption[] = useMemo(() => {
    if (isRecurring) {
      return [
        {
          id: "recorrente_cartao",
          title: "Cartão de Crédito — Recorrente",
          subtitle: `${planLabel} · cobrança mensal automática`,
          price: `R$ ${recurringValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          totalLabel: "Mensal",
          priceValue: recurringValue,
          icon: CreditCard,
          badge: "Assinatura",
          badgeColor: "bg-primary/10 text-primary border-primary/20",
          features: ["Cobrança automática mensal", "Cancelamento a qualquer momento", "Sem taxa de adesão"],
        },
        {
          id: "recorrente_boleto",
          title: "Boleto Bancário — Recorrente",
          subtitle: `${planLabel} · cobrança mensal via boleto`,
          price: `R$ ${recurringValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          totalLabel: "Mensal",
          priceValue: recurringValue,
          icon: FileText,
          badge: "Boleto Mensal",
          badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
          features: ["Boleto gerado automaticamente", "Vencimento todo dia 10", "Sem taxa de adesão"],
        },
      ];
    }

    return [
      {
        id: "avista",
        title: "PIX — À Vista",
        subtitle: "Pagamento instantâneo e seguro",
        price: `R$ ${(pricing.avista.value * qty).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        totalLabel: "Total",
        priceValue: pricing.avista.value * qty,
        icon: QrCode,
        badge: "Melhor preço",
        badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        features: ["Aprovação imediata", "QR Code gerado na hora", "Sem taxas extras"],
      },
      {
        id: "cartao6x",
        title: "Cartão de Crédito",
        subtitle: `${pricing.cartao.installments}x sem juros`,
        price: `R$ ${(pricing.cartao.installmentValue * qty).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        totalLabel: `${pricing.cartao.installments}x de`,
        priceValue: pricing.cartao.value * qty,
        icon: CreditCard,
        badge: "Sem juros",
        badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        features: ["Aprovação instantânea", "Parcele em até 6x", "Todas as bandeiras"],
      },
      {
        id: "boleto3x",
        title: "Boleto Parcelado",
        subtitle: `${pricing.boleto.installments}x sem juros`,
        price: `R$ ${(pricing.boleto.installmentValue * qty).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        totalLabel: `${pricing.boleto.installments}x de`,
        priceValue: pricing.boleto.value * qty,
        icon: FileText,
        features: ["Até 3 dias úteis", "Parcelado sem juros", "Emissão automática"],
      },
    ];
  }, [pricing, qty, isRecurring, recurringValue, planLabel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selected) {
      setError("Selecione uma forma de pagamento para continuar");
      return;
    }
    const option = paymentOptions.find(o => o.id === selected);
    if (option) onNext(selected, option.priceValue);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando valores...</p>
      </div>
    );
  }

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
            {isRecurring ? <RefreshCw className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
            {isRecurring ? 'Assinatura Mensal' : 'Forma de Pagamento'}
          </div>
          <h2 className="text-2xl font-bold">
            {isRecurring ? 'Confirme sua assinatura' : 'Escolha como pagar'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {isRecurring
              ? `Você selecionou o ${planLabel}. O valor será cobrado mensalmente.`
              : qty > 1
                ? `${qty} classes selecionadas — valores já multiplicados.`
                : "Selecione a forma mais conveniente para você."}
          </p>
        </div>

        {/* Recurring plan highlight */}
        {isRecurring && (
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              {plan === 'premium' ? (
                <Crown className="w-6 h-6 text-primary" />
              ) : (
                <Infinity className="w-6 h-6 text-primary" />
              )}
              <div>
                <p className="font-bold text-foreground">{planLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {plan === 'premium'
                    ? 'Proteção total com todos os recursos inclusos'
                    : 'Marcas ilimitadas + tudo do Premium'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(plan === 'premium'
                ? ['Exigências inclusas', 'Oposições inclusas', 'Recursos inclusos', 'Monitoramento RPI']
                : ['Marcas ilimitadas', 'Tudo incluso', 'Gerente dedicado', 'Suporte prioritário']
              ).map((item, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Options */}
        <div className="space-y-3">
          {paymentOptions.map((option, index) => {
            const isSelected = selected === option.id;
            return (
              <motion.button
                key={option.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                onClick={() => setSelected(option.id)}
                className={cn(
                  "w-full text-left rounded-2xl border-2 p-5 transition-all duration-200 group",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-[var(--shadow-button)] shadow-sm"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-xl shrink-0 transition-all duration-200",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}>
                    <option.icon className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-sm">{option.title}</span>
                      {option.badge && (
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", option.badgeColor)}>
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{option.subtitle}</p>
                    <div className="flex flex-wrap gap-2">
                      {option.features.map((f, fi) => (
                        <span key={fi} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Check className="w-2.5 h-2.5 text-emerald-500" />
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Price + Radio */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">{option.totalLabel}</p>
                      <p className={cn("font-bold text-lg leading-tight", isSelected ? "text-primary" : "")}>
                        {option.price}
                      </p>
                      {isRecurring && (
                        <p className="text-[10px] text-muted-foreground">/mês</p>
                      )}
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                    )}>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-2 h-2 rounded-full bg-primary-foreground"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-destructive text-sm text-center"
          >
            {error}
          </motion.p>
        )}

        {/* Trust badges */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Shield, label: "100% Seguro", sub: "Dados criptografados" },
            { icon: Clock, label: "Processo Ágil", sub: "Início imediato" },
            { icon: Zap, label: "Garantia INPI", sub: "Se indeferir, refazemos" },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/40 border border-border/50 text-center">
              <item.icon className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
              <span className="text-[9px] text-muted-foreground leading-tight">{item.sub}</span>
            </div>
          ))}
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
