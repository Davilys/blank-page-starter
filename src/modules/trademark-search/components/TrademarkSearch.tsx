import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Lock, Mail, Zap } from 'lucide-react';

// Mesmo glifo de WhatsApp usado no cabeçalho da consulta.
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}><path d="M20.52 3.48A11.91 11.91 0 0012.04 0C5.46 0 .1 5.35.1 11.94c0 2.1.55 4.16 1.6 5.97L0 24l6.24-1.64a11.9 11.9 0 005.8 1.48h.01C18.63 23.84 24 18.49 24 11.9c0-3.19-1.24-6.18-3.48-8.42zM12.05 21.83h-.01a9.9 9.9 0 01-5.05-1.38l-.36-.21-3.7.97.99-3.61-.24-.37a9.88 9.88 0 01-1.52-5.29C2.16 6.47 6.59 2.04 12.05 2.04a9.83 9.83 0 017 2.9 9.83 9.83 0 012.89 7c0 5.45-4.44 9.89-9.89 9.89zm5.42-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.18.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.21 5.08 4.5.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.69.25-1.29.18-1.41-.08-.12-.28-.2-.57-.35z" /></svg>
);
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrademarkSearch } from '../useTrademarkSearch';
import { validateContactInput, validateLeadInput, validateSearchInput } from '../trademarkSearchService';
import { formatPhone } from '@/lib/validators';
import {
  ACTIVITY_MAX_LENGTH,
  BRAND_MAX_LENGTH,
  BRAND_STAGES,
  BRAND_STAGE_PLACEHOLDER,
  type TrademarkSearchJob,
} from '../types';
import { SearchProgress } from './SearchProgress';
import { SearchResult as DefaultSearchResult } from './SearchResult';
import { ConsultationSearchResult } from './ConsultationSearchResult';
import { SearchError } from './SearchError';

