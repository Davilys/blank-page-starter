import { useState, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Plus, Trash2, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { FunnelType } from './ClientKanbanBoard';

export interface AdminKanbanStage {
  id: string;
  label: string;
  color: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  description: string;
}

interface AdminKanbanConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: AdminKanbanStage[];
  funnelType: FunnelType;
  onSaved: () => void;
}

const COLOR_OPTIONS = [
  { name: 'Azul', gradient: 'from-blue-500 to-blue-600', border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', swatch: '#3B82F6' },
  { name: 'Esmeralda', gradient: 'from-emerald-500 to-emerald-600', border: 'border-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', swatch: '#10B981' },
  { name: 'Teal', gradient: 'from-teal-500 to-teal-600', border: 'border-teal-500', bg: 'bg-teal-50 dark:bg-teal-950/30', text: 'text-teal-700 dark:text-teal-300', swatch: '#14B8A6' },
  { name: 'Amarelo', gradient: 'from-yellow-500 to-amber-500', border: 'border-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950/30', text: 'text-yellow-700 dark:text-yellow-300', swatch: '#F59E0B' },
  { name: 'Laranja', gradient: 'from-orange-500 to-orange-600', border: 'border-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-300', swatch: '#F97316' },
  { name: 'Vermelho', gradient: 'from-red-500 to-red-600', border: 'border-red-500', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300', swatch: '#EF4444' },
  { name: 'Roxo', gradient: 'from-purple-500 to-purple-600', border: 'border-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-700 dark:text-purple-300', swatch: '#A855F7' },
  { name: 'Ciano', gradient: 'from-cyan-500 to-cyan-600', border: 'border-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-950/30', text: 'text-cyan-700 dark:text-cyan-300', swatch: '#06B6D4' },
  { name: 'Cinza', gradient: 'from-gray-500 to-gray-600', border: 'border-gray-500', bg: 'bg-gray-50 dark:bg-gray-950/30', text: 'text-gray-700 dark:text-gray-300', swatch: '#6B7280' },
  { name: 'Rosa', gradient: 'from-pink-500 to-pink-600', border: 'border-pink-500', bg: 'bg-pink-50 dark:bg-pink-950/30', text: 'text-pink-700 dark:text-pink-300', swatch: '#EC4899' },
];

const SETTINGS_KEY_MAP: Record<FunnelType, string> = {
  comercial: 'admin_kanban_comercial_stages',
  juridico: 'admin_kanban_juridico_stages',
};

export function AdminKanbanConfig({ open, onOpenChange, stages: initialStages, funnelType, onSaved }: AdminKanbanConfigProps) {
  const [stages, setStages] = useState<AdminKanbanStage[]>(initialStages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColorIdx, setNewColorIdx] = useState(0);

  useEffect(() => {
    setStages(initialStages);
  }, [initialStages]);

  const settingsKey = SETTINGS_KEY_MAP[funnelType];

  const saveStages = async (updated: AdminKanbanStage[]) => {
    setSaving(true);
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: settingsKey, value: { stages: updated } as any }, { onConflict: 'key' });

    if (error) {
      toast.error('Erro ao salvar configuração');
    } else {
      toast.success('Etapas salvas');
      onSaved();
    }
    setSaving(false);
  };

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    const id = newLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (stages.some(s => s.id === id)) {
      toast.error('Etapa já existe');
      return;
    }
    const colorOpt = COLOR_OPTIONS[newColorIdx];
    const newStage: AdminKanbanStage = {
      id,
      label: newLabel.trim().toUpperCase(),
      color: colorOpt.gradient,
      borderColor: colorOpt.border,
      bgColor: colorOpt.bg,
      textColor: colorOpt.text,
      description: '',
    };
    const updated = [...stages, newStage];
    setStages(updated);
    setNewLabel('');
    setNewColorIdx(0);
    saveStages(updated);
  };

  const handleRemove = (id: string) => {
    const updated = stages.filter(s => s.id !== id);
    setStages(updated);
    saveStages(updated);
  };

  const startEdit = (stage: AdminKanbanStage) => {
    setEditingId(stage.id);
    setEditLabel(stage.label);
    setEditDesc(stage.description);
  };

  const confirmEdit = () => {
    if (!editingId || !editLabel.trim()) return;
    const updated = stages.map(s =>
      s.id === editingId ? { ...s, label: editLabel.trim().toUpperCase(), description: editDesc.trim() } : s
    );
    setStages(updated);
    setEditingId(null);
    saveStages(updated);
  };

  const handleColorChange = (stageId: string, colorIdx: number) => {
    const colorOpt = COLOR_OPTIONS[colorIdx];
    const updated = stages.map(s =>
      s.id === stageId
        ? { ...s, color: colorOpt.gradient, borderColor: colorOpt.border, bgColor: colorOpt.bg, textColor: colorOpt.text }
        : s
    );
    setStages(updated);
    saveStages(updated);
  };

  const handleReorder = (newOrder: AdminKanbanStage[]) => {
    setStages(newOrder);
  };

  const handleReorderComplete = () => {
    saveStages(stages);
  };

  const getColorIdx = (stage: AdminKanbanStage) => {
    return COLOR_OPTIONS.findIndex(c => c.gradient === stage.color);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Configurar Etapas — {funnelType === 'comercial' ? 'Comercial' : 'Jurídico'}
          </DialogTitle>
          <DialogDescription>
            Adicione, edite, reordene ou remova etapas do Kanban.
          </DialogDescription>
        </DialogHeader>

        {/* Add new stage */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nova etapa</label>
            <Input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Nome da etapa"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="flex gap-1 flex-wrap max-w-[140px]">
            {COLOR_OPTIONS.slice(0, 7).map((c, idx) => (
              <button
                key={c.name}
                className={`w-5 h-5 rounded-full border-2 transition-all ${newColorIdx === idx ? 'border-foreground scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c.swatch }}
                onClick={() => setNewColorIdx(idx)}
                title={c.name}
              />
            ))}
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!newLabel.trim()}>
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

              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLOR_OPTIONS[getColorIdx(stage)]?.swatch || '#6B7280' }}
              />

              {editingId === stage.id ? (
                <div className="flex flex-col gap-1 flex-1">
                  <Input
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    placeholder="Nome"
                    onKeyDown={e => e.key === 'Enter' && confirmEdit()}
                  />
                  <Input
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="Descrição (opcional)"
                  />
                  <Button size="sm" variant="ghost" className="h-7 self-end" onClick={confirmEdit}>
                    <Check className="h-4 w-4 mr-1" /> Salvar
                  </Button>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block truncate">{stage.label}</span>
                  {stage.description && (
                    <span className="text-[10px] text-muted-foreground block truncate">{stage.description}</span>
                  )}
                </div>
              )}

              {/* Color picker */}
              <div className="flex gap-0.5 flex-shrink-0">
                {COLOR_OPTIONS.slice(0, 5).map((c, idx) => (
                  <button
                    key={c.name}
                    className={`w-3.5 h-3.5 rounded-full border transition-all ${getColorIdx(stage) === idx ? 'border-foreground' : 'border-transparent opacity-50 hover:opacity-100'}`}
                    style={{ backgroundColor: c.swatch }}
                    onClick={() => handleColorChange(stage.id, idx)}
                    title={c.name}
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
