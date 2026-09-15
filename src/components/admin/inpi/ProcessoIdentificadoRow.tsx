import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ChevronRight, UserPlus, AlertTriangle, CheckCircle2, Info, FileText,
  ShieldAlert, UserCog, CircleHelp,
} from 'lucide-react';
import {
  classifyDispatch, CATEGORY_TONE, PRIORITY_LABEL,
  type DispatchClassification,
} from '@/lib/rpi/classifyDispatch';

export interface RpiEntryLike {
  id: string;
  process_number: string;
  brand_name: string | null;
  holder_name: string | null;
  ncl_classes: string[] | null;
  dispatch_code: string | null;
  dispatch_type: string | null;
  dispatch_text: string | null;
  matched_client_id: string | null;
  relation_primary?: string | null;
  relation_types?: string[] | null;
  is_destituicao?: boolean | null;
  is_nomeacao?: boolean | null;
  is_substituicao?: boolean | null;
  needs_human_review?: boolean | null;
  review_reason?: string | null;
  match_candidates?: unknown;
  enrichment_status?: string | null;
  dispatches?: unknown;
  protocols?: unknown;
  client?: { full_name: string | null; email: string; company_name: string | null };
}

const TONE_CLASSES: Record<string, { badge: string; bar: string; icon: string }> = {
  red: { badge: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25', bar: 'bg-red-500', icon: 'text-red-600 dark:text-red-400' },
  orange: { badge: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/25', bar: 'bg-orange-500', icon: 'text-orange-600 dark:text-orange-400' },
  amber: { badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25', bar: 'bg-amber-500', icon: 'text-amber-600 dark:text-amber-400' },
  blue: { badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25', bar: 'bg-blue-500', icon: 'text-blue-600 dark:text-blue-400' },
  green: { badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25', bar: 'bg-emerald-500', icon: 'text-emerald-600 dark:text-emerald-400' },
  purple: { badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/25', bar: 'bg-violet-500', icon: 'text-violet-600 dark:text-violet-400' },
  gray: { badge: 'bg-muted text-muted-foreground border-border', bar: 'bg-muted-foreground/40', icon: 'text-muted-foreground' },
};

const RELATION_LABEL: Record<string, string> = {
  procurador_principal: 'Procurador atual',
  procurador_protocolo: 'Petição',
  procurador_nomeado: 'Nomeação',
  procurador_destituido: 'Destituição',
  procurador_substituido: 'Substituição',
  mencao_texto_complementar: 'Outra menção',
  outra_mencao: 'Outra menção',
};

export function classifyEntry(entry: RpiEntryLike): DispatchClassification {
  return classifyDispatch({
    dispatchCode: entry.dispatch_code,
    dispatchName: entry.dispatch_type,
    complementaryText: entry.dispatch_text,
    dispatches: entry.dispatches,
    protocols: entry.protocols,
    isDestituicao: !!entry.is_destituicao,
    isNomeacao: !!entry.is_nomeacao,
    isSubstituicao: !!entry.is_substituicao,
  });
}

export function entryDataState(entry: RpiEntryLike): 'conferidos' | 'parciais' | 'revisao' {
  if (entry.needs_human_review) return 'revisao';
  if (!entry.brand_name || !entry.holder_name || !entry.dispatch_code) return 'parciais';
  return 'conferidos';
}

function hasCandidates(entry: RpiEntryLike): boolean {
  const c = entry.match_candidates;
  if (Array.isArray(c)) return c.length > 0;
  if (typeof c === 'string') {
    try { const p = JSON.parse(c); return Array.isArray(p) && p.length > 0; } catch { return false; }
  }
  return false;
}

interface Props {
  entry: RpiEntryLike;
  expanded?: boolean;
  onOpen: (entry: RpiEntryLike) => void;
  onAssign: (entry: RpiEntryLike, e: React.MouseEvent) => void;
}

function ProcessoIdentificadoRowBase({ entry, expanded, onOpen, onAssign }: Props) {
  const cls = classifyEntry(entry);
  const tone = TONE_CLASSES[CATEGORY_TONE[cls.category]] ?? TONE_CLASSES.gray;
  const dataState = entryDataState(entry);
  const relation = entry.relation_primary ? RELATION_LABEL[entry.relation_primary] : null;
  const clientName = entry.client?.company_name || entry.client?.full_name || null;
  const emConferencia = !entry.matched_client_id && hasCandidates(entry);

  const PriorityIcon =
    cls.priority === 'critico' ? ShieldAlert
    : cls.priority === 'atencao' ? AlertTriangle
    : cls.priority === 'positivo' ? CheckCircle2
    : Info;

  const CategoryIcon = cls.category === 'procurador' ? UserCog : cls.category === 'nao_classificado' ? CircleHelp : FileText;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={`Ver processo ${entry.process_number}${entry.brand_name ? ` — ${entry.brand_name}` : ''}`}
      onClick={() => onOpen(entry)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(entry); }
      }}
      className={`relative flex flex-col gap-3 rounded-xl border bg-card p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors cursor-pointer
        hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        lg:grid lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1.3fr)_minmax(0,2fr)_minmax(0,1.2fr)_auto] lg:items-center lg:gap-5
        ${expanded ? 'border-primary/40 ring-1 ring-primary/10' : 'border-border'}`}
    >
      <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${tone.bar}`} aria-hidden="true" />

      {/* Bloco A — marca e processo */}
      <div className="min-w-0 pl-2">
        <div className="flex items-center gap-2 lg:hidden mb-1">
          <PriorityIcon className={`h-3.5 w-3.5 ${tone.icon}`} aria-hidden="true" />
          <span className="text-[11px] font-medium text-muted-foreground">{PRIORITY_LABEL[cls.priority]}</span>
        </div>
        <p className={`truncate font-semibold ${entry.brand_name ? 'text-foreground' : 'text-muted-foreground italic'}`}>
          {entry.brand_name || 'Aguardando identificação da marca'}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{entry.process_number}</code>
          {entry.ncl_classes && entry.ncl_classes.length > 0 && (
            <span className="text-[11px] text-muted-foreground">NCL {entry.ncl_classes.join(', ')}</span>
          )}
          {dataState === 'parciais' && (
            <Badge variant="outline" className="h-5 border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400">
              Dados incompletos
            </Badge>
          )}
          {dataState === 'revisao' && (
            <Badge variant="outline" className="h-5 border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-700 dark:text-violet-400">
              Revisão necessária
            </Badge>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {entry.holder_name || 'Titular não informado'}
          {relation ? ` · ${relation}` : ''}
        </p>
      </div>

      {/* Bloco B — despacho */}
      <div className="min-w-0 pl-2 lg:pl-0">
        <Badge variant="outline" className={`gap-1.5 whitespace-normal text-left text-[11px] font-medium ${tone.badge}`}>
          <CategoryIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
          {cls.dispatch_label}
        </Badge>
        {cls.dispatch_code && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">Código: {cls.dispatch_code}</p>
            </TooltipTrigger>
            <TooltipContent>
              {cls.dispatch_name_original || 'Código oficial do despacho publicado na RPI'}
            </TooltipContent>
          </Tooltip>
        )}
        <div className="mt-1 hidden items-center gap-1 lg:flex">
          <PriorityIcon className={`h-3.5 w-3.5 ${tone.icon}`} aria-hidden="true" />
          <span className="text-[11px] text-muted-foreground">{PRIORITY_LABEL[cls.priority]}</span>
        </div>
      </div>

      {/* Bloco C — resumo e próxima ação */}
      <div className="min-w-0 pl-2 lg:pl-0">
        <p className="line-clamp-2 text-xs text-muted-foreground">{cls.summary}</p>
        <p className="mt-1 text-[11px] font-medium text-foreground/80">Próxima ação: {cls.suggested_action}</p>
        {entry.is_destituicao && (
          <p className="mt-1 text-[11px] font-medium text-violet-700 dark:text-violet-400">
            Esta publicação informa a destituição de Davilys Danques de Oliveira Cunha.
          </p>
        )}
      </div>

      {/* Bloco D — vínculo */}
      <div className="pl-2 lg:pl-0" onClick={(e) => e.stopPropagation()}>
        {entry.matched_client_id ? (
          <div className="text-xs">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              Cliente vinculado
            </span>
            {clientName && <p className="mt-1 truncate text-[11px] text-muted-foreground">{clientName}</p>}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-1">
            <span className="text-[11px] text-muted-foreground">
              {emConferencia ? 'Vínculo em conferência' : 'Sem cliente vinculado'}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 rounded-lg border-primary/30 text-xs text-primary hover:bg-primary/10"
              onClick={(e) => { e.stopPropagation(); onAssign(entry, e); }}
            >
              <UserPlus className="h-3 w-3" aria-hidden="true" />
              {emConferencia ? 'Revisar vínculo' : 'Vincular cliente'}
            </Button>
          </div>
        )}
      </div>

      {/* Bloco E — abertura */}
      <div className="flex items-center justify-between gap-1 pl-2 text-muted-foreground lg:justify-end lg:pl-0">
        <span className="text-xs font-medium lg:inline">Ver processo</span>
        <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden="true" />
      </div>
    </div>
  );
}

export const ProcessoIdentificadoRow = memo(ProcessoIdentificadoRowBase);
