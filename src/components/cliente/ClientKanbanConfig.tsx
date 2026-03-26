import { useState, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Plus, Trash2, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';

export interface KanbanStage {
  id: string;
  name: string;
  color: string;
}

interface ClientKanbanConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: KanbanStage[];
  onSaved: () => void;
}

const COLOR_SWATCHES = [
  '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#22C55E',
  '#EF4444', '#6B7280', '#EC4899', '#06B6D4', '#F97316',
  '#14B8A6', '#6366F1', '#84CC16', '#A855F7',
];

export function ClientKanbanConfig({ open, onOpenChange, stages: initialStages, onSaved }: ClientKanbanConfigProps) {
  const [stages, setStages] = useState<KanbanStage[]>(initialStages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_SWATCHES[0]);

  useEffect(() => {
    setStages(initialStages);
  }, [initialStages]);

  const saveStages = async (updated: KanbanStage[]) => {
    setSaving(true);
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: 'client_kanban_stages', value: { stages: updated } as any }, { onConflict: 'key' });

    if (error) {
      toast.error('Erro ao salvar configuração');
    } else {
      toast.success('Etapas salvas');
      onSaved();
    }
    setSaving(false);
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const id = newName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (stages.some(s => s.id === id)) {
      toast.error('Etapa já existe');
      return;
    }
    const updated = [...stages, { id, name: newName.trim(), color: newColor }];
    setStages(updated);
    setNewName('');
    setNewColor(COLOR_SWATCHES[0]);
    saveStages(updated);
  };

  const handleRemove = (id: string) => {
    const updated = stages.filter(s => s.id !== id);
    setStages(updated);
    saveStages(updated);
  };

  const startEdit = (stage: KanbanStage) => {
    setEditingId(stage.id);
    setEditName(stage.name);
  };

  const confirmEdit = () => {
    if (!editingId || !editName.trim()) return;
    const updated = stages.map(s => s.id === editingId ? { ...s, name: editName.trim() } : s);
    setStages(updated);
    setEditingId(null);
    saveStages(updated);
  };

  const handleColorChange = (stageId: string, color: string) => {
    const updated = stages.map(s => s.id === stageId ? { ...s, color } : s);
    setStages(updated);
    saveStages(updated);
  };

  const handleReorder = (newOrder: KanbanStage[]) => {
    setStages(newOrder);
  };

  const handleReorderComplete = () => {
    saveStages(stages);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Etapas do Kanban</DialogTitle>
          <DialogDescription>Adicione, edite, reordene ou remova etapas do Kanban.</DialogDescription>
        </DialogHeader>

        {/* Add new stage */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nova etapa</label>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nome da etapa"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="flex gap-1 flex-wrap max-w-[120px]">
            {COLOR_SWATCHES.slice(0, 7).map(c => (
              <button
                key={c}
                className={`w-5 h-5 rounded-full border-2 transition-all ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Stages list with drag */}
        <Reorder.Group axis="y" values={stages} onReorder={handleReorder} className="space-y-2 mt-4">
          {stages.map(stage => (
            <Reorder.Item
              key={stage.id}
              value={stage}
              onDragEnd={handleReorderComplete}
              className="flex items-center gap-2 p-3 rounded-lg border bg-card cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />

              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />

              {editingId === stage.id ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && confirmEdit()}
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={confirmEdit}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <span className="flex-1 text-sm font-medium">{stage.name}</span>
              )}

              {/* Color picker */}
              <div className="flex gap-0.5 flex-shrink-0">
                {COLOR_SWATCHES.slice(0, 5).map(c => (
                  <button
                    key={c}
                    className={`w-3.5 h-3.5 rounded-full border transition-all ${stage.color === c ? 'border-foreground' : 'border-transparent opacity-50 hover:opacity-100'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => handleColorChange(stage.id, c)}
                  />
                ))}
              </div>

              {editingId !== stage.id && (
                <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={() => startEdit(stage)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}

              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 flex-shrink-0 text-destructive hover:text-destructive"
                onClick={() => handleRemove(stage.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        {saving && <p className="text-xs text-muted-foreground text-center">Salvando...</p>}
      </DialogContent>
    </Dialog>
  );
}
