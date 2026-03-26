import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { format, addDays, parseISO } from 'date-fns';
import type { PubTipo } from './types';
import { TIPO_CONFIG } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processes: any[];
  admins: any[];
  clientMap: Map<string, any>;
  linkedProcessIds: Set<string | null>;
  onSubmit: (data: { processId: string; dataDeposito: string; dataPubRpi: string; tipo: PubTipo; adminId: string }) => void;
  isPending: boolean;
}

export function PublicacaoCreateDialog({ open, onOpenChange, processes, admins, clientMap, linkedProcessIds, onSubmit, isPending }: Props) {
  const [processId, setProcessId] = useState('');
  const [dataDeposito, setDataDeposito] = useState('');
  const [dataPubRpi, setDataPubRpi] = useState('');
  const [tipo, setTipo] = useState<PubTipo>('publicacao_rpi');
  const [adminId, setAdminId] = useState('');

  useEffect(() => {
    if (!open) { setProcessId(''); setDataDeposito(''); setDataPubRpi(''); setTipo('publicacao_rpi'); setAdminId(''); }
  }, [open]);

  const processMap = new Map(processes.map(p => [p.id, p]));
  useEffect(() => {
    if (processId) {
      const proc = processMap.get(processId);
      if (proc?.deposit_date) setDataDeposito(proc.deposit_date);
    }
  }, [processId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Publicação</DialogTitle>
          <DialogDescription>Vincule um processo existente e preencha os dados iniciais.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Processo (marca)</Label>
            <Select value={processId} onValueChange={setProcessId}>
              <SelectTrigger><SelectValue placeholder="Selecione um processo" /></SelectTrigger>
              <SelectContent>
                {processes.filter(p => !linkedProcessIds.has(p.id)).map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.brand_name} {p.process_number ? `(${p.process_number})` : ''} — {clientMap.get(p.user_id!)?.full_name || 'Sem cliente'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Data de Depósito</Label>
            <Input type="date" value={dataDeposito} onChange={e => setDataDeposito(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Data Publicação RPI (opcional)</Label>
            <Input type="date" value={dataPubRpi} onChange={e => setDataPubRpi(e.target.value)} className="h-9" />
            {dataPubRpi && <p className="text-[10px] text-muted-foreground mt-1">Prazo oposição auto: {format(addDays(parseISO(dataPubRpi), 60), 'dd/MM/yyyy')}</p>}
          </div>
          <div>
            <Label className="text-xs">Tipo de Publicação</Label>
            <Select value={tipo} onValueChange={v => setTipo(v as PubTipo)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Admin Responsável</Label>
            <Select value={adminId} onValueChange={setAdminId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
              <SelectContent>
                {admins.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSubmit({ processId, dataDeposito, dataPubRpi, tipo, adminId })} disabled={!processId || isPending}>
            {isPending ? 'Criando...' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
