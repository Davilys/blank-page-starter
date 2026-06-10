import { useMemo, useState } from 'react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, Clock, AlertTriangle, Archive, Search, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_CONFIG } from './types';

type Bucket = 'no_prazo' | '30dias' | 'ultima_semana' | 'vencidos';

interface PublicacaoPrazosProps {
  publicacoes: any[];
  processMap: Map<string, any>;
  clientMap: Map<string, any>;
  onOpenDetail?: (pubId: string) => void;
  initialBucket?: Bucket;
}

function computeDeadline(pub: any): string | null {
  if (pub.proximo_prazo_critico) return pub.proximo_prazo_critico;
  if (pub.data_publicacao_rpi) {
    return format(addDays(parseISO(pub.data_publicacao_rpi), 60), 'yyyy-MM-dd');
  }
  return null;
}

function bucketOf(days: number | null): Bucket | null {
  if (days === null) return null;
  if (days < 0) return 'vencidos';
  if (days <= 7) return 'ultima_semana';
  if (days <= 30) return '30dias';
  return 'no_prazo';
}

const BUCKETS: { id: Bucket; label: string; color: string; ring: string }[] = [
  { id: 'no_prazo', label: 'No Prazo', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40', ring: 'ring-emerald-500' },
  { id: '30dias', label: '30 Dias para Vencer', color: 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40', ring: 'ring-amber-500' },
  { id: 'ultima_semana', label: 'Última Semana', color: 'text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40', ring: 'ring-orange-500' },
  { id: 'vencidos', label: 'Vencidos', color: 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40', ring: 'ring-red-500' },
];

export function PublicacaoPrazos({ publicacoes, processMap, clientMap, onOpenDetail, initialBucket }: PublicacaoPrazosProps) {
  const [active, setActive] = useState<Bucket>(initialBucket || 'no_prazo');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  // Filter eligible publications (not certified/archived/cumprido)
  const eligible = useMemo(() => {
    return publicacoes
      .filter(p => p.status !== 'certificado' && p.status !== 'arquivado' && !p.cumprimento_ok)
      .map(p => {
        const deadline = computeDeadline(p);
        const days = deadline ? differenceInDays(parseISO(deadline), new Date()) : null;
        return { ...p, _deadline: deadline, _days: days, _bucket: bucketOf(days) };
      })
      .filter(p => p._bucket !== null);
  }, [publicacoes]);

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { no_prazo: 0, '30dias': 0, ultima_semana: 0, vencidos: 0 };
    eligible.forEach(p => { if (p._bucket) c[p._bucket as Bucket]++; });
    return c;
  }, [eligible]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return eligible
      .filter(p => p._bucket === active)
      .filter(p => {
        if (!term) return true;
        const proc = p.process_id ? processMap.get(p.process_id) : null;
        const client = p.client_id ? clientMap.get(p.client_id) : null;
        return (
          (proc?.brand_name || p.brand_name_rpi || '').toLowerCase().includes(term) ||
          (proc?.process_number || p.process_number_rpi || '').toLowerCase().includes(term) ||
          (client?.full_name || client?.email || '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => (a._days ?? 9999) - (b._days ?? 9999));
  }, [eligible, active, search, processMap, clientMap]);

  const handleConfirmCumprimento = async (pub: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('publicacoes_marcas')
      .update({
        cumprimento_ok: true,
        cumprimento_at: new Date().toISOString(),
        cumprimento_by: user?.id || null,
      } as any)
      .eq('id', pub.id);
    if (error) { toast.error('Erro ao confirmar cumprimento'); return; }
    toast.success('Cumprimento confirmado — saiu do controle de prazos');
    queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
  };

  const handleArchiveNow = async (pub: any) => {
    const now = new Date().toISOString();
    await supabase.from('publicacoes_marcas').update({
      status: 'arquivado',
      descricao_prazo: 'Arquivado por decurso de prazo',
      updated_at: now,
    } as any).eq('id', pub.id);
    if (pub.process_id) {
      await supabase.from('brand_processes').update({
        pipeline_stage: 'arquivado',
        status: 'arquivado',
        updated_at: now,
      } as any).eq('id', pub.process_id);
    }
    toast.success('Publicação arquivada');
    queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
    queryClient.invalidateQueries({ queryKey: ['brand-processes-pub'] });
  };

  return (
    <div className="space-y-4">
      {/* Bucket tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {BUCKETS.map(b => (
          <button
            key={b.id}
            onClick={() => setActive(b.id)}
            className={cn(
              'p-3 rounded-xl border text-left transition-all',
              active === b.id ? `ring-2 ${b.ring} border-transparent` : 'border-border hover:border-foreground/20'
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', b.color)}>{b.label}</span>
              <Badge variant="secondary" className="text-xs">{counts[b.id]}</Badge>
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar marca, processo ou cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-500px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Marca / Processo</TableHead>
                  <TableHead className="text-xs">Publicação RPI</TableHead>
                  <TableHead className="text-xs">Prazo Final</TableHead>
                  <TableHead className="text-xs">Dias Restantes</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12 text-sm">
                      Nenhuma publicação nesta faixa de prazo.
                    </TableCell>
                  </TableRow>
                ) : filtered.map(pub => {
                  const proc = pub.process_id ? processMap.get(pub.process_id) : null;
                  const client = pub.client_id ? clientMap.get(pub.client_id) : null;
                  const stCfg = STATUS_CONFIG[pub.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG['003'];
                  const days = pub._days as number | null;
                  const daysColor =
                    days === null ? 'text-muted-foreground' :
                    days < 0 ? 'text-red-600 dark:text-red-400 font-semibold' :
                    days <= 7 ? 'text-orange-600 dark:text-orange-400 font-semibold' :
                    days <= 30 ? 'text-amber-600 dark:text-amber-400 font-medium' :
                    'text-emerald-600 dark:text-emerald-400';
                  return (
                    <TableRow key={pub.id}>
                      <TableCell className="text-sm">
                        <div className="font-medium">{client?.full_name || client?.email || '—'}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{proc?.brand_name || pub.brand_name_rpi || '—'}</div>
                        <div className="text-xs text-muted-foreground">{proc?.process_number || pub.process_number_rpi || ''}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {pub.data_publicacao_rpi ? format(parseISO(pub.data_publicacao_rpi), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {pub._deadline ? format(parseISO(pub._deadline), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </TableCell>
                      <TableCell className={cn('text-sm', daysColor)}>
                        <div className="flex items-center gap-1.5">
                          {days !== null && days < 0 ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          {days === null ? '—' : days < 0 ? `${Math.abs(days)}d atrasado` : `${days}d restantes`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', stCfg.bg, stCfg.color)}>{stCfg.label}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {onOpenDetail && (
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onOpenDetail(pub.id)} title="Ver detalhe">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => handleConfirmCumprimento(pub)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Cumprido
                          </Button>
                          {active === 'vencidos' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs gap-1 border-red-500/40 text-red-700 dark:text-red-400 hover:bg-red-500/10"
                              onClick={() => handleArchiveNow(pub)}
                            >
                              <Archive className="w-3.5 h-3.5" /> Arquivar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}