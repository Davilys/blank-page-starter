import { useCallback, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { runConsultorIaSearch, type ConsultorIaSearchOk } from '@/lib/api/consultorIaSearch';
import { cn } from '@/lib/utils';

type Phase =
  | { kind: 'form' }
  | { kind: 'loading'; brand: string; activity: string }
  | { kind: 'result'; data: ConsultorIaSearchOk }
  | { kind: 'error'; message: string; brand: string; activity: string };

function pdfFileName(brand: string): string {
  const slug = brand
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'marca';
  return `laudo-viabilidade-${slug}.pdf`;
}

function downloadPdf(pdfBase64: string, brand: string) {
  const bin = atob(pdfBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFileName(brand);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ConsultorIaSearch() {
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const [brand, setBrand] = useState('');
  const [activity, setActivity] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const handleSubmit = useCallback(async () => {
    const b = brand.replace(/\s+/g, ' ').trim();
    const a = activity.replace(/\s+/g, ' ').trim();
    if (b.length < 2 || !a) {
      setFormError('Preencha o nome da marca e o ramo de atividade.');
      return;
    }
    setFormError(null);
    const seq = ++requestSeq.current;
    setPhase({ kind: 'loading', brand: b, activity: a });
    const result = await runConsultorIaSearch(b, a);
    if (seq !== requestSeq.current) return; // busca mais nova já disparada
    if (result.ok === false) {
      setPhase({ kind: 'error', message: result.error.message, brand: b, activity: a });
      return;
    }
    setPhase({ kind: 'result', data: result });
  }, [brand, activity]);

  const resetToForm = useCallback(() => {
    requestSeq.current += 1;
    setBrand('');
    setActivity('');
    setFormError(null);
    setPhase({ kind: 'form' });
  }, []);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <AnimatePresence mode="wait">
        {phase.kind === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10 sm:px-6"
          >
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/15 bg-card text-primary shadow-[0_16px_36px_-20px_hsl(var(--primary)/0.65)]">
                <Search className="h-8 w-8" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Busca de Viabilidade</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
                Consulte a viabilidade da marca usando apenas o nome e o ramo de atividade. O laudo oficial é gerado em PDF na hora.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="cia-brand">Nome da marca</Label>
                  <Input
                    id="cia-brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Ex.: Madoiselle"
                    maxLength={120}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cia-activity">Ramo de atividade</Label>
                  <Input
                    id="cia-activity"
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    placeholder="Ex.: Loja de maquiagem, roupas e acessórios"
                    maxLength={200}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                </div>
                {formError && (
                  <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    {formError}
                  </p>
                )}
                <Button id="cia-submit" type="button" size="lg" className="w-full gap-2" onClick={handleSubmit}>
                  <Search className="h-5 w-5" aria-hidden="true" />
                  Buscar viabilidade
                </Button>
                <p className="text-center text-xs leading-5 text-muted-foreground">
                  A consulta usa a base pública do INPI e gera o laudo no modelo oficial aprovado. Se o ramo não tiver classificação aprovada, o laudo não é emitido.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {phase.kind === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
          >
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold text-foreground">Consultando a base do INPI…</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {phase.brand} · {phase.activity}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Isso pode levar alguns segundos. O laudo é gerado no modelo oficial.</p>
            </div>
          </motion.div>
        )}

        {phase.kind === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
          >
            <AlertTriangle className="h-12 w-12 text-destructive" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold text-foreground">Não foi possível concluir a consulta</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{phase.message}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button type="button" onClick={handleSubmit} className="gap-2">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Tentar novamente
              </Button>
              <Button type="button" variant="outline" onClick={resetToForm} className="gap-2">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Nova busca
              </Button>
            </div>
          </motion.div>
        )}

        {phase.kind === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10 sm:px-6"
          >
            {phase.data.modelIncomplete ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 sm:p-8">
                <div className="flex flex-col items-start gap-4 sm:flex-row">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                    <ShieldAlert className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Laudo não disponível para este ramo</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      A consulta de <strong className="text-foreground">{phase.data.brand}</strong> ({phase.data.activity}) foi registrada, mas este ramo de atividade ainda não tem a classificação aprovada. Nenhum laudo é emitido ou enviado fora do modelo oficial — a equipe confirma as classes antes de liberar.
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={resetToForm} className="gap-2">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Nova busca
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div
                  className={cn(
                    'rounded-2xl border p-6 sm:p-8',
                    phase.data.total === 0
                      ? 'border-border bg-muted/40'
                      : 'border-amber-500/25 bg-amber-500/5',
                  )}
                >
                  <div className="flex flex-col items-start gap-4 sm:flex-row">
                    <div
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                        phase.data.total === 0 ? 'bg-primary/10 text-primary' : 'bg-amber-500/15 text-amber-600',
                      )}
                    >
                      {phase.data.total === 0 ? (
                        <Search className="h-6 w-6" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold text-foreground">
                        {phase.data.total === 0 ? 'Nenhum registro com nome exato' : `${phase.data.total} registro${phase.data.total === 1 ? '' : 's'} encontrado${phase.data.total === 1 ? '' : 's'}`}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {phase.data.total === 0 ? (
                          <>
                            Não encontramos nenhum registro com o nome exato <strong className="text-foreground">{phase.data.brand}</strong> na base pública do INPI para o ramo informado. A busca é exata e não cobre nomes semelhantes{phase.data.baseUpdatedAt ? `; a base informa atualização em ${phase.data.baseUpdatedAt} e pedidos recentes podem não constar` : ''}. Isso não confirma a disponibilidade nem garante o registro da marca no INPI. O detalhamento está no laudo oficial.
                          </>
                        ) : (
                          <>
                            Encontramos registros com o nome exato de <strong className="text-foreground">{phase.data.brand}</strong>{phase.data.baseUpdatedAt ? ` (base com atualização informada em ${phase.data.baseUpdatedAt})` : ''}. Isso não significa, por si só, impedimento nem garante o registro: a análise de colidência e classe é da equipe WebMarcas. Confira os principais abaixo e o detalhamento completo no laudo oficial.
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {phase.data.records.length > 0 && (
                    <ul className="mt-5 space-y-2">
                      {phase.data.records.slice(0, 5).map((r) => (
                        <li
                          key={`${r.process}-${r.brand}`}
                          className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="min-w-0">
                            <span className="font-semibold text-foreground">{r.brand}</span>
                            {r.holder && <span className="text-muted-foreground"> · {r.holder}</span>}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {r.process && <>Proc. {r.process}</>}
                            {r.nice && <> · Cl. {r.nice}</>}
                            {r.status && <> · {r.status}</>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
                  <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileText className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-foreground">Laudo oficial em PDF</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {phase.data.pdfBase64
                          ? 'Modelo oficial aprovado, com classes, análise e avisos. Pronto para baixar.'
                          : phase.data.pdfFailed
                            ? 'O laudo não pôde ser gerado agora. Tente novamente em instantes.'
                            : 'Laudo indisponível para esta consulta.'}
                      </p>
                    </div>
                    {phase.data.pdfBase64 && (
                      <Button type="button" className="gap-2" onClick={() => downloadPdf(phase.data.pdfBase64!, phase.data.brand)}>
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Baixar laudo (PDF)
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button type="button" variant="outline" onClick={resetToForm} className="gap-2">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Nova busca
                  </Button>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Consulta registrada · laudo no modelo oficial
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ConsultorIaSearch;
