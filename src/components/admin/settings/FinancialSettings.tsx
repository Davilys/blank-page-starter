import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { SettingsCard } from './SettingsCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, DollarSign, Calendar, Percent, CreditCard, Save, Loader2 } from 'lucide-react';

interface FinancialSettingsData {
  currency: string;
  inpiFee: number;
  dueDays: number;
  cashDiscount: number;
  maxInstallments: number;
}

export function FinancialSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['system-settings', 'financial'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'financial')
        .single();
      if (error) throw error;
      return data?.value as unknown as FinancialSettingsData;
    },
  });

  const [settings, setSettings] = useState<FinancialSettingsData>({
    currency: 'BRL',
    inpiFee: 355,
    dueDays: 7,
    cashDiscount: 5,
    maxInstallments: 12,
  });

  useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (data: FinancialSettingsData) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: JSON.parse(JSON.stringify(data)), updated_at: new Date().toISOString() })
        .eq('key', 'financial');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings', 'financial'] });
      toast.success('Configurações financeiras salvas!');
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
      {/* Currency */}
      <SettingsCard
        icon={DollarSign}
        iconColor="text-green-500"
        title="Moeda Padrão"
        description="Moeda utilizada para exibição de valores"
      >
        <Select
          value={settings.currency}
          onValueChange={(v) => setSettings({ ...settings, currency: v })}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BRL">R$ - Real Brasileiro</SelectItem>
            <SelectItem value="USD">$ - Dólar Americano</SelectItem>
            <SelectItem value="EUR">€ - Euro</SelectItem>
          </SelectContent>
        </Select>
      </SettingsCard>

      {/* INPI Fee */}
      <SettingsCard
        icon={Wallet}
        iconColor="text-blue-500"
        title="Taxa INPI Padrão"
        description="Valor padrão da taxa de serviço do INPI"
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">R$</span>
          <Input
            type="number"
            value={settings.inpiFee}
            onChange={(e) => setSettings({ ...settings, inpiFee: parseFloat(e.target.value) || 0 })}
            className="w-32"
          />
          <span className="text-sm text-muted-foreground">
            Este valor é sugerido automaticamente em novos orçamentos
          </span>
        </div>
      </SettingsCard>

      {/* Due Days */}
      <SettingsCard
        icon={Calendar}
        iconColor="text-orange-500"
        title="Prazo de Vencimento"
        description="Dias padrão para vencimento de faturas"
      >
        <div className="flex items-center gap-3">
          <Select
            value={(settings.dueDays ?? 7).toString()}
            onValueChange={(v) => setSettings({ ...settings, dueDays: parseInt(v) })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 dias</SelectItem>
              <SelectItem value="5">5 dias</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="10">10 dias</SelectItem>
              <SelectItem value="15">15 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            a partir da data de emissão
          </span>
        </div>
      </SettingsCard>

      {/* Cash Discount */}
      <SettingsCard
        icon={Percent}
        iconColor="text-emerald-500"
        title="Desconto à Vista"
        description="Percentual de desconto para pagamento à vista"
      >
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min="0"
            max="100"
            value={settings.cashDiscount}
            onChange={(e) => setSettings({ ...settings, cashDiscount: parseFloat(e.target.value) || 0 })}
            className="w-24"
          />
          <span className="text-muted-foreground">%</span>
          <span className="text-sm text-muted-foreground">
            Aplicado automaticamente em pagamentos PIX/à vista
          </span>
        </div>
      </SettingsCard>

      {/* Max Installments */}
      <SettingsCard
        icon={CreditCard}
        iconColor="text-violet-500"
        title="Parcelamento Máximo"
        description="Número máximo de parcelas para cartão de crédito"
      >
        <div className="flex items-center gap-3">
          <Select
            value={(settings.maxInstallments ?? 12).toString()}
            onValueChange={(v) => setSettings({ ...settings, maxInstallments: parseInt(v) })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            parcelas sem juros
          </span>
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
          Salvar Configurações Financeiras
        </Button>
      </motion.div>
    </motion.div>
  );
}
