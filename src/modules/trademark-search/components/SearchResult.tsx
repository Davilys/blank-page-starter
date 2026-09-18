import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, AlertTriangle, HelpCircle, FileDown, ExternalLink, MessageCircle,
  ChevronDown, ChevronUp, Search, ArrowRight, RotateCcw, Shield, FileText,
  CalendarDays, Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TrademarkSearchJob, TrademarkRecord } from '../types';
import { buildWhatsAppUrl } from './SearchError';

type Tone = 'success' | 'warning' | 'neutral';

interface ConclusionView {
  tone: Tone;
  title: string;
  description: string;
  icon: typeof CheckCircle2;
}

function conclusionView(job: TrademarkSearchJob, brand: string): ConclusionView {
  const analysis = job.result?.activity_analysis;
  if (job.status === 'completed' && analysis) {
    const hasRelated = analysis.counts.related > 0;
    const hasPending = analysis.counts.pending > 0;
    return {
      tone: hasRelated || hasPending ? 'warning' : 'success',
      title: hasRelated ? 'Ocorrências potencialmente relacionadas à sua atividade' : hasPending ? 'Há ocorrências que precisam de conferência' : 'Nenhuma ocorrência relevante encontrada',
      description: analysis.message + ' Antes do protocolo, a WebMarcas realizará a conferência técnica. A consulta não garante registro.',
      icon: hasRelated || hasPending ? AlertTriangle : CheckCircle2,
    };
  }
  const conclusion = job.result?.conclusion;
  if (job.status === 'completed' && conclusion === 'no_matches_in_searched_terms') {
    return {
      tone: 'success',
      title: 'Nenhum registro encontrado nos termos pesquisados',
      description: `A busca exata e radical por "${brand}" na base do INPI não retornou processos nos termos consultados. Isso indica um cenário favorável, mas a análise final de colidência e classe é feita pela equipe jurídica antes do protocolo.`,
      icon: CheckCircle2,
    };
  }
  if (job.status === 'completed' && conclusion === 'requires_legal_review') {
    return {
      tone: 'warning',
      title: 'Foram encontrados registros semelhantes',
      description: `Existem processos na base do INPI relacionados a "${brand}". Isso não significa que o registro é impossível: a análise jurídica avalia classe, atividade e grau de semelhança para definir a melhor estratégia.`,
      icon: AlertTriangle,
    };
  }
  return {
    tone: 'neutral',
    title: 'Consulta concluída sem conclusão automática',
    description: 'A base do INPI respondeu, mas os dados retornados não permitem uma conclusão automática segura. Nenhum resultado foi inventado — recomendamos a análise da equipe WebMarcas.',
    icon: HelpCircle,
  };
}

const toneClasses: Record<Tone, { box: string; icon: string; iconBox: string; badge: string; count: string }> = {
  success: { box: 'border-success/25 bg-success/5', icon: 'text-success-foreground', iconBox: 'bg-success text-success-foreground shadow-[0_0_0_8px_hsl(var(--success)/0.10)]', badge: 'bg-primary/10 text-primary border-primary/10', count: 'bg-success/10 text-success' },
  warning: { box: 'border-accent/35 bg-accent/5', icon: 'text-accent-foreground', iconBox: 'bg-accent text-accent-foreground', badge: 'bg-accent/10 text-accent border-accent/20', count: 'bg-accent/10 text-accent' },
  neutral: { box: 'border-border bg-muted/30', icon: 'text-primary-foreground', iconBox: 'bg-primary', badge: 'bg-muted text-muted-foreground border-border', count: 'bg-muted text-foreground' },
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSearchMode(mode: string): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
}

