import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { SettingsCard } from './SettingsCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  GitBranch,
  GripVertical,
  Plus,
  Trash2,
  ChevronRight,
  Layers,
  Sparkles,
} from 'lucide-react';

interface PipelineStage {
  id: string;
  name: string;
  color: string;
}

interface ProcessSettingsData {
  stages: PipelineStage[];
}

const PALETTE = [
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#F59E0B', // amber
  '#10B981', // emerald
  '#06B6D4', // cyan
  '#EC4899', // pink
  '#F97316', // orange
  '#84CC16', // lime
  '#6366F1', // indigo
];

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ─── Pipeline Preview Strip ─────────────────────────────────────────────────
function PipelinePreview({ stages }: { stages: PipelineStage[] }) {
  if (stages.length === 0) return null;
  return (
    <div className="mb-6 overflow-x-auto pb-2">
      <div className="flex items-center gap-1 min-w-max">
        {stages.map((stage, i) => (
          <div key={stage.id} className="flex items-center gap-1">
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={{
                backgroundColor: `${stage.color}18`,
                borderColor: `${stage.color}50`,
                color: stage.color,
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              {stage.name}
            </motion.div>
            {i < stages.length - 1 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Color Swatch Picker ────────────────────────────────────────────────────
function ColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="relative w-8 h-8 rounded-full transition-all duration-150 focus:outline-none"
          style={{ backgroundColor: color }}
        >
          <AnimatePresence>
            {value === color && (
              <motion.span
                key="ring"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="absolute inset-0 rounded-full"
                style={{ boxShadow: `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${color}` }}
              />
            )}
          </AnimatePresence>
        </button>
      ))}
    </div>
  );
}

// ─── Stage Row ──────────────────────────────────────────────────────────────
function StageRow({
  stage,
  index,
  onRemove,
  onColorChange,
}: {
  stage: PipelineStage;
  index: number;
  onRemove: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
}) {
  const [showSwatches, setShowSwatches] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close swatches on outside click
  useEffect(() => {
    if (!showSwatches) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowSwatches(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSwatches]);

  return (
    <Reorder.Item
      value={stage}
      className="relative flex items-center gap-3 rounded-xl border bg-card/80 backdrop-blur-sm overflow-hidden cursor-grab active:cursor-grabbing"
      style={{ borderColor: `${stage.color}40` }}
      whileDrag={{ scale: 1.02, boxShadow: `0 8px 32px ${stage.color}30` }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: stage.color }}
      />

      <div className="flex items-center gap-3 p-3 pl-4 w-full">
        {/* Drag handle */}
        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />

        {/* Index badge */}
        <span
          className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md flex-shrink-0"
          style={{
            backgroundColor: `${stage.color}20`,
            color: stage.color,
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        {/* Stage name */}
        <span className="flex-1 font-medium text-sm text-foreground truncate">
          {stage.name}
        </span>

        {/* Color dot + swatch picker */}
        <div ref={ref} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowSwatches((v) => !v)}
            className="w-7 h-7 rounded-full border-2 border-border transition-transform hover:scale-110 focus:outline-none"
            style={{ backgroundColor: stage.color }}
            title="Alterar cor"
          />
          <AnimatePresence>
            {showSwatches && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                className="absolute right-0 top-9 z-50 p-3 rounded-xl border bg-popover shadow-xl"
              >
                <ColorSwatches
                  value={stage.color}
                  onChange={(c) => {
                    onColorChange(stage.id, c);
                    setShowSwatches(false);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Delete */}
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRemove(stage.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Reorder.Item>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────
function EmptyPipeline({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 py-12 text-center"
    >
      <motion.div
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        className="p-4 rounded-2xl bg-primary/10 border border-primary/20"
      >
        <Layers className="h-8 w-8 text-primary" />
      </motion.div>
      <div>
        <p className="font-semibold text-foreground">Nenhuma etapa configurada</p>
        <p className="text-sm text-muted-foreground mt-1">
          Adicione etapas para definir o funil do pipeline jurídico INPI
        </p>
      </div>
      <Button onClick={onAdd} size="sm" className="gap-2">
        <Plus className="h-4 w-4" />
        Adicionar primeira etapa
      </Button>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function ProcessSettings() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newStage, setNewStage] = useState({ name: '', color: PALETTE[0] });
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['system-settings', 'processes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'processes')
        .single();
      if (error) throw error;
      return data?.value as unknown as ProcessSettingsData;
    },
  });

  const [settings, setSettings] = useState<ProcessSettingsData>({ stages: [] });

  useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: ProcessSettingsData) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: JSON.parse(JSON.stringify(payload)), updated_at: new Date().toISOString() })
        .eq('key', 'processes');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings', 'processes'] });
    },
    onError: () => toast.error('Erro ao salvar configurações'),
  });

  // Auto-save helper with debounce
  const autoSave = (payload: ProcessSettingsData, silent = false) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveMutation.mutate(payload, {
        onSuccess: () => {
          if (!silent) toast.success('Ordem do pipeline salva automaticamente');
        },
      });
    }, 500);
  };

  const addStage = () => {
    if (!newStage.name.trim()) return;
    const id = `${newStage.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    const updated: ProcessSettingsData = {
      ...settings,
      stages: [
        ...settings.stages,
        { id, name: newStage.name.trim(), color: newStage.color },
      ],
    };
    setSettings(updated);
    saveMutation.mutate(updated, {
      onSuccess: () => toast.success(`Etapa "${newStage.name}" adicionada`),
    });
    setNewStage({ name: '', color: PALETTE[settings.stages.length % PALETTE.length] });
    setIsDialogOpen(false);
  };

  const removeStage = (id: string) => {
    const stage = settings.stages.find((s) => s.id === id);
    const updated = { ...settings, stages: settings.stages.filter((s) => s.id !== id) };
    setSettings(updated);
    saveMutation.mutate(updated, {
      onSuccess: () => toast.success(`Etapa "${stage?.name}" removida`),
    });
  };

  const updateStageColor = (id: string, color: string) => {
    const updated = {
      ...settings,
      stages: settings.stages.map((s) => (s.id === id ? { ...s, color } : s)),
    };
    setSettings(updated);
    autoSave(updated, true);
  };

  const reorderStages = (newOrder: PipelineStage[]) => {
    const updated = { ...settings, stages: newOrder };
    setSettings(updated);
    autoSave(updated);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <SettingsCard
        icon={GitBranch}
        iconColor="text-cyan-500"
        title="Etapas do Pipeline"
        description="Configure as etapas do funil jurídico INPI — arraste para reordenar (salva automaticamente)"
      >
        {/* Pipeline Visual Preview */}
        <PipelinePreview stages={settings.stages} />

        {/* Add Stage Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full border-dashed mb-5 gap-2 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Adicionar Etapa
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Nova Etapa do Pipeline
              </DialogTitle>
              <DialogDescription>
                Adicione uma nova etapa ao funil de processos jurídicos
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Live preview */}
              <AnimatePresence>
                {newStage.name && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2 p-3 rounded-xl border"
                      style={{ borderColor: `${newStage.color}50`, backgroundColor: `${newStage.color}10` }}
                    >
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${newStage.color}25`, color: newStage.color }}
                      >
                        {String(settings.stages.length + 1).padStart(2, '0')}
                      </span>
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: newStage.color }}
                      />
                      <span className="font-semibold text-sm text-foreground">{newStage.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">preview</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label>Nome da Etapa</Label>
                <Input
                  value={newStage.name}
                  onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
                  placeholder="Ex: Em Análise, Exigência, Publicado..."
                  onKeyDown={(e) => e.key === 'Enter' && addStage()}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Cor da etapa</Label>
                <ColorSwatches
                  value={newStage.color}
                  onChange={(c) => setNewStage({ ...newStage, color: c })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={addStage} disabled={!newStage.name.trim()} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stage List */}
        {settings.stages.length === 0 ? (
          <EmptyPipeline onAdd={() => setIsDialogOpen(true)} />
        ) : (
          <Reorder.Group
            axis="y"
            values={settings.stages}
            onReorder={reorderStages}
            className="space-y-2"
          >
            <AnimatePresence initial={false}>
              {settings.stages.map((stage, index) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  index={index}
                  onRemove={removeStage}
                  onColorChange={updateStageColor}
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}

        {/* Stage count footer */}
        {settings.stages.length > 0 && (
          <p className="text-xs text-muted-foreground text-right mt-3">
            {settings.stages.length} etapa{settings.stages.length !== 1 ? 's' : ''} configurada{settings.stages.length !== 1 ? 's' : ''}
          </p>
        )}
      </SettingsCard>
    </motion.div>
  );
}
