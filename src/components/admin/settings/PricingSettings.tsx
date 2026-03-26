import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  QrCode, CreditCard, FileText, Save, Loader2, 
  DollarSign, RefreshCw, Eye, Calculator
} from 'lucide-react';
import { usePricing, type PricingData } from '@/hooks/usePricing';

export function PricingSettings() {
  const { pricing, isLoading, invalidate } = usePricing();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<PricingData>({
    avista: { value: 698.97, label: 'R$699' },
    cartao: { value: 1194, installments: 6, installmentValue: 199 },
    boleto: { value: 1197, installments: 3, installmentValue: 399 },
  });

  useEffect(() => {
    if (pricing) {
      setFormData(pricing);
    }
  }, [pricing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Check if pricing entry exists
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('key', 'pricing')
        .maybeSingle();

      const { data: user } = await supabase.auth.getUser();

      // Convert formData to JSON-compatible format
      const valueToSave = JSON.parse(JSON.stringify(formData));

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('system_settings')
          .update({ 
            value: valueToSave,
            updated_at: new Date().toISOString(),
            updated_by: user.user?.id
          })
          .eq('key', 'pricing');

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('system_settings')
          .insert([{ 
            key: 'pricing', 
            value: valueToSave,
            updated_by: user.user?.id
          }]);

        if (error) throw error;
      }

      toast.success('Preços atualizados com sucesso!', {
        description: 'As alterações já estão visíveis no site e checkout.'
      });
      invalidate();
    } catch (error) {
      console.error('Error saving pricing:', error);
      toast.error('Erro ao salvar preços');
    } finally {
      setSaving(false);
    }
  };

  // Auto-calculate total when installments change
  const updateCartaoInstallment = (installmentValue: number) => {
    setFormData(prev => ({
      ...prev,
      cartao: {
        ...prev.cartao,
        installmentValue,
        value: installmentValue * prev.cartao.installments
      }
    }));
  };

  const updateCartaoInstallments = (installments: number) => {
    setFormData(prev => ({
      ...prev,
      cartao: {
        ...prev.cartao,
        installments,
        value: prev.cartao.installmentValue * installments
      }
    }));
  };

  const updateBoletoInstallment = (installmentValue: number) => {
    setFormData(prev => ({
      ...prev,
      boleto: {
        ...prev.boleto,
        installmentValue,
        value: installmentValue * prev.boleto.installments
      }
    }));
  };

  const updateBoletoInstallments = (installments: number) => {
    setFormData(prev => ({
      ...prev,
      boleto: {
        ...prev.boleto,
        installments,
        value: prev.boleto.installmentValue * installments
      }
    }));
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Preços do Registro de Marca
          </h2>
          <p className="text-muted-foreground">
            Configure os valores para cada forma de pagamento. As alterações são aplicadas instantaneamente no site e checkout.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>

      <div className="grid gap-6">
        {/* À Vista (PIX) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-primary/20">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <QrCode className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Pagamento À Vista (PIX)</CardTitle>
                    <CardDescription>Melhor preço para pagamento instantâneo</CardDescription>
                  </div>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  Melhor preço
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.avista.value}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        avista: { ...prev.avista, value: parseFloat(e.target.value) || 0 }
                      }))}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Label exibido no site</Label>
                  <Input
                    value={formData.avista.label}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      avista: { ...prev.avista, label: e.target.value }
                    }))}
                    placeholder="Ex: R$699"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Preview:</span>
                <span className="font-medium">{formatCurrency(formData.avista.value)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Cartão de Crédito */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <CreditCard className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Cartão de Crédito</CardTitle>
                  <CardDescription>Parcelamento no cartão</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Nº de Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    max="12"
                    value={formData.cartao.installments}
                    onChange={(e) => updateCartaoInstallments(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor da Parcela (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.cartao.installmentValue}
                      onChange={(e) => updateCartaoInstallment(parseFloat(e.target.value) || 0)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Valor Total (calculado)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.cartao.value}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        cartao: { ...prev.cartao, value: parseFloat(e.target.value) || 0 }
                      }))}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Calculator className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Preview:</span>
                <span className="font-medium">
                  {formData.cartao.installments}x de {formatCurrency(formData.cartao.installmentValue)} = {formatCurrency(formData.cartao.value)}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Boleto Parcelado */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <FileText className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Boleto Parcelado</CardTitle>
                  <CardDescription>Parcelamento em boletos bancários</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Nº de Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    max="12"
                    value={formData.boleto.installments}
                    onChange={(e) => updateBoletoInstallments(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor da Parcela (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.boleto.installmentValue}
                      onChange={(e) => updateBoletoInstallment(parseFloat(e.target.value) || 0)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Valor Total (calculado)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.boleto.value}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        boleto: { ...prev.boleto, value: parseFloat(e.target.value) || 0 }
                      }))}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Calculator className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Preview:</span>
                <span className="font-medium">
                  {formData.boleto.installments}x de {formatCurrency(formData.boleto.installmentValue)} = {formatCurrency(formData.boleto.value)}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-700 dark:text-blue-400">
                Sincronização Automática
              </p>
              <p className="text-blue-600/80 dark:text-blue-500/80">
                Ao salvar, os preços são atualizados automaticamente em: Site principal, Formulário de registro, Checkout do cliente, Contratos gerados e Painel administrativo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
