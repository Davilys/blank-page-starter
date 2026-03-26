import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Layers, Info, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { usePricing } from "@/hooks/usePricing";
import { cn } from "@/lib/utils";

interface NclClassSelectionStepProps {
  suggestedClasses: number[];
  classDescriptions: string[];
  brandName: string;
  onNext: (selectedClasses: number[], classDescriptions: string[]) => void;
  onBack: () => void;
}

export function NclClassSelectionStep({
  suggestedClasses,
  classDescriptions,
  brandName,
  onNext,
  onBack,
}: NclClassSelectionStepProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState("");
  const { pricing } = usePricing();

  const hasClasses = suggestedClasses.length > 0;

  const toggleClass = (cls: number) => {
    setError("");
    setSelected((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  };

  const handleSubmit = () => {
    if (!hasClasses) {
      // No classes suggested — proceed with default (1 class)
      onNext([], []);
      return;
    }
    if (selected.length === 0) {
      setError("Selecione ao menos 1 classe para proteger sua marca.");
      return;
    }
    // Map selected classes back to their descriptions by position index
    const selectedDescriptions = selected.map((cls) => {
      const idx = suggestedClasses.indexOf(cls);
      return idx >= 0 ? classDescriptions[idx] || `Classe ${cls}` : `Classe ${cls}`;
    });
    onNext(selected, selectedDescriptions);
  };

  const totalValue = Math.max(selected.length, 1) * pricing.avista.value;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Layers className="w-3.5 h-3.5" />
            Classes de Proteção
          </div>
          <h2 className="text-2xl font-bold">Proteja sua marca</h2>
          <p className="text-muted-foreground text-sm">
            Selecione as classes NCL para proteger <strong>"{brandName}"</strong> nos segmentos certos.
          </p>
        </div>

        {/* Info Card */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              <p className="font-semibold mb-1">O que são Classes NCL?</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                A Classificação Internacional de Nice (NCL) divide produtos e serviços em 45 classes.
                Registrar sua marca nas classes corretas garante proteção legal contra uso indevido
                no seu ramo de atividade.
              </p>
            </div>
          </div>
        </div>

        {/* Classes List or Empty State */}
        {hasClasses ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
              Classes sugeridas pela IA ({suggestedClasses.length})
            </p>
            {suggestedClasses.map((cls, index) => {
              const isChecked = selected.includes(cls);
              const desc = classDescriptions[index] || `Classe ${cls}`;
              return (
                <motion.button
                  key={cls}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  onClick={() => toggleClass(cls)}
                  className={cn(
                    "w-full text-left rounded-xl border-2 p-4 transition-all duration-200 group",
                    isChecked
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleClass(cls)}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold shrink-0",
                          isChecked
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {cls}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{desc}</p>
                          <p className="text-xs text-muted-foreground">NCL Classe {cls}</p>
                        </div>
                      </div>
                    </div>
                    {isChecked && (
                      <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-foreground mb-1">Nenhuma classe sugerida</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  A análise de viabilidade não retornou sugestões de classes para sua marca.
                  Você pode prosseguir e nossa equipe definirá a classe mais adequada para o seu registro.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Price Summary */}
        {hasClasses && selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="rounded-xl border border-border bg-muted/30 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  {selected.length} {selected.length === 1 ? "classe selecionada" : "classes selecionadas"}
                </p>
                <p className="text-sm font-semibold">Valor estimado (PIX)</p>
              </div>
              <p className="text-xl font-bold text-primary">
                R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              O valor final será definido na próxima etapa conforme a forma de pagamento escolhida.
            </p>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-destructive text-sm text-center"
          >
            {error}
          </motion.p>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onBack} className="flex-1 h-12 rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            className="flex-1 h-12 rounded-xl shadow-[var(--shadow-button)]"
          >
            Continuar
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
