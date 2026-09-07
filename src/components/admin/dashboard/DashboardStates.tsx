import { AlertTriangle, Inbox } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type BlockStatus = 'loading' | 'ready' | 'empty' | 'error';

export function BlockSkeleton({ height = 220, rows = 3 }: { height?: number; rows?: number }) {
  return (
    <div className="space-y-3" style={{ minHeight: height }} aria-busy="true" aria-live="polite">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="w-full" style={{ height: height - 90 }} />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </div>
    </div>
  );
}

export function BlockEmpty({ message, hint, height = 200 }: { message: string; hint?: string; height?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center gap-2 px-4"
      style={{ minHeight: height }}
      role="status"
    >
      <Inbox className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{message}</p>
      {hint && <p className="text-xs text-muted-foreground max-w-xs">{hint}</p>}
    </div>
  );
}

export function BlockError({ message = 'Não foi possível carregar esta métrica.', onRetry, height = 200 }: {
  message?: string; onRetry?: () => void; height?: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 px-4" style={{ minHeight: height }} role="alert">
      <AlertTriangle className="h-8 w-8 text-amber-500/70" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 px-3 py-1 rounded-lg text-xs font-semibold text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

/** Valor que distingue "zero real" de "sem dados" */
export function MetricValue({ value, suffix = '', fallback = 'Sem dados suficientes', className }: {
  value: number | null; suffix?: string; fallback?: string; className?: string;
}) {
  if (value === null) {
    return <span className={cn('text-sm font-medium text-muted-foreground', className)}>—</span>;
  }
  return (
    <span className={className}>
      {value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}{suffix}
    </span>
  );
}

export function InfoTip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="cursor-help outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Aviso de qualidade de dado (ex.: muitos registros "Não informado") */
export function DataGapNote({ text }: { text: string }) {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}
