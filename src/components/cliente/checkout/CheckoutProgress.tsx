import { motion } from "framer-motion";
import { Check, Search, User, Building2, Sparkles, CreditCard, FileSignature } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  number: number;
  label: string;
  icon: typeof Search;
}

const steps: Step[] = [
  { number: 1, label: "Viabilidade", icon: Search },
  { number: 2, label: "Dados Pessoais", icon: User },
  { number: 3, label: "Dados da Marca", icon: Building2 },
  { number: 4, label: "Planos", icon: Sparkles },
  { number: 5, label: "Pagamento", icon: CreditCard },
  { number: 6, label: "Contrato", icon: FileSignature },
];

interface CheckoutProgressProps {
  currentStep: number;
}

export function CheckoutProgress({ currentStep }: CheckoutProgressProps) {
  return (
    <div className="w-full mb-10">
      {/* Step label for mobile */}
      <div className="sm:hidden text-center mb-4">
        <span className="text-xs text-muted-foreground">
          Etapa {currentStep} de {steps.length}: <strong className="text-foreground">{steps[currentStep - 1]?.label}</strong>
        </span>
      </div>

      <div className="flex items-center justify-between relative">
        {/* Background connector line */}
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-border mx-[20px] z-0" />

        {steps.map((s, index) => {
          const isCompleted = currentStep > s.number;
          const isCurrent = currentStep === s.number;
          const isPending = currentStep < s.number;

          return (
            <div key={s.number} className="flex items-center flex-1 z-10">
              <div className="flex flex-col items-center group">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.15 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className={cn(
                    "relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 shadow-sm",
                    isCompleted && "bg-primary text-primary-foreground shadow-[var(--shadow-button)]",
                    isCurrent && "bg-primary text-primary-foreground shadow-[var(--shadow-button)] ring-4 ring-primary/20",
                    isPending && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    >
                      <Check className="w-5 h-5" />
                    </motion.div>
                  ) : (
                    <s.icon className="w-4 h-4" />
                  )}

                  {isCurrent && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-primary/30"
                      animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </motion.div>

                <span className={cn(
                  "text-xs mt-2 hidden sm:block transition-all duration-300 whitespace-nowrap",
                  isCompleted && "text-primary font-medium",
                  isCurrent && "text-foreground font-semibold",
                  isPending && "text-muted-foreground"
                )}>
                  {s.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className="flex-1 mx-1 h-0.5 relative overflow-hidden">
                  <div className="absolute inset-0 bg-border" />
                  <motion.div
                    className="absolute inset-0 bg-primary origin-left"
                    initial={false}
                    animate={{ scaleX: currentStep > s.number ? 1 : 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
