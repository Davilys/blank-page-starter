import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Shield, Crown, Infinity, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanType } from "@/hooks/useContractTemplate";

interface PlanOption {
  id: PlanType;
  title: string;
  subtitle: string;
  price: string;
  priceDetail: string;
  icon: typeof Shield;
  badge?: string;
  badgeColor?: string;
  features: string[];
  highlight?: boolean;
}

const PLAN_OPTIONS: PlanOption[] = [
  {
    id: "essencial",
    title: "Plano Essencial",
    subtitle: "Registro único com acompanhamento completo",
    price: "R$ 698,97",
    priceDetail: "à vista no PIX ou até 6x no cartão",
    icon: Shield,
    features: [
      "Registro de 1 marca",
      "Acompanhamento até conclusão",
      "Garantia: se indeferir, refazemos",
      "Suporte por chat e e-mail",
    ],
  },
  {
    id: "premium",
    title: "Plano Premium",
    subtitle: "Proteção total com tudo incluso",
    price: "R$ 398,00",
    priceDetail: "/mês · cobrança recorrente",
    icon: Crown,
    badge: "Mais popular",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
    highlight: true,
    features: [
      "Registro de 1 marca",
      "Exigências, oposições e recursos inclusos",
      "Monitoramento semanal da RPI",
      "Suporte prioritário",
    ],
  },
  {
    id: "corporativo",
    title: "Plano Corporativo",
    subtitle: "Marcas ilimitadas para seu CPF/CNPJ",
    price: "R$ 1.621,00",
    priceDetail: "/mês · cobrança recorrente",
    icon: Infinity,
    badge: "Ilimitado",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    features: [
      "Registro de marcas ilimitado",
      "Tudo do Plano Premium incluso",
      "Gerente de conta dedicado",
      "Consultoria estratégica de portfólio",
    ],
  },
];

interface PlanSelectionStepProps {
  selectedPlan: PlanType;
  onNext: (plan: PlanType) => void;
  onBack: () => void;
}

export function PlanSelectionStep({ selectedPlan, onNext, onBack }: PlanSelectionStepProps) {
  const [selected, setSelected] = useState<PlanType>(selectedPlan || "essencial");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selected) {
      setError("Selecione um plano para continuar");
      return;
    }
    onNext(selected);
  };

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
            <Sparkles className="w-3.5 h-3.5" />
            Escolha seu Plano
          </div>
          <h2 className="text-2xl font-bold">Selecione o plano ideal</h2>
          <p className="text-muted-foreground text-sm">
            Escolha o nível de proteção para sua marca.
          </p>
        </div>

        {/* Plan Options */}
        <div className="space-y-3">
          {PLAN_OPTIONS.map((option, index) => {
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
                    ? "border-primary bg-primary/5 shadow-sm"
                    : option.highlight
                      ? "border-primary/30 bg-card hover:border-primary/50 hover:bg-muted/30"
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
                      <p className={cn("font-bold text-lg leading-tight", isSelected ? "text-primary" : "")}>
                        {option.price}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{option.priceDetail}</p>
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
            { icon: Zap, label: "Processo Ágil", sub: "Início imediato" },
            { icon: Crown, label: "Garantia INPI", sub: "Se indeferir, refazemos" },
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