function RecordRow({ r }: { r: TrademarkRecord }) {
  return (
    <li className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr] gap-1 sm:gap-3 px-3 py-2.5 text-xs border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <p className="font-semibold text-foreground break-words">{r.brand || '—'}</p>
        <p className="text-muted-foreground break-words">{r.holder || 'Titular não informado'}</p>
      </div>
      <div className="text-muted-foreground">
        <p><span className="font-medium text-foreground">Processo:</span> {r.process || '—'}</p>
        {r.nice && <p><span className="font-medium text-foreground">Classe:</span> {r.nice}</p>}
      </div>
      <div className="flex items-center justify-between sm:justify-start gap-2 text-muted-foreground">
        <span className="break-words">{r.status || '—'}</span>
        {r.source_url && (
          <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline shrink-0" aria-label={`Abrir processo ${r.process} no INPI`}>
            INPI <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </li>
  );
}

export function SearchResult({ job, brandName, businessArea, onNewSearch, onContinue, continueLabel = 'Continuar o registro' }: {
  job: TrademarkSearchJob;
  brandName: string;
  businessArea: string;
  onNewSearch: () => void;
  onContinue?: () => void;
  continueLabel?: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const view = conclusionView(job, brandName);
  const tone = toneClasses[view.tone];
  const Icon = view.icon;
  const result = job.result;
  const searches = result?.searches ?? [];
  const analysis = result?.activity_analysis;
  const totalRecords = result?.records?.length ?? searches.reduce((acc, s) => acc + s.records.length, 0);
  const queriedAt = formatDate(result?.queried_at ?? null);
  const [queriedDate, queriedTime] = queriedAt?.split(', ') ?? ['—', ''];
  const searchType = searches.length > 0
    ? searches.map((search) => formatSearchMode(search.mode)).join(' + ')
    : '—';

  const hasOccurrences = job.status === 'completed' && (analysis ? analysis.counts.related + analysis.counts.pending > 0 : result?.conclusion === 'requires_legal_review');
  // Regra aprovada: ocorrências encontradas => CTA principal "Solicitar análise" (WhatsApp), não "registre agora".
  const whatsappMessage = hasOccurrences
    ? `Olá! Fiz a consulta da marca ${brandName} e foram encontradas ocorrências. Gostaria de solicitar uma análise técnica.`
    : `Olá! Consultei a marca ${brandName} (${businessArea}) no site da WebMarcas e quero uma análise da equipe. Protocolo da consulta: ${job.job_id}.`;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 space-y-5 text-foreground">
      {/* Status / situation card */}
      <section className={cn('relative overflow-hidden rounded-2xl border p-4 sm:p-5', tone.box)} aria-labelledby="search-result-title">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full', tone.iconBox)}>
            <Icon className={cn('h-6 w-6', tone.icon)} strokeWidth={2.6} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h2 id="search-result-title" className="text-base font-black leading-tight sm:text-lg">
                {view.tone === 'success' ? 'Nenhuma ocorrência relevante encontrada' : view.title}
              </h2>
              <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider', tone.badge)}>
                Base oficial INPI
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3 space-y-1.5 sm:ml-[3.25rem]">
          {view.tone === 'success' ? (
            <>
              <p className="text-sm font-semibold leading-relaxed">Não identificamos ocorrência potencialmente conflitante nesta triagem preliminar.</p>
              <p className="text-[13px] leading-relaxed text-muted-foreground">A análise técnica da WebMarcas realizará a conferência antes do protocolo. A consulta não garante registro.</p>
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted-foreground sm:text-sm">{view.description}</p>
          )}
        </div>
      </section>

      {/* Summary cards */}
      <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label="Resumo da consulta">
        <div className="flex min-w-0 gap-2.5 rounded-2xl border border-border bg-card p-2.5 shadow-sm">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase leading-snug text-muted-foreground">Registros encontrados</p>
            <p className="mt-0.5 text-base font-black leading-none">{totalRecords}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{totalRecords === 1 ? 'registro' : 'registros'}</p>
          </div>
        </div>
        <div className="flex min-w-0 gap-2.5 rounded-2xl border border-border bg-card p-2.5 shadow-sm">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Search className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase leading-snug text-muted-foreground">Tipo de busca</p>
            <p className="mt-1 overflow-wrap-anywhere text-sm font-bold leading-snug">{searchType}</p>
          </div>
        </div>
        <div className="col-span-2 flex min-w-0 gap-2.5 rounded-2xl border border-border bg-card p-2.5 shadow-sm sm:col-span-1">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase leading-snug text-muted-foreground">Consultado em</p>
            <p className="mt-0.5 text-sm font-black leading-snug">{queriedDate}</p>
            {queriedTime && <p className="text-sm font-semibold text-muted-foreground">{queriedTime}</p>}
          </div>
        </div>
      </div>

      {analysis && (
        <section aria-labelledby="analysis-summary-title" className="space-y-3">
          <div>
            <h2 id="analysis-summary-title" className="text-xl font-black leading-tight">Resumo da análise</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Confira os detalhes de cada segmento da triagem preliminar.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card px-4 shadow-sm">
          {(['related', 'pending', 'other'] as const).map((group, index) => {
            const label = {related: 'Potencialmente relacionados', pending: 'Necessitam conferência', other: 'Outros segmentos'}[group];
            const selected = analysis.items.filter(i => i.group === group);
            return <details key={group} className={cn('group', index > 0 && 'border-t border-border')}>
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
                <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full', selected.length ? 'bg-accent/10 text-accent' : 'bg-success text-success-foreground')}>
                  {selected.length ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold leading-snug sm:text-base">{label}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{selected.length ? `${selected.length} ${selected.length === 1 ? 'ocorrência neste grupo.' : 'ocorrências neste grupo.'}` : 'Nenhuma ocorrência neste grupo.'}</span>
                </span>
                <span className={cn('grid h-10 min-w-10 shrink-0 place-items-center rounded-full px-2 text-sm font-black', tone.count)}>{selected.length}</span>
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-border pb-3 pt-2">
              {group === 'other' && <p className="px-2 pb-2 text-xs leading-relaxed text-muted-foreground">Não são impedimentos automáticos. Esta separação preliminar não exclui juridicamente conflito ou proteção especial.</p>}
              {!selected.length ? <p className="px-2 py-2 text-sm text-muted-foreground">{group === 'related' && analysis.counts.pending ? 'Sem ocorrência confirmada neste grupo; há pendências de conferência.' : 'Nenhuma ocorrência neste grupo.'}</p> :
                <ul className="max-h-96 overflow-y-auto">{selected.map(item => {
                  const record = result?.records.find(r => r.process === item.process);
                  if (!record) return null;
                  return <li key={item.process} className="border-b border-border last:border-0">
                    <ul><RecordRow r={record} /></ul>
                    {item.specification && <p className="px-3 pb-2 text-xs break-words"><strong>Especificação oficial:</strong> {item.specification}</p>}
                    <p className="px-3 pb-3 text-xs text-muted-foreground">{item.reason}</p>
                  </li>;
                })}</ul>}
              </div>
            </details>;
          })}
          </div>
        </section>
      )}
      {searches.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm" aria-labelledby="traceability-title">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Link2 className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 id="traceability-title" className="text-lg font-black">Rastreabilidade</h2>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">Todas as buscas e correspondências textuais desta consulta.</p>
            </div>
          </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          {searches.map((s) => {
            const key = `${s.mode}:${s.term}`;
            const open = !!expanded[key];
            return (
              <div key={key} className="border-b border-border last:border-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setExpanded((p) => ({ ...p, [key]: !open }))}
                  className="h-auto min-h-16 w-full justify-start rounded-none px-3 py-3 text-left hover:bg-muted/40"
                  aria-expanded={open}
                >
                  <Search className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1 whitespace-normal">
                    <span className="block text-sm font-extrabold capitalize">Busca {s.mode}</span>
                    <span className="mt-0.5 block break-words text-xs font-normal text-muted-foreground">“{s.term}”</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold">{s.total} {s.total === 1 ? 'registro' : 'registros'}</span>
                    {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </Button>
                {open && s.records.length > 0 && (
                  <ul className="border-t border-border bg-background/60 max-h-72 overflow-y-auto">
                    {s.records.map((r, i) => <RecordRow key={`${r.process}-${i}`} r={r} />)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        </section>
      )}

      {analysis && (
        <details className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-muted-foreground">Informações técnicas da consulta</summary>
          <div className="space-y-2 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            <p>{analysis.limitation}</p>
            <p>Total textual preservado: {totalRecords}.</p>
            <p>Classes de foco preliminar: {analysis.focus_classes.join(', ') || 'ramo a esclarecer'}.</p>
          </div>
        </details>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {hasOccurrences ? (
          <Button asChild className="col-span-2 min-h-14 rounded-[14px] text-base font-extrabold shadow-lg shadow-primary/20">
            <a href={buildWhatsAppUrl(whatsappMessage)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4 mr-2" />Solicitar análise
            </a>
          </Button>
        ) : (
          onContinue && (
            <Button onClick={onContinue} className="col-span-2 min-h-14 rounded-[14px] text-base font-extrabold shadow-lg shadow-primary/20">
              {continueLabel}<ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )
        )}
        {job.pdf_url && (
          <Button asChild variant="outline" className={cn('min-h-14 whitespace-normal rounded-[14px] px-2 text-center', hasOccurrences && !onContinue && 'col-span-2')}>
            <a href={job.pdf_url} target="_blank" rel="noopener noreferrer">
              <FileDown className="w-4 h-4 mr-2" />Baixar relatório (PDF)
            </a>
          </Button>
        )}
        {hasOccurrences ? (
          onContinue && (
            <Button variant="outline" onClick={onContinue} className={cn('min-h-14 whitespace-normal rounded-[14px] px-2 text-center', !job.pdf_url && 'col-span-2')}>
              {continueLabel}<ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )
        ) : (
          <Button asChild variant="outline" className={cn('min-h-14 whitespace-normal rounded-[14px] px-2 text-center', !job.pdf_url && 'col-span-2')}>
            <a href={buildWhatsAppUrl(whatsappMessage)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4 mr-2" />Falar com a equipe
            </a>
          </Button>
        )}
      </div>

      <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border px-1 pt-4 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-start gap-2"><Shield className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0">Protocolo da consulta:<span className="block break-all font-mono text-[11px]">{job.job_id}</span></span></span>
        <Button type="button" variant="ghost" onClick={onNewSearch} className="h-11 shrink-0 px-2 text-primary">
          <RotateCcw className="h-4 w-4" />Nova consulta
        </Button>
      </div>
    </motion.div>
  );
}
