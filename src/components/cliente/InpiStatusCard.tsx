import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ExternalLink, Globe, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { useClientProcessLookup } from '@/hooks/useClientProcessLookup';

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

interface Props {
  processNumber: string;
  controller: ReturnType<typeof useClientProcessLookup>;
}

/**
 * Quadro "Situação atual consultada no INPI" da área do cliente.
 * Espelha os campos oficiais do painel admin (Revista INPI), mas em modo
 * somente leitura: nunca preenche/vincula registros do CRM.
 */
export function InpiStatusCard({ processNumber, controller }: Props) {
  const state = controller.get(processNumber);
  const lookup = state.lookup;
  const when = formatWhen(lookup?.queried_at ?? null);

  return (
    <div className="rounded-xl border border-primary/25 bg-gradient-to-b from-primary/5 to-transparent p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Globe className="h-4 w-4" />
          Situação atual consultada no INPI
        </h4>
        <Button
          size="sm"
          className="h-8 gap-1.5 rounded-lg text-xs"
          disabled={state.loading}
          onClick={() => void controller.sync(processNumber, true)}
        >
          {state.loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Sincronizar com INPI
        </Button>
      </div>

      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {when ? (
          <>
            Última consulta: <span className="font-medium text-emerald-600">{when}</span>
            {' · '}
          </>
        ) : null}
        Atualiza sozinho toda vez que você entra na área do cliente
        {state.fromCache && lookup ? (
          <>
            {' · '}
            <Badge variant="outline" className="h-5 align-middle text-[10px]">
              Resultado reaproveitado
            </Badge>
          </>
        ) : null}
      </p>

      {state.loading && !lookup && (
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
              onClick={() => void controller.sync(processNumber, true)}
            >
              <RefreshCw className="h-3 w-3" />
              Tentar novamente
            </Button>
          )}
        </div>
      )}

      {lookup && (
        <div className="mt-3 space-y-3">
          {lookup.current_status && (
            <div className="rounded-lg border border-primary/15 bg-background p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                Situação atual
              </p>
              <p className="mt-0.5 text-sm font-semibold">{lookup.current_status}</p>
            </div>
          )}

          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <Row label="Marca (INPI)" value={lookup.brand_name} />
            <Row label="Titular (INPI)" value={lookup.holder} />
            <Row label="Classe NCL (oficial)" value={lookup.ncl_class} />
            <Row label="Apresentação" value={lookup.presentation} />
            <Row label="Natureza" value={lookup.nature} />
            <Row label="Procurador" value={lookup.legal_representative} />
            <Row label="Depósito" value={lookup.filing_date} />
            <Row label="Concessão" value={lookup.grant_date} />
            <Row label="Vigência" value={lookup.expiry_date} />
            {lookup.specification && (
              <div className="sm:col-span-2 rounded-lg bg-muted/60 px-3 py-2">
                <dt className="text-[11px] text-muted-foreground">Especificação</dt>
                <dd className="text-xs">{lookup.specification}</dd>
              </div>
            )}
          </dl>

          {lookup.detail_status === 'unavailable' && (
            <p className="text-[11px] text-muted-foreground">
              Dados principais consultados. Detalhes adicionais indisponíveis neste momento.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-0.5">
            {lookup.source_url && /^https?:\/\//i.test(lookup.source_url) && (
              <a
                href={lookup.source_url}
                target="_blank"
                rel="noopener noreferrer"
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
          Nenhuma consulta realizada para este processo ainda. Toque em "Sincronizar com INPI"
          para buscar a situação atual.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-xs font-medium">{value}</dd>
    </div>
  );
}
