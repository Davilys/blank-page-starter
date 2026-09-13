import { useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Lock, Zap, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrademarkSearch } from '../useTrademarkSearch';
import { validateSearchInput } from '../trademarkSearchService';
import { ACTIVITY_MAX_LENGTH, BRAND_MAX_LENGTH, type TrademarkSearchJob } from '../types';
import { SearchProgress } from './SearchProgress';
import { SearchResult } from './SearchResult';
import { SearchError } from './SearchError';

export interface TrademarkSearchProps {
  /** `landing`: visual da home (pílulas). `checkout`: visual do passo 1 do registro. */
  variant: 'landing' | 'checkout';
  /** Chamado quando o visitante decide continuar após uma consulta concluída. */
  onContinue?: (brandName: string, businessArea: string, job: TrademarkSearchJob) => void;
  continueLabel?: string;
}

function useElapsed(startedAt: number | null, active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return startedAt ? Math.max(0, now - startedAt) : 0;
}

/**
 * Buscador único de marcas. O mesmo componente (e o mesmo estado, via Provider)
 * é usado na home, em /registrar e na área do cliente.
 */
export function TrademarkSearch({ variant, onContinue, continueLabel }: TrademarkSearchProps) {
  const { state, isBusy, startSearch, retry, reset } = useTrademarkSearch();
  const [brand, setBrand] = useState(state.brandName);
  const [activity, setActivity] = useState(state.businessArea);
  const [localError, setLocalError] = useState<string | null>(null);
  const elapsed = useElapsed(state.startedAt, isBusy);

  // Mantém os campos em sincronia quando a consulta vem de outra página.
  useEffect(() => {
    if (state.phase !== 'idle') {
      setBrand(state.brandName);
      setActivity(state.businessArea);
    }
  }, [state.phase, state.brandName, state.businessArea]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = validateSearchInput(brand, activity);
    if (err) {
      setLocalError(err.message);
      return;
    }
    setLocalError(null);
    void startSearch(brand, activity);
  };

  const handleReset = () => {
    reset();
    setLocalError(null);
  };

  const showForm = state.phase === 'idle';
  const showProgress = isBusy;
  const showResult = state.phase === 'completed' && state.job;
  const showError = state.phase === 'error' && state.error;

  const idPrefix = variant === 'landing' ? 'wmLanding' : 'wmCheckout';

  return (
    <div id={variant === 'landing' ? 'consultar' : undefined} className="w-full">
      <AnimatePresence mode="wait">
        {showForm && (
          <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
            {variant === 'landing' ? (
              <>
                <div className="flex justify-center mb-4">
                  <span className="badge-consulta">
                    <Zap className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Consulta Gratuita
                  </span>
                </div>
                <h2 className="font-display text-[1.9rem] sm:text-[2.15rem] leading-[1.05] font-bold text-center text-[hsl(222_47%_11%)] mb-8">
                  Consulte a viabilidade da sua{' '}
                  <span className="text-[hsl(222_92%_54%)]">marca</span>
                </h2>
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div>
                    <label htmlFor={`${idPrefix}Brand`} className="form-label-caps">Nome da Marca</label>
                    <input
                      id={`${idPrefix}Brand`}
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="Como sua marca se chama?"
                      className="form-pill-input"
                      maxLength={BRAND_MAX_LENGTH}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${idPrefix}Activity`} className="form-label-caps">Ramo de Atividade</label>
                    <input
                      id={`${idPrefix}Activity`}
                      type="text"
                      value={activity}
                      onChange={(e) => setActivity(e.target.value)}
                      placeholder="Ex: Serviços Jurídicos, Alimentação, Tecnologia..."
                      className="form-pill-input"
                      maxLength={ACTIVITY_MAX_LENGTH}
                      autoComplete="off"
                    />
                  </div>
                  {localError && <p className="text-sm text-destructive text-center" role="alert">{localError}</p>}
                  <button type="submit" className="btn-cta-solid mt-2">
                    Consultar Viabilidade
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <div className="flex items-center justify-center gap-2 pt-1 text-xs text-[hsl(215_16%_47%)]">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-semibold text-[hsl(222_47%_11%)]">100% Seguro</span>
                    <span className="opacity-40">·</span>
                    <a href="/politica-privacidade" className="underline hover:text-[hsl(222_92%_54%)]">Política de privacidade</a>
                  </div>
                </form>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                <div className="text-center space-y-2">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Search className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Consulte a disponibilidade da sua marca</h2>
                  <p className="text-sm text-muted-foreground">Pesquisa exata e radical na base oficial do INPI.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}Brand`} className="text-sm font-semibold">Nome da Marca <span className="text-destructive">*</span></Label>
                    <Input id={`${idPrefix}Brand`} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ex: WebMarcas, TechFlow, BioVida..." className="h-12 text-base" maxLength={BRAND_MAX_LENGTH} autoComplete="off" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}Activity`} className="text-sm font-semibold">Ramo de Atividade <span className="text-destructive">*</span></Label>
                    <Input id={`${idPrefix}Activity`} value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Ex: Serviços Jurídicos, Alimentação, Tecnologia..." className="h-12 text-base" maxLength={ACTIVITY_MAX_LENGTH} autoComplete="off" />
                  </div>
                </div>
                {localError && <p className="text-sm text-destructive" role="alert">{localError}</p>}
                <Button type="submit" className="w-full h-12 rounded-xl font-bold text-base">
                  Consultar no INPI<ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <p className="text-center text-xs text-muted-foreground inline-flex w-full items-center justify-center gap-1.5">
                  <Lock className="w-3 h-3" />Consulta gratuita e sem compromisso
                </p>
              </form>
            )}
          </motion.div>
        )}

        {showProgress && (
          <SearchProgress key="progress" brandName={state.brandName} phase={state.phase} elapsedMs={elapsed} />
        )}

        {showResult && (
          <SearchResult
            key="result"
            job={state.job!}
            brandName={state.brandName}
            businessArea={state.businessArea}
            onNewSearch={handleReset}
            onContinue={onContinue ? () => onContinue(state.brandName, state.businessArea, state.job!) : undefined}
            continueLabel={continueLabel}
          />
        )}

        {showError && (
          <SearchError key="error" error={state.error!} brandName={state.brandName} onRetry={() => void retry()} onReset={handleReset} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default TrademarkSearch;
