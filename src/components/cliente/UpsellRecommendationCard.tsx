import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Target, Globe, Award, ChevronRight, Sparkles, X } from 'lucide-react';
import { generateRecommendations, logUpsellResponse, type UpsellRecommendation, type UpsellContext } from '@/lib/upsellEngine';
import { cn } from '@/lib/utils';

const typeIcons: Record<string, React.ElementType> = {
  classe_complementar: Target,
  blindagem_cnpj: Shield,
  madrid_protocol: Globe,
  protecao_premium: Award,
};

const typeColors: Record<string, { color: string; glow: string; gradient: string }> = {
  classe_complementar: { color: '#3b82f6', glow: '59 130 246', gradient: 'from-blue-500 to-cyan-400' },
  blindagem_cnpj: { color: '#8b5cf6', glow: '139 92 246', gradient: 'from-violet-500 to-purple-400' },
  madrid_protocol: { color: '#06b6d4', glow: '6 182 212', gradient: 'from-cyan-500 to-teal-400' },
  protecao_premium: { color: '#f59e0b', glow: '245 158 11', gradient: 'from-amber-500 to-orange-400' },
};

interface Props {
  context: UpsellContext;
  onAccept?: (rec: UpsellRecommendation) => void;
}

export function UpsellRecommendationCard({ context, onAccept }: Props) {
  const [recommendations, setRecommendations] = useState<UpsellRecommendation[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!context.classeAtual && !context.segmento) {
      setLoading(false);
      return;
    }
    generateRecommendations(context).then(recs => {
      setRecommendations(recs);
      setLoading(false);
    });
  }, [context.classeAtual, context.segmento, context.scoreComercial]);

  const handleAccept = async (rec: UpsellRecommendation) => {
    await logUpsellResponse({
      userId: context.userId,
      classe: context.classeAtual,
      segmento: context.segmento,
      score: context.scoreComercial,
      upsellSugerido: rec.titulo,
      upsellTipo: rec.tipo,
      aceitou: true,
      confidence: rec.confidence,
    });
    onAccept?.(rec);
  };

  const handleDismiss = async (rec: UpsellRecommendation) => {
    await logUpsellResponse({
      userId: context.userId,
      classe: context.classeAtual,
      segmento: context.segmento,
      score: context.scoreComercial,
      upsellSugerido: rec.titulo,
      upsellTipo: rec.tipo,
      aceitou: false,
      confidence: rec.confidence,
    });
    setDismissed(prev => new Set([...prev, rec.id]));
  };

  const visible = recommendations.filter(r => !dismissed.has(r.id));

  if (loading || visible.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-3xl border backdrop-blur-sm"
      style={{
        background: 'hsl(var(--card)/0.85)',
        borderColor: 'hsl(var(--border)/0.6)',
        boxShadow: '0 8px 32px hsl(var(--foreground)/0.04)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-3 border-b border-border/40">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-400 shadow-lg">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-sm">💰 Recomendação de Proteção</h2>
          <p className="text-[10px] text-muted-foreground">Baseado na análise inteligente da sua marca</p>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {visible.slice(0, 2).map((rec, i) => {
            const Icon = typeIcons[rec.tipo] || Target;
            const colors = typeColors[rec.tipo] || typeColors.classe_complementar;

            return (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="relative overflow-hidden rounded-2xl border p-4"
                style={{
                  background: `linear-gradient(135deg, hsl(var(--card)/0.8) 0%, rgb(${colors.glow} / 0.04) 100%)`,
                  borderColor: `rgb(${colors.glow} / 0.2)`,
                }}
              >
                {/* Accent */}
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl bg-gradient-to-b ${colors.gradient}`} />

                {/* Dismiss */}
                <button
                  onClick={() => handleDismiss(rec)}
                  className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted/50 transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                <div className="ml-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg" style={{ background: `rgb(${colors.glow} / 0.12)` }}>
                      <Icon className="h-4 w-4" style={{ color: colors.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{rec.titulo}</p>
                      {rec.isPremium && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                          RECOMENDAÇÃO PREMIUM
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mb-3">{rec.descricao}</p>

                  {rec.classesSugeridas && rec.classesSugeridas.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {rec.classesSugeridas.map(c => (
                        <span key={c} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          Classe {c}
                        </span>
                      ))}
                    </div>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleAccept(rec)}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all",
                      `bg-gradient-to-r ${colors.gradient} shadow-lg`
                    )}
                  >
                    Quero proteger minha marca
                    <ChevronRight className="h-3.5 w-3.5" />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Legal */}
        <p className="text-[9px] text-muted-foreground text-center mt-2">
          Recomendação baseada em dados históricos e análise de mercado. Consulte um especialista para orientação personalizada.
        </p>
      </div>
    </motion.div>
  );
}
