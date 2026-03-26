import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ArrowUp, ArrowDown, ArrowUpDown, Eye, ChevronLeft, ChevronRight, Newspaper } from 'lucide-react';
import type { Publicacao, PubStatus, SortKey, SortDir } from './types';
import { STATUS_CONFIG } from './types';

interface Props {
  paginatedData: Publicacao[];
  filtered: Publicacao[];
  processMap: Map<string, any>;
  clientMap: Map<string, any>;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  sortKey: SortKey;
  sortDir: SortDir;
  handleSort: (key: SortKey) => void;
  currentPage: number;
  totalPages: number;
  setCurrentPage: (p: number | ((prev: number) => number)) => void;
  sheetPubId: string | null;
  onRowClick: (id: string) => void;
}

export function PublicacaoListTable({
  paginatedData, filtered, processMap, clientMap, selectedIds, toggleSelect,
  toggleSelectAll, sortKey, sortDir, handleSort, currentPage, totalPages,
  setCurrentPage, sheetPubId, onRowClick,
}: Props) {
  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Newspaper className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm">Nenhuma publicação encontrada</p>
      </div>
    );
  }

  return (
    <Card className="border">
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-520px)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={paginatedData.length > 0 && selectedIds.size === paginatedData.length} onCheckedChange={toggleSelectAll} />
                </TableHead>
                {(['marca', 'cliente', 'status', 'data_pub', 'prazo'] as SortKey[]).map(key => {
                  const labels: Record<SortKey, string> = { marca: 'Marca', cliente: 'Cliente', status: 'Status', data_pub: 'Publicação', prazo: 'Prazo' };
                  return (
                    <TableHead key={key} className="cursor-pointer select-none text-xs" onClick={() => handleSort(key)}>
                      <div className="flex items-center gap-1">
                        {labels[key]}
                        {sortKey === key ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                      </div>
                    </TableHead>
                  );
                })}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map(pub => {
                const proc = pub.process_id ? processMap.get(pub.process_id) : null;
                const client = pub.client_id ? clientMap.get(pub.client_id) : null;
                const days = pub.proximo_prazo_critico ? differenceInDays(parseISO(pub.proximo_prazo_critico), new Date()) : null;
                const brandName = proc?.brand_name || pub.brand_name_rpi || '—';
                const processNumber = proc?.process_number || pub.process_number_rpi || null;
                return (
                  <TableRow key={pub.id} className={cn('cursor-pointer', sheetPubId === pub.id && 'bg-accent')} onClick={() => onRowClick(pub.id)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(pub.id)} onCheckedChange={() => toggleSelect(pub.id)} />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-xs font-bold">{brandName}</p>
                        <div className="flex items-center gap-1.5">
                          {processNumber && <span className="text-[10px] text-muted-foreground">{processNumber}</span>}
                          {(() => {
                            const nclClass = (pub as any).ncl_class || proc?.ncl_classes?.join(', ') || null;
                            return nclClass ? <span className="text-[9px] text-primary/70 font-medium">NCL {nclClass}</span> : null;
                          })()}
                          {/* Link indicator */}
                          {pub.client_id ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Vinculado" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" title="Órfã" />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {client?.full_name || <span className="text-amber-600 dark:text-amber-400 text-[10px]">Sem cliente</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-[10px]', STATUS_CONFIG[pub.status]?.bg, STATUS_CONFIG[pub.status]?.color)}>
                        {STATUS_CONFIG[pub.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">
                      {pub.data_publicacao_rpi ? format(parseISO(pub.data_publicacao_rpi), 'dd/MM/yy') : '—'}
                    </TableCell>
                    <TableCell>
                      {days !== null ? (
                        <span className={cn('text-[10px] font-semibold', days < 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-muted-foreground')}>
                          {days < 0 ? `${Math.abs(days)}d atrasado` : `${days}d`}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6"><Eye className="w-3 h-3" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t">
            <span className="text-[10px] text-muted-foreground">{filtered.length} processos</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={currentPage === 1} onClick={() => setCurrentPage((p: number) => p - 1)}>
                <ChevronLeft className="w-3 h-3" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, currentPage - 3), currentPage + 2).map(page => (
                <Button key={page} variant={currentPage === page ? 'default' : 'outline'} size="sm" className="h-7 w-7 px-0 text-[10px]" onClick={() => setCurrentPage(page)}>
                  {page}
                </Button>
              ))}
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p: number) => p + 1)}>
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