export interface TrademarkSearchProps {
  /** `landing`: visual da home (pílulas). `checkout`: visual do passo 1 do registro. */
  variant: 'landing' | 'checkout';
  consultationVisual?: boolean;
  /** Quando true (só /consultar), o formulário também captura telefone e estágio da empresa. */
  collectContact?: boolean;
  /** Chamado quando o visitante decide continuar após uma consulta concluída. */
  onContinue?: (brandName: string, businessArea: string, job: TrademarkSearchJob) => void;
  continueLabel?: string;
  formTitle?: string;
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
export function TrademarkSearch({ variant, onContinue, continueLabel, consultationVisual = false, collectContact = false, formTitle }: TrademarkSearchProps) {
  const SearchResult = consultationVisual ? ConsultationSearchResult : DefaultSearchResult;
  const { state, isBusy, startSearch, retry, retryPdf, pdfRetrying, reset } = useTrademarkSearch();
  const [brand, setBrand] = useState(state.brandName);
  const [activity, setActivity] = useState(state.businessArea);
  const [brandStage, setBrandStage] = useState(state.brandStage);
  const [fullName, setFullName] = useState(state.fullName);
  const [phone, setPhone] = useState(state.phone);
  const [email, setEmail] = useState(state.email);
  const [view, setView] = useState<'search' | 'contact'>('search');
  const [localError, setLocalError] = useState<string | null>(null);
  const elapsed = useElapsed(state.startedAt, isBusy);

  // Mantém os campos em sincronia quando a consulta vem de outra página.
  useEffect(() => {
    if (state.phase !== 'idle') {
      setBrand(state.brandName);
      setActivity(state.businessArea);
      setBrandStage(state.brandStage);
      setFullName(state.fullName);
      setPhone(state.phone);
      setEmail(state.email);
      setView('search');
    }
  }, [state.phase, state.brandName, state.businessArea, state.brandStage, state.fullName, state.phone, state.email]);

  // Ao avançar para a etapa de contato, garante que o topo do formulário
  // fique visível (header fixo cobre o título em telas menores).
  const formRef = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    if (view !== 'contact') return;
    const el = formRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [view]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = validateSearchInput(brand, activity)
      ?? (collectContact ? validateContactInput(brandStage, BRAND_STAGES) : null);
    if (err) {
      setLocalError(err.message);
      return;
    }
    // Segunda tela (desenho do cliente, 31/10): contato antes de disparar a busca.
    if (collectContact && view === 'search') {
      setLocalError(null);
      setView('contact');
      return;
    }
    if (collectContact) {
      const contactErr = validateLeadInput(fullName, phone, email);
      if (contactErr) {
        setLocalError(contactErr.message);
        return;
      }
    }
    setLocalError(null);
    void startSearch(brand, activity, collectContact ? { brandStage, fullName, phone, email } : undefined);
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
            {variant === 'landing' && !(collectContact && view === 'contact') ? (
              <>
                <div className="hidden md:flex justify-center mb-4">
                  <span className="badge-consulta">
                    <Zap className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Consulta Gratuita
                  </span>
                </div>
                <h2 className="wm-home-consult-title font-display text-[1.9rem] sm:text-[2.15rem] leading-[1.05] font-bold text-center max-md:text-left text-[hsl(222_47%_11%)] mb-8 max-md:mb-2">
                  Consulte sua{' '}
                  <span className="text-[hsl(222_92%_54%)]">marca</span> grátis!
                </h2>
                <p className="flex md:hidden items-center gap-1.5 text-xs text-[hsl(215_16%_47%)] mb-6">
                  <Zap className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Pesquisa exata na base oficial do INPI.
                </p>
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
                  {collectContact && (
                    <div>
                      <label htmlFor={`${idPrefix}Stage`} className="form-label-caps">Estágio atual da marca</label>
                      <select
                        id={`${idPrefix}Stage`}
                        value={brandStage}
                        onChange={(e) => setBrandStage(e.target.value)}
                        className={`form-pill-input${brandStage ? '' : ' text-muted-foreground'}`}
                      >
                        <option value="" disabled>{BRAND_STAGE_PLACEHOLDER}</option>
                        {BRAND_STAGES.map((stage) => (
                          <option key={stage} value={stage}>{stage}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {localError && <p className="text-sm text-destructive text-center" role="alert">{localError}</p>}
                  <button type="submit" className="btn-cta-solid mt-2">
                    Consultar Viabilidade
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-1 text-center text-[13px] leading-5 text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-foreground">
                      <Lock aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-success" />
                      100% Seguro
                    </span>
                    <span aria-hidden="true" className="opacity-40">·</span>
                    <a href="/privacidade" className="underline underline-offset-2 hover:text-primary">Política de privacidade</a>
                  </div>
                </form>
              </>
            ) : collectContact && view === 'contact' ? (
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-6" noValidate>
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold leading-tight">Pronto, falta só esses <span className="text-[#16a34a]">dados!</span></h2>
                  <p className="text-sm text-muted-foreground">Assim vamos enviar o laudo pelo seu WhatsApp e e-mail.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}Name`} className="text-sm font-semibold">Nome <span className="text-destructive">*</span></Label>
                    <Input
                      id={`${idPrefix}Name`}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="h-12 text-base"
                      maxLength={100}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}Phone`} className="text-sm font-semibold">WhatsApp <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <WhatsAppIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                      <Input
                        id={`${idPrefix}Phone`}
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        placeholder="Ex: (11) 91112-0225"
                        className="h-12 text-base"
                        style={{ paddingLeft: '2.5rem' }}
                        maxLength={15}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}Email`} className="text-sm font-semibold">E-mail <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                      <Input
                        id={`${idPrefix}Email`}
                        type="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Ex: seu@email.com"
                        className="h-12 text-base"
                        style={{ paddingLeft: '2.5rem' }}
                        maxLength={160}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>
                {localError && <p className="text-sm text-destructive" role="alert">{localError}</p>}
                <Button type="submit" className="w-full h-12 rounded-xl font-bold text-base">
                  Receber meu laudo agora<ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <p className="inline-flex w-full items-center justify-center gap-1.5 text-center text-[13px] leading-5 text-muted-foreground">
                  <Lock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0">Consulta gratuita e sem compromisso</span>
                </p>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold leading-tight">{formTitle ?? "Consulte a disponibilidade da sua marca"}</h2>
                  <p className="text-sm text-muted-foreground">Pesquisa exata na base oficial do INPI.</p>
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
                  {collectContact && (
                    <div className="space-y-2">
                      <Label htmlFor={`${idPrefix}Stage`} className="text-sm font-semibold">Estágio atual da marca <span className="text-destructive">*</span></Label>
                      <select
                        id={`${idPrefix}Stage`}
                        value={brandStage}
                        onChange={(e) => setBrandStage(e.target.value)}
                        className={`flex h-12 w-full rounded-md border border-input bg-background pl-3 pr-8 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${brandStage ? '' : 'text-muted-foreground'}`}
                      >
                        <option value="" disabled>{BRAND_STAGE_PLACEHOLDER}</option>
                        {BRAND_STAGES.map((stage) => (
                          <option key={stage} value={stage}>{stage}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {localError && <p className="text-sm text-destructive" role="alert">{localError}</p>}
                <Button type="submit" className="w-full h-12 rounded-xl font-bold text-base">
                  Consultar no INPI<ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <p className="inline-flex w-full items-center justify-center gap-1.5 text-center text-[13px] leading-5 text-muted-foreground">
                  <Lock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0">Consulta gratuita e sem compromisso</span>
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
            onRetryPdf={() => void retryPdf()}
            pdfRetrying={pdfRetrying}
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
