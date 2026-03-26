import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Brain, Cpu, Zap, Shield, CheckCircle2, XCircle, Loader2,
  Eye, EyeOff, Activity, Clock, BarChart3, AlertTriangle, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────
interface AIProvider {
  id: string;
  name: string;
  provider_type: 'openai' | 'gemini' | 'deepseek' | 'lovable';
  api_key: string | null;
  model: string;
  is_active: boolean;
  is_fallback: boolean;
  created_at: string;
  updated_at: string;
}

interface AIUsageLog {
  id: string;
  provider: string;
  module: string;
  task_type: string | null;
  success: boolean;
  error_message: string | null;
  response_time_ms: number | null;
  tokens_used: number | null;
  created_at: string;
}

// ─── Provider configs ─────────────────────────────
const PROVIDER_CONFIG: Record<string, {
  icon: typeof Brain;
  color: string;
  glow: string;
  models: { value: string; label: string }[];
  description: string;
}> = {
  lovable: {
    icon: Sparkles,
    color: '#8b5cf6',
    glow: '#8b5cf618',
    models: [
      { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
      { value: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
      { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
      { value: 'openai/gpt-5', label: 'GPT-5' },
      { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
      { value: 'openai/gpt-5-nano', label: 'GPT-5 Nano' },
      { value: 'openai/gpt-5.2', label: 'GPT-5.2' },
    ],
    description: 'IA integrada da plataforma. Não requer API Key. Inclui modelos Google e OpenAI.',
  },
  openai: {
    icon: Brain,
    color: '#10b981',
    glow: '#10b98118',
    models: [
      { value: 'gpt-5.2', label: 'GPT-5.2' },
      { value: 'gpt-5', label: 'GPT-5' },
      { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
      { value: 'gpt-5-nano', label: 'GPT-5 Nano' },
      { value: 'chatgpt-5.1-mini', label: 'ChatGPT-5.1 Mini' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      { value: 'o3', label: 'o3' },
      { value: 'o3-mini', label: 'o3 Mini' },
      { value: 'o4-mini', label: 'o4 Mini' },
    ],
    description: 'API direta OpenAI. Requer chave de API válida.',
  },
  gemini: {
    icon: Cpu,
    color: '#3b82f6',
    glow: '#3b82f618',
    models: [
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
    description: 'API direta Google Gemini. Requer chave de API válida.',
  },
  deepseek: {
    icon: Zap,
    color: '#f59e0b',
    glow: '#f59e0b18',
    models: [
      { value: 'deepseek-chat', label: 'DeepSeek Chat' },
      { value: 'deepseek-coder', label: 'DeepSeek Coder' },
      { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
    ],
    description: 'API DeepSeek. Requer chave de API válida. Opcional.',
  },
};

// ─── Provider Card ────────────────────────────────
function ProviderCard({
  provider,
  config,
  onActivate,
  onSave,
  onTest,
  isActivating,
  isTesting,
}: {
  provider: AIProvider;
  config: typeof PROVIDER_CONFIG[string];
  onActivate: () => void;
  onSave: (updates: Partial<AIProvider>) => void;
  onTest: () => void;
  isActivating: boolean;
  isTesting: boolean;
}) {
  const [apiKey, setApiKey] = useState(provider.api_key || '');
  const [model, setModel] = useState(provider.model);
  const [showKey, setShowKey] = useState(false);
  const [isFallback, setIsFallback] = useState(provider.is_fallback);
  const Icon = config.icon;
  const isLovable = provider.provider_type === 'lovable';

  const handleSave = () => {
    onSave({
      api_key: isLovable ? null : apiKey,
      model,
      is_fallback: isFallback,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        'relative overflow-hidden transition-all duration-300',
        provider.is_active && 'ring-2',
      )} style={provider.is_active ? { borderColor: config.color, boxShadow: `0 0 20px ${config.color}30` } : {}}>
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${config.color}, transparent)` }} />

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${config.color}20`, border: `1px solid ${config.color}35` }}
              >
                <Icon className="h-5 w-5" style={{ color: config.color }} />
              </div>
              <div>
                <CardTitle className="text-base font-bold">{provider.name}</CardTitle>
                <CardDescription className="text-xs">{config.description}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {provider.is_active && (
                <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-[10px] font-bold uppercase">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Ativa
                </Badge>
              )}
              {provider.is_fallback && !provider.is_active && (
                <Badge variant="outline" className="text-[10px] font-bold uppercase border-amber-500/30 text-amber-500">
                  <Shield className="h-3 w-3 mr-1" /> Fallback
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* API Key */}
          {!isLovable && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">API Key</label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Model Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Modelo</label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.models.map(m => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fallback toggle */}
          {!provider.is_active && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">Usar como Fallback</p>
                <p className="text-[10px] text-muted-foreground">Será usada se a IA principal falhar</p>
              </div>
              <Switch checked={isFallback} onCheckedChange={setIsFallback} />
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleSave} className="text-xs">
              Salvar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onTest}
              disabled={isTesting || (!isLovable && !apiKey)}
              className="text-xs"
            >
              {isTesting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Activity className="h-3 w-3 mr-1" />}
              Testar Conexão
            </Button>
            {!provider.is_active && (
              <Button
                size="sm"
                onClick={onActivate}
                disabled={isActivating || (!isLovable && !apiKey)}
                className="text-xs text-white"
                style={{ background: config.color }}
              >
                {isActivating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Zap className="h-3 w-3 mr-1" />}
                Ativar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Usage Stats ──────────────────────────────────
function UsageStats({ logs }: { logs: AIUsageLog[] }) {
  const totalCalls = logs.length;
  const successCalls = logs.filter(l => l.success).length;
  const failCalls = totalCalls - successCalls;
  const avgTime = totalCalls > 0 ? Math.round(logs.reduce((a, l) => a + (l.response_time_ms || 0), 0) / totalCalls) : 0;

  const stats = [
    { label: 'Total Chamadas', value: totalCalls, icon: BarChart3, color: '#3b82f6' },
    { label: 'Sucesso', value: successCalls, icon: CheckCircle2, color: '#10b981' },
    { label: 'Falhas', value: failCalls, icon: XCircle, color: '#f43f5e' },
    { label: 'Tempo Médio', value: `${avgTime}ms`, icon: Clock, color: '#f59e0b' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s, i) => (
        <Card key={i} className="p-3">
          <div className="flex items-center gap-2">
            <s.icon className="h-4 w-4" style={{ color: s.color }} />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">{s.label}</span>
          </div>
          <p className="text-xl font-black mt-1">{s.value}</p>
        </Card>
      ))}
    </div>
  );
}

// ─── Recent Logs ──────────────────────────────────
function RecentLogs({ logs }: { logs: AIUsageLog[] }) {
  if (logs.length === 0) return (
    <Card className="p-6 text-center">
      <p className="text-sm text-muted-foreground">Nenhum log de uso registrado ainda.</p>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">Logs Recentes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-64">
          <div className="divide-y divide-border">
            {logs.slice(0, 50).map(log => (
              <div key={log.id} className="px-4 py-2.5 flex items-center gap-3 text-xs">
                {log.success ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{log.provider}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5">{log.module}</Badge>
                  </div>
                  {log.error_message && (
                    <p className="text-destructive truncate mt-0.5">{log.error_message}</p>
                  )}
                </div>
                <span className="text-muted-foreground whitespace-nowrap">
                  {log.response_time_ms ? `${log.response_time_ms}ms` : '—'}
                </span>
                <span className="text-muted-foreground/60 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────
export function AISettings() {
  const queryClient = useQueryClient();
  const [testingId, setTestingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // Fetch providers
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_providers')
        .select('*')
        .order('created_at');
      if (error) throw error;
      return data as AIProvider[];
    },
  });

  // Fetch usage logs
  const { data: logs = [] } = useQuery({
    queryKey: ['ai-usage-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AIUsageLog[];
    },
  });

  // Save provider
  const saveMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AIProvider> }) => {
      const { error } = await supabase.from('ai_providers').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      toast.success('Provider salvo com sucesso');
    },
    onError: () => toast.error('Erro ao salvar provider'),
  });

  // Activate provider
  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      // Deactivate all
      const { error: e1 } = await supabase.from('ai_providers').update({ is_active: false }).neq('id', 'placeholder');
      if (e1) throw e1;
      // Activate selected
      const { error: e2 } = await supabase.from('ai_providers').update({ is_active: true, is_fallback: false }).eq('id', id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      toast.success('IA ativada com sucesso!');
      setActivatingId(null);
    },
    onError: () => {
      toast.error('Erro ao ativar IA');
      setActivatingId(null);
    },
  });

  // Test connection
  const handleTest = async (provider: AIProvider) => {
    setTestingId(provider.id);
    try {
      const { data, error } = await supabase.functions.invoke('ai-engine', {
        body: {
          action: 'test',
          providerId: provider.id,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Conexão com ${provider.name} OK! Tempo: ${data.responseTime}ms`);
      } else {
        toast.error(`Falha na conexão: ${data?.error || 'Erro desconhecido'}`);
      }
    } catch (err: any) {
      toast.error(`Erro ao testar: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  };

  // Add new provider
  const addProvider = async (providerType: string) => {
    const config = PROVIDER_CONFIG[providerType];
    if (!config) return;
    const exists = providers.some(p => p.provider_type === providerType);
    if (exists) {
      toast.info('Este provider já está cadastrado');
      return;
    }
    const { error } = await supabase.from('ai_providers').insert({
      name: providerType === 'openai' ? 'OpenAI' : providerType === 'gemini' ? 'Google Gemini' : 'DeepSeek',
      provider_type: providerType,
      model: config.models[0].value,
      is_active: false,
    });
    if (error) {
      toast.error('Erro ao adicionar provider');
    } else {
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      toast.success('Provider adicionado');
    }
  };

  const activeProvider = providers.find(p => p.is_active);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active AI Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-xl p-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">IA Ativa no Sistema</p>
            <p className="text-lg font-black text-foreground">
              {activeProvider ? `${activeProvider.name} — ${activeProvider.model}` : 'Nenhuma IA configurada'}
            </p>
          </div>
          {activeProvider && (
            <motion.div
              className="w-3 h-3 rounded-full bg-emerald-500"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </div>
      </motion.div>

      {/* Usage Stats */}
      <UsageStats logs={logs} />

      {/* Provider Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Provedores de IA</h3>
          <div className="flex gap-1.5">
            {['openai', 'gemini', 'deepseek'].map(type => {
              const exists = providers.some(p => p.provider_type === type);
              if (exists) return null;
              return (
                <Button key={type} size="sm" variant="outline" className="text-xs h-7" onClick={() => addProvider(type)}>
                  + {type === 'openai' ? 'OpenAI' : type === 'gemini' ? 'Gemini' : 'DeepSeek'}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4">
          {providers.map(provider => {
            const config = PROVIDER_CONFIG[provider.provider_type];
            if (!config) return null;
            return (
              <ProviderCard
                key={provider.id}
                provider={provider}
                config={config}
                onActivate={() => {
                  setActivatingId(provider.id);
                  activateMutation.mutate(provider.id);
                }}
                onSave={(updates) => saveMutation.mutate({ id: provider.id, updates })}
                onTest={() => handleTest(provider)}
                isActivating={activatingId === provider.id}
                isTesting={testingId === provider.id}
              />
            );
          })}
        </div>
      </div>

      {/* Logs */}
      <RecentLogs logs={logs} />

      {/* Info */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-500">Importante</p>
            <p className="text-muted-foreground">
              A troca de IA ativa afeta todos os módulos que utilizam inteligência artificial (Chat, E-mail, INPI, etc).
              Recomendamos testar a conexão antes de ativar. O sistema possui fallback automático caso a IA principal falhe.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
