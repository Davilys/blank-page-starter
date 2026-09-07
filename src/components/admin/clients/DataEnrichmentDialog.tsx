/** Diálogo de atualização cadastral — compara CRM x fonte autorizada e atualiza só o que for marcado. */
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, RefreshCw, Search, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { enrichClient, resolveIdentifier } from '@/lib/dataEnrichment/enrichmentService';
import { buildComparison } from '@/lib/dataEnrichment/comparisonService';
import { buildMergePayload } from '@/lib/dataEnrichment/mergeService';
import type { ComparisonItem, CrmClientSnapshot, EnrichmentResult } from '@/lib/dataEnrichment/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: CrmClientSnapshot | null;
  onUpdated: () => void | Promise<void>;
  onEditRegistration?: () => void;
}

const GROUP_LABEL: Record<ComparisonItem['group'], string> = {
  pessoal: 'Dados pessoais',
  contato: 'Contatos',
  endereco: 'Endereço',
  empresa: 'Dados da empresa',
};

const STATUS_META: Record<ComparisonItem['status'], { label: string; cls: string }> = {
  unchanged: { label: '🟢 Sem alteração', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  updated: { label: '🟠 Dado atualizado encontrado', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  new: { label: '🔵 Novo dado encontrado', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
};

const maskDoc = (doc?: string | null) => {
  const d = (doc || '').replace(/\D/g, '');
  if (!d) return '—';
  return `${'•'.repeat(Math.max(0, d.length - 4))}${d.slice(-4)}`;
};

export function DataEnrichmentDialog({ open, onOpenChange, client, onUpdated, onEditRegistration }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<EnrichmentResult | null>(null);
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const identifier = client ? resolveIdentifier(client) : null;
  const docLabel = identifier?.value || '';

  const grouped = useMemo(() => {
    const map = new Map<ComparisonItem['group'], ComparisonItem[]>();
    for (const item of items) {
      const arr = map.get(item.group) || [];
      arr.push(item);
      map.set(item.group, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  const changeable = items.filter(i => i.status !== 'unchanged');

  const reset = () => {
    setResult(null);
    setItems([]);
    setSelected(new Set());
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSearch = async () => {
    if (!client || loading) return;
    setLoading(true);
    setResult(null);
    setItems([]);
    setSelected(new Set());
    try {
      const res = await enrichClient(client);
      setResult(res);
      if (res.status === 'success' && res.data) {
        const comparison = buildComparison(client, res.data);
        setItems(comparison);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (!client || selected.size === 0 || saving) return;
    setSaving(true);
    try {
      const { payload, updatedLabels } = buildMergePayload(client, items, selected);
      if (Object.keys(payload).length === 0) {
        toast.info('Nenhum dado novo para atualizar.');
        setSaving(false);
        return;
      }
      const { error } = await supabase.from('profiles').update(payload as never).eq('id', client.id);
      if (error) throw error;

      const { data: authData } = await supabase.auth.getUser();
      const { error: activityError } = await supabase.from('client_activities').insert({
        user_id: client.id,
        admin_id: authData?.user?.id ?? null,
        activity_type: 'atualizacao_cadastral',
        description: `Atualização cadastral realizada · Fonte: ${result?.source || 'BrasilAPI'}`,
        metadata: {
          source: result?.source || null,
          document_type: identifier?.type || null,
          documento: maskDoc(docLabel),
          fields_found: changeable.map(i => i.label),
          fields_updated: updatedLabels,
          user_id: authData?.user?.id ?? null,
          updated_at: new Date().toISOString(),
        },
      } as never);
      if (activityError) {
        toast.warning('Dados salvos, mas não foi possível registrar o histórico.');
        await onUpdated();
        handleClose(false);
        return;
      }

      toast.success('Dados atualizados com sucesso.');
      await onUpdated();
      handleClose(false);
    } catch {
      toast.error('Não foi possível salvar as alterações agora. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" /> Atualização cadastral
          </DialogTitle>
          <DialogDescription>
            Vamos verificar se existem dados cadastrais mais recentes.
          </DialogDescription>
        </DialogHeader>

        {/* Identificação */}
        <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-8 gap-1">
            <div>
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="text-sm font-semibold">{client?.full_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CPF/CNPJ</p>
              <p className="text-sm font-semibold font-mono">{docLabel || '—'}</p>
            </div>
          </div>
        </div>

        {!identifier ? (
          <div className="rounded-2xl border border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3">
            <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              Não foi possível realizar a consulta porque falta CPF ou CNPJ no cadastro.
            </p>
            {onEditRegistration && (
              <Button size="sm" variant="outline" onClick={() => { handleClose(false); onEditRegistration(); }}>
                Editar cadastro
              </Button>
            )}
          </div>
        ) : (
          <>
            {!result && (
              <Button onClick={handleSearch} disabled={loading} className="w-full sm:w-auto">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                {loading ? 'Consultando dados...' : 'Verificar dados atualizados'}
              </Button>
            )}

            {loading && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Consultando dados...</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
                </div>
              </div>
            )}

            {result && result.status !== 'success' && (
              <div className="rounded-2xl border border-border bg-muted/30 p-4 flex items-start gap-2">
                <AlertCircle className={`h-4 w-4 mt-0.5 shrink-0 ${['provider_error', 'timeout'].includes(result.status) ? 'text-destructive' : 'text-muted-foreground'}`} />
                <p className="text-sm whitespace-pre-line">{result.message || 'Nenhuma atualização cadastral encontrada.'}</p>
              </div>
            )}

            {result?.status === 'success' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold">Consulta concluída</span>
                  {result.source && <Badge variant="secondary" className="text-[11px]">{result.source}</Badge>}
                </div>

                {changeable.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma atualização cadastral encontrada.</p>
                ) : (
                  <div className="hidden sm:grid grid-cols-[1fr_1fr_auto] gap-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Cadastro atual</span>
                    <span>Dados encontrados</span>
                    <span>Ação</span>
                  </div>
                )}

                {grouped.map(([group, groupItems]) => (
                  <div key={group} className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{GROUP_LABEL[group]}</p>
                    {groupItems.map(item => (
                      <div key={item.key} className="rounded-2xl border border-border bg-card p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-sm font-medium">{item.label}</span>
                          <Badge className={`text-[10px] font-semibold border-0 ${STATUS_META[item.status].cls}`}>
                            {STATUS_META[item.status].label}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 sm:gap-3 sm:items-center">
                          <div>
                            <p className="text-[11px] text-muted-foreground sm:hidden">Cadastro atual</p>
                            <p className="text-sm break-words">{item.currentValue}</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <ArrowRight className="h-3.5 w-3.5 mt-1 text-muted-foreground hidden sm:block shrink-0" />
                            <div>
                              <p className="text-[11px] text-muted-foreground sm:hidden">Dados encontrados</p>
                              <p className="text-sm font-medium break-words">{item.foundValue}</p>
                            </div>
                          </div>
                          <div>
                            {item.status === 'unchanged' ? (
                              <span className="text-xs text-muted-foreground">Já cadastrado</span>
                            ) : (
                              <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={selected.has(item.key)}
                                  onCheckedChange={() => toggle(item.key)}
                                />
                                <span className="text-xs">
                                  {item.status === 'new' && (item.kind === 'phone' || item.kind === 'email')
                                    ? `Adicionar ${item.foundValue}`
                                    : 'Atualizar este dado'}
                                </span>
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <Separator />
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={selected.size === 0 || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Atualizar dados selecionados
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
