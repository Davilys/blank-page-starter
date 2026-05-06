import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Link2, Search } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  contractId: string | null;
  signatoryName?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLinked: () => void;
}

export function LinkClientDialog({ contractId, signatoryName, open, onOpenChange, onLinked }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; full_name: string | null; email: string; cpf_cnpj: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setQuery(signatoryName || '');
  }, [open, signatoryName]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const q = query.trim();
      if (q.length < 2) { setResults([]); return; }
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, cpf_cnpj')
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,cpf_cnpj.ilike.%${q}%`)
        .limit(20);
      setResults((data as any) || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, open]);

  const handleLink = async (clientId: string) => {
    if (!contractId) return;
    setLinkingId(clientId);
    const { error } = await supabase.from('contracts').update({ user_id: clientId }).eq('id', contractId);
    setLinkingId(null);
    if (error) { toast.error('Erro ao vincular: ' + error.message); return; }
    toast.success('Contrato vinculado ao cliente');
    onLinked();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" /> Vincular contrato a um cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-9"
              placeholder="Buscar por nome, email ou CPF/CNPJ..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {loading && <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>}
            {!loading && results.length === 0 && query.length >= 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente encontrado</p>
            )}
            {results.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.full_name || '(sem nome)'}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.email} {r.cpf_cnpj ? `· ${r.cpf_cnpj}` : ''}</p>
                </div>
                <Button size="sm" onClick={() => handleLink(r.id)} disabled={linkingId === r.id}>
                  {linkingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Vincular'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}