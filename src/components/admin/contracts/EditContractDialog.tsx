import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, User, Tag, CreditCard } from 'lucide-react';
import { replaceContractVariables } from '@/hooks/useContractTemplate';
import { 
  validateCPF, 
  validateCNPJ, 
  formatCPF, 
  formatCNPJ, 
  formatCEP, 
  formatPhone,
  fetchAddressByCEP 
} from '@/lib/validators';

interface EditContractDialogProps {
  contract: {
    id: string;
    contract_number: string | null;
    subject: string | null;
    contract_value: number | null;
    payment_method?: string | null;
    signature_status: string | null;
    user_id: string | null;
    asaas_payment_id?: string | null;
    template_id?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  company_name: string | null;
  cpf: string | null;
  cnpj: string | null;
  cpf_cnpj: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

export function EditContractDialog({ contract, open, onOpenChange, onSuccess }: EditContractDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [isLoadingCEP, setIsLoadingCEP] = useState(false);
  const [currentTab, setCurrentTab] = useState('personal');
  const [template, setTemplate] = useState<{ id: string; content: string } | null>(null);

  // Personal data
  const [personalData, setPersonalData] = useState({
    fullName: '',
    email: '',
    phone: '',
    cpf: '',
    cep: '',
    address: '',
    neighborhood: '',
    city: '',
    state: '',
  });

  // Brand data
  const [brandData, setBrandData] = useState({
    brandName: '',
    businessArea: '',
    hasCNPJ: false,
    cnpj: '',
    companyName: '',
  });

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<'avista' | 'cartao6x' | 'boleto3x'>('avista');

  // Load contract data when dialog opens
  useEffect(() => {
    if (open && contract?.user_id) {
      loadContractData();
    }
  }, [open, contract?.id]);

  const loadContractData = async () => {
    if (!contract?.user_id) return;
    
    setLoadingData(true);
    try {
      // Fetch profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', contract.user_id)
        .single();

      if (profileError) throw profileError;

      // Fetch template
      if (contract.template_id) {
        const { data: templateData } = await supabase
          .from('contract_templates')
          .select('id, content')
          .eq('id', contract.template_id)
          .single();
        
        if (templateData) {
          setTemplate(templateData);
        }
      } else {
        // Fetch default template
        const { data: templateData } = await supabase
          .from('contract_templates')
          .select('id, content')
          .eq('is_active', true)
          .ilike('name', '%Registro de Marca%')
          .limit(1)
          .single();
        
        if (templateData) {
          setTemplate(templateData);
        }
      }

      // Fetch brand process for brand data
      const { data: brandProcess } = await supabase
        .from('brand_processes')
        .select('brand_name, business_area')
        .eq('user_id', contract.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Populate personal data
      const cpfValue = profile.cpf || 
        (profile.cpf_cnpj?.replace(/[^\d]/g, '').length === 11 ? profile.cpf_cnpj : '') || '';
      const cnpjValue = profile.cnpj || 
        (profile.cpf_cnpj?.replace(/[^\d]/g, '').length === 14 ? profile.cpf_cnpj : '') || '';

      setPersonalData({
        fullName: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        cpf: cpfValue,
        cep: profile.zip_code || '',
        address: profile.address || '',
        neighborhood: profile.neighborhood || '',
        city: profile.city || '',
        state: profile.state || '',
      });

      // Populate brand data
      const extractedBrandName = brandProcess?.brand_name || extractBrandFromSubject(contract.subject || '');
      setBrandData({
        brandName: extractedBrandName,
        businessArea: brandProcess?.business_area || '',
        hasCNPJ: !!cnpjValue,
        cnpj: cnpjValue,
        companyName: profile.company_name || '',
      });

      // Set payment method
      const method = contract.payment_method as 'avista' | 'cartao6x' | 'boleto3x';
      setPaymentMethod(method || 'avista');

    } catch (error) {
      console.error('Error loading contract data:', error);
      toast.error('Erro ao carregar dados do contrato');
    } finally {
      setLoadingData(false);
    }
  };

  const extractBrandFromSubject = (subject: string): string => {
    if (!subject) return '';
    const parts = subject.split(' - ');
    return parts.length > 1 ? parts.slice(1).join(' - ').trim() : subject;
  };

  // CEP auto-fill
  const handleCEPChange = useCallback(async (value: string) => {
    const formatted = formatCEP(value);
    setPersonalData(prev => ({ ...prev, cep: formatted }));

    const cleanCEP = formatted.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      setIsLoadingCEP(true);
      const addressData = await fetchAddressByCEP(cleanCEP);
      if (addressData) {
        setPersonalData(prev => ({
          ...prev,
          address: addressData.logradouro || prev.address,
          neighborhood: addressData.bairro || prev.neighborhood,
          city: addressData.localidade || prev.city,
          state: addressData.uf || prev.state,
        }));
      }
      setIsLoadingCEP(false);
    }
  }, []);

  // Get contract value based on payment method
  const getContractValue = (): number => {
    switch (paymentMethod) {
      case 'avista': return 699;
      case 'cartao6x': return 1194;
      case 'boleto3x': return 1197;
      default: return 699;
    }
  };

  // Get payment description
  const getPaymentDescription = () => {
    switch (paymentMethod) {
      case 'avista': return 'PIX à vista - R$ 699,00';
      case 'cartao6x': return 'Cartão 6x de R$ 199,00 = R$ 1.194,00';
      case 'boleto3x': return 'Boleto 3x de R$ 399,00 = R$ 1.197,00';
      default: return '';
    }
  };

  // Generate new contract HTML
  const generateContractHtml = () => {
    if (!template?.content) return '';

    return replaceContractVariables(template.content, {
      personalData: {
        fullName: personalData.fullName,
        email: personalData.email,
        phone: personalData.phone,
        cpf: personalData.cpf,
        cep: personalData.cep,
        address: personalData.address,
        neighborhood: personalData.neighborhood,
        city: personalData.city,
        state: personalData.state,
      },
      brandData: {
        brandName: brandData.brandName,
        businessArea: brandData.businessArea,
        hasCNPJ: brandData.hasCNPJ,
        cnpj: brandData.cnpj,
        companyName: brandData.companyName,
      },
      paymentMethod: paymentMethod,
    });
  };

  // Validate form
  const validateForm = () => {
    if (!personalData.fullName || personalData.fullName.length < 3) {
      toast.error('Nome completo é obrigatório');
      return false;
    }
    if (!personalData.email || !personalData.email.includes('@')) {
      toast.error('Email inválido');
      return false;
    }
    if (!personalData.phone || personalData.phone.length < 14) {
      toast.error('Telefone é obrigatório');
      return false;
    }
    if (!personalData.cpf || !validateCPF(personalData.cpf)) {
      toast.error('CPF inválido');
      return false;
    }
    if (!brandData.brandName || brandData.brandName.length < 2) {
      toast.error('Nome da marca é obrigatório');
      return false;
    }
    if (brandData.hasCNPJ && brandData.cnpj && !validateCNPJ(brandData.cnpj)) {
      toast.error('CNPJ inválido');
      return false;
    }
    return true;
  };

  // Save changes
  const handleSave = async () => {
    if (!contract?.id || !contract.user_id) return;
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      // 1. Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: personalData.fullName,
          email: personalData.email,
          phone: personalData.phone,
          cpf: personalData.cpf,
          cpf_cnpj: brandData.hasCNPJ ? brandData.cnpj : personalData.cpf,
          cnpj: brandData.hasCNPJ ? brandData.cnpj : null,
          company_name: brandData.hasCNPJ ? brandData.companyName : null,
          address: personalData.address,
          neighborhood: personalData.neighborhood,
          city: personalData.city,
          state: personalData.state,
          zip_code: personalData.cep,
        })
        .eq('id', contract.user_id);

      if (profileError) throw profileError;

      // 2. Update brand process if exists
      const { data: existingProcess } = await supabase
        .from('brand_processes')
        .select('id')
        .eq('user_id', contract.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingProcess) {
        await supabase
          .from('brand_processes')
          .update({
            brand_name: brandData.brandName,
            business_area: brandData.businessArea,
          })
          .eq('id', existingProcess.id);
      }

      // 3. Generate new contract HTML
      const newContractHtml = generateContractHtml();
      const newContractValue = getContractValue();
      const newSubject = `CONTRATO REGISTRO DE MARCA - ${brandData.brandName.toUpperCase()}`;

      // 4. Update contract
      const { error: contractError } = await supabase
        .from('contracts')
        .update({
          subject: newSubject,
          contract_value: newContractValue,
          payment_method: paymentMethod,
          contract_html: newContractHtml,
          signatory_name: personalData.fullName,
          signatory_cpf: personalData.cpf,
          signatory_cnpj: brandData.hasCNPJ ? brandData.cnpj : null,
        })
        .eq('id', contract.id);

      if (contractError) throw contractError;

      toast.success('Contrato atualizado com sucesso!');
      onSuccess();
      onOpenChange(false);

    } catch (error: any) {
      console.error('Error updating contract:', error);
      toast.error(error.message || 'Erro ao atualizar contrato');
    } finally {
      setLoading(false);
    }
  };

  const hasExistingPayment = !!contract?.asaas_payment_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar Contrato #{contract?.contract_number || ''}
          </DialogTitle>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Warning for existing payment */}
            {hasExistingPayment && (
              <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Este contrato já possui uma cobrança gerada no gateway de pagamento. 
                  Alterações no valor ou método de pagamento não afetarão a cobrança existente.
                </AlertDescription>
              </Alert>
            )}

            <Tabs value={currentTab} onValueChange={setCurrentTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="personal" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Dados Pessoais
                </TabsTrigger>
                <TabsTrigger value="brand" className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Dados da Marca
                </TabsTrigger>
                <TabsTrigger value="payment" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Pagamento
                </TabsTrigger>
              </TabsList>

              {/* Personal Data Tab */}
              <TabsContent value="personal" className="space-y-4 pt-4">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="fullName">Nome Completo *</Label>
                    <Input
                      id="fullName"
                      value={personalData.fullName}
                      onChange={(e) => setPersonalData(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="Nome completo"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">E-mail *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={personalData.email}
                        onChange={(e) => setPersonalData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefone *</Label>
                      <Input
                        id="phone"
                        value={personalData.phone}
                        onChange={(e) => setPersonalData(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                        placeholder="(11) 99999-9999"
                        maxLength={15}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="cpf">CPF *</Label>
                    <Input
                      id="cpf"
                      value={personalData.cpf}
                      onChange={(e) => setPersonalData(prev => ({ ...prev, cpf: formatCPF(e.target.value) }))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="cep">CEP *</Label>
                      <div className="relative">
                        <Input
                          id="cep"
                          value={personalData.cep}
                          onChange={(e) => handleCEPChange(e.target.value)}
                          placeholder="00000-000"
                          maxLength={9}
                        />
                        {isLoadingCEP && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                        )}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="address">Endereço *</Label>
                      <Input
                        id="address"
                        value={personalData.address}
                        onChange={(e) => setPersonalData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Rua, número"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="neighborhood">Bairro *</Label>
                      <Input
                        id="neighborhood"
                        value={personalData.neighborhood}
                        onChange={(e) => setPersonalData(prev => ({ ...prev, neighborhood: e.target.value }))}
                        placeholder="Bairro"
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">Cidade *</Label>
                      <Input
                        id="city"
                        value={personalData.city}
                        onChange={(e) => setPersonalData(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="Cidade"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">UF *</Label>
                      <Input
                        id="state"
                        value={personalData.state}
                        onChange={(e) => setPersonalData(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                        placeholder="SP"
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Brand Data Tab */}
              <TabsContent value="brand" className="space-y-4 pt-4">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="brandName">Nome da Marca *</Label>
                    <Input
                      id="brandName"
                      value={brandData.brandName}
                      onChange={(e) => setBrandData(prev => ({ ...prev, brandName: e.target.value }))}
                      placeholder="Nome da marca a ser registrada"
                    />
                  </div>

                  <div>
                    <Label htmlFor="businessArea">Ramo de Atividade *</Label>
                    <Input
                      id="businessArea"
                      value={brandData.businessArea}
                      onChange={(e) => setBrandData(prev => ({ ...prev, businessArea: e.target.value }))}
                      placeholder="Ex: Restaurante, Loja de roupas, etc."
                    />
                  </div>

                  <div className="flex items-center space-x-2 py-2">
                    <Checkbox
                      id="hasCNPJ"
                      checked={brandData.hasCNPJ}
                      onCheckedChange={(checked) => setBrandData(prev => ({ ...prev, hasCNPJ: !!checked }))}
                    />
                    <Label htmlFor="hasCNPJ" className="cursor-pointer">
                      Possui CNPJ
                    </Label>
                  </div>

                  {brandData.hasCNPJ && (
                    <>
                      <div>
                        <Label htmlFor="cnpj">CNPJ *</Label>
                        <Input
                          id="cnpj"
                          value={brandData.cnpj}
                          onChange={(e) => setBrandData(prev => ({ ...prev, cnpj: formatCNPJ(e.target.value) }))}
                          placeholder="00.000.000/0000-00"
                          maxLength={18}
                        />
                      </div>
                      <div>
                        <Label htmlFor="companyName">Razão Social *</Label>
                        <Input
                          id="companyName"
                          value={brandData.companyName}
                          onChange={(e) => setBrandData(prev => ({ ...prev, companyName: e.target.value }))}
                          placeholder="Razão social da empresa"
                        />
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>

              {/* Payment Tab */}
              <TabsContent value="payment" className="space-y-4 pt-4">
                <div className="grid gap-4">
                  <div>
                    <Label>Forma de Pagamento</Label>
                    <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a forma de pagamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="avista">PIX à vista - R$ 699,00</SelectItem>
                        <SelectItem value="cartao6x">Cartão 6x de R$ 199,00 = R$ 1.194,00</SelectItem>
                        <SelectItem value="boleto3x">Boleto 3x de R$ 399,00 = R$ 1.197,00</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium">Resumo do Pagamento</p>
                    <p className="text-lg font-bold text-primary">{getPaymentDescription()}</p>
                    <p className="text-sm text-muted-foreground">
                      Valor total: R$ {getContractValue().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
