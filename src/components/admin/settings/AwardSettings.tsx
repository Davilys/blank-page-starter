import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Trophy, Save, Loader2, Target, Sparkles, TrendingUp,
  Award, FileText, Megaphone, CreditCard, DollarSign,
  Zap, BarChart3, RefreshCw, Eye, Calculator, Gift, Star
} from 'lucide-react';

// ─── Types ────────────────────────────────────────
interface AwardConfig {
  enabled: boolean;
  registro_marca: {
    base_rate: number;
    above_goal_avista_rate: number;
    above_goal_parcelado_rate: number;
    monthly_goal: number;
  };
  publicacao: {
    base_rate: number;
    above_goal_rate: number;
    monthly_goal: number;
    milestone_interval: number;
    milestone_bonus: number;
  };
  cobranca: {
    tiers: {
      min: number;
      max: number;
      rate: number;
    }[];
    milestone_interval: number;
    milestone_bonus: number;
  };
  master_admin_email: string;
}

const DEFAULT_CONFIG: AwardConfig = {
  enabled: true,
  registro_marca: {
    base_rate: 50,
    above_goal_avista_rate: 100,
    above_goal_parcelado_rate: 50,
    monthly_goal: 30,
  },
  publicacao: {
    base_rate: 50,
    above_goal_rate: 100,
    monthly_goal: 50,
    milestone_interval: 10,
    milestone_bonus: 100,
  },
  cobranca: {
    tiers: [
      { min: 199, max: 397, rate: 10 },
      { min: 398, max: 597, rate: 25 },
      { min: 598, max: 999, rate: 50 },
      { min: 1000, max: 1500, rate: 75 },
      { min: 1518, max: 99999, rate: 100 },
    ],
    milestone_interval: 10,
    milestone_bonus: 50,
  },
  master_admin_email: 'davillys@gmail.com',
};

// ─── Section Components ───────────────────────────

