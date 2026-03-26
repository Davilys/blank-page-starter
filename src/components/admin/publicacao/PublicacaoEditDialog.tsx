import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X } from 'lucide-react';
import { format, addDays, addYears, parseISO } from 'date-fns';
import type { Publicacao, PubStatus, PubTipo } from './types';
import { STATUS_CONFIG, TIPO_CONFIG } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData: Partial<Publicacao>;
  setEditData: React.Dispatch<React.SetStateAction<Partial<Publicacao>>>;
  processes: any[];
  admins: any[];
  clients: any[];
  clientMap: Map<string, any>;
  selected: Publicacao | null;
  onSave: () => void;
  isPending: boolean;
}

export function PublicacaoEditDialog({ open, onOpenChange, editData, setEditData, processes, admins, clients, clientMap, selected, onSave, isPending }: Props) {
  const [editClientSearch, setEditClientSearch] = useState('');
  const [showEditClientDropdown, setShowEditClientDropdown] = useState(false);

  useEffect(() => { if (!open) { setEditClientSearch(''); setShowEditClientDropdown(false); } }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Editar Publicação</DialogTitle></DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-4">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={editData.status || ''} onValueChange={v => setEditData(d => ({ ...d, status: v as PubStatus }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo de Publicação</Label>
              <Select value={editData.tipo_publicacao || ''} onValueChange={v => setEditData(d => ({ ...d, tipo_publicacao: v as PubTipo }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TIPO_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cliente (vincular manualmente)</Label>
              <div className="relative">
                <div className="flex items-center gap-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input className="h-9 pl-7 text-sm" placeholder="Buscar por nome, email ou CPF..." value={editClientSearch} onChange={e => setEditClientSearch(e.target.value)} onFocus={() => setShowEditClientDropdown(true)} />
                  </div>
                  {editData.client_id && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => { setEditData(d => ({ ...d, client_id: null })); setEditClientSearch(''); }}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                {editData.client_id && !editClientSearch && (
                  <p className="text-[10px] text-primary mt-1 font-medium">✓ {clientMap.get(editData.client_id)?.full_name || editData.client_id}</p>
                )}
                {showEditClientDropdown && editClientSearch.length >= 2 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {clients.filter((c: any) => { const q = editClientSearch.toLowerCase(); return (c.full_name?.toLowerCase().includes(q)) || (c.email?.toLowerCase().includes(q)) || (c.cpf_cnpj?.toLowerCase().includes(q)); }).slice(0, 10).map((c: any) => (
                      <button key={c.id} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b last:border-0" onClick={() => { setEditData(d => ({ ...d, client_id: c.id })); setEditClientSearch(''); setShowEditClientDropdown(false); }}>
                        <p className="font-medium text-xs">{c.full_name || 'Sem nome'}</p>
                        <p className="text-[10px] text-muted-foreground">{c.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs">Processo (vincular manualmente)</Label>
              <Select value={editData.process_id || ''} onValueChange={v => setEditData(d => ({ ...d, process_id: v || null }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione um processo" /></SelectTrigger>
                <SelectContent>{processes.map(p => <SelectItem key={p.id} value={p.id}>{p.brand_name} {p.process_number ? `(${p.process_number})` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Admin Responsável</Label>
              <Select value={editData.admin_id || ''} onValueChange={v => setEditData(d => ({ ...d, admin_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{admins.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data Publicação RPI</Label>
              <Input type="date" value={editData.data_publicacao_rpi || ''} onChange={e => setEditData(d => ({ ...d, data_publicacao_rpi: e.target.value || null }))} className="h-9" />
              {editData.data_publicacao_rpi && <p className="text-[10px] text-muted-foreground mt-1">Prazo oposição auto: {format(addDays(parseISO(editData.data_publicacao_rpi), 60), 'dd/MM/yyyy')}</p>}
            </div>
            <div>
              <Label className="text-xs">Data Decisão</Label>
              <Input type="date" value={editData.data_decisao || ''} onChange={e => setEditData(d => ({ ...d, data_decisao: e.target.value || null }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Data Certificado</Label>
              <Input type="date" value={editData.data_certificado || ''} onChange={e => setEditData(d => ({ ...d, data_certificado: e.target.value || null }))} className="h-9" />
              {editData.data_certificado && <p className="text-[10px] text-muted-foreground mt-1">Renovação ordinária: {format(addYears(parseISO(editData.data_certificado), 9), 'dd/MM/yyyy')}</p>}
            </div>
            <div>
              <Label className="text-xs">Próximo Prazo Crítico</Label>
              <Input type="date" value={editData.proximo_prazo_critico || ''} onChange={e => setEditData(d => ({ ...d, proximo_prazo_critico: e.target.value || null }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Descrição do Prazo</Label>
              <Input value={editData.descricao_prazo || ''} onChange={e => setEditData(d => ({ ...d, descricao_prazo: e.target.value }))} className="h-9" placeholder="Ex.: Prazo de oposição" />
            </div>
            <div>
              <Label className="text-xs">N° RPI</Label>
              <Input value={editData.rpi_number || ''} onChange={e => setEditData(d => ({ ...d, rpi_number: e.target.value }))} className="h-9" placeholder="Ex.: 2800" />
            </div>
            <div>
              <Label className="text-xs">Link RPI Oficial</Label>
              <Input value={editData.rpi_link || ''} onChange={e => setEditData(d => ({ ...d, rpi_link: e.target.value }))} className="h-9" placeholder="https://..." />
            </div>
            <div>
              <Label className="text-xs">Comentários Internos</Label>
              <Textarea value={editData.comentarios_internos || ''} onChange={e => setEditData(d => ({ ...d, comentarios_internos: e.target.value }))} rows={3} className="text-sm" />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={isPending}>{isPending ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
