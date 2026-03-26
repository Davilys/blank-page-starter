import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Filter, Search, Plus, X, List, LayoutGrid, Newspaper } from 'lucide-react';
import type { ViewMode, SmartFilter } from './types';

interface Props {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  searchAutocomplete: string;
  setSearchAutocomplete: (v: string) => void;
  showSearchDropdown: boolean;
  setShowSearchDropdown: (v: boolean) => void;
  setSearch: (v: string) => void;
  filterClient: string;
  setFilterClient: (v: string) => void;
  filteredCount: number;
  hasActiveFilters: boolean;
  onOpenFilters: () => void;
  onCreateNew: () => void;
  clients: any[];
  processes: any[];
  smartFilter: SmartFilter;
  setSmartFilter: (v: SmartFilter) => void;
  orphanCount: number;
  incompleteCount: number;
  noPrazoCount: number;
}

export function PublicacaoToolbar({
  viewMode, setViewMode, searchAutocomplete, setSearchAutocomplete,
  showSearchDropdown, setShowSearchDropdown, setSearch, filterClient,
  setFilterClient, filteredCount, hasActiveFilters, onOpenFilters,
  onCreateNew, clients, processes, smartFilter, setSmartFilter,
  orphanCount, incompleteCount, noPrazoCount,
}: Props) {
  return (
    <div className="space-y-2 mb-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onOpenFilters}>
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="default" className="h-4 w-4 p-0 text-[9px] rounded-full flex items-center justify-center ml-0.5">!</Badge>
            )}
          </Button>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Newspaper className="w-4 h-4 text-primary" />
            Publicações
            <Badge variant="secondary" className="text-xs">{filteredCount}</Badge>
          </div>
          {/* Search autocomplete */}
          <div className="relative">
            <div className="flex items-center">
              <Search className="absolute left-2 w-3.5 h-3.5 text-muted-foreground z-10" />
              <Input
                className="h-8 w-48 pl-7 text-xs"
                placeholder="Buscar cliente, marca..."
                value={searchAutocomplete}
                onChange={e => { setSearchAutocomplete(e.target.value); setShowSearchDropdown(true); }}
                onFocus={() => { if (searchAutocomplete.length >= 2) setShowSearchDropdown(true); }}
                onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
              />
              {(searchAutocomplete || filterClient !== 'todos') && (
                <Button variant="ghost" size="icon" className="h-8 w-8 ml-1" onClick={() => { setSearchAutocomplete(''); setFilterClient('todos'); setSearch(''); setShowSearchDropdown(false); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            {showSearchDropdown && searchAutocomplete.length >= 2 && (
              <div className="absolute z-50 w-72 mt-1 bg-popover border rounded-md shadow-lg max-h-56 overflow-y-auto">
                {(() => {
                  const q = searchAutocomplete.toLowerCase();
                  const matchedClients = clients.filter((c: any) => (c.full_name?.toLowerCase().includes(q)) || (c.email?.toLowerCase().includes(q))).slice(0, 6);
                  const matchedProcs = processes.filter((p: any) => (p.brand_name?.toLowerCase().includes(q)) || (p.process_number?.toLowerCase().includes(q))).slice(0, 6);
                  if (matchedClients.length === 0 && matchedProcs.length === 0) return <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum resultado</p>;
                  return (
                    <>
                      {matchedClients.length > 0 && <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">Clientes</div>}
                      {matchedClients.map((c: any) => (
                        <button key={c.id} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors" onClick={() => { setFilterClient(c.id); setSearchAutocomplete(c.full_name || c.email); setShowSearchDropdown(false); }}>
                          <p className="text-xs font-medium">{c.full_name || 'Sem nome'}</p>
                          <p className="text-[10px] text-muted-foreground">{c.email}</p>
                        </button>
                      ))}
                      {matchedProcs.length > 0 && <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase border-t">Processos/Marcas</div>}
                      {matchedProcs.map((p: any) => (
                        <button key={p.id} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors" onClick={() => { setSearch(p.brand_name || p.process_number || ''); setSearchAutocomplete(p.brand_name || p.process_number || ''); setShowSearchDropdown(false); }}>
                          <p className="text-xs font-medium">{p.brand_name}</p>
                          {p.process_number && <p className="text-[10px] text-muted-foreground font-mono">{p.process_number}</p>}
                        </button>
                      ))}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={onCreateNew}>
            <Plus className="w-3.5 h-3.5" /> Nova
          </Button>
          <div className="flex border rounded-md overflow-hidden">
            <Button variant={viewMode === 'lista' ? 'default' : 'ghost'} size="sm" className="h-8 px-2.5 rounded-none" onClick={() => setViewMode('lista')}>
              <List className="w-3.5 h-3.5" />
            </Button>
            <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" className="h-8 px-2.5 rounded-none" onClick={() => setViewMode('kanban')}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Smart Filters */}
      <div className="flex items-center gap-1.5 px-1">
        {[
          { key: 'todos' as SmartFilter, label: 'Todos', count: null },
          { key: 'orfas' as SmartFilter, label: '🔴 Órfãs', count: orphanCount },
          { key: 'incompletas' as SmartFilter, label: '⚠️ Incompletas', count: incompleteCount },
          { key: 'sem_prazo' as SmartFilter, label: '📅 Sem Prazo', count: noPrazoCount },
        ].map(f => (
          <Button
            key={f.key}
            variant={smartFilter === f.key ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-[10px] gap-1"
            onClick={() => setSmartFilter(smartFilter === f.key ? 'todos' : f.key)}
          >
            {f.label}
            {f.count !== null && f.count > 0 && (
              <Badge variant={smartFilter === f.key ? 'secondary' : 'outline'} className="text-[9px] h-4 px-1 ml-0.5">
                {f.count}
              </Badge>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
