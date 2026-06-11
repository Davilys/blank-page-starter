import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Pencil } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  publicacao: any | null;
  processBrandName?: string | null;
}

export function EditarMarcaDialog({ open, onOpenChange, publicacao, processBrandName }: Props) {
  const [name, setName] = useState('');
  const [alsoUpdateProcess, setAlsoUpdateProcess] = useState(true);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open && publicacao) {
      setName(publicacao.brand_name_rpi || processBrandName || '');
      setAlsoUpdateProcess(!!publicacao.process_id);
    }
  }, [open, publicacao, processBrandName]);

  const handleSave = async () => {
    if (!publicacao) return;
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Informe o nome da marca'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('publicacoes_marcas')
      .update({ brand_name_rpi: trimmed } as any)
      .eq('id', publicacao.id);
    if (error) { toast.error('Erro ao atualizar nome da marca'); setSaving(false); return; }

    if (alsoUpdateProcess && publicacao.process_id) {
      const { error: pErr } = await supabase
        .from('brand_processes')
        .update({ brand_name: trimmed } as any)
        .eq('id', publicacao.process_id);
      if (pErr) {
        toast.warning('Publicação atualizada, mas falhou ao atualizar o processo');
      }
    }
    toast.success('Nome da marca atualizado');
    queryClient.invalidateQueries({ queryKey: ['publicacoes-marcas'] });
    queryClient.invalidateQueries({ queryKey: ['brand-processes-pub'] });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" /> Editar nome da marca
          </DialogTitle>
          <DialogDescription>
            Quando o sistema não identifica o nome da marca a partir do RPI, você pode preencher manualmente.
          </DialogDescription>
        </DialogHeader>

        {publicacao && (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-0.5">
              <div><span className="text-muted-foreground">Processo nº:</span> <span className="font-medium">{publicacao.process_number_rpi || '—'}</span></div>
              <div><span className="text-muted-foreground">Publicação RPI:</span> <span className="font-medium">{publicacao.data_publicacao_rpi || '—'}</span></div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brand-name">Nome da marca</Label>
              <Input
                id="brand-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Minha Marca"
                autoFocus
              />
            </div>

            {publicacao.process_id && (
              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox checked={alsoUpdateProcess} onCheckedChange={(c) => setAlsoUpdateProcess(!!c)} />
                <span>Atualizar também o nome no processo vinculado</span>
              </label>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
