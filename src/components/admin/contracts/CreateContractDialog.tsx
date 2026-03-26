import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, FileText, Send, Copy, Link, UserPlus, Search, CalendarIcon, Brain, CheckSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { generateDocumentContent } from '@/lib/documentTemplates';
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
import { z } from 'zod';

interface CreateContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  leadId?: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  company_name: string | null;
  cpf_cnpj: string | null;   // Legacy field - keep for backwards compatibility
  cpf: string | null;        // Specific CPF field
  cnpj: string | null;       // Specific CNPJ field
  address: string | null;
  neighborhood: string | null; // Specific neighborhood field
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

interface ContractTemplate {
  id: string;
  name: string;
  content: string;
  variables: any;
}

type DocumentType = 'contract' | 'procuracao' | 'distrato_multa' | 'distrato_sem_multa';

// NCL class descriptions (Nice Classification - 45 classes)
const NCL_CLASS_DESCRIPTIONS: Record<number, string> = {
  1: 'Produtos químicos',
  2: 'Tintas e vernizes',
  3: 'Cosméticos e produtos de limpeza',
  4: 'Óleos e combustíveis',
  5: 'Produtos farmacêuticos',
  6: 'Metais comuns',
  7: 'Máquinas e ferramentas',
  8: 'Ferramentas manuais',
  9: 'Aparelhos eletrônicos e tecnologia',
  10: 'Equipamentos médicos',
  11: 'Iluminação e climatização',
  12: 'Veículos',
  13: 'Armas de fogo',
  14: 'Joalheria e relojoaria',
  15: 'Instrumentos musicais',
  16: 'Papel e impressos',
  17: 'Borracha e plásticos',
  18: 'Couro e artigos de viagem',
  19: 'Materiais de construção',
  20: 'Móveis',
  21: 'Utensílios domésticos',
  22: 'Cordas e fibras têxteis',
  23: 'Fios para uso têxtil',
  24: 'Tecidos e coberturas',
  25: 'Vestuário, calçados e chapelaria',
  26: 'Rendas e bordados',
  27: 'Tapetes e revestimentos',
  28: 'Jogos e brinquedos',
  29: 'Alimentos de origem animal',
  30: 'Alimentos de origem vegetal',
  31: 'Produtos agrícolas',
  32: 'Cervejas e bebidas não alcoólicas',
  33: 'Bebidas alcoólicas',
  34: 'Tabaco',
  35: 'Publicidade e negócios',
  36: 'Seguros e finanças',
  37: 'Construção e reparos',
  38: 'Telecomunicações',
  39: 'Transporte e armazenagem',
  40: 'Tratamento de materiais',
  41: 'Educação e entretenimento',
  42: 'Serviços de TI e científicos',
  43: 'Alimentação e hospedagem',
  44: 'Serviços médicos',
  45: 'Serviços jurídicos e segurança',
};

interface ClientBrand {
  id: string;
  brand_name: string;
  business_area: string | null;
  ncl_classes: number[] | null;
}

// Always returns the production domain to avoid broken links when admin is in Lovable preview
const getProductionBaseUrl = () => {
  const origin = window.location.origin;
  const isPreview = origin.includes('lovableproject.com') || origin.includes('lovable.app') || origin.includes('localhost');
  return isPreview ? 'https://webmarcas.net' : origin;
};

// Validation schemas matching public form
const personalDataSchema = z.object({
  fullName: z.string().min(3, "Nome completo obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(14, "Telefone obrigatório"),
  cpf: z.string().refine(validateCPF, "CPF inválido"),
  cep: z.string().min(9, "CEP obrigatório"),
  address: z.string().min(5, "Endereço obrigatório"),
  neighborhood: z.string().min(2, "Bairro obrigatório"),
  city: z.string().min(2, "Cidade obrigatória"),
  state: z.string().length(2, "UF obrigatório"),
});

const brandDataSchema = z.object({
  brandName: z.string().min(2, "Nome da marca obrigatório"),
  businessArea: z.string().min(3, "Ramo de atividade obrigatório"),
  hasCNPJ: z.boolean(),
  cnpj: z.string().optional(),
  companyName: z.string().optional(),
}).refine((data) => {
  if (data.hasCNPJ) {
    if (!data.cnpj || !validateCNPJ(data.cnpj)) return false;
    if (!data.companyName || data.companyName.length < 3) return false;
  }
  return true;
}, {
  message: "CNPJ ou Razão Social inválidos",
  path: ["cnpj"],
});

// Mapeamento de nomes de templates para document_type
const getDocumentTypeFromTemplateName = (name: string): DocumentType => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('procuração') || lowerName.includes('procuracao')) return 'procuracao';
  if (lowerName.includes('distrato') && lowerName.includes('multa') && !lowerName.includes('sem')) return 'distrato_multa';
  if (lowerName.includes('distrato') && lowerName.includes('sem')) return 'distrato_sem_multa';
  return 'contract';
};

