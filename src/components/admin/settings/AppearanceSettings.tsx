import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { SettingsCard } from './SettingsCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Palette, Sun, Moon, Monitor, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppearanceSettingsData {
  theme: 'light' | 'dark' | 'system';
  primaryColor: string;
  customCss: string;
}

const themeOptions = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

const colorPresets = [
  { name: 'Azul', color: '#0066CC' },
  { name: 'Verde', color: '#059669' },
  { name: 'Roxo', color: '#7C3AED' },
  { name: 'Rosa', color: '#DB2777' },
  { name: 'Laranja', color: '#EA580C' },
  { name: 'Ciano', color: '#0891B2' },
];

export function AppearanceSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['system-settings', 'appearance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'appearance')
        .single();
      if (error) throw error;
      return data?.value as unknown as AppearanceSettingsData;
    },
  });

  const [settings, setSettings] = useState<AppearanceSettingsData>({
    theme: 'system',
    primaryColor: '#0066CC',
    customCss: '',
  });

  useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (data: AppearanceSettingsData) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: JSON.parse(JSON.stringify(data)), updated_at: new Date().toISOString() })
        .eq('key', 'appearance');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings', 'appearance'] });
      toast.success('Configurações de aparência salvas!');
    },
    onError: () => toast.error('Erro ao salvar configurações'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Theme Selection */}
      <SettingsCard
        icon={Palette}
        iconColor="text-pink-500"
        title="Tema do Sistema"
        description="Escolha o tema visual do CRM"
      >
        <RadioGroup
          value={settings.theme}
          onValueChange={(value: 'light' | 'dark' | 'system') => setSettings({ ...settings, theme: value })}
          className="grid grid-cols-3 gap-4"
        >
          {themeOptions.map((option) => (
            <Label
              key={option.value}
              htmlFor={option.value}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                settings.theme === option.value
                  ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <RadioGroupItem value={option.value} id={option.value} className="sr-only" />
              <option.icon className={cn(
                "h-6 w-6",
                settings.theme === option.value ? "text-primary" : "text-muted-foreground"
              )} />
              <span className={cn(
                "font-medium text-sm",
                settings.theme === option.value ? "text-primary" : "text-muted-foreground"
              )}>
                {option.label}
              </span>
            </Label>
          ))}
        </RadioGroup>
      </SettingsCard>

      {/* Primary Color */}
      <SettingsCard
        icon={Palette}
        iconColor="text-violet-500"
        title="Cor Primária"
        description="Personalize a cor principal do sistema"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {colorPresets.map((preset) => (
              <motion.button
                key={preset.color}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSettings({ ...settings, primaryColor: preset.color })}
                className={cn(
                  "w-10 h-10 rounded-full border-2 transition-all",
                  settings.primaryColor === preset.color
                    ? "border-foreground ring-2 ring-offset-2 ring-offset-background ring-primary"
                    : "border-transparent hover:border-muted-foreground"
                )}
                style={{ backgroundColor: preset.color }}
                title={preset.name}
              />
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <Label>Cor personalizada:</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.primaryColor}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                className="w-10 h-10 rounded-lg border cursor-pointer"
              />
              <Input
                value={settings.primaryColor}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                placeholder="#0066CC"
                className="w-32 font-mono text-sm"
              />
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Custom CSS */}
      <SettingsCard
        icon={Palette}
        iconColor="text-cyan-500"
        title="CSS Personalizado"
        description="Adicione estilos CSS customizados (avançado)"
      >
        <div className="space-y-2">
          <Textarea
            value={settings.customCss}
            onChange={(e) => setSettings({ ...settings, customCss: e.target.value })}
            placeholder={`/* Exemplo */\n.custom-class {\n  color: #333;\n}`}
            rows={6}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Use com cuidado. CSS inválido pode afetar o funcionamento do sistema.
          </p>
        </div>
      </SettingsCard>

      {/* Save Button */}
      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Button 
          onClick={() => saveMutation.mutate(settings)} 
          disabled={saveMutation.isPending}
          className="w-full"
          size="lg"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Configurações de Aparência
        </Button>
      </motion.div>
    </motion.div>
  );
}