function RegistroMarcaSection({
  config,
  onChange,
}: {
  config: AwardConfig['registro_marca'];
  onChange: (v: AwardConfig['registro_marca']) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <Card className="border-primary/20 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Registro de Marca</CardTitle>
                <CardDescription>Premiação por marcas registradas</CardDescription>
              </div>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
              <Trophy className="h-3 w-3" />
              Principal
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-primary" />
                Meta Mensal (marcas)
              </Label>
              <Input
                type="number"
                min={1}
                value={config.monthly_goal}
                onChange={e => onChange({ ...config, monthly_goal: parseInt(e.target.value) || 1 })}
              />
              <p className="text-[11px] text-muted-foreground">Após atingir a meta, o valor muda conforme forma de pagamento</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                Valor Base (por marca)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={config.base_rate}
                  onChange={e => onChange({ ...config, base_rate: parseFloat(e.target.value) || 0 })}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Após atingir a meta</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Valor À Vista (acima meta)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={config.above_goal_avista_rate}
                  onChange={e => onChange({ ...config, above_goal_avista_rate: parseFloat(e.target.value) || 0 })}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Valor Parcelado (acima meta)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={config.above_goal_parcelado_rate}
                  onChange={e => onChange({ ...config, above_goal_parcelado_rate: parseFloat(e.target.value) || 0 })}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl bg-muted/50 border p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Simulação
            </div>
            <div className="grid gap-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>1ª à {config.monthly_goal}ª marca</span>
                <span className="font-semibold text-foreground">R$ {config.base_rate.toFixed(2)} cada</span>
              </div>
              <div className="flex justify-between">
                <span>{config.monthly_goal + 1}ª+ marca (à vista)</span>
                <span className="font-semibold text-emerald-500">R$ {config.above_goal_avista_rate.toFixed(2)} cada</span>
              </div>
              <div className="flex justify-between">
                <span>{config.monthly_goal + 1}ª+ marca (parcelado)</span>
                <span className="font-semibold text-foreground">R$ {config.above_goal_parcelado_rate.toFixed(2)} cada</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PublicacaoSection({
  config,
  onChange,
}: {
  config: AwardConfig['publicacao'];
  onChange: (v: AwardConfig['publicacao']) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card className="overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500 via-violet-400/60 to-transparent" />
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Megaphone className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Publicações</CardTitle>
                <CardDescription>Premiação por publicações resolvidas</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-violet-500" />
                Meta Mensal (publicações)
              </Label>
              <Input
                type="number"
                min={1}
                value={config.monthly_goal}
                onChange={e => onChange({ ...config, monthly_goal: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Base (por publicação)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={config.base_rate}
                  onChange={e => onChange({ ...config, base_rate: parseFloat(e.target.value) || 0 })}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Valor Acima da Meta</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={config.above_goal_rate}
                  onChange={e => onChange({ ...config, above_goal_rate: parseFloat(e.target.value) || 0 })}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Milestone */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20">
                <Zap className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">Bônus de Milestone</p>
                <p className="text-[11px] text-muted-foreground">Bônus recorrente a cada X publicações resolvidas</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>A cada (publicações)</Label>
                <Input
                  type="number"
                  min={1}
                  value={config.milestone_interval}
                  onChange={e => onChange({ ...config, milestone_interval: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bônus (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.milestone_bonus}
                    onChange={e => onChange({ ...config, milestone_bonus: parseFloat(e.target.value) || 0 })}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CobrancaSection({
  config,
  onChange,
}: {
  config: AwardConfig['cobranca'];
  onChange: (v: AwardConfig['cobranca']) => void;
}) {
  const updateTier = (idx: number, field: keyof AwardConfig['cobranca']['tiers'][0], value: number) => {
    const newTiers = [...config.tiers];
    newTiers[idx] = { ...newTiers[idx], [field]: value };
    onChange({ ...config, tiers: newTiers });
  };

  const addTier = () => {
    const last = config.tiers[config.tiers.length - 1];
    onChange({
      ...config,
      tiers: [...config.tiers, { min: (last?.max || 0) + 1, max: (last?.max || 0) + 500, rate: 0 }],
    });
  };

  const removeTier = (idx: number) => {
    if (config.tiers.length <= 1) return;
    onChange({ ...config, tiers: config.tiers.filter((_, i) => i !== idx) });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <Card className="overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-orange-500 via-orange-400/60 to-transparent" />
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <CreditCard className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Cobranças</CardTitle>
                <CardDescription>Tabela de faixas por valor de parcela</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Tier Table */}
          <div className="rounded-xl border overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-0 bg-muted/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>De (R$)</span>
              <span>Até (R$)</span>
              <span>Prêmio/Parcela (R$)</span>
              <span></span>
            </div>
            {config.tiers.map((tier, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center px-4 py-3 border-t">
                <Input
                  type="number"
                  value={tier.min}
                  onChange={e => updateTier(idx, 'min', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
                <Input
                  type="number"
                  value={tier.max}
                  onChange={e => updateTier(idx, 'max', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={tier.rate}
                    onChange={e => updateTier(idx, 'rate', parseFloat(e.target.value) || 0)}
                    className="h-9 pl-8"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => removeTier(idx)}
                  disabled={config.tiers.length <= 1}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={addTier} className="gap-1.5">
            <span className="text-lg leading-none">+</span> Adicionar Faixa
          </Button>

          <Separator />

          {/* Milestone */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20">
                <Zap className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">Bônus de Milestone</p>
                <p className="text-[11px] text-muted-foreground">Bônus recorrente a cada X cobranças resolvidas</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>A cada (cobranças)</Label>
                <Input
                  type="number"
                  min={1}
                  value={config.milestone_interval}
                  onChange={e => onChange({ ...config, milestone_interval: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bônus (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.milestone_bonus}
                    onChange={e => onChange({ ...config, milestone_bonus: parseFloat(e.target.value) || 0 })}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────
export function AwardSettings() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AwardConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'award_config')
        .maybeSingle();

      if (data?.value) {
        const saved = data.value as unknown as AwardConfig;
        setConfig({ ...DEFAULT_CONFIG, ...saved });
      }
    } catch (err) {
      console.error('Error loading award config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('key', 'award_config')
        .maybeSingle();

      const { data: user } = await supabase.auth.getUser();
      const valueToSave = JSON.parse(JSON.stringify(config));

      if (existing) {
        const { error } = await supabase
          .from('system_settings')
          .update({ value: valueToSave, updated_at: new Date().toISOString(), updated_by: user.user?.id })
          .eq('key', 'award_config');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('system_settings')
          .insert([{ key: 'award_config', value: valueToSave, updated_by: user.user?.id }]);
        if (error) throw error;
      }

      toast.success('Configurações de premiação salvas!', {
        description: 'Os novos valores serão aplicados nos cálculos imediatamente.',
      });
    } catch (error) {
      console.error('Error saving award config:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            Configurações de Premiação
          </h2>
          <p className="text-muted-foreground text-sm">
            Defina valores, metas e regras de bonificação da equipe. As alterações são aplicadas instantaneamente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
            <Switch
              checked={config.enabled}
              onCheckedChange={v => setConfig(prev => ({ ...prev, enabled: v }))}
            />
            <span className="text-sm font-medium">{config.enabled ? 'Ativo' : 'Desativado'}</span>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Admin Master */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-400/60 to-transparent" />
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <Star className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Administrador Master</CardTitle>
                <CardDescription>E-mail do admin com visão total da premiação</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Input
              value={config.master_admin_email}
              onChange={e => setConfig(prev => ({ ...prev, master_admin_email: e.target.value }))}
              placeholder="admin@empresa.com"
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Sections */}
      <RegistroMarcaSection
        config={config.registro_marca}
        onChange={v => setConfig(prev => ({ ...prev, registro_marca: v }))}
      />

      <PublicacaoSection
        config={config.publicacao}
        onChange={v => setConfig(prev => ({ ...prev, publicacao: v }))}
      />

      <CobrancaSection
        config={config.cobranca}
        onChange={v => setConfig(prev => ({ ...prev, cobranca: v }))}
      />

      {/* Info Card */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-amber-500 via-amber-400/60 to-transparent" />
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-5 w-5 text-amber-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">Sincronização com Premiação</p>
              <p className="text-amber-600/80 dark:text-amber-500/80">
                Ao salvar, os valores e regras são aplicados automaticamente nos cálculos do painel de Premiação. Os registros existentes são recalculados com as novas configurações na próxima atualização.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
