import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Lock, Send, Database, ScanSearch, ShieldCheck, FileText, Flag, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SearchPhase } from '../types';

/**
 * Etapas exibidas correspondem a ações reais do fluxo:
 *  preparing -> validação local | sending -> chamada à função segura | queued -> aguardando na base do INPI
 *  running   -> busca exata e radical em execução | validating -> normalização do retorno
 *  completed -> relatório recebido (PDF quando disponível) e consulta concluída
 */
const STEPS: { key: string; label: string; detail: string; icon: typeof Send; reachedAt: SearchPhase[] }[] = [
  { key: 'preparing', label: 'Preparando consulta', detail: 'Validando os termos informados', icon: Loader2, reachedAt: ['preparing', 'sending', 'queued', 'running', 'validating', 'completed'] },
  { key: 'sending', label: 'Enviando consulta segura', detail: 'Conexão criptografada com o servidor WebMarcas', icon: Send, reachedAt: ['sending', 'queued', 'running', 'validating', 'completed'] },
  { key: 'queued', label: 'Consultando a base do INPI', detail: 'Consulta registrada e aguardando processamento', icon: Database, reachedAt: ['queued', 'running', 'validating', 'completed'] },
  { key: 'running', label: 'Processando busca exata e radical', detail: 'Pesquisa textual em andamento na base oficial', icon: ScanSearch, reachedAt: ['running', 'validating', 'completed'] },
  { key: 'validating', label: 'Validando resultados', detail: 'Conferindo os dados retornados', icon: ShieldCheck, reachedAt: ['validating', 'completed'] },
  { key: 'report', label: 'Gerando relatório', detail: 'Relatório da consulta', icon: FileText, reachedAt: ['completed'] },
  { key: 'done', label: 'Consulta concluída', detail: '', icon: Flag, reachedAt: ['completed'] },
];

function currentIndex(phase: SearchPhase): number {
  const idx = STEPS.findIndex((s) => s.reachedAt[0] === phase);
  if (idx >= 0) return idx;
  if (phase === 'completed') return STEPS.length - 1;
  return 0;
}

export function SearchProgress({ brandName, phase, elapsedMs }: { brandName: string; phase: SearchPhase; elapsedMs: number }) {
  const active = currentIndex(phase);
  const ActiveIcon = STEPS[active].icon;
  const minutes = Math.floor(elapsedMs / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3 }}
      className="py-4 space-y-7"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex items-center justify-center w-32 h-32">
          <motion.div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30" animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} />
          <motion.div className="absolute inset-3 rounded-full border border-primary/50" animate={{ rotate: -360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} />
          <motion.div className="absolute inset-6 rounded-full bg-primary/5" animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
          <div className="relative z-10 flex flex-col items-center gap-1">
            <AnimatePresence mode="wait">
              <motion.div key={active} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.25 }}>
                <ActiveIcon className={cn('w-8 h-8 text-primary', STEPS[active].key === 'preparing' && 'animate-spin')} />
              </motion.div>
            </AnimatePresence>
            <span className="text-[11px] font-semibold text-primary tabular-nums">
              {minutes > 0 ? `${minutes}m ` : ''}{seconds}s
            </span>
          </div>
        </div>

        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Consultando</p>
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <motion.span className="w-1.5 h-1.5 rounded-full bg-primary" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1, repeat: Infinity }} />
            <span className="text-sm font-bold text-primary tracking-wider">{brandName.toUpperCase()}</span>
            <Lock className="w-3 h-3 text-primary/60" />
          </div>
        </div>
      </div>

      <ol className="space-y-2">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isDone = i < active;
          const isActive = i === active;
          return (
            <motion.li
              key={step.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: i <= active ? 1 : 0.35, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-500',
                isActive ? 'bg-primary/10 border-primary/30' : isDone ? 'bg-muted/30 border-border/30' : 'bg-muted/10 border-border/10',
              )}
            >
              <div className={cn('flex items-center justify-center w-7 h-7 rounded-lg shrink-0', isActive ? 'bg-primary/20' : isDone ? 'bg-muted/50' : 'bg-muted/20')}>
                {isDone ? <CheckCircle className="w-4 h-4 text-primary" /> : <Icon className={cn('w-4 h-4', isActive ? 'text-primary' : 'text-muted-foreground/40')} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold', isActive ? 'text-foreground' : isDone ? 'text-muted-foreground' : 'text-muted-foreground/40')}>{step.label}</p>
                {isActive && step.detail && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-muted-foreground mt-0.5">{step.detail}</motion.p>
                )}
              </div>
              {isActive && (
                <motion.div className="flex gap-0.5 shrink-0" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                  {[0, 1, 2].map((j) => (
                    <motion.div key={j} className="w-1 h-1 rounded-full bg-primary" animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: j * 0.15 }} />
                  ))}
                </motion.div>
              )}
            </motion.li>
          );
        })}
      </ol>

      <p className="text-center text-[11px] text-muted-foreground">
        A consulta na base do INPI pode levar alguns minutos. Você pode navegar pelo site; o resultado continua disponível.
      </p>

      <div className="flex items-center justify-center gap-2">
        <Lock className="w-3 h-3 text-muted-foreground/50" />
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Conexão criptografada • Base oficial INPI</p>
      </div>
    </motion.div>
  );
}
