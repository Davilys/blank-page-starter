import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ExternalLink, AlertTriangle, Globe, UserCheck, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProcessLookup, type LookupState } from '@/hooks/useProcessLookup';

export interface LookupEntryLike {
  id: string;
  process_number: string;
  brand_name: string | null;
  holder_name: string | null;
  ncl_classes: string[] | null;
}

const FIELD_LABEL: Record<string, string> = {
  brand_name: 'Marca',
  holder_name: 'Titular',
  ncl_classes: 'Classe NCL',
  situacao_atual: 'Situação atual',
  apresentacao: 'Apresentação',
  natureza: 'Natureza',
  attorney_name: 'Procurador',
  deposit_date: 'Data de depósito',
  concession_date: 'Data de concessão',
  validity_date: 'Data de vigência',
};

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function isIncomplete(entry: LookupEntryLike): boolean {
  return !entry.brand_name || !entry.holder_name || !entry.ncl_classes?.length;
}

interface Props {
  entry: LookupEntryLike;
  /** Chamado depois de uma consulta que efetivamente gravou campos no registro. */
  onApplied: (processNumber: string) => void;
  /** Estado compartilhado pela tela (um hook por página evita consultas duplicadas). */
  controller: ReturnType<typeof useProcessLookup>;
}

export function InpiLookupPanel({ entry, onApplied, controller }: Props) {
  const { get, ensure, refetch } = controller;
  const state: LookupState = get(entry.process_number);
  const [confirming, setConfirming] = useState<string | null>(null);

  const confirmCandidate = async (clientId: string) => {
    setConfirming(clientId);
    try {
      const { error } = await supabase
        .from('rpi_entries')
        .update({
          matched_client_id: clientId,
          linked_at: new Date().toISOString(),
          auto_link_source: 'confirmado_manual',
          updated_at: new Date().toISOString(),
        })
        .eq('id', entry.id)
        .is('matched_client_id', null);
      if (error) throw error;
      // nova consulta organiza a marca na ficha do cliente e o cartão da aba Publicação
      await refetch(entry.process_number, entry.id);
      toast.success('Cliente vinculado e ficha atualizada');
      onApplied(entry.process_number);
    } catch {
      toast.error('Não foi possível vincular o cliente agora.');
    } finally {
      setConfirming(null);
    }
  };

  useEffect(() => {
    if (isIncomplete(entry)) ensure(entry.process_number, entry.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id, entry.process_number]);

  useEffect(() => {
    if (state.saved && state.applied.length > 0) onApplied(entry.process_number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.saved, state.applied.length]);

  const lookup = state.lookup;
  const when = formatWhen(lookup?.queried_at ?? null);

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          Situação atual consultada no INPI
        </h4>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 rounded-lg text-xs"
          disabled={state.loading}
          onClick={(e) => {
            e.stopPropagation();
            void refetch(entry.process_number, entry.id);
          }}
        >
          {state.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Consultar novamente no INPI
        </Button>
      </div>

      {state.loading && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Consultando dados do processo no INPI…
        </p>
      )}

      {!state.loading && state.error && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {state.error.message}
          </p>
          {state.error.code !== 'not_found' && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 h-7 gap-1.5 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                void refetch(entry.process_number, entry.id);
              }}
            >
              <RefreshCw className="h-3 w-3" />
              Tentar novamente
            </Button>
          )}
        </div>
      )}

      {!state.loading && lookup && (
        <div className="mt-3 space-y-2">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <LookupRow label="Situação atual" value={lookup.current_status} />
            <LookupRow label="Marca (INPI)" value={lookup.brand_name} />
            <LookupRow label="Titular (INPI)" value={lookup.holder} />
            <LookupRow label="Classe NCL (oficial)" value={lookup.ncl_class} />
            <LookupRow label="Apresentação" value={lookup.presentation} />
            <LookupRow label="Natureza" value={lookup.nature} />
            <LookupRow label="Procurador" value={lookup.legal_representative} />
            <LookupRow label="Depósito" value={lookup.filing_date} />
            <LookupRow label="Concessão" value={lookup.grant_date} />
            <LookupRow label="Vigência" value={lookup.expiry_date} />
            <LookupRow label="Especificação" value={lookup.specification} />
          </dl>

          {state.divergences.length > 0 && (
            <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-2.5">
              <p className="text-[11px] font-medium text-blue-700 dark:text-blue-400">
                Dados oficiais diferentes do que já está gravado (mantivemos o valor atual):
              </p>
              <ul className="mt-1 space-y-0.5">
                {state.divergences.map((d) => (
                  <li key={d.field} className="text-[11px] text-muted-foreground">
                    {FIELD_LABEL[d.field] ?? d.field}: <span className="font-medium">{String(d.official)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.applied.length > 0 && state.saved && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
              Preenchido automaticamente: {state.applied.map((f) => FIELD_LABEL[f] ?? f).join(', ')}.
            </p>
          )}

          {lookup.detail_status === 'unavailable' && (
            <p className="text-[11px] text-muted-foreground">
              Dados principais consultados. Detalhes adicionais indisponíveis neste momento.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {when && <span className="text-[11px] text-muted-foreground">Consultado em {when}</span>}
            {state.fromCache && (
              <Badge variant="outline" className="h-5 text-[10px]">
                Resultado reaproveitado
              </Badge>
            )}
            {lookup.source_url && /^https?:\/\//i.test(lookup.source_url) && (
              <a
                href={lookup.source_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Ver no INPI
              </a>
            )}
          </div>
        </div>
      )}

      {!state.loading && !lookup && !state.error && (
        <p className="mt-3 text-xs text-muted-foreground">
          Nenhuma consulta realizada para este processo.
        </p>
      )}
    </div>
  );
}

function LookupRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-xs text-foreground">{value}</dd>
    </div>
  );
}
