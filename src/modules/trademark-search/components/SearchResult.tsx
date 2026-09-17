import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, AlertTriangle, HelpCircle, FileDown, ExternalLink, MessageCircle,
  ChevronDown, ChevronUp, Search, ArrowRight, RotateCcw, Shield,
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
    return {
      tone: analysis.counts.related ? 'warning' : 'neutral',
      title: analysis.counts.related ? 'Ocorrências potencialmente relacionadas à sua atividade' : analysis.counts.pending ? 'Há ocorrências que precisam de conferência' : 'Nenhuma ocorrência relevante identificada nesta triagem',
      description: analysis.message + ' Antes do protocolo, a WebMarcas realizará a conferência técnica. A consulta não garante registro.',
      icon: analysis.counts.related ? AlertTriangle : HelpCircle,
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

const toneClasses: Record<Tone, { box: string; icon: string; badge: string }> = {
  success: { box: 'border-primary/30 bg-primary/5', icon: 'text-primary', badge: 'bg-primary/10 text-primary border-primary/20' },
  warning: { box: 'border-accent/40 bg-accent/5', icon: 'text-accent', badge: 'bg-accent/10 text-accent border-accent/30' },
  neutral: { box: 'border-border bg-muted/30', icon: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground border-border' },
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function RecordRow({ r }: { r: TrademarkRecord }) {
  return (
    <li className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr] gap-1 sm:gap-3 px-3 py-2.5 text-xs border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <p className="font-semibold text-foreground truncate">{r.brand || '—'}</p>
        <p className="text-muted-foreground truncate">{r.holder || 'Titular não informado'}</p>
      </div>
      <div className="text-muted-foreground">
        <p><span className="font-medium text-foreground">Processo:</span> {r.process || '—'}</p>
        {r.nice && <p><span className="font-medium text-foreground">Classe:</span> {r.nice}</p>}
      </div>
      <div className="flex items-center justify-between sm:justify-start gap-2 text-muted-foreground">
        <span className="truncate">{r.status || '—'}</span>
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

  const hasOccurrences = job.status === 'completed' && (analysis ? analysis.counts.related + analysis.counts.pending > 0 : result?.conclusion === 'requires_legal_review');
  // Regra aprovada: ocorrências encontradas => CTA principal "Solicitar análise" (WhatsApp), não "registre agora".
  const whatsappMessage = hasOccurrences
    ? `Olá! Fiz a consulta da marca ${brandName} e foram encontradas ocorrências. Gostaria de solicitar uma análise técnica.`
    : `Olá! Consultei a marca ${brandName} (${businessArea}) no site da WebMarcas e quero uma análise da equipe. Protocolo da consulta: ${job.job_id}.`;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 text-foreground">
      <div className={cn('rounded-2xl border p-5 flex items-start gap-4', tone.box)}>
        <div className="p-2.5 rounded-xl bg-background border border-border/60 shrink-0">
          <Icon className={cn('w-6 h-6', tone.icon)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-base font-bold">{view.title}</h3>
            <span className={cn('text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border', tone.badge)}>
              Base oficial INPI
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{view.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Marca</p>
          <p className="text-sm font-bold truncate">{brandName}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{analysis ? 'Relacionadas à atividade' : 'Correspondências textuais'}</p>
          <p className="text-sm font-bold">{analysis ? analysis.counts.related : totalRecords}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Buscas</p>
          <p className="text-sm font-bold">{searches.length > 0 ? searches.map((s) => s.mode).join(' + ') : '—'}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Consultado em</p>
          <p className="text-sm font-bold">{queriedAt ?? '—'}</p>
        </div>
      </div>

      {analysis && (
        <section aria-label="Triagem por atividade" className="space-y-3">
          <p className="text-xs text-muted-foreground">{analysis.limitation}</p>
          {(['related', 'pending', 'other'] as const).map(group => {
            const label = {related: 'Potencialmente relacionadas', pending: 'Necessitam conferência — não descartadas', other: 'Outros segmentos — consultar resultados'}[group];
            const selected = analysis.items.filter(i => i.group === group);
            return <details key={group} open={group === 'related' || (group === 'pending' && !analysis.counts.related)} className="rounded-xl border border-border bg-card">
              <summary className="cursor-pointer p-3 text-sm font-semibold">{label}: {selected.length}</summary>
              {group === 'other' && <p className="px-3 text-xs text-muted-foreground">Não são impedimentos automáticos. Esta separação preliminar não exclui juridicamente conflito ou proteção especial.</p>}
              {!selected.length ? <p className="px-3 pb-3 text-xs text-muted-foreground">{group === 'related' && analysis.counts.pending ? 'Sem ocorrência confirmada neste grupo; há pendências de conferência.' : 'Nenhuma ocorrência neste grupo.'}</p> :
                <ul className="max-h-96 overflow-y-auto">{selected.map(item => {
                  const record = result!.records.find(r => r.process === item.process)!;
                  return <li key={item.process} className="border-t border-border">
                    <ul><RecordRow r={record} /></ul>
                    {item.specification && <p className="px-3 pb-2 text-xs break-words"><strong>Especificação oficial:</strong> {item.specification}</p>}
                    <p className="px-3 pb-3 text-xs text-muted-foreground">{item.reason}</p>
                  </li>;
                })}</ul>}
            </details>;
          })}
          <p className="text-xs text-muted-foreground">Total textual preservado: {totalRecords}. Classes de foco preliminar: {analysis.focus_classes.join(', ') || 'ramo a esclarecer'}.</p>
        </section>
      )}
      {searches.length > 0 && (
        <details className="rounded-xl border border-border p-3" open={!analysis}>
        <summary className="cursor-pointer text-sm font-medium">Rastreabilidade: todas as buscas e correspondências textuais</summary>
        <div className="space-y-2">
          {searches.map((s) => {
            const key = `${s.mode}:${s.term}`;
            const open = !!expanded[key];
            return (
              <div key={key} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded((p) => ({ ...p, [key]: !open }))}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
                  aria-expanded={open}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Search className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold capitalize">Busca {s.mode}</span>
                    <span className="text-xs text-muted-foreground truncate">“{s.term}”</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted">{s.total} {s.total === 1 ? 'registro' : 'registros'}</span>
                    {s.records.length > 0 && (open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
                  </div>
                </button>
                {open && s.records.length > 0 && (
                  <ul className="border-t border-border bg-background/60 max-h-72 overflow-y-auto">
                    {s.records.map((r, i) => <RecordRow key={`${r.process}-${i}`} r={r} />)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        </details>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {hasOccurrences ? (
          <Button asChild className="h-12 rounded-xl font-bold sm:col-span-2">
            <a href={buildWhatsAppUrl(whatsappMessage)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4 mr-2" />Solicitar análise
            </a>
          </Button>
        ) : (
          onContinue && (
            <Button onClick={onContinue} className="h-12 rounded-xl font-bold sm:col-span-2">
              {continueLabel}<ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )
        )}
        {job.pdf_url && (
          <Button asChild variant="outline" className={cn('h-11 rounded-xl', hasOccurrences && !onContinue && 'sm:col-span-2')}>
            <a href={job.pdf_url} target="_blank" rel="noopener noreferrer">
              <FileDown className="w-4 h-4 mr-2" />Baixar relatório (PDF)
            </a>
          </Button>
        )}
        {hasOccurrences ? (
          onContinue && (
            <Button variant="outline" onClick={onContinue} className={cn('h-11 rounded-xl', !job.pdf_url && 'sm:col-span-2')}>
              {continueLabel}<ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )
        ) : (
          <Button asChild variant="outline" className={cn('h-11 rounded-xl', !job.pdf_url && 'sm:col-span-2')}>
            <a href={buildWhatsAppUrl(whatsappMessage)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4 mr-2" />Falar com a equipe
            </a>
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Shield className="w-3 h-3" />Protocolo da consulta: <span className="font-mono">{job.job_id}</span></span>
        <button type="button" onClick={onNewSearch} className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground">
          <RotateCcw className="w-3 h-3" />Nova consulta
        </button>
      </div>
    </motion.div>
  );
}
