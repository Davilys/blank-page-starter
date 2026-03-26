import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { SettingsCard } from './SettingsCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSignature, Clock, Shield, FileText, Save, Loader2 } from 'lucide-react';

interface ContractSettingsData {
  linkValidityDays: number;
  requireSignature: boolean;
  blockchainEnabled: boolean;
}

export function ContractSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['system-settings', 'contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'contracts')
        .single();
      if (error) throw error;
      return data?.value as unknown as ContractSettingsData;
    },
  });

  const { data: templates } = useQuery({
    queryKey: ['contract-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_templates')
        .select('id, name')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const [settings, setSettings] = useState<ContractSettingsData>({
    linkValidityDays: 7,
    requireSignature: true,
    blockchainEnabled: true,
  });

  useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (data: ContractSettingsData) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: JSON.parse(JSON.stringify(data)), updated_at: new Date().toISOString() })
        .eq('key', 'contracts');
      if (error) throw error;

      // Update signature_expires_at on all pending/sent contracts
      const { error: updateError } = await supabase
        .from('contracts')
        .update({
          signature_expires_at: new Date(Date.now() + data.linkValidityDays * 24 * 60 * 60 * 1000).toISOString(),
        })
        .neq('signature_status', 'signed')
        .not('signature_expires_at', 'is', null);

      if (updateError) {
        console.error('Error updating pending contracts:', updateError);
        toast.warning('Configurações salvas, mas houve erro ao atualizar contratos pendentes');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings', 'contracts'] });
      toast.success('Configurações salvas! Contratos pendentes atualizados.');
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
      {/* Link Validity */}
      <SettingsCard
        icon={Clock}
        iconColor="text-blue-500"
        title="Validade do Link de Assinatura"
        description="Tempo de expiração do link enviado para o cliente assinar"
      >
        <div className="flex items-center gap-4">
          <Select
            value={settings.linkValidityDays.toString()}
            onValueChange={(v) => setSettings({ ...settings, linkValidityDays: parseInt(v) })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 dia</SelectItem>
              <SelectItem value="3">3 dias</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="15">15 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            Após esse período, o link expira e o cliente precisa solicitar um novo.
          </span>
        </div>
      </SettingsCard>

      {/* Signature Requirement */}
      <SettingsCard
        icon={FileSignature}
        iconColor="text-violet-500"
        title="Assinatura Obrigatória"
        description="Exigir assinatura digital para validar contratos"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Exigir Assinatura</Label>
            <p className="text-sm text-muted-foreground">
              Contratos só serão considerados válidos após assinatura do cliente
            </p>
          </div>
          <Switch
            checked={settings.requireSignature}
            onCheckedChange={(checked) => setSettings({ ...settings, requireSignature: checked })}
          />
        </div>
      </SettingsCard>

      {/* Blockchain Verification */}
      <SettingsCard
        icon={Shield}
        iconColor="text-emerald-500"
        title="Verificação Blockchain"
        description="Registrar hash do contrato em blockchain para prova de autenticidade"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Ativar Blockchain</Label>
            <p className="text-sm text-muted-foreground">
              Utiliza OpenTimestamps para registro imutável em Bitcoin
            </p>
          </div>
          <Switch
            checked={settings.blockchainEnabled}
            onCheckedChange={(checked) => setSettings({ ...settings, blockchainEnabled: checked })}
          />
        </div>
      </SettingsCard>

      {/* Template Selection */}
      <SettingsCard
        icon={FileText}
        iconColor="text-orange-500"
        title="Templates de Contrato"
        description="Gerencie os modelos de contrato disponíveis"
      >
        <div className="space-y-3">
          {templates && templates.length > 0 ? (
            <div className="space-y-2">
              {templates.map((template) => (
                <div key={template.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <span className="font-medium text-sm">{template.name}</span>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/admin/modelos-contrato">Editar</a>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum template cadastrado. Crie templates na seção de Modelos de Contrato.
            </p>
          )}
          <Button variant="outline" className="w-full" asChild>
            <a href="/admin/modelos-contrato">Gerenciar Templates</a>
          </Button>
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
          Salvar Configurações de Contratos
        </Button>
      </motion.div>
    </motion.div>
  );
}
