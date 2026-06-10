import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, UserPlus, Loader2 } from 'lucide-react';
import { CreateClientDialog } from '@/components/admin/clients/CreateClientDialog';

interface VincularClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicacao: any | null;
  clients: any[];
  onLink: (clientId: string) => Promise<void> | void;
}

export function VincularClienteDialog({ open, onOpenChange, publicacao, clients, onLink }: VincularClienteDialogProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return clients.filter((c) => {
      return (
        c.full_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.company_name?.toLowerCase().includes(q) ||
        c.cpf_cnpj?.toLowerCase?.().includes(q) ||
        c.phone?.toLowerCase?.().includes(q)
      );
    });
  }, [clients, search]);

  const handleClose = (v: boolean) => {
    if (!v) {
      setSearch('');
      setSelected(null);
    }
    onOpenChange(v);
  };

  const handleConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await onLink(selected.id);
      handleClose(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Vincular Cliente
          </DialogTitle>
          <DialogDescription>
            Selecione o cliente para vincular a esta publicação. Caso não encontre, cadastre um novo cliente.
          </DialogDescription>
        </DialogHeader>

        {publicacao && (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Marca</span>
                <span className="font-semibold">{publicacao.brand_name_rpi || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Processo</span>
                <span className="font-mono text-sm">{publicacao.process_number_rpi || '—'}</span>
              </div>
              {publicacao.data_publicacao_rpi && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Publicação RPI</span>
                  <span className="text-sm">{publicacao.data_publicacao_rpi}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Buscar Cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, email, empresa, CPF/CNPJ ou telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex-1">
                  Selecionar Cliente{' '}
                  <span className="text-muted-foreground font-normal">
                    ({clients.length} disponíveis{filtered.length > 0 ? `, ${filtered.length} encontrados` : ''})
                  </span>
                </Label>
                <CreateClientDialog
                  onClientCreated={() => {
                    queryClient.invalidateQueries({ queryKey: ['profiles-pub'] });
                  }}
                />
              </div>
              <ScrollArea className="h-[240px] border rounded-xl p-2">
                {filtered.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm px-4">
                    {clients.length === 0
                      ? 'Carregando clientes...'
                      : search && search.trim().length >= 2
                      ? `Nenhum cliente encontrado para "${search}". Use "Novo Cliente" para cadastrar.`
                      : 'Digite ao menos 2 letras para buscar'}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filtered.slice(0, 50).map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setSelected(c)}
                        className={`p-3 rounded-xl cursor-pointer transition-colors ${
                          selected?.id === c.id ? 'bg-primary/10 border border-primary' : 'hover:bg-muted'
                        }`}
                      >
                        <div className="font-medium text-sm">{c.full_name || c.company_name || 'Sem nome'}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                        {c.company_name && c.full_name && (
                          <div className="text-xs text-muted-foreground">{c.company_name}</div>
                        )}
                        {c.cpf_cnpj && (
                          <div className="text-[10px] text-muted-foreground font-mono">{c.cpf_cnpj}</div>
                        )}
                      </div>
                    ))}
                    {filtered.length > 50 && (
                      <div className="text-xs text-muted-foreground text-center py-2">
                        Mostrando 50 de {filtered.length}. Refine a busca para ver mais.
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || !selected} className="gap-2 rounded-xl">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Vincular Cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}