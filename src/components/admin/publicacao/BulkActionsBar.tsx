import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckSquare, X, Bell, Download, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

type PubStatus = '003' | 'oposicao' | 'exigencia_merito' | 'indeferimento' | 'deferimento' | 'certificado' | 'renovacao' | 'arquivado';

const STATUS_OPTIONS: { value: PubStatus; label: string }[] = [
  { value: '003', label: '003' },
  { value: 'oposicao', label: 'Oposição' },
  { value: 'exigencia_merito', label: 'Exigência de Mérito' },
  { value: 'indeferimento', label: 'Indeferimento' },
  { value: 'deferimento', label: 'Deferimento' },
  { value: 'certificado', label: 'Certificado' },
  { value: 'renovacao', label: 'Renovação' },
  { value: 'arquivado', label: 'Arquivado' },
];

interface Props {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkStatusChange: (status: PubStatus) => void;
  onBulkReminder: () => void;
  onBulkExport: () => void;
}

export function BulkActionsBar({ selectedCount, onClearSelection, onBulkStatusChange, onBulkReminder, onBulkExport }: Props) {
  const [bulkStatus, setBulkStatus] = useState<PubStatus | ''>('');

  if (selectedCount === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mb-3 p-3 rounded-xl border border-primary/30 bg-primary/5 flex flex-wrap items-center gap-3"
    >
      <div className="flex items-center gap-2">
        <CheckSquare className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{selectedCount} selecionado(s)</span>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClearSelection}>
          <X className="w-3 h-3 mr-1" /> Limpar
        </Button>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <div className="flex items-center gap-1">
          <Select value={bulkStatus} onValueChange={v => setBulkStatus(v as PubStatus)}>
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <SelectValue placeholder="Alterar status..." />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {bulkStatus && (
            <Button size="sm" className="h-8 text-xs" onClick={() => { onBulkStatusChange(bulkStatus as PubStatus); setBulkStatus(''); }}>
              <ArrowRight className="w-3 h-3 mr-1" /> Aplicar
            </Button>
          )}
        </div>

        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onBulkReminder}>
          <Bell className="w-3 h-3 mr-1" /> Lembretes
        </Button>

        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onBulkExport}>
          <Download className="w-3 h-3 mr-1" /> Exportar
        </Button>
      </div>
    </motion.div>
  );
}