export function CreateContractDialog({ open, onOpenChange, onSuccess, leadId }: CreateContractDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);
  const [isNewClient, setIsNewClient] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [isLoadingCEP, setIsLoadingCEP] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [currentTab, setCurrentTab] = useState('personal');

  // AI suggested classes state
  const [suggestedClasses, setSuggestedClasses] = useState<{ classes: number[]; descriptions: string[] } | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Brand data tab states (existing client flow)
  const [clientBrands, setClientBrands] = useState<ClientBrand[]>([]);
  const [useExistingBrand, setUseExistingBrand] = useState(true);
  const [existingBrandId, setExistingBrandId] = useState<string>('');

  // Client search autocomplete state
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientSearchRef = useRef<HTMLInputElement>(null);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  
  // New client personal data - matching public form exactly
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

  // Brand data - matching public form exactly
  const [brandData, setBrandData] = useState({
    brandName: '',
    businessArea: '',
    hasCNPJ: false,
    cnpj: '',
    companyName: '',
  });

  // Multiple brands support - NEW
  interface BrandItem {
    brandName: string;
    businessArea: string;
    nclClass: string;
  }
  const [brandQuantity, setBrandQuantity] = useState(1);
  const [brandsArray, setBrandsArray] = useState<BrandItem[]>([
    { brandName: '', businessArea: '', nclClass: '' }
  ]);

  // Payment method - matching public form (null = no charge)
  const [paymentMethod, setPaymentMethod] = useState<'avista' | 'cartao6x' | 'boleto3x' | 'recorrente_cartao' | 'recorrente_boleto' | 'recorrente_promocional' | null>(null);
  const [promotionalValue, setPromotionalValue] = useState<string>('');
  
  // Optional payment dates for PIX and Boleto (Admin can customize)
  const [pixPaymentDate, setPixPaymentDate] = useState<Date | undefined>(undefined);
  const [boletoVencimentoDate, setBoletoVencimentoDate] = useState<Date | undefined>(undefined);
  const [distratoMultaDueDate, setDistratoMultaDueDate] = useState<Date | undefined>(undefined);

  // Legacy form data for existing client flows
  const [formData, setFormData] = useState({
    user_id: '',
    subject: '',
    contract_value: '699',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    template_id: '',
    description: '',
    document_type: 'contract' as DocumentType,
    // Document-specific fields
    signatory_name: '',
    signatory_cpf: '',
    signatory_cnpj: '',
    company_address: '',
    company_city: '',
    company_state: '',
    company_cep: '',
    brand_name: '',
    penalty_value: '',
    penalty_installments: '1',
  });

  useEffect(() => {
    if (open) {
      fetchData();
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    // Auto-fill fields when profile is selected
    if (selectedProfile) {
      // Prioritize specific cpf/cnpj fields, fallback to legacy cpf_cnpj
      const cpfValue = selectedProfile.cpf || 
        (selectedProfile.cpf_cnpj?.replace(/[^\d]/g, '').length === 11 ? selectedProfile.cpf_cnpj : '') || '';
      const cnpjValue = selectedProfile.cnpj || 
        (selectedProfile.cpf_cnpj?.replace(/[^\d]/g, '').length === 14 ? selectedProfile.cpf_cnpj : '') || '';
      
      // Build full address including neighborhood
      const fullAddress = selectedProfile.neighborhood 
        ? `${selectedProfile.address || ''}, ${selectedProfile.neighborhood}`.replace(/^, /, '')
        : selectedProfile.address || '';
      
      setFormData(prev => ({
        ...prev,
        signatory_name: selectedProfile.full_name || '',
        signatory_cpf: cpfValue,
        signatory_cnpj: cnpjValue,
        company_address: fullAddress,
        company_city: selectedProfile.city || '',
        company_state: selectedProfile.state || '',
        company_cep: selectedProfile.zip_code || '',
      }));
    }
  }, [selectedProfile]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node) &&
        clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)
      ) {
        setClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered clients for autocomplete — busca por nome, email ou telefone
  const filteredProfileOptions = clientSearch.trim().length === 0
    ? profiles.slice(0, 10)
    : profiles.filter(p => {
        const term = clientSearch.toLowerCase();
        const phone = (p.phone || '').replace(/\D/g, '');
        const termDigits = term.replace(/\D/g, '');
        return (
          p.full_name?.toLowerCase().includes(term) ||
          p.email.toLowerCase().includes(term) ||
          (termDigits.length >= 3 && phone.includes(termDigits))
        );
      }).slice(0, 15);

  const handleSelectClient = async (profile: Profile) => {
    setSelectedProfile(profile);
    setFormData(prev => ({ ...prev, user_id: profile.id }));
    setClientSearch(profile.full_name || profile.email);
    setClientDropdownOpen(false);

    // Fetch client brands
    try {
      const { data: brands } = await supabase
        .from('brand_processes')
        .select('id, brand_name, business_area, ncl_classes')
        .eq('user_id', profile.id)
        .order('brand_name');
      setClientBrands(brands || []);
    } catch (err) {
      console.log('Could not fetch client brands:', err);
      setClientBrands([]);
    }
  };

  const fetchData = async (retryCount = 0) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Aguarda hidratação da sessão para evitar requests com token anônimo (retorno vazio)
      if (!session) {
        if (retryCount < 8) {
          setTimeout(() => fetchData(retryCount + 1), 400);
          return;
        }
        toast.error('Sessão expirada. Faça login novamente para carregar os modelos.');
        return;
      }

      // Busca todos os clientes (jurídico e comercial) com paginação para ultrapassar limite de 1000
      const fetchAllProfiles = async (): Promise<Profile[]> => {
        const allProfiles: Profile[] = [];
        let offset = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, phone, company_name, cpf_cnpj, cpf, cnpj, address, neighborhood, city, state, zip_code')
            .order('full_name')
            .range(offset, offset + batchSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allProfiles.push(...data);
            offset += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        return allProfiles;
      };

      const [allProfiles, templatesRes] = await Promise.all([
        fetchAllProfiles(),
        supabase
          .from('contract_templates')
          .select('id, name, content, variables')
          .eq('is_active', true)
          .order('name'),
      ]);

      if (templatesRes.error) throw templatesRes.error;

      // Retry curto para cobrir corrida eventual pós-login
      if ((templatesRes.data?.length ?? 0) === 0 && retryCount < 2) {
        setTimeout(() => fetchData(retryCount + 1), 350);
        return;
      }

      setProfiles(allProfiles);
      setTemplates(templatesRes.data || []);

      // Auto-select do template padrão de registro
      const standardTemplate = templatesRes.data?.find((t) =>
        t.name.toLowerCase().includes('padrão') && t.name.toLowerCase().includes('registro de marca')
      );

      if (standardTemplate) {
        setSelectedTemplate(standardTemplate);
        setFormData((prev) => ({ ...prev, template_id: standardTemplate.id }));
      }
    } catch (error) {
      console.error('Erro ao carregar clientes/modelos de contrato:', error);

      if (retryCount < 2) {
        setTimeout(() => fetchData(retryCount + 1), 500);
        return;
      }

      toast.error('Falha ao carregar modelos de contrato.');
    }
  };

  const generateContractNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${year}${random}`;
  };

  // CEP auto-fill - same as public form
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

  // Generate contract HTML using standard template - EXACTLY like public form
  const generateNewClientContractHtml = () => {
    const template = selectedTemplate?.content || '';
    
    // For multiple brands, use first brand as primary and pass array
    const primaryBrand = brandQuantity > 1 ? brandsArray[0] : brandData;
    
    // Map class descriptions for the selected classes
    const classDescs = selectedClasses.map(cls => {
      if (suggestedClasses) {
        const idx = suggestedClasses.classes.indexOf(cls);
        if (idx >= 0 && suggestedClasses.descriptions[idx]) {
          return suggestedClasses.descriptions[idx];
        }
      }
      return `Classe ${cls}`;
    });

    return replaceContractVariables(template, {
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
        brandName: brandQuantity > 1 ? primaryBrand.brandName : brandData.brandName,
        businessArea: brandQuantity > 1 ? primaryBrand.businessArea : brandData.businessArea,
        hasCNPJ: brandData.hasCNPJ,
        cnpj: brandData.cnpj,
        companyName: brandData.companyName,
      },
      paymentMethod: paymentMethod,
      multipleBrands: brandQuantity > 1 ? brandsArray : undefined,
      selectedClasses: selectedClasses.length > 0 ? selectedClasses : undefined,
      classDescriptions: selectedClasses.length > 0 ? classDescs : undefined,
      promotionalValue: paymentMethod === 'recorrente_promocional' && promotionalValue ? parseFloat(promotionalValue) : undefined,
    });
  };

  // Get multiplier: if classes selected use that count, otherwise use brandQuantity
  const getQuantityMultiplier = (): number => {
    if (selectedClasses.length > 0) return selectedClasses.length;
    return brandQuantity;
  };

  // Detect plan type from selected template
  const isPremiumTemplate = selectedTemplate?.name.toLowerCase().includes('premium') && selectedTemplate?.name.toLowerCase().includes('registro');
  const isCorporativoTemplate = selectedTemplate?.name.toLowerCase().includes('corporativo') && selectedTemplate?.name.toLowerCase().includes('registro');
  const isRecurringTemplate = isPremiumTemplate || isCorporativoTemplate;

  // Get contract value based on payment method - multiplied by quantity
  const getContractValue = (): number | null => {
    if (!paymentMethod) return null;
    const quantity = getQuantityMultiplier();
    switch (paymentMethod) {
      case 'avista': return 699 * quantity;
      case 'cartao6x': return 1194 * quantity;
      case 'boleto3x': return 1197 * quantity;
      case 'recorrente_cartao':
      case 'recorrente_boleto':
        if (isCorporativoTemplate) return 1621;
        if (isPremiumTemplate) return 398 * quantity;
        return null;
      case 'recorrente_promocional':
        return promotionalValue ? parseFloat(promotionalValue) : null;
      default: return null;
    }
  };

  // Get unit value for display
  const getUnitValue = (): number | null => {
    if (!paymentMethod) return null;
    switch (paymentMethod) {
      case 'avista': return 699;
      case 'cartao6x': return 1194;
      case 'boleto3x': return 1197;
      case 'recorrente_cartao':
      case 'recorrente_boleto':
        if (isCorporativoTemplate) return 1621;
        if (isPremiumTemplate) return 398;
        return null;
      case 'recorrente_promocional':
        return promotionalValue ? parseFloat(promotionalValue) : null;
      default: return null;
    }
  };

  // Get payment description for display - with quantity suffix
  const getPaymentDescription = () => {
    if (!paymentMethod) return 'Nenhuma (sem cobrança)';
    const qty = getQuantityMultiplier();
    const label = selectedClasses.length > 0 ? `${qty} classe${qty > 1 ? 's' : ''}` : (qty > 1 ? `${qty} marcas` : '');
    const suffix = label ? ` (${label})` : '';
    switch (paymentMethod) {
      case 'avista': return `PIX à vista - R$ ${(699 * qty).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${suffix}`;
      case 'cartao6x': return `Cartão 6x de R$ ${(199 * qty).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} = R$ ${(1194 * qty).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${suffix}`;
      case 'boleto3x': return `Boleto 3x de R$ ${(399 * qty).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} = R$ ${(1197 * qty).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${suffix}`;
      case 'recorrente_cartao': {
        const val = isCorporativoTemplate ? 1621 : 398;
        return `Cartão Recorrente - R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês`;
      }
      case 'recorrente_boleto': {
        const val = isCorporativoTemplate ? 1621 : 398;
        return `Boleto Recorrente - R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês`;
      }
      case 'recorrente_promocional': {
        const promoVal = promotionalValue ? parseFloat(promotionalValue) : 0;
        return `Valor Promocional Recorrente - R$ ${promoVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês`;
      }
      default: return 'Nenhuma (sem cobrança)';
    }
  };

  // Generate AI suggested classes
  const handleGenerateClasses = async () => {
    if (!brandData.brandName || !brandData.businessArea) {
      toast.error('Preencha o nome da marca e ramo de atividade primeiro');
      return;
    }
    setLoadingClasses(true);
    setSuggestedClasses(null);
    setSelectedClasses([]);
    try {
      const { data, error } = await supabase.functions.invoke('inpi-viability-check', {
        body: { brandName: brandData.brandName, businessArea: brandData.businessArea, classesOnly: true },
      });
      if (error) throw error;
      if (data?.classes && data.classes.length > 0) {
        setSuggestedClasses({
          classes: data.classes,
          descriptions: data.classDescriptions || [],
        });
        toast.success(`${data.classes.length} classes NCL sugeridas`);
      } else {
        toast.warning('Nenhuma classe sugerida retornada pela IA');
      }
    } catch (err: any) {
      console.error('Error generating classes:', err);
      toast.error('Erro ao gerar classes sugeridas');
    } finally {
      setLoadingClasses(false);
    }
  };

  const toggleClassSelection = (cls: number) => {
    setSelectedClasses(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );
  };

  const selectAllClasses = () => {
    if (!suggestedClasses) return;
    setSelectedClasses(
      selectedClasses.length === suggestedClasses.classes.length ? [] : [...suggestedClasses.classes]
    );
  };

  const generateDocumentHtml = () => {
    // For new clients, use the standard contract template with replaced variables
    if (isNewClient) {
      return generateNewClientContractHtml();
    }

    // Extract brand name from subject if brand_name is empty
    // Subject format is usually "CONTRATO REGISTRO DE MARCA - BRAND NAME" or "Procuração INPI - Brand Name"
    const extractBrandFromSubject = (subject: string): string => {
      if (!subject) return '';
      // Try to extract after " - " separator
      const parts = subject.split(' - ');
      if (parts.length > 1) {
        return parts.slice(1).join(' - ').trim();
      }
      // Otherwise return the full subject as brand name
      return subject;
    };

    const effectiveBrandName = formData.brand_name || extractBrandFromSubject(formData.subject) || '';

    // Derive the document type from the selected template to avoid race conditions
    // (e.g., user changes template and immediately clicks "Gerar link" before setFormData applies).
    const effectiveDocumentType: DocumentType = selectedTemplate
      ? getDocumentTypeFromTemplateName(selectedTemplate.name)
      : formData.document_type;

    // Parse address to extract neighborhood if available
    const parseAddressForNeighborhood = (address: string): { mainAddress: string; neighborhood: string } => {
      if (!address) return { mainAddress: '', neighborhood: '' };
      const parts = address.split(',').map(s => s.trim());
      return {
        mainAddress: parts[0] || '',
        neighborhood: parts[1] || '',
      };
    };

    const addressParts = parseAddressForNeighborhood(selectedProfile?.address || formData.company_address || '');

    // Helper function to replace template variables with flexible spacing and case-insensitive
    const replaceVar = (template: string, key: string, value: string): string => {
      const regex = new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'gi');
      return template.replace(regex, value);
    };

    // For existing clients with a selected template - use the template content with profile data
    if (selectedTemplate && selectedProfile) {
      // Check if it's a standard contract template (Registro de Marca INPI)
      const isStandardContract = effectiveDocumentType === 'contract' && 
        selectedTemplate.name.toLowerCase().includes('registro de marca');
      
      // Check if it's a monitoring/maintenance template
      const isMonitoramentoContract = selectedTemplate.name.toLowerCase().includes('monitoramento') ||
        selectedTemplate.name.toLowerCase().includes('manutencao') ||
        selectedTemplate.name.toLowerCase().includes('manutenção');
      
      if (isMonitoramentoContract) {
        // Replace monitoramento-specific variables with profile data
        const currentDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const fullAddress = `${selectedProfile.address || ''}, ${selectedProfile.neighborhood || ''}, ${selectedProfile.city || ''} - ${selectedProfile.state || ''}, CEP ${selectedProfile.zip_code || ''}`.replace(/^, /, '');
        
        let result = selectedTemplate.content;
        result = replaceVar(result, 'nome_cliente', selectedProfile.full_name || formData.signatory_name || '');
        result = replaceVar(result, 'cpf_cnpj', selectedProfile.cpf_cnpj || selectedProfile.cpf || formData.signatory_cpf || '');
        result = replaceVar(result, 'endereco_cliente', fullAddress);
        result = replaceVar(result, 'marca', effectiveBrandName);
        result = replaceVar(result, 'dia_vencimento', '10');
        result = replaceVar(result, 'data_assinatura', currentDate);
        result = replaceVar(result, 'email', selectedProfile.email || '');
        result = replaceVar(result, 'telefone', selectedProfile.phone || '');
        result = replaceVar(result, 'cnpj_empresa', '');
        result = replaceVar(result, 'endereco_empresa', '');
        return result;
      }
      
      if (isStandardContract) {
        // Use replaceContractVariables with profile data
        return replaceContractVariables(selectedTemplate.content, {
          personalData: {
            fullName: selectedProfile.full_name || formData.signatory_name || '',
            email: selectedProfile.email || '',
            phone: selectedProfile.phone || '',
            cpf: selectedProfile.cpf_cnpj?.replace(/[^\d]/g, '').length === 11 
              ? selectedProfile.cpf_cnpj : formData.signatory_cpf || '',
            cep: selectedProfile.zip_code || formData.company_cep || '',
            address: addressParts.mainAddress || selectedProfile.address || formData.company_address || '',
            neighborhood: addressParts.neighborhood,
            city: selectedProfile.city || formData.company_city || '',
            state: selectedProfile.state || formData.company_state || '',
          },
          brandData: {
            brandName: effectiveBrandName,
            businessArea: brandData.businessArea || '',
            hasCNPJ: (selectedProfile.cpf_cnpj?.replace(/[^\d]/g, '').length === 14) || !!formData.signatory_cnpj,
            cnpj: selectedProfile.cpf_cnpj?.replace(/[^\d]/g, '').length === 14 
              ? selectedProfile.cpf_cnpj : formData.signatory_cnpj || '',
            companyName: selectedProfile.company_name || '',
          },
          paymentMethod: paymentMethod,
          selectedClasses: selectedClasses.length > 0 ? selectedClasses : undefined,
          classDescriptions: selectedClasses.length > 0 
            ? selectedClasses.map(c => NCL_CLASS_DESCRIPTIONS[c] || `Classe ${c}`) 
            : undefined,
          promotionalValue: paymentMethod === 'recorrente_promocional' && promotionalValue ? parseFloat(promotionalValue) : undefined,
        });
      }
    }

    // Legacy flow for contracts - use description if provided, or empty template
    if (effectiveDocumentType === 'contract') {
      // If we have a template selected, use its content as fallback
      if (selectedTemplate?.content && !formData.description) {
        return selectedTemplate.content;
      }
      return formData.description || '';
    }

    // For other document types (procuracao, distrato) using database templates
    // Priority: Use selectedTemplate?.content from database and replace variables directly
    if (selectedTemplate?.content) {
      const currentDate = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      
      const fullAddress = `${addressParts.mainAddress}${addressParts.neighborhood ? ', ' + addressParts.neighborhood : ''}, ${selectedProfile?.city || formData.company_city || ''} - ${selectedProfile?.state || formData.company_state || ''}, CEP ${selectedProfile?.zip_code || formData.company_cep || ''}`;
      
      // Prepare variable values
      const nomeEmpresa = selectedProfile?.company_name || formData.signatory_name || selectedProfile?.full_name || '';
      const cnpjValue = formData.signatory_cnpj || (selectedProfile?.cpf_cnpj?.replace(/[^\d]/g, '').length === 14 ? selectedProfile.cpf_cnpj : '') || '';
      const nomeRepresentante = formData.signatory_name || selectedProfile?.full_name || '';
      const cpfRepresentante = formData.signatory_cpf || (selectedProfile?.cpf_cnpj?.replace(/[^\d]/g, '').length === 11 ? selectedProfile.cpf_cnpj : '') || '';
      
      // Replace all template variables with client data using robust replaceVar helper
      let result = selectedTemplate.content;
      
      // Company/Personal data
      result = replaceVar(result, 'nome_empresa', nomeEmpresa);
      result = replaceVar(result, 'endereco_empresa', fullAddress);
      result = replaceVar(result, 'endereco', fullAddress);
      result = replaceVar(result, 'cidade', selectedProfile?.city || formData.company_city || '');
      result = replaceVar(result, 'estado', selectedProfile?.state || formData.company_state || '');
      result = replaceVar(result, 'cep', selectedProfile?.zip_code || formData.company_cep || '');
      result = replaceVar(result, 'cnpj', cnpjValue);
      
      // Representative data - support both variable names
      result = replaceVar(result, 'nome_representante', nomeRepresentante);
      result = replaceVar(result, 'cpf_representante', cpfRepresentante);
      
      // Contact info
      result = replaceVar(result, 'email', selectedProfile?.email || '');
      result = replaceVar(result, 'telefone', selectedProfile?.phone || '');
      
      // Brand and distrato specifics
      result = replaceVar(result, 'marca', effectiveBrandName);
      result = replaceVar(result, 'data_procuracao', currentDate);
      result = replaceVar(result, 'data_distrato', currentDate);
      result = replaceVar(result, 'valor_multa', formData.penalty_value || '0,00');
      result = replaceVar(result, 'numero_parcelas', formData.penalty_installments || '1');
      
      return result;
    }

    // Fallback to generateDocumentContent only if no template selected
    const vars = {
      nome_empresa: selectedProfile?.company_name || formData.signatory_name || selectedProfile?.full_name || '',
      cnpj: formData.signatory_cnpj || (selectedProfile?.cpf_cnpj?.replace(/[^\d]/g, '').length === 14 ? selectedProfile.cpf_cnpj : '') || '',
      endereco: addressParts.mainAddress || selectedProfile?.address || formData.company_address || '',
      cidade: selectedProfile?.city || formData.company_city || '',
      estado: selectedProfile?.state || formData.company_state || '',
      cep: selectedProfile?.zip_code || formData.company_cep || '',
      nome_representante: formData.signatory_name || selectedProfile?.full_name || '',
      cpf_representante: formData.signatory_cpf || (selectedProfile?.cpf_cnpj?.replace(/[^\d]/g, '').length === 11 ? selectedProfile.cpf_cnpj : '') || '',
      email: selectedProfile?.email || '',
      telefone: selectedProfile?.phone || '',
      marca: effectiveBrandName,
      valor_multa: formData.penalty_value || '',
      numero_parcela: formData.penalty_installments || '1',
    };

    // At this point, effectiveDocumentType is guaranteed NOT to be 'contract'
    const nonContractType = effectiveDocumentType as Exclude<DocumentType, 'contract'>;
    return generateDocumentContent(nonContractType, vars);
  };

  const createNewClient = async (): Promise<string | null> => {
    setCreatingClient(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-client-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            email: personalData.email,
            full_name: personalData.fullName,
            phone: personalData.phone,
            cpf: personalData.cpf,
            cnpj: brandData.hasCNPJ ? brandData.cnpj : null,
            cpf_cnpj: personalData.cpf, // Legacy field - keep CPF for compatibility
            company_name: brandData.hasCNPJ ? brandData.companyName : null,
            address: `${personalData.address}, ${personalData.neighborhood}`,
            neighborhood: personalData.neighborhood,
            city: personalData.city,
            state: personalData.state,
            zip_code: personalData.cep,
            brand_name: brandData.brandName,
            business_area: brandData.businessArea,
            client_funnel_type: 'comercial', // NEW: Clients created via contract go to commercial funnel
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Erro ao criar cliente');
      }

      if (result.isExisting) {
        toast.info('Cliente já existente - contrato será vinculado');
      } else {
        toast.success('Novo cliente criado no funil comercial');
      }

      return result.userId;
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast.error(error.message || 'Erro ao criar cliente');
      return null;
    } finally {
      setCreatingClient(false);
    }
  };

  const validateNewClientData = (): boolean => {
    setValidationErrors({});
    const errors: Record<string, string> = {};

    // Validate personal data
    const personalResult = personalDataSchema.safeParse(personalData);
    if (!personalResult.success) {
      personalResult.error.errors.forEach(err => {
        if (err.path[0]) {
          errors[`personal_${err.path[0]}`] = err.message;
        }
      });
    }

    // Validate brand data - handle single and multiple brands
    if (brandQuantity > 1) {
      // Validate multiple brands array
      for (let i = 0; i < brandQuantity; i++) {
        const brand = brandsArray[i];
        if (!brand?.brandName || brand.brandName.trim().length < 2) {
          errors[`brand_${i}_name`] = 'Nome da marca obrigatório (mín. 2 caracteres)';
        }
        if (!brand?.businessArea || brand.businessArea.trim().length < 3) {
          errors[`brand_${i}_area`] = 'Ramo de atividade obrigatório (mín. 3 caracteres)';
        }
      }
      // Also validate CNPJ if selected
      if (brandData.hasCNPJ) {
        if (!brandData.cnpj || !validateCNPJ(brandData.cnpj)) {
          errors['brand_cnpj'] = 'CNPJ inválido';
        }
        if (!brandData.companyName || brandData.companyName.length < 3) {
          errors['brand_companyName'] = 'Razão Social obrigatória';
        }
      }
    } else {
      // Validate single brand
      const brandResult = brandDataSchema.safeParse(brandData);
      if (!brandResult.success) {
        brandResult.error.errors.forEach(err => {
          if (err.path[0]) {
            errors[`brand_${err.path[0]}`] = err.message;
          }
        });
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      // Switch to tab with first error
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey.startsWith('personal_')) {
        setCurrentTab('personal');
      } else if (firstErrorKey.startsWith('brand_')) {
        setCurrentTab('brand');
      }
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent, sendLink = false) => {
    e.preventDefault();
    
    // Validate based on new client or existing
    if (isNewClient) {
      if (!validateNewClientData()) {
        toast.error('Preencha todos os campos obrigatórios corretamente');
        return;
      }
    } else if (!formData.user_id) {
      toast.error('Selecione um cliente');
      return;
    }

    setLoading(true);
    try {
      let userId = formData.user_id;
      let contractSubject = formData.subject;

      // If new client, create first
      if (isNewClient) {
        const newUserId = await createNewClient();
        if (!newUserId) {
          setLoading(false);
          return;
        }
        userId = newUserId;
        // Auto-generate subject for new clients
        contractSubject = `CONTRATO REGISTRO DE MARCA - ${brandData.brandName.toUpperCase()}`;
      }

      const contractHtml = generateDocumentHtml();

      // Check if it's a standard contract template (for existing client payment method)
      const isStandardTemplate = selectedTemplate?.name.toLowerCase().includes('registro de marca') ||
                                  selectedTemplate?.name.toLowerCase().includes('padrão');
      
      // Detect monitoring template
      const isMonitoramento = selectedTemplate?.name.toLowerCase().includes('monitoramento') ||
                               selectedTemplate?.name.toLowerCase().includes('manutencao') ||
                               selectedTemplate?.name.toLowerCase().includes('manutenção');

      // Detect distrato com multa
      const isDistratoMulta = selectedTemplate ? getDocumentTypeFromTemplateName(selectedTemplate.name) === 'distrato_multa' : formData.document_type === 'distrato_multa';

      // Calculate contract value: for new clients OR existing clients with standard template, use calculated value
      // For monitoramento, force R$ 59.00
      // For distrato com multa, use penalty_value
      const contractValue = isMonitoramento
        ? 59.00
        : isDistratoMulta && formData.penalty_value
          ? parseFloat(formData.penalty_value)
          : (isNewClient 
            ? getContractValue() 
            : (isStandardTemplate ? getContractValue() : (formData.contract_value ? parseFloat(formData.contract_value) : null)));

      // Calculate custom due date based on payment method or distrato multa
      const customDueDate = isDistratoMulta && distratoMultaDueDate
        ? distratoMultaDueDate.toISOString().split('T')[0]
        : paymentMethod === 'avista' && pixPaymentDate 
          ? pixPaymentDate.toISOString().split('T')[0]
          : paymentMethod === 'boleto3x' && boletoVencimentoDate
            ? boletoVencimentoDate.toISOString().split('T')[0]
            : null;

      // Get current admin user to register as contract creator
      const { data: { user: adminUser } } = await supabase.auth.getUser();

      const { data: contract, error } = await supabase.from('contracts').insert({
        user_id: userId,
        contract_number: generateContractNumber(),
        subject: contractSubject,
        contract_value: contractValue,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        template_id: selectedTemplate?.id || null,
        description: isNewClient ? null : (formData.description || null),
        contract_html: contractHtml,
        document_type: selectedTemplate ? getDocumentTypeFromTemplateName(selectedTemplate.name) : 'contract',
        signatory_name: isNewClient ? personalData.fullName : (formData.signatory_name || null),
        signatory_cpf: isNewClient ? personalData.cpf : (formData.signatory_cpf || null),
        signatory_cnpj: isNewClient && brandData.hasCNPJ ? brandData.cnpj : (formData.signatory_cnpj || null),
        penalty_value: formData.penalty_value ? parseFloat(formData.penalty_value) : null,
        payment_method: isMonitoramento ? 'boleto_recorrente' : ((isNewClient || isStandardTemplate) && paymentMethod ? paymentMethod : null),
        custom_due_date: customDueDate,
        signature_status: 'not_signed',
        visible_to_client: true,
        lead_id: leadId || null,
        created_by: adminUser?.id || null,
        suggested_classes: selectedClasses.length > 0
          ? { 
              classes: suggestedClasses?.classes || selectedClasses, 
              descriptions: suggestedClasses?.descriptions || selectedClasses.map(c => NCL_CLASS_DESCRIPTIONS[c] || `Classe ${c}`), 
              selected: selectedClasses 
            }
          : (suggestedClasses ? { classes: suggestedClasses.classes, descriptions: suggestedClasses.descriptions, selected: selectedClasses } : null),
      } as any).select().single();

      if (error) throw error;

      setCreatedContractId(contract.id);

      // Camada 2: Atribuir admin como responsável no perfil do cliente (se ainda não tiver)
      if (adminUser?.id && userId) {
        await supabase
          .from('profiles')
          .update({ assigned_to: adminUser.id })
          .eq('id', userId)
          .is('assigned_to', null); // Só atribui se ainda não tiver responsável
      }

      toast.success('Contrato criado com sucesso');

      // Create Asaas charge for Distrato com Multa
      if (isDistratoMulta && formData.penalty_value && parseFloat(formData.penalty_value) > 0 && userId) {
        try {
          const session = await supabase.auth.getSession();
          const penaltyDueDate = distratoMultaDueDate 
            ? distratoMultaDueDate.toISOString().split('T')[0]
            : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Default 3 days
          
          const invoiceRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin-invoice`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.data.session?.access_token}`,
              },
              body: JSON.stringify({
                clientId: userId,
                description: `Multa Distrato - ${formData.brand_name || contractSubject}`,
                value: parseFloat(formData.penalty_value),
                dueDate: penaltyDueDate,
                billingType: 'BOLETO',
                installmentCount: parseInt(formData.penalty_installments) > 1 ? parseInt(formData.penalty_installments) : undefined,
                contractId: contract.id,
              }),
            }
          );
          const invoiceResult = await invoiceRes.json();
          if (invoiceRes.ok && !invoiceResult.error) {
            toast.success(`Cobrança da multa de R$ ${parseFloat(formData.penalty_value).toFixed(2)} criada no Asaas`);
          } else {
            console.error('Error creating penalty invoice:', invoiceResult);
            toast.warning('Distrato criado, mas houve erro ao criar cobrança da multa no Asaas');
          }
        } catch (invoiceErr) {
          console.error('Error creating penalty invoice:', invoiceErr);
          toast.warning('Distrato criado, mas houve erro ao criar cobrança da multa');
        }
      }

      // Check if it's a standard contract template that needs automatic link generation
      const isStandardContractTemplate = selectedTemplate?.name.toLowerCase().includes('registro de marca') ||
                                          selectedTemplate?.name.toLowerCase().includes('padrão');

      if (sendLink) {
        // Pass new client contact info for sending
        await generateAndSendLink(contract.id, isNewClient ? {
          email: personalData.email,
          phone: personalData.phone,
          name: personalData.fullName,
        } : undefined);
      } else if (isStandardContractTemplate) {
        // Auto-generate signature link for standard contracts (without sending)
        await generateSignatureLinkOnly(contract.id);
        onSuccess();
        onOpenChange(false);
        resetForm();
      } else {
        onSuccess();
        onOpenChange(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error creating contract:', error);
      toast.error('Erro ao criar contrato');
    } finally {
      setLoading(false);
    }
  };

  // Generate signature link without sending notifications
  const generateSignatureLinkOnly = async (contractId: string) => {
    try {
      const linkResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-signature-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ contractId, baseUrl: getProductionBaseUrl() }),
        }
      );

      const linkResult = await linkResponse.json();
      
      if (!linkResponse.ok || linkResult.error) {
        console.error('Error generating signature link:', linkResult.error);
        toast.warning('Contrato criado, mas houve erro ao gerar link de assinatura');
        return;
      }

      console.log('Signature link generated automatically:', linkResult.data.url);
      toast.success('Link de assinatura gerado automaticamente');
    } catch (error: any) {
      console.error('Error generating signature link:', error);
      toast.warning('Contrato criado, mas houve erro ao gerar link de assinatura');
    }
  };

  const generateAndSendLink = async (contractId: string, newClientContact?: { email: string; phone: string; name: string }) => {
    setSendingLink(true);
    try {
      // Generate signature link
      const linkResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-signature-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ contractId, baseUrl: getProductionBaseUrl() }),
        }
      );

      const linkResult = await linkResponse.json();
      
      if (!linkResponse.ok || linkResult.error) {
        throw new Error(linkResult.error || 'Erro ao gerar link');
      }

      setGeneratedLink(linkResult.data.url);

      // Send signature request with optional override contact
      const sendResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-signature-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ 
            contractId, 
            channels: ['email', 'whatsapp'], 
            baseUrl: getProductionBaseUrl(),
            // Override contact info for new clients
            overrideContact: newClientContact,
          }),
        }
      );

      const sendResult = await sendResponse.json();
      
      if (sendResponse.ok && sendResult.success) {
        toast.success('Link de assinatura enviado!');
      } else {
        toast.warning('Contrato criado, mas houve erro ao enviar notificações');
      }
    } catch (error: any) {
      console.error('Error generating/sending link:', error);
      toast.error(error.message || 'Erro ao gerar/enviar link');
    } finally {
      setSendingLink(false);
    }
  };

  const copyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      toast.success('Link copiado!');
    }
  };

  const resetForm = () => {
    setPersonalData({
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
    setBrandData({
      brandName: '',
      businessArea: '',
      hasCNPJ: false,
      cnpj: '',
      companyName: '',
    });
    setFormData({
      user_id: '',
      subject: '',
      contract_value: '699',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      template_id: '',
      description: '',
      document_type: 'contract',
      signatory_name: '',
      signatory_cpf: '',
      signatory_cnpj: '',
      company_address: '',
      company_city: '',
      company_state: '',
      company_cep: '',
      brand_name: '',
      penalty_value: '',
      penalty_installments: '1',
    });
    setSelectedProfile(null);
    setSelectedTemplate(null);
    setClientSearch('');
    setClientDropdownOpen(false);
    setGeneratedLink(null);
    setCreatedContractId(null);
    setIsNewClient(false);
    setValidationErrors({});
    setCurrentTab('personal');
    setPaymentMethod(null);
    setPromotionalValue('');
    setPixPaymentDate(undefined);
    setBoletoVencimentoDate(undefined);
    setDistratoMultaDueDate(undefined);
    // Reset multiple brands state
    setBrandQuantity(1);
    setBrandsArray([{ brandName: '', businessArea: '', nclClass: '' }]);
    // Reset AI classes state
    setSuggestedClasses(null);
    setSelectedClasses([]);
    setLoadingClasses(false);
    // Reset brand data tab states
    setClientBrands([]);
    setUseExistingBrand(true);
    setExistingBrandId('');
  };

  const handleProfileChange = async (userId: string) => {
    const profile = profiles.find(p => p.id === userId);
    setSelectedProfile(profile || null);
    
    // Auto-populate form fields with profile data for document generation
    if (profile) {
      // Prioritize specific cpf/cnpj fields, fallback to legacy cpf_cnpj
      const cpfValue = profile.cpf || 
        (profile.cpf_cnpj?.replace(/[^\d]/g, '').length === 11 ? profile.cpf_cnpj : '') || '';
      const cnpjValue = profile.cnpj || 
        (profile.cpf_cnpj?.replace(/[^\d]/g, '').length === 14 ? profile.cpf_cnpj : '') || '';
      
      // Build full address including neighborhood from specific field
      const fullAddress = profile.neighborhood 
        ? `${profile.address || ''}, ${profile.neighborhood}`.replace(/^, /, '')
        : profile.address || '';
      
      // Try to fetch brand name from client's processes
      let brandName = '';
      try {
        const { data: processes } = await supabase
          .from('brand_processes')
          .select('brand_name')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();
        
        if (processes?.brand_name) {
          brandName = processes.brand_name;
        }
      } catch (error) {
        console.log('Could not fetch brand name:', error);
      }
      
      setFormData(prev => ({ 
        ...prev, 
        user_id: userId,
        signatory_name: profile.full_name || '',
        signatory_cpf: cpfValue,
        signatory_cnpj: cnpjValue,
        company_address: fullAddress,
        company_city: profile.city || '',
        company_state: profile.state || '',
        company_cep: profile.zip_code || '',
        brand_name: brandName || prev.brand_name || '',
        // Auto-generate subject if empty
        subject: prev.subject || `Documento - ${profile.full_name || profile.email}`,
      }));

      // Fetch client brands for brand data tab
      try {
        const { data: allBrands } = await supabase
          .from('brand_processes')
          .select('id, brand_name, business_area, ncl_classes')
          .eq('user_id', userId)
          .order('brand_name');
        setClientBrands(allBrands || []);
      } catch (err) {
        console.log('Could not fetch client brands:', err);
        setClientBrands([]);
      }
    } else {
      setFormData(prev => ({ ...prev, user_id: userId }));
    }
  };

  const handleNewClientToggle = (checked: boolean) => {
    setIsNewClient(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, user_id: '' }));
      setSelectedProfile(null);
      // Force standard template for new clients
      const standardTemplate = templates.find(t => 
        t.name.toLowerCase().includes('padrão') && t.name.toLowerCase().includes('registro de marca')
      );
      if (standardTemplate) {
        setSelectedTemplate(standardTemplate);
      }
    }
  };

  const isSpecialDocument = formData.document_type !== 'contract';
  const isDistrato = formData.document_type === 'distrato_multa' || formData.document_type === 'distrato_sem_multa';
  
  // Detect monitoring/maintenance template
  const isMonitoramentoTemplate = selectedTemplate?.name.toLowerCase().includes('monitoramento') ||
                                   selectedTemplate?.name.toLowerCase().includes('manutencao') ||
                                   selectedTemplate?.name.toLowerCase().includes('manutenção');

  // Show "Criar e Enviar Link" button for special documents OR standard contract templates OR monitoramento
  const isStandardContractTemplate = selectedTemplate?.name.toLowerCase().includes('registro de marca') ||
                                      selectedTemplate?.name.toLowerCase().includes('padrão') ||
                                      isMonitoramentoTemplate;
  const showSendLinkButton = isSpecialDocument || isStandardContractTemplate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isNewClient ? 'Criar Novo Cliente + Contrato' : 'Novo Documento'}
          </DialogTitle>
        </DialogHeader>

        {generatedLink ? (
          /* Success state with link */
          <div className="py-6 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <Link className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-green-800">Contrato Criado!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                O link de assinatura foi gerado e enviado ao cliente.
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <Label className="text-xs text-muted-foreground">Link de Assinatura:</Label>
              <div className="flex items-center gap-2 mt-2">
                <Input value={generatedLink} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Válido por 7 dias. O cliente pode assinar acessando este link.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                onSuccess();
                onOpenChange(false);
                resetForm();
              }}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
            {/* Toggle between existing and new client */}
            <div className="flex items-center space-x-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <Checkbox 
                id="newClient" 
                checked={isNewClient}
                onCheckedChange={handleNewClientToggle}
              />
              <label 
                htmlFor="newClient" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                Criar novo cliente (formulário completo)
              </label>
            </div>

            {isNewClient ? (
              /* NEW CLIENT FORM - Matching public form exactly */
              <>
                <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                  <strong>Contrato:</strong> Contrato Padrão - Registro de Marca INPI
                  <br />
                  <span className="text-xs">O mesmo contrato do formulário público será utilizado.</span>
                </div>

                <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="personal">Dados Pessoais</TabsTrigger>
                    <TabsTrigger value="brand">Dados da Marca</TabsTrigger>
                    <TabsTrigger value="payment">Pagamento</TabsTrigger>
                  </TabsList>

                  <TabsContent value="personal" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Preencha os dados do cliente exatamente como no formulário público.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="fullName" className={cn(validationErrors.personal_fullName && "text-destructive")}>
                          Nome Completo *
                        </Label>
                        <Input
                          id="fullName"
                          value={personalData.fullName}
                          onChange={(e) => {
                            setPersonalData({ ...personalData, fullName: e.target.value });
                            if (validationErrors.personal_fullName) {
                              setValidationErrors(prev => { const u = { ...prev }; delete u.personal_fullName; return u; });
                            }
                          }}
                          placeholder="Seu nome completo"
                          className={cn(validationErrors.personal_fullName && "border-destructive focus-visible:ring-destructive")}
                        />
                        {validationErrors.personal_fullName && (
                          <p className="text-destructive text-xs">{validationErrors.personal_fullName}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className={cn(validationErrors.personal_email && "text-destructive")}>
                          E-mail *
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={personalData.email}
                          onChange={(e) => {
                            setPersonalData({ ...personalData, email: e.target.value });
                            if (validationErrors.personal_email) {
                              setValidationErrors(prev => { const u = { ...prev }; delete u.personal_email; return u; });
                            }
                          }}
                          placeholder="seu@email.com"
                          className={cn(validationErrors.personal_email && "border-destructive focus-visible:ring-destructive")}
                        />
                        {validationErrors.personal_email && (
                          <p className="text-destructive text-xs">{validationErrors.personal_email}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className={cn(validationErrors.personal_phone && "text-destructive")}>
                          Telefone *
                        </Label>
                        <Input
                          id="phone"
                          value={personalData.phone}
                          onChange={(e) => {
                            setPersonalData({ ...personalData, phone: formatPhone(e.target.value) });
                            if (validationErrors.personal_phone) {
                              setValidationErrors(prev => { const u = { ...prev }; delete u.personal_phone; return u; });
                            }
                          }}
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                          className={cn(validationErrors.personal_phone && "border-destructive focus-visible:ring-destructive")}
                        />
                        {validationErrors.personal_phone && (
                          <p className="text-destructive text-xs">{validationErrors.personal_phone}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cpf" className={cn(validationErrors.personal_cpf && "text-destructive")}>
                          CPF *
                        </Label>
                        <Input
                          id="cpf"
                          value={personalData.cpf}
                          onChange={(e) => {
                            setPersonalData({ ...personalData, cpf: formatCPF(e.target.value) });
                            if (validationErrors.personal_cpf) {
                              setValidationErrors(prev => { const u = { ...prev }; delete u.personal_cpf; return u; });
                            }
                          }}
                          placeholder="000.000.000-00"
                          maxLength={14}
                          className={cn(validationErrors.personal_cpf && "border-destructive focus-visible:ring-destructive")}
                        />
                        {validationErrors.personal_cpf && (
                          <p className="text-destructive text-xs">{validationErrors.personal_cpf}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cep" className={cn(validationErrors.personal_cep && "text-destructive")}>
                          CEP *
                        </Label>
                        <div className="relative">
                          <Input
                            id="cep"
                            value={personalData.cep}
                            onChange={(e) => {
                              handleCEPChange(e.target.value);
                              if (validationErrors.personal_cep) {
                                setValidationErrors(prev => { const u = { ...prev }; delete u.personal_cep; return u; });
                              }
                            }}
                            placeholder="00000-000"
                            maxLength={9}
                            className={cn(validationErrors.personal_cep && "border-destructive focus-visible:ring-destructive")}
                          />
                          {isLoadingCEP && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        {validationErrors.personal_cep && (
                          <p className="text-destructive text-xs">{validationErrors.personal_cep}</p>
                        )}
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="address" className={cn(validationErrors.personal_address && "text-destructive")}>
                          Endereço *
                        </Label>
                        <Input
                          id="address"
                          value={personalData.address}
                          onChange={(e) => {
                            setPersonalData({ ...personalData, address: e.target.value });
                            if (validationErrors.personal_address) {
                              setValidationErrors(prev => { const u = { ...prev }; delete u.personal_address; return u; });
                            }
                          }}
                          placeholder="Rua, número, complemento"
                          className={cn(validationErrors.personal_address && "border-destructive focus-visible:ring-destructive")}
                        />
                        {validationErrors.personal_address && (
                          <p className="text-destructive text-xs">{validationErrors.personal_address}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="neighborhood" className={cn(validationErrors.personal_neighborhood && "text-destructive")}>
                          Bairro *
                        </Label>
                        <Input
                          id="neighborhood"
                          value={personalData.neighborhood}
                          onChange={(e) => {
                            setPersonalData({ ...personalData, neighborhood: e.target.value });
                            if (validationErrors.personal_neighborhood) {
                              setValidationErrors(prev => { const u = { ...prev }; delete u.personal_neighborhood; return u; });
                            }
                          }}
                          placeholder="Bairro"
                          className={cn(validationErrors.personal_neighborhood && "border-destructive focus-visible:ring-destructive")}
                        />
                        {validationErrors.personal_neighborhood && (
                          <p className="text-destructive text-xs">{validationErrors.personal_neighborhood}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="city" className={cn(validationErrors.personal_city && "text-destructive")}>
                          Cidade *
                        </Label>
                        <Input
                          id="city"
                          value={personalData.city}
                          onChange={(e) => {
                            setPersonalData({ ...personalData, city: e.target.value });
                            if (validationErrors.personal_city) {
                              setValidationErrors(prev => { const u = { ...prev }; delete u.personal_city; return u; });
                            }
                          }}
                          placeholder="Cidade"
                          className={cn(validationErrors.personal_city && "border-destructive focus-visible:ring-destructive")}
                        />
                        {validationErrors.personal_city && (
                          <p className="text-destructive text-xs">{validationErrors.personal_city}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="state" className={cn(validationErrors.personal_state && "text-destructive")}>
                          UF *
                        </Label>
                        <Input
                          id="state"
                          value={personalData.state}
                          onChange={(e) => {
                            setPersonalData({ ...personalData, state: e.target.value.toUpperCase() });
                            if (validationErrors.personal_state) {
                              setValidationErrors(prev => { const u = { ...prev }; delete u.personal_state; return u; });
                            }
                          }}
                          placeholder="UF"
                          maxLength={2}
                          className={cn(validationErrors.personal_state && "border-destructive focus-visible:ring-destructive")}
                        />
                        {validationErrors.personal_state && (
                          <p className="text-destructive text-xs">{validationErrors.personal_state}</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="brand" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Informe os dados da(s) marca(s) que será(ão) registrada(s).
                    </p>

                    {/* Quantity selector for multiple brands */}
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                      <Label className="text-sm font-medium">Quantidade de Marcas a Registrar</Label>
                      <Select 
                        value={brandQuantity.toString()} 
                        onValueChange={(v) => {
                          const qty = parseInt(v);
                          setBrandQuantity(qty);
                          // Adjust brands array
                          if (qty > brandsArray.length) {
                            const newBrands = [...brandsArray];
                            for (let i = brandsArray.length; i < qty; i++) {
                              newBrands.push({ brandName: '', businessArea: '', nclClass: '' });
                            }
                            setBrandsArray(newBrands);
                          } else {
                            setBrandsArray(brandsArray.slice(0, qty));
                          }
                          // Sync first brand with brandData when qty = 1
                          if (qty === 1 && brandsArray.length > 0) {
                            setBrandData(prev => ({
                              ...prev,
                              brandName: brandsArray[0].brandName,
                              businessArea: brandsArray[0].businessArea,
                            }));
                          }
                        }}
                      >
                        <SelectTrigger className="w-full md:w-48">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                            <SelectItem key={n} value={n.toString()}>
                              {n} marca{n > 1 ? 's' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {brandQuantity > 1 && (
                        <p className="text-xs text-muted-foreground">
                          O valor do contrato será calculado automaticamente: {brandQuantity} marcas × valor unitário
                        </p>
                      )}
                    </div>

                    {/* Dynamic brand blocks for multiple brands */}
                    {brandQuantity > 1 ? (
                      <div className="space-y-4">
                        {brandsArray.map((brand, index) => (
                          <div key={index} className={cn(
                            "border rounded-lg p-4 space-y-3 bg-muted/30",
                            (validationErrors[`brand_${index}_name`] || validationErrors[`brand_${index}_area`]) && "border-destructive"
                          )}>
                            <h4 className="font-medium text-sm text-primary">Marca #{index + 1}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label className={cn("text-xs", validationErrors[`brand_${index}_name`] && "text-destructive")}>
                                  Nome da Marca *
                                </Label>
                                <Input
                                  value={brand.brandName}
                                  onChange={(e) => {
                                    const newBrands = [...brandsArray];
                                    newBrands[index] = { ...newBrands[index], brandName: e.target.value };
                                    setBrandsArray(newBrands);
                                    // Clear error on change
                                    if (validationErrors[`brand_${index}_name`]) {
                                      setValidationErrors(prev => {
                                        const updated = { ...prev };
                                        delete updated[`brand_${index}_name`];
                                        return updated;
                                      });
                                    }
                                  }}
                                  placeholder="Nome da marca"
                                  className={cn(validationErrors[`brand_${index}_name`] && "border-destructive focus-visible:ring-destructive")}
                                />
                                {validationErrors[`brand_${index}_name`] && (
                                  <p className="text-destructive text-xs">{validationErrors[`brand_${index}_name`]}</p>
                                )}
                              </div>
                              <div className="space-y-1">
                                <Label className={cn("text-xs", validationErrors[`brand_${index}_area`] && "text-destructive")}>
                                  Ramo de Atividade *
                                </Label>
                                <Input
                                  value={brand.businessArea}
                                  onChange={(e) => {
                                    const newBrands = [...brandsArray];
                                    newBrands[index] = { ...newBrands[index], businessArea: e.target.value };
                                    setBrandsArray(newBrands);
                                    // Clear error on change
                                    if (validationErrors[`brand_${index}_area`]) {
                                      setValidationErrors(prev => {
                                        const updated = { ...prev };
                                        delete updated[`brand_${index}_area`];
                                        return updated;
                                      });
                                    }
                                  }}
                                  placeholder="Ramo de atividade"
                                  className={cn(validationErrors[`brand_${index}_area`] && "border-destructive focus-visible:ring-destructive")}
                                />
                                {validationErrors[`brand_${index}_area`] && (
                                  <p className="text-destructive text-xs">{validationErrors[`brand_${index}_area`]}</p>
                                )}
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Classe NCL</Label>
                                <Select
                                  value={brand.nclClass}
                                  onValueChange={(v) => {
                                    const newBrands = [...brandsArray];
                                    newBrands[index] = { ...newBrands[index], nclClass: v };
                                    setBrandsArray(newBrands);
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Classe" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 45 }, (_, i) => i + 1).map(n => (
                                      <SelectItem key={n} value={n.toString()}>
                                        Classe {n}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Single brand - original form */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="brandName" className={cn(validationErrors.brand_brandName && "text-destructive")}>
                            Nome da Marca *
                          </Label>
                          <Input
                            id="brandName"
                            value={brandData.brandName}
                            onChange={(e) => {
                              setBrandData({ ...brandData, brandName: e.target.value });
                              if (validationErrors.brand_brandName) {
                                setValidationErrors(prev => {
                                  const updated = { ...prev };
                                  delete updated.brand_brandName;
                                  return updated;
                                });
                              }
                            }}
                            placeholder="Nome que será registrado"
                            className={cn(validationErrors.brand_brandName && "border-destructive focus-visible:ring-destructive")}
                          />
                          {validationErrors.brand_brandName && (
                            <p className="text-destructive text-xs">{validationErrors.brand_brandName}</p>
                          )}
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="businessArea" className={cn(validationErrors.brand_businessArea && "text-destructive")}>
                            Ramo de Atividade *
                          </Label>
                          <Input
                            id="businessArea"
                            value={brandData.businessArea}
                            onChange={(e) => {
                              setBrandData({ ...brandData, businessArea: e.target.value });
                              if (validationErrors.brand_businessArea) {
                                setValidationErrors(prev => {
                                  const updated = { ...prev };
                                  delete updated.brand_businessArea;
                                  return updated;
                                });
                              }
                            }}
                            placeholder="Ex: Serviços Jurídicos, Alimentação, etc."
                            className={cn(validationErrors.brand_businessArea && "border-destructive focus-visible:ring-destructive")}
                          />
                          {validationErrors.brand_businessArea && (
                            <p className="text-destructive text-xs">{validationErrors.brand_businessArea}</p>
                          )}
                        </div>

                        {/* AI Generate Classes Button - only for single brand */}
                        {brandQuantity <= 1 && (
                          <div className="md:col-span-2 space-y-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleGenerateClasses}
                              disabled={loadingClasses || !brandData.brandName || !brandData.businessArea}
                              className="gap-2"
                            >
                              {loadingClasses ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Brain className="h-4 w-4" />
                              )}
                              {loadingClasses ? 'Gerando...' : 'Gerar Classes Sugeridas'}
                            </Button>

                            {/* Suggested classes checkboxes */}
                            {suggestedClasses && suggestedClasses.classes.length > 0 && (
                              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium">Classes NCL Sugeridas</p>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={selectAllClasses}
                                    className="h-7 text-xs gap-1"
                                  >
                                    <CheckSquare className="h-3 w-3" />
                                    {selectedClasses.length === suggestedClasses.classes.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                                  </Button>
                                </div>
                                {suggestedClasses.classes.map((cls, idx) => (
                                  <div
                                    key={cls}
                                    className={cn(
                                      "flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors",
                                      selectedClasses.includes(cls) ? "bg-primary/5 border-primary" : "bg-background border-border hover:border-primary/50"
                                    )}
                                   >
                                     <Checkbox
                                       checked={selectedClasses.includes(cls)}
                                       onCheckedChange={() => toggleClassSelection(cls)}
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">Classe {cls}</span>
                                        {idx === 0 && (
                                          <Badge variant="default" className="text-[10px] px-1.5 py-0">
                                            Classe Principal
                                          </Badge>
                                        )}
                                      </div>
                                      {suggestedClasses.descriptions[idx] && (
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                          {suggestedClasses.descriptions[idx]}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {selectedClasses.length > 0 && (
                                  <p className="text-xs text-muted-foreground pt-1">
                                    {selectedClasses.length} classe{selectedClasses.length > 1 ? 's' : ''} selecionada{selectedClasses.length > 1 ? 's' : ''} — valores serão multiplicados por {selectedClasses.length}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* CNPJ section - always visible */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                      <div className="md:col-span-2">
                        <div className="flex items-center space-x-2 py-2">
                          <Checkbox
                            id="hasCNPJ"
                            checked={brandData.hasCNPJ}
                            onCheckedChange={(checked) => setBrandData({ ...brandData, hasCNPJ: !!checked })}
                          />
                          <Label htmlFor="hasCNPJ" className="text-sm font-normal cursor-pointer">
                            Tenho CNPJ e quero vincular à marca
                          </Label>
                        </div>
                      </div>

                      {brandData.hasCNPJ && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="cnpj" className={cn(validationErrors.brand_cnpj && "text-destructive")}>
                              CNPJ *
                            </Label>
                            <Input
                              id="cnpj"
                              value={brandData.cnpj}
                              onChange={(e) => {
                                setBrandData({ ...brandData, cnpj: formatCNPJ(e.target.value) });
                                if (validationErrors.brand_cnpj) {
                                  setValidationErrors(prev => {
                                    const updated = { ...prev };
                                    delete updated.brand_cnpj;
                                    return updated;
                                  });
                                }
                              }}
                              placeholder="00.000.000/0000-00"
                              maxLength={18}
                              className={cn(validationErrors.brand_cnpj && "border-destructive focus-visible:ring-destructive")}
                            />
                            {validationErrors.brand_cnpj && (
                              <p className="text-destructive text-xs">{validationErrors.brand_cnpj}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="companyName" className={cn(validationErrors.brand_companyName && "text-destructive")}>
                              Razão Social *
                            </Label>
                            <Input
                              id="companyName"
                              value={brandData.companyName}
                              onChange={(e) => {
                                setBrandData({ ...brandData, companyName: e.target.value });
                                if (validationErrors.brand_companyName) {
                                  setValidationErrors(prev => {
                                    const updated = { ...prev };
                                    delete updated.brand_companyName;
                                    return updated;
                                  });
                                }
                              }}
                              placeholder="Nome da empresa"
                              className={cn(validationErrors.brand_companyName && "border-destructive focus-visible:ring-destructive")}
                            />
                            {validationErrors.brand_companyName && (
                              <p className="text-destructive text-xs">{validationErrors.brand_companyName}</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="payment" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Selecione a forma de pagamento do cliente.
                    </p>

                    <div className="space-y-3">
                      {/* PIX à vista */}
                      <div className="space-y-2">
                        <div
                          onClick={() => setPaymentMethod('avista')}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            paymentMethod === 'avista'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full border-2 ${
                                paymentMethod === 'avista' 
                                  ? 'border-primary bg-primary' 
                                  : 'border-muted-foreground'
                              }`}>
                                {paymentMethod === 'avista' && (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <div className="w-2 h-2 bg-white rounded-full" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium">PIX à Vista</p>
                                <p className="text-sm text-muted-foreground">Pagamento instantâneo</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary">R$ {(699 * getQuantityMultiplier()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                              {getQuantityMultiplier() > 1 && <p className="text-xs text-muted-foreground">{getQuantityMultiplier()}x R$ 699,00</p>}
                              <p className="text-xs text-green-600 font-medium">43% OFF</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Date picker for PIX - only shows when PIX is selected */}
                        {paymentMethod === 'avista' && (
                          <div className="ml-7 p-3 bg-muted/30 rounded-lg border border-border">
                            <div className="flex items-center gap-2 mb-2">
                              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                              <Label className="text-sm font-medium">Data de pagamento (opcional)</Label>
                            </div>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !pixPaymentDate && "text-muted-foreground"
                                  )}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {pixPaymentDate ? format(pixPaymentDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={pixPaymentDate}
                                  onSelect={setPixPaymentDate}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                  className={cn("p-3 pointer-events-auto")}
                                />
                              </PopoverContent>
                            </Popover>
                            <p className="text-xs text-muted-foreground mt-1">
                              Se não selecionar, será usado pagamento imediato.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Cartão 6x - NO date picker for credit card */}
                      <div
                        onClick={() => setPaymentMethod('cartao6x')}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          paymentMethod === 'cartao6x'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border-2 ${
                              paymentMethod === 'cartao6x' 
                                ? 'border-primary bg-primary' 
                                : 'border-muted-foreground'
                            }`}>
                              {paymentMethod === 'cartao6x' && (
                                <div className="w-full h-full flex items-center justify-center">
                                  <div className="w-2 h-2 bg-white rounded-full" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium">Cartão de Crédito</p>
                              <p className="text-sm text-muted-foreground">Parcelamento sem juros</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">6x de R$ {(199 * getQuantityMultiplier()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            <p className="text-xs text-muted-foreground">Total: R$ {(1194 * getQuantityMultiplier()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                      </div>

                      {/* Boleto 3x */}
                      <div className="space-y-2">
                        <div
                          onClick={() => setPaymentMethod('boleto3x')}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            paymentMethod === 'boleto3x'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full border-2 ${
                                paymentMethod === 'boleto3x' 
                                  ? 'border-primary bg-primary' 
                                  : 'border-muted-foreground'
                              }`}>
                                {paymentMethod === 'boleto3x' && (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <div className="w-2 h-2 bg-white rounded-full" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium">Boleto Bancário</p>
                                <p className="text-sm text-muted-foreground">Parcelamento em 3x</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold">3x de R$ {(399 * getQuantityMultiplier()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                              <p className="text-xs text-muted-foreground">Total: R$ {(1197 * getQuantityMultiplier()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Date picker for Boleto - only shows when Boleto is selected */}
                        {paymentMethod === 'boleto3x' && (
                          <div className="ml-7 p-3 bg-muted/30 rounded-lg border border-border">
                            <div className="flex items-center gap-2 mb-2">
                              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                              <Label className="text-sm font-medium">Data de vencimento do boleto (opcional)</Label>
                            </div>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !boletoVencimentoDate && "text-muted-foreground"
                                  )}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {boletoVencimentoDate ? format(boletoVencimentoDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={boletoVencimentoDate}
                                  onSelect={setBoletoVencimentoDate}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                  className={cn("p-3 pointer-events-auto")}
                                />
                              </PopoverContent>
                            </Popover>
                            <p className="text-xs text-muted-foreground mt-1">
                              Se não selecionar, será usado vencimento automático.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Multiple brands summary */}
                    {brandQuantity > 1 && paymentMethod && (
                      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200">Resumo do Contrato</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <span className="text-muted-foreground">Quantidade de marcas:</span>
                          <span className="font-medium">{brandQuantity}</span>
                          <span className="text-muted-foreground">Valor unitário:</span>
                          <span className="font-medium">R$ {getUnitValue()?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="text-muted-foreground">Total do contrato:</span>
                          <span className="font-bold text-primary text-lg">
                            R$ {getContractValue()?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="bg-muted/50 rounded-lg p-3 text-sm">
                      <strong>Forma selecionada:</strong> {getPaymentDescription()}
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              /* EXISTING CLIENT FORM - Legacy flow */
              <>
                {/* Template Selection */}
                <div className="space-y-2">
                  <Label>Modelo de Documento *</Label>
                  <Select 
                    value={selectedTemplate?.id || ''}
                    onValueChange={(value) => {
                      const template = templates.find(t => t.id === value);
                      setSelectedTemplate(template || null);
                      if (template) {
                        const docType = getDocumentTypeFromTemplateName(template.name);
                        // Auto-generate subject based on template name
                        const tName = template.name.toLowerCase();
                        let autoSubject = '';
                        if (tName.includes('monitoramento') || tName.includes('manutencao') || tName.includes('manutenção')) {
                          autoSubject = 'PLANO DE MONITORAMENTO E MANUTENÇÃO - PÓS CERTIFICADO';
                        } else if (tName.includes('registro de marca')) {
                          autoSubject = 'CONTRATO REGISTRO DE MARCA';
                        } else if (tName.includes('procuração') || tName.includes('procuracao')) {
                          autoSubject = 'PROCURAÇÃO INPI';
                        } else if (tName.includes('distrato')) {
                          autoSubject = 'DISTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORAMENTO PARA REGISTRO DE MARCA JUNTO AO INPI';
                        } else {
                          autoSubject = template.name.toUpperCase();
                        }
                        // Append brand name if available
                        const brandName = formData.brand_name;
                        if (brandName) {
                          autoSubject += ` - ${brandName.toUpperCase()}`;
                        }
                        // Auto-fill contract value based on plan type
                        const tNameCheck = template.name.toLowerCase();
                        let autoValue = '699';
                        if (tNameCheck.includes('corporativo') && tNameCheck.includes('registro')) autoValue = '1621';
                        else if (tNameCheck.includes('premium') && tNameCheck.includes('registro')) autoValue = '398';
                        
                        setFormData(prev => ({ 
                          ...prev, 
                          document_type: docType,
                          template_id: template.id,
                          subject: autoSubject,
                          contract_value: autoValue,
                        }));
                        // Reset payment method when template changes
                        setPaymentMethod(null);
                      }
                    }}
                  >
                    <SelectTrigger className="pointer-events-auto">
                      <SelectValue placeholder="Selecione o modelo" />
                    </SelectTrigger>
                    <SelectContent className="pointer-events-auto z-[100]">
                      {[...templates].sort((a, b) => {
                        const aName = a.name.toLowerCase();
                        const bName = b.name.toLowerCase();
                        if (aName.includes('padrão') && aName.includes('registro')) return -1;
                        if (bName.includes('padrão') && bName.includes('registro')) return 1;
                        return a.name.localeCompare(b.name);
                      }).map(template => {
                        const name = template.name.toLowerCase();
                        let priceLabel = '';
                        if (name.includes('padrão') && name.includes('registro')) priceLabel = ' — R$ 699';
                        else if (name.includes('premium') && name.includes('registro')) priceLabel = ' — R$ 398/mês';
                        else if (name.includes('corporativo') && name.includes('registro')) priceLabel = ' — R$ 1.621/mês';
                        return (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}{priceLabel && <span className="text-muted-foreground">{priceLabel}</span>}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className={cn("grid w-full", isStandardContractTemplate && !isMonitoramentoTemplate ? "grid-cols-3" : "grid-cols-2")}>
                    <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
                    {isStandardContractTemplate && !isMonitoramentoTemplate && (
                      <TabsTrigger value="brand_data">Dados da Marca</TabsTrigger>
                    )}
                    <TabsTrigger value="details">Dados do Signatário</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label>Cliente *</Label>
                        <div className="relative">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                              ref={clientSearchRef}
                              value={clientSearch}
                              onChange={(e) => {
                                setClientSearch(e.target.value);
                                setClientDropdownOpen(true);
                                if (!e.target.value) {
                                  setSelectedProfile(null);
                                  setFormData(prev => ({ ...prev, user_id: '' }));
                                }
                              }}
                              onFocus={() => setClientDropdownOpen(true)}
                              placeholder="Digite para buscar cliente..."
                              className="pl-9"
                            />
                            {selectedProfile && (
                              <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setSelectedProfile(null);
                                  setClientSearch('');
                                  setFormData(prev => ({ ...prev, user_id: '' }));
                                  clientSearchRef.current?.focus();
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          {clientDropdownOpen && filteredProfileOptions.length > 0 && (
                            <div
                              ref={clientDropdownRef}
                              className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
                            >
                              {filteredProfileOptions.map(profile => (
                                <button
                                  key={profile.id}
                                  type="button"
                                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/40 last:border-0"
                                  onMouseDown={(e) => {
                                    e.preventDefault(); // prevent blur before click
                                    handleSelectClient(profile);
                                  }}
                                >
                                  <span className="font-medium">{profile.full_name || profile.email}</span>
                                  {profile.company_name && (
                                    <span className="text-muted-foreground ml-1">— {profile.company_name}</span>
                                  )}
                                  <div className="text-xs text-muted-foreground mt-0.5">{profile.email}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label>Assunto *</Label>
                        <Input
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          placeholder={isSpecialDocument 
                            ? `Ex: ${formData.document_type === 'procuracao' ? 'Procuração INPI - Marca XYZ' : 'Distrato - Marca XYZ'}` 
                            : 'Ex: CONTRATO REGISTRO DE MARCA 699,00'
                          }
                          required
                        />
                      </div>

                      {(isDistrato || isSpecialDocument) && (
                        <div className="space-y-2 col-span-2">
                          <Label>Nome da Marca {isSpecialDocument && '*'}</Label>
                          <Input
                            value={formData.brand_name}
                            onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                            placeholder={isDistrato ? "Nome da marca relacionada ao distrato" : "Nome da marca para o documento"}
                          />
                        </div>
                      )}

                      {formData.document_type !== 'distrato_multa' && (
                        <div className="space-y-2">
                          <Label>Valor do Documento</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.contract_value}
                            onChange={(e) => setFormData({ ...formData, contract_value: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                      )}

                      {formData.document_type === 'distrato_multa' && (
                        <>
                          <div className="space-y-2">
                            <Label>Valor da Multa (R$) *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={formData.penalty_value}
                              onChange={(e) => setFormData({ ...formData, penalty_value: e.target.value })}
                              placeholder="398,00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Nº de Parcelas da Multa</Label>
                            <Input
                              type="number"
                              value={formData.penalty_installments}
                              onChange={(e) => setFormData({ ...formData, penalty_installments: e.target.value })}
                              placeholder="1"
                            />
                          </div>
                          <div className="space-y-2 col-span-2">
                            <Label>Data de Cobrança da Multa</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !distratoMultaDueDate && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {distratoMultaDueDate ? format(distratoMultaDueDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data de vencimento"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={distratoMultaDueDate}
                                  onSelect={setDistratoMultaDueDate}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                  className={cn("p-3 pointer-events-auto")}
                                />
                              </PopoverContent>
                            </Popover>
                            <p className="text-xs text-muted-foreground">
                              Se não selecionar, será usado vencimento em 3 dias.
                            </p>
                          </div>
                          {formData.penalty_value && parseFloat(formData.penalty_value) > 0 && (
                            <div className="col-span-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-2">
                              <h4 className="font-semibold text-amber-800 dark:text-amber-200 text-sm">Resumo da Cobrança da Multa</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <span className="text-muted-foreground">Valor da multa:</span>
                                <span className="font-bold text-primary">
                                  {parseInt(formData.penalty_installments) > 1 
                                    ? `${formData.penalty_installments}x de R$ ${parseFloat(formData.penalty_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                    : `R$ ${parseFloat(formData.penalty_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                  }
                                </span>
                                <span className="text-muted-foreground">Vencimento:</span>
                                <span className="font-medium">
                                  {distratoMultaDueDate ? format(distratoMultaDueDate, "dd/MM/yyyy", { locale: ptBR }) : 'Em 3 dias (automático)'}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                A cobrança será criada automaticamente no Asaas ao salvar.
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      <div className="space-y-2">
                        <Label>Data de Início</Label>
                        <Input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Data Final</Label>
                        <Input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        />
                      </div>

                      {!isSpecialDocument && (
                        <div className="space-y-2 col-span-2">
                          <Label>Descrição / Conteúdo</Label>
                          <Textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={4}
                            placeholder="Detalhes do contrato..."
                          />
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Brand Data Tab - only for standard contract (Registro de Marca) */}
                  {isStandardContractTemplate && !isMonitoramentoTemplate && (
                    <TabsContent value="brand_data" className="space-y-4 mt-4">
                      {/* Toggle: existing brand vs new brand */}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={useExistingBrand ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setUseExistingBrand(true);
                            setSelectedClasses([]);
                            setSuggestedClasses(null);
                          }}
                        >
                          Marca já registrada
                        </Button>
                        <Button
                          type="button"
                          variant={!useExistingBrand ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setUseExistingBrand(false);
                            setExistingBrandId('');
                            setSelectedClasses([]);
                            setSuggestedClasses(null);
                          }}
                        >
                          Nova marca
                        </Button>
                      </div>

                      {useExistingBrand ? (
                        <div className="space-y-4">
                          {/* Select existing brand */}
                          <div className="space-y-2">
                            <Label>Selecionar Marca do Cliente</Label>
                            {clientBrands.length > 0 ? (
                              <Select
                                value={existingBrandId}
                                onValueChange={(brandId) => {
                                  setExistingBrandId(brandId);
                                  const brand = clientBrands.find(b => b.id === brandId);
                                  if (brand) {
                                    setFormData(prev => ({
                                      ...prev,
                                      brand_name: brand.brand_name,
                                      subject: `CONTRATO REGISTRO DE MARCA - ${brand.brand_name.toUpperCase()}`,
                                    }));
                                    // Reset class selection when switching brands
                                    setSelectedClasses([]);
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Escolha uma marca" />
                                </SelectTrigger>
                                <SelectContent>
                                  {clientBrands.map(brand => (
                                    <SelectItem key={brand.id} value={brand.id}>
                                      {brand.brand_name}
                                      {brand.ncl_classes && brand.ncl_classes.length > 0 && (
                                        <span className="text-muted-foreground ml-2">
                                          (Classes: {brand.ncl_classes.join(', ')})
                                        </span>
                                      )}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Este cliente não possui marcas registradas. Use "Nova marca".
                              </p>
                            )}
                          </div>

                          {/* Show existing classes as badges */}
                          {existingBrandId && (() => {
                            const selectedBrand = clientBrands.find(b => b.id === existingBrandId);
                            const existingClasses = selectedBrand?.ncl_classes || [];
                            return existingClasses.length > 0 ? (
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Classes já registradas:</Label>
                                <div className="flex flex-wrap gap-1.5">
                                  {existingClasses.map(cls => (
                                    <Badge key={cls} variant="secondary" className="text-xs">
                                      {cls} - {NCL_CLASS_DESCRIPTIONS[cls] || `Classe ${cls}`}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ) : null;
                          })()}

                          {/* NCL class selection - full list */}
                          {existingBrandId && (
                            <div className="space-y-2">
                              <Label>Selecionar Novas Classes NCL</Label>
                              <p className="text-xs text-muted-foreground">
                                Selecione as classes adicionais para registrar esta marca.
                              </p>
                              <ScrollArea className="h-[300px] rounded-md border p-3">
                                <div className="space-y-1">
                                  {Object.entries(NCL_CLASS_DESCRIPTIONS).map(([num, desc]) => {
                                    const cls = parseInt(num);
                                    const existingClasses = clientBrands.find(b => b.id === existingBrandId)?.ncl_classes || [];
                                    const isExisting = existingClasses.includes(cls);
                                    const isSelected = selectedClasses.includes(cls);
                                    return (
                                      <label
                                        key={cls}
                                        className={cn(
                                          "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                                          isExisting ? "opacity-50 cursor-not-allowed bg-muted/50" :
                                          isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
                                        )}
                                      >
                                        <Checkbox
                                          checked={isSelected || isExisting}
                                          disabled={isExisting}
                                          onCheckedChange={() => !isExisting && toggleClassSelection(cls)}
                                        />
                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold bg-muted text-muted-foreground shrink-0">
                                          {String(cls).padStart(2, '0')}
                                        </span>
                                        <span className="text-sm">{desc}</span>
                                        {isExisting && <Badge variant="outline" className="text-[10px] ml-auto">Já registrada</Badge>}
                                      </label>
                                    );
                                  })}
                                </div>
                              </ScrollArea>
                              {selectedClasses.length > 0 && (
                                <p className="text-sm font-medium text-primary">
                                  {selectedClasses.length} nova{selectedClasses.length > 1 ? 's' : ''} classe{selectedClasses.length > 1 ? 's' : ''} selecionada{selectedClasses.length > 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* New brand inputs */}
                          <div className="space-y-2">
                            <Label>Nome da Marca *</Label>
                            <Input
                              value={formData.brand_name}
                              onChange={(e) => {
                                setFormData(prev => ({
                                  ...prev,
                                  brand_name: e.target.value,
                                  subject: e.target.value ? `CONTRATO REGISTRO DE MARCA - ${e.target.value.toUpperCase()}` : prev.subject,
                                }));
                                setBrandData(prev => ({ ...prev, brandName: e.target.value }));
                              }}
                              placeholder="Ex: Minha Marca"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Ramo de Atividade *</Label>
                            <Input
                              value={brandData.businessArea}
                              onChange={(e) => setBrandData(prev => ({ ...prev, businessArea: e.target.value }))}
                              placeholder="Ex: Alimentação, Tecnologia, Moda..."
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleGenerateClasses}
                            disabled={loadingClasses || !formData.brand_name || !brandData.businessArea}
                            className="w-full"
                          >
                            {loadingClasses ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Brain className="h-4 w-4 mr-2" />
                            )}
                            Gerar Classes por IA
                          </Button>

                          {/* Show AI suggested classes */}
                          {suggestedClasses && suggestedClasses.classes.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">Classes sugeridas pela IA:</Label>
                                <Button type="button" variant="ghost" size="sm" onClick={selectAllClasses}>
                                  <CheckSquare className="h-3.5 w-3.5 mr-1" />
                                  {selectedClasses.length === suggestedClasses.classes.length ? 'Desmarcar todas' : 'Selecionar todas'}
                                </Button>
                              </div>
                              {suggestedClasses.classes.map((cls, idx) => {
                                const isSelected = selectedClasses.includes(cls);
                                return (
                                  <label
                                    key={cls}
                                    className={cn(
                                      "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                                      isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
                                    )}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => toggleClassSelection(cls)}
                                    />
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold bg-muted text-muted-foreground shrink-0">
                                      {String(cls).padStart(2, '0')}
                                    </span>
                                    <span className="text-sm">{suggestedClasses.descriptions[idx] || NCL_CLASS_DESCRIPTIONS[cls] || `Classe ${cls}`}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {selectedClasses.length > 0 && (
                            <p className="text-sm font-medium text-primary">
                              {selectedClasses.length} classe{selectedClasses.length > 1 ? 's' : ''} selecionada{selectedClasses.length > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      )}
                    </TabsContent>
                  )}

                  <TabsContent value="details" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      {isSpecialDocument 
                        ? 'Preencha os dados do representante legal que irá assinar o documento.'
                        : 'Dados opcionais do signatário.'}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label>Nome do Representante Legal {isSpecialDocument && '*'}</Label>
                        <Input
                          value={formData.signatory_name}
                          onChange={(e) => setFormData({ ...formData, signatory_name: e.target.value })}
                          placeholder="Nome completo"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>CPF do Representante</Label>
                        <Input
                          value={formData.signatory_cpf}
                          onChange={(e) => setFormData({ ...formData, signatory_cpf: formatCPF(e.target.value) })}
                          placeholder="000.000.000-00"
                          maxLength={14}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>CNPJ da Empresa</Label>
                        <Input
                          value={formData.signatory_cnpj}
                          onChange={(e) => setFormData({ ...formData, signatory_cnpj: formatCNPJ(e.target.value) })}
                          placeholder="00.000.000/0001-00"
                          maxLength={18}
                        />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label>Endereço</Label>
                        <Input
                          value={formData.company_address}
                          onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                          placeholder="Rua, número, bairro"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Cidade</Label>
                        <Input
                          value={formData.company_city}
                          onChange={(e) => setFormData({ ...formData, company_city: e.target.value })}
                          placeholder="São Paulo"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Estado</Label>
                        <Input
                          value={formData.company_state}
                          onChange={(e) => setFormData({ ...formData, company_state: e.target.value.toUpperCase() })}
                          placeholder="SP"
                          maxLength={2}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>CEP</Label>
                        <Input
                          value={formData.company_cep}
                          onChange={(e) => setFormData({ ...formData, company_cep: formatCEP(e.target.value) })}
                          placeholder="00000-000"
                          maxLength={9}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Payment selection for standard contracts with existing clients (NOT for monitoramento) */}
                {isStandardContractTemplate && !isMonitoramentoTemplate && formData.document_type !== 'distrato_multa' && formData.document_type !== 'distrato_sem_multa' && (
                  <div className="space-y-4 mt-4 p-4 bg-muted/30 rounded-lg border">
                    <div>
                      <Label className="font-medium">Forma de Pagamento *</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {isRecurringTemplate 
                          ? `Plano ${isCorporativoTemplate ? 'Corporativo' : 'Premium'} — cobrança mensal recorrente.`
                          : 'Selecione a forma de pagamento para este contrato.'}
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      {isRecurringTemplate ? (
                        <>
                          {/* Cartão Recorrente */}
                          <div
                            onClick={() => setPaymentMethod('recorrente_cartao')}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              paymentMethod === 'recorrente_cartao'
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full border-2 ${
                                  paymentMethod === 'recorrente_cartao' 
                                    ? 'border-primary bg-primary' 
                                    : 'border-muted-foreground'
                                }`}>
                                  {paymentMethod === 'recorrente_cartao' && (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <div className="w-2 h-2 bg-white rounded-full" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">Cartão de Crédito — Recorrente</p>
                                  <p className="text-sm text-muted-foreground">Cobrança mensal automática</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-primary">R$ {isCorporativoTemplate ? '1.621,00' : '398,00'}</p>
                                <p className="text-xs text-muted-foreground">/mês</p>
                              </div>
                            </div>
                          </div>

                          {/* Boleto Recorrente */}
                          <div
                            onClick={() => setPaymentMethod('recorrente_boleto')}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              paymentMethod === 'recorrente_boleto'
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full border-2 ${
                                  paymentMethod === 'recorrente_boleto' 
                                    ? 'border-primary bg-primary' 
                                    : 'border-muted-foreground'
                                }`}>
                                  {paymentMethod === 'recorrente_boleto' && (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <div className="w-2 h-2 bg-white rounded-full" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">Boleto Bancário — Recorrente</p>
                                  <p className="text-sm text-muted-foreground">Boleto mensal automático</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold">R$ {isCorporativoTemplate ? '1.621,00' : '398,00'}</p>
                                <p className="text-xs text-muted-foreground">/mês</p>
                              </div>
                            </div>
                          </div>

                          {/* Valor Promocional Recorrente */}
                          <div className="space-y-2">
                            <div
                              onClick={() => setPaymentMethod('recorrente_promocional')}
                              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                paymentMethod === 'recorrente_promocional'
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-4 h-4 rounded-full border-2 ${
                                    paymentMethod === 'recorrente_promocional' 
                                      ? 'border-primary bg-primary' 
                                      : 'border-muted-foreground'
                                  }`}>
                                    {paymentMethod === 'recorrente_promocional' && (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <div className="w-2 h-2 bg-white rounded-full" />
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium">Valor Promocional — Recorrente</p>
                                    <p className="text-sm text-muted-foreground">Valor personalizado mensal</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {promotionalValue ? (
                                    <>
                                      <p className="text-2xl font-bold text-green-600">R$ {parseFloat(promotionalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                      <p className="text-xs text-muted-foreground">/mês</p>
                                    </>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">Definir valor</p>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {paymentMethod === 'recorrente_promocional' && (
                              <div className="ml-7 p-3 bg-muted/30 rounded-lg border border-border">
                                <Label className="text-sm font-medium">Valor mensal promocional (R$) *</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="1"
                                  value={promotionalValue}
                                  onChange={(e) => setPromotionalValue(e.target.value)}
                                  placeholder="Ex: 800,00"
                                  className="mt-2"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Este valor será cobrado mensalmente de forma recorrente no Asaas e registrado no contrato.
                                </p>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          {/* PIX à vista */}
                          <div
                            onClick={() => setPaymentMethod('avista')}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              paymentMethod === 'avista'
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full border-2 ${
                                  paymentMethod === 'avista' 
                                    ? 'border-primary bg-primary' 
                                    : 'border-muted-foreground'
                                }`}>
                                  {paymentMethod === 'avista' && (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <div className="w-2 h-2 bg-white rounded-full" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">PIX à Vista</p>
                                  <p className="text-sm text-muted-foreground">Pagamento instantâneo</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-primary">R$ 699,00</p>
                                <p className="text-xs text-green-600 font-medium">43% OFF</p>
                              </div>
                            </div>
                          </div>

                          {/* Cartão 6x */}
                          <div
                            onClick={() => setPaymentMethod('cartao6x')}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              paymentMethod === 'cartao6x'
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full border-2 ${
                                  paymentMethod === 'cartao6x' 
                                    ? 'border-primary bg-primary' 
                                    : 'border-muted-foreground'
                                }`}>
                                  {paymentMethod === 'cartao6x' && (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <div className="w-2 h-2 bg-white rounded-full" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">Cartão de Crédito</p>
                                  <p className="text-sm text-muted-foreground">Parcelamento sem juros</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold">6x de R$ 199,00</p>
                                <p className="text-xs text-muted-foreground">Total: R$ 1.194,00</p>
                              </div>
                            </div>
                          </div>

                          {/* Boleto 3x */}
                          <div
                            onClick={() => setPaymentMethod('boleto3x')}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              paymentMethod === 'boleto3x'
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full border-2 ${
                                  paymentMethod === 'boleto3x' 
                                    ? 'border-primary bg-primary' 
                                    : 'border-muted-foreground'
                                }`}>
                                  {paymentMethod === 'boleto3x' && (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <div className="w-2 h-2 bg-white rounded-full" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">Boleto Bancário</p>
                                  <p className="text-sm text-muted-foreground">Parcelamento em 3x</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold">3x de R$ 399,00</p>
                                <p className="text-xs text-muted-foreground">Total: R$ 1.197,00</p>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3 text-sm">
                      <strong>Forma selecionada:</strong> {getPaymentDescription()}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        O valor do contrato será atualizado automaticamente.
                      </span>
                    </div>
                  </div>
                )}

                {/* Monitoramento template info box */}
                {isMonitoramentoTemplate && (
                  <div className="space-y-3 mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-primary/10 text-primary">Plano Recorrente</Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      <p><strong>Mensalidade:</strong> R$ 59,00/mês (boleto automático)</p>
                      <p><strong>Anuidade:</strong> R$ 398,00 (cobrada em dezembro)</p>
                      <p className="text-muted-foreground text-xs mt-2">
                        A cobrança recorrente será criada automaticamente no Asaas após a assinatura do contrato.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              {isNewClient ? (
                <>
                  <Button type="submit" disabled={loading || creatingClient}>
                    {(loading || creatingClient) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Criar Contrato
                  </Button>
                  <Button 
                    type="button" 
                    variant="default"
                    onClick={(e) => handleSubmit(e as any, true)}
                    disabled={loading || sendingLink || creatingClient}
                    className="bg-primary"
                  >
                    {(sendingLink || creatingClient) ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Criar Cliente e Enviar
                  </Button>
                </>
              ) : (
                <>
                  <Button type="submit" disabled={loading || sendingLink}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Criar Documento
                  </Button>
                  {showSendLinkButton && (
                    <Button 
                      type="button" 
                      variant="default"
                      onClick={(e) => handleSubmit(e as any, true)}
                      disabled={loading || sendingLink}
                    >
                      {sendingLink ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Criar e Enviar Link
                    </Button>
                  )}
                </>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
