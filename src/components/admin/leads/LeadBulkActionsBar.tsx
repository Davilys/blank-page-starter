import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, UserCheck, Tag, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

interface LeadBulkActionsBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onActionComplete: () => void;
}

const STATUS_OPTIONS = [
  { value: 'novo', label: 'Novo' },
  { value: 'contato', label: 'Em Contato' },
  { value: 'qualificado', label: 'Qualificado' },
  { value: 'proposta', label: 'Proposta Enviada' },
  { value: 'negociacao', label: 'Em Negociação' },
  { value: 'perdido', label: 'Perdido' },
];

export function LeadBulkActionsBar({ 
  selectedIds, 
  onClearSelection, 
  onActionComplete 
}: LeadBulkActionsBarProps) {
  const [loading, setLoading] = useState(false);

  const handleBulkDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.length} leads?`)) return;

    setLoading(true);
    try {
      // First delete related email_logs
      await supabase.from('email_logs').delete().in('related_lead_id', selectedIds);
      
      // Then delete the leads (contracts will have lead_id set to NULL automatically via ON DELETE SET NULL)
      const { data, error } = await supabase
        .from('leads')
        .delete()
        .in('id', selectedIds)
        .select('id');
      
      if (error) throw error;
      
      const deletedCount = data?.length || 0;
      
      if (deletedCount === 0) {
        toast.error('Nenhum lead foi excluído. Verifique suas permissões.');
        return;
      }
      
      if (deletedCount < selectedIds.length) {
        toast.warning(`${deletedCount} de ${selectedIds.length} leads excluídos. Alguns não puderam ser removidos.`);
      } else {
        toast.success(`${deletedCount} leads excluídos com sucesso`);
      }
      
      onClearSelection();
      onActionComplete();
    } catch (error: any) {
      console.error('Error deleting leads:', error);
      toast.error(error.message || 'Erro ao excluir leads');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status })
        .in('id', selectedIds);

      if (error) throw error;
      
      toast.success(`Status atualizado para ${selectedIds.length} leads`);
      onClearSelection();
      onActionComplete();
    } catch (error) {
      console.error('Error updating leads:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setLoading(false);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border shadow-xl rounded-lg p-4 flex items-center gap-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-2 pr-4 border-r">
        <span className="font-medium">{selectedIds.length}</span>
        <span className="text-muted-foreground">selecionados</span>
        <Button variant="ghost" size="icon" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Select onValueChange={handleBulkStatusChange} disabled={loading}>
          <SelectTrigger className="w-[180px]">
            <Tag className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Alterar status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button 
          variant="destructive" 
          onClick={handleBulkDelete}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          Excluir
        </Button>
      </div>
    </div>
  );
}
