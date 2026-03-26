import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_URL = "https://api.asaas.com/v3";

interface PersonalData {
  fullName: string;
  cpf: string;
  email: string;
  phone: string;
  cep: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface BrandData {
  brandName: string;
  businessArea: string;
  hasCNPJ: boolean;
  cnpj: string;
  companyName: string;
}

interface PaymentRequest {
  personalData: PersonalData;
  brandData: BrandData;
  paymentMethod: string;
  paymentValue: number;
  contractHtml?: string;
  userId?: string;
  documentType?: 'contract' | 'procuracao' | 'distrato_multa' | 'distrato_sem_multa';
  selectedClasses?: number[];
  classDescriptions?: string[];
  suggestedClasses?: number[];
  suggestedClassDescriptions?: string[];
}

interface ContractTemplate {
  id: string;
  name: string;
  content: string;
  is_active: boolean;
}

// Helper function to replace template variables with actual data
function replaceContractVariables(
  template: string,
  data: {
    personalData: PersonalData;
    brandData: BrandData;
    paymentMethod: string;
    paymentValue?: number;
    selectedClasses?: number[];
    classDescriptions?: string[];
  }
): string {
  const { personalData, brandData, paymentMethod, paymentValue } = data;

  // Format current date in Portuguese
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const now = new Date();
  const currentDate = `${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`;

  // Build complete address
  const enderecoCompleto = `${personalData.address}, ${personalData.neighborhood}, ${personalData.city} - ${personalData.state}, CEP ${personalData.cep}`;

  // Razão social or name
  const razaoSocialOuNome = brandData.hasCNPJ && brandData.companyName 
    ? brandData.companyName 
    : personalData.fullName;

  // CNPJ data
  const dadosCnpj = brandData.hasCNPJ && brandData.cnpj 
    ? `inscrita no CNPJ sob nº ${brandData.cnpj}, ` 
    : '';

  // Payment method details
  const getPaymentDetails = () => {
    const classCount = data.selectedClasses?.length || 1;
    const qty = Math.max(classCount, 1);
    
    switch (paymentMethod) {
      case 'avista': {
        const total = 699 * qty;
        const valorIntegral = 1228 * qty;
        const economia = valorIntegral - total;
        const totalSuffix = qty > 1
          ? ` Valor total de ${qty} classes: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
          : '';
        return `• Pagamento à vista via PIX: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${qty === 1 ? 'seiscentos e noventa e nove reais' : 'conforme seleção de classes'}) - com 43% de desconto (economia de R$ ${economia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).${totalSuffix}`;
      }
      case 'cartao6x': {
        const total = 1194 * qty;
        const installment = total / 6;
        const totalSuffix = qty > 1
          ? ` Valor total de ${qty} classes: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
          : '';
        return `• Pagamento parcelado no Cartão de Crédito: 6x de R$ ${installment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} = Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - sem juros.${totalSuffix}`;
      }
      case 'boleto3x': {
        const total = 1197 * qty;
        const installment = total / 3;
        const totalSuffix = qty > 1
          ? ` Valor total de ${qty} classes: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
          : '';
        return `• Pagamento parcelado via Boleto Bancário: 3x de R$ ${installment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} = Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.${totalSuffix}`;
      }
      case 'recorrente_cartao':
        return `• Pagamento mensal recorrente via Cartão de Crédito: R$ ${paymentValue ? paymentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}/mês.`;
      case 'recorrente_boleto':
        return `• Pagamento mensal recorrente via Boleto Bancário: R$ ${paymentValue ? paymentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}/mês.`;
      default:
        return `• Forma de pagamento a ser definida.`;
    }
  };

  // CPF or CNPJ for signature section
  const cpfCnpj = brandData.hasCNPJ && brandData.cnpj 
    ? brandData.cnpj 
    : personalData.cpf;

  // Replace all variables
  let result = template
    .replace(/\{\{nome_cliente\}\}/g, personalData.fullName)
    .replace(/\{\{cpf\}\}/g, personalData.cpf)
    .replace(/\{\{cpf_cnpj\}\}/g, cpfCnpj)
    .replace(/\{\{email\}\}/g, personalData.email)
    .replace(/\{\{telefone\}\}/g, personalData.phone)
    .replace(/\{\{marca\}\}/g, brandData.brandName)
    .replace(/\{\{ramo_atividade\}\}/g, brandData.businessArea)
    .replace(/\{\{endereco_completo\}\}/g, enderecoCompleto)
    .replace(/\{\{endereco\}\}/g, personalData.address)
    .replace(/\{\{bairro\}\}/g, personalData.neighborhood)
    .replace(/\{\{cidade\}\}/g, personalData.city)
    .replace(/\{\{estado\}\}/g, personalData.state)
    .replace(/\{\{cep\}\}/g, personalData.cep)
    .replace(/\{\{razao_social_ou_nome\}\}/g, razaoSocialOuNome)
    .replace(/\{\{dados_cnpj\}\}/g, dadosCnpj)
    .replace(/\{\{forma_pagamento_detalhada\}\}/g, getPaymentDetails())
    .replace(/\{\{data_extenso\}\}/g, currentDate)
    .replace(/\{\{data\}\}/g, now.toLocaleDateString('pt-BR'));

  // Inject NCL classes into clause 1.1 if selectedClasses are provided
  if (data.selectedClasses && data.selectedClasses.length > 0) {
    const classListLines = data.selectedClasses.map((cls, i) => {
      const desc = data.classDescriptions?.[i] || `Classe ${cls}`;
      return `${i + 1}. Marca: ${brandData.brandName} - Classe NCL: ${cls} (${desc})`;
    }).join('\n');

    const clause11Pattern = /registro da marca "[^"]*" junto ao INPI até a conclusão do processo, no ramo de atividade: [^.]+\./i;
    if (clause11Pattern.test(result)) {
      result = result.replace(clause11Pattern, `registro das seguintes marcas junto ao INPI até a conclusão dos processos:\n\n${classListLines}`);
    }
  }

  return result;
}

// Base64 WebMarcas logo for PDF generation - this is the actual logo
const WEBMARCAS_LOGO_BASE64 = 'data:image/png;base64,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';

// Generate full HTML for the contract with the standard layout including real logo
// Supports different document types: contract, procuracao, distrato_multa, distrato_sem_multa
function generateContractHtml(content: string, documentType: 'contract' | 'procuracao' | 'distrato_multa' | 'distrato_sem_multa' = 'contract'): string {
  const htmlContent = content
    .split('\n')
    .filter(line => !line.includes('CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS'))
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<div style="height: 12px;"></div>';
      
      if (/^\d+\.\s*CLÁUSULA/.test(trimmed)) {
        return `<h2 style="font-weight: bold; font-size: 12px; color: #0284c7; margin-top: 20px; margin-bottom: 8px;">${trimmed}</h2>`;
      }
      
      if (/^\d+\.\d+\s/.test(trimmed)) {
        return `<p style="font-size: 11px; margin-bottom: 8px; padding-left: 16px;">${trimmed}</p>`;
      }
      
      if (/^[a-z]\)/.test(trimmed)) {
        return `<p style="font-size: 11px; margin-bottom: 4px; padding-left: 32px;">${trimmed}</p>`;
      }
      
      if (trimmed.startsWith('•')) {
        return `<p style="font-size: 11px; margin-bottom: 8px; padding-left: 16px;">${trimmed}</p>`;
      }
      
      if (/^I+\)/.test(trimmed)) {
        return `<p style="font-size: 11px; margin-bottom: 12px; font-weight: 500;">${trimmed}</p>`;
      }
      
      if (trimmed.match(/^_+$/)) return '';
      
      if (trimmed === 'CONTRATADA:' || trimmed === 'CONTRATANTE:') {
        return `<p style="font-size: 11px; font-weight: bold; text-align: center; margin-top: 24px; margin-bottom: 4px;">${trimmed}</p>`;
      }
      
      if (trimmed.includes('WEB MARCAS PATENTES EIRELI') || trimmed.includes('WebMarcas Intelligence PI') || 
          trimmed.startsWith('CNPJ:') || 
          trimmed.startsWith('CPF:') ||
          trimmed.startsWith('CPF/CNPJ:')) {
        return `<p style="font-size: 10px; text-align: center; color: #6b7280; margin-bottom: 4px;">${trimmed}</p>`;
      }
      
      if (trimmed.startsWith('São Paulo,')) {
        return `<p style="font-size: 11px; margin-top: 24px; margin-bottom: 24px;">${trimmed}</p>`;
      }
      
      return `<p style="font-size: 11px; margin-bottom: 12px; line-height: 1.6;">${trimmed}</p>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contrato WebMarcas</title>
  <style>
    /* Print-specific settings for A4 with exact colors */
    @page { 
      size: A4; 
      margin: 20mm; 
    }
    
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
    }
    
    html, body {
      width: 210mm;
      min-height: 297mm;
    }
    
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      line-height: 1.6; 
      color: #1f2937; 
      background: white !important; 
      padding: 30px; 
      font-size: 11px; 
      max-width: 210mm;
      margin: 0 auto;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    
    /* Header with logo and URL */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      margin-bottom: 0;
    }
    
    .header-logo {
      height: 48px;
      width: auto;
      object-fit: contain;
    }
    
    .header-url {
      color: #0284c7 !important;
      font-weight: 600;
      font-size: 14px;
      text-decoration: none;
    }
    
    /* Orange/Yellow Gradient Bar - MUST preserve colors */
    .gradient-bar {
      height: 8px;
      width: 100%;
      background: linear-gradient(90deg, #f97316, #fbbf24) !important;
      border-radius: 3px;
      margin-bottom: 24px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    /* Blue Main Title - underlined */
    .main-title {
      text-align: center;
      color: #0284c7 !important;
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 16px;
      letter-spacing: -0.5px;
      text-decoration: underline;
    }
    
    /* Dark Blue Box with Contract Title */
    .contract-title-box {
      background-color: #1e3a5f !important;
      color: white !important;
      text-align: center;
      padding: 14px 20px;
      border-radius: 6px;
      margin-bottom: 16px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .contract-title-box p {
      font-weight: 600;
      font-size: 13px;
      line-height: 1.5;
      margin: 0;
      color: white !important;
    }
    
    /* Yellow Highlight Box - LEFT BORDER ONLY */
    .highlight-box {
      background-color: #FEF9E7 !important;
      padding: 16px 20px;
      margin-bottom: 24px;
      border-left: 4px solid #F59E0B !important;
      font-size: 12px;
      line-height: 1.6;
      color: #374151 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .highlight-box p {
      margin-bottom: 10px;
      color: #374151 !important;
    }
    
    .highlight-box p:last-child {
      margin-bottom: 0;
    }
    
    /* Contract Content */
    .content {
      margin-top: 20px;
      color: #1f2937;
    }
    
    .content h2 {
      color: #0284c7 !important;
      font-size: 13px;
      font-weight: bold;
      margin-top: 24px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    
    .content p {
      color: #1f2937;
      font-size: 11px;
      line-height: 1.7;
      margin-bottom: 10px;
      text-align: justify;
      orphans: 3;
      widows: 3;
    }
    
    /* Footer */
    .footer {
      margin-top: 40px;
      text-align: center;
      color: #6b7280 !important;
      font-size: 10px;
      border-top: 1px solid #e5e7eb;
      padding-top: 16px;
      page-break-inside: avoid;
    }
    
    .footer p {
      margin-bottom: 4px;
      color: #6b7280 !important;
    }
    
    /* Print-specific overrides */
    @media print {
      html, body {
        width: 210mm;
        min-height: 297mm;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      
      body {
        padding: 0;
        margin: 0;
      }
      
      .gradient-bar {
        background: linear-gradient(90deg, #f97316, #fbbf24) !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      .contract-title-box {
        background-color: #0EA5E9 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      .highlight-box {
        background-color: #FEF9E7 !important;
        border-left: 4px solid #F59E0B !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      /* Avoid page breaks in important sections */
      .header, .gradient-bar, .main-title, .contract-title-box, .highlight-box {
        page-break-inside: avoid;
        page-break-after: avoid;
      }
      
      .content h2 {
        page-break-after: avoid;
      }
      
      .content p {
        orphans: 3;
        widows: 3;
      }
    }
  </style>
</head>
<body>
  <!-- Header with Logo and URL -->
  <div class="header">
    <img src="${WEBMARCAS_LOGO_BASE64}" alt="WebMarcas" class="header-logo" />
    <span class="header-url">www.webmarcas.net</span>
  </div>
  
  <!-- Orange/Yellow Gradient Bar -->
  <div class="gradient-bar"></div>
  
  ${documentType === 'procuracao' ? `
  <!-- Título da Procuração -->
  <h1 class="main-title">PROCURAÇÃO PARA REPRESENTAÇÃO JUNTO AO INPI</h1>
  <p style="text-align: center; color: #4B5563; font-size: 14px; font-style: italic; margin-bottom: 24px;">Instrumento Particular de Procuração para fins de Registro de Marca</p>
  
  <!-- Caixa Amarela - Aviso Legal de Procuração -->
  <div class="highlight-box">
    <p>Pelo presente instrumento particular de PROCURAÇÃO, o(a) outorgante abaixo identificado(a) nomeia e constitui como seu bastante PROCURADOR o(a) Sr(a). Davilys Danques de Oliveira Cunha, para representá-lo(a) de forma exclusiva junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL – INPI, podendo praticar todos os atos necessários, legais e administrativos relacionados ao pedido, acompanhamento, defesa e manutenção do registro de marca, inclusive apresentação de requerimentos, cumprimento de exigências, interposição de recursos e recebimento de notificações.</p>
  </div>
  ` : documentType === 'distrato_multa' || documentType === 'distrato_sem_multa' ? `
  <!-- Título do Distrato -->
  <h1 class="main-title">ACORDO DE DISTRATO</h1>
  
  <div class="contract-title-box">
    <p>INSTRUMENTO PARTICULAR DE DISTRATO DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS</p>
  </div>
  
  <div class="highlight-box">
    <p>As partes abaixo qualificadas resolvem, de comum acordo, distratar o contrato de prestação de serviços firmado anteriormente, nos termos e condições a seguir estabelecidos.</p>
  </div>
  ` : `
  <!-- Blue Title - CONTRATO underlined -->
  <h1 class="main-title" style="text-decoration: underline;">CONTRATO</h1>
  
  <!-- Light Blue Box with Contract Title -->
  <div class="contract-title-box">
    <p>CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORAMENTO<br/>PARA REGISTRO DE MARCA JUNTO AO INPI</p>
  </div>
  
  <!-- Yellow Highlight Section - LEFT BORDER ONLY -->
  <div class="highlight-box">
    <p>Os termos deste instrumento aplicam-se apenas a contratações com negociações personalizadas, tratadas diretamente com a equipe comercial da WebMarcas Intelligence PI.</p>
    <p>Os termos aqui celebrados são adicionais ao "Contrato de Prestação de Serviços e Gestão de Pagamentos e Outras Avenças" com aceite integral no momento do envio da Proposta.</p>
  </div>
  `}
  
  <!-- Contract Content -->
  <div class="content">
    ${htmlContent}
  </div>
  
  <!-- Footer -->
  <div class="footer">
    <p>Contrato gerado e assinado eletronicamente pelo sistema WebMarcas</p>
    <p>www.webmarcas.net | contato@webmarcas.net</p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ASAAS_API_KEY) {
      throw new Error('ASAAS_API_KEY not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    // Capture client info for signature
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Create Supabase admin client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { personalData, brandData, paymentMethod, paymentValue, contractHtml: providedContractHtml, userId, selectedClasses, classDescriptions, suggestedClasses: suggestedClassesFromClient, suggestedClassDescriptions: suggestedClassDescsFromClient }: PaymentRequest = await req.json();

    console.log('Creating Asaas payment for:', personalData.fullName, '| Method:', paymentMethod);

    // ========================================
    // STEP 0: Fetch the contract template from database
    // This ensures we ALWAYS use the admin-defined template
    // ========================================
    let contractHtml = providedContractHtml;
    let templateId: string | null = null;

    // Always fetch the template from database to ensure we use the latest version
    const { data: templateData, error: templateError } = await supabaseAdmin
      .from('contract_templates')
      .select('id, name, content, is_active')
      .eq('is_active', true)
      .or(`name.ilike.%Contrato Padrão - Registro de Marca INPI%,name.ilike.%Registro de Marca%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (templateData && templateData.length > 0) {
      const template = templateData[0] as ContractTemplate;
      templateId = template.id;
      console.log('Using template from database:', template.name);

      // Replace variables with actual data
      const processedContent = replaceContractVariables(template.content, {
        personalData,
        brandData,
        paymentMethod,
        paymentValue,
        selectedClasses: selectedClasses || [],
        classDescriptions: classDescriptions || [],
      });

      // Generate full HTML
      contractHtml = generateContractHtml(processedContent);
      console.log('Generated contract HTML from template');
    } else {
      console.log('No template found in database, using provided HTML or generating fallback');
      if (!contractHtml) {
        // Generate basic fallback
        contractHtml = `<html><body><h1>Contrato de Registro de Marca</h1><p>Cliente: ${personalData.fullName}</p><p>Marca: ${brandData.brandName}</p></body></html>`;
      }
    }

    // ========================================
    // STEP 0.1: Normalize CPF/CNPJ and prepare unique identifier
    // ========================================
    const cpfCnpj = brandData.hasCNPJ && brandData.cnpj 
      ? brandData.cnpj.replace(/\D/g, '') 
      : personalData.cpf.replace(/\D/g, '');
    
    // Format CPF for storage (XXX.XXX.XXX-XX)
    const formattedCpf = cpfCnpj.length === 11 
      ? cpfCnpj.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      : cpfCnpj.length === 14 
        ? cpfCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
        : cpfCnpj;

    // ========================================
    // STEP 0.1: Check for existing PROFILE by CPF (UNIQUE KEY)
    // This prevents duplicate clients in the CRM
    // ========================================
    let existingProfileId: string | null = null;
    
    // First try formatted CPF
    const { data: profileByCpf } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')
      .eq('cpf_cnpj', formattedCpf)
      .maybeSingle();
    
    if (profileByCpf) {
      existingProfileId = profileByCpf.id;
      console.log('Found existing profile by formatted CPF:', existingProfileId);
    } else {
      // Try with raw digits
      const { data: profileByRawCpf } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name')
        .eq('cpf_cnpj', cpfCnpj)
        .maybeSingle();
      
      if (profileByRawCpf) {
        existingProfileId = profileByRawCpf.id;
        console.log('Found existing profile by raw CPF:', existingProfileId);
      }
    }
    
    // If no profile found by CPF, try by email
    if (!existingProfileId) {
      const { data: profileByEmail } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', personalData.email)
        .maybeSingle();
      
      if (profileByEmail) {
        existingProfileId = profileByEmail.id;
        console.log('Found existing profile by email:', existingProfileId);
      }
    }
    
    // Use the found profile ID if we have a userId from session, otherwise use found profile
    const effectiveUserId = userId || existingProfileId;
    
    if (existingProfileId) {
      // Update existing profile with any new data (except CPF which is unique)
      await supabaseAdmin
        .from('profiles')
        .update({
          full_name: personalData.fullName,
          phone: personalData.phone,
          cpf: personalData.cpf,
          cnpj: brandData.hasCNPJ ? brandData.cnpj : null,
          cpf_cnpj: personalData.cpf, // Keep legacy field with CPF
          address: personalData.address,
          neighborhood: personalData.neighborhood,
          city: personalData.city,
          state: personalData.state,
          zip_code: personalData.cep,
          company_name: brandData.hasCNPJ ? brandData.companyName : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProfileId);
      console.log('Updated existing profile with new data');
    }

    // ========================================
    // STEP 1: Create/Update Lead in database
    // ========================================
    // Check if lead already exists by email or CPF/CNPJ
    const { data: existingLead } = await supabaseAdmin
      .from('leads')
      .select('id')
      .or(`email.eq.${personalData.email},cpf_cnpj.eq.${cpfCnpj}`)
      .maybeSingle();

    let leadId: string = '';

    if (existingLead) {
      leadId = existingLead.id;
      // Update existing lead
      await supabaseAdmin
        .from('leads')
        .update({
          full_name: personalData.fullName,
          email: personalData.email,
          phone: personalData.phone,
          cpf_cnpj: cpfCnpj,
          company_name: brandData.hasCNPJ ? brandData.companyName : null,
          address: personalData.address,
          city: personalData.city,
          state: personalData.state,
          zip_code: personalData.cep,
          status: 'em_negociacao',
          notes: `Marca: ${brandData.brandName} | Ramo: ${brandData.businessArea} | Pagamento: ${paymentMethod}`,
          estimated_value: paymentValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);
      console.log('Updated existing lead:', leadId);
    } else {
      // Create new lead
      const { data: newLead, error: leadError } = await supabaseAdmin
        .from('leads')
        .insert({
          full_name: personalData.fullName,
          email: personalData.email,
          phone: personalData.phone,
          cpf_cnpj: cpfCnpj,
          company_name: brandData.hasCNPJ ? brandData.companyName : null,
          address: personalData.address,
          city: personalData.city,
          state: personalData.state,
          zip_code: personalData.cep,
          status: 'novo',
          origin: 'site',
          notes: `Marca: ${brandData.brandName} | Ramo: ${brandData.businessArea} | Pagamento: ${paymentMethod}`,
          estimated_value: paymentValue,
        })
        .select('id')
        .single();

      if (leadError) {
        console.error('Error creating lead:', leadError);
        // Don't fail the payment flow if lead creation fails
      } else {
        leadId = newLead?.id || '';
        console.log('Created new lead:', leadId);
      }
    }

    // ========================================
    // STEP 2: Create/Find Customer in Asaas
    // ========================================
    const existingCustomerResponse = await fetch(
      `${ASAAS_API_URL}/customers?cpfCnpj=${cpfCnpj}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY,
        },
      }
    );

    let customerId: string;
    let asaasCustomerId: string;
    const existingCustomerData = await existingCustomerResponse.json();

    if (existingCustomerData.data && existingCustomerData.data.length > 0) {
      customerId = existingCustomerData.data[0].id;
      asaasCustomerId = customerId;
      console.log('Found existing Asaas customer:', customerId);
    } else {
      // Create new customer
      const customerPayload = {
        name: brandData.hasCNPJ ? brandData.companyName : personalData.fullName,
        cpfCnpj: cpfCnpj,
        email: personalData.email,
        mobilePhone: personalData.phone.replace(/\D/g, ''),
        address: personalData.address,
        addressNumber: '',
        complement: '',
        province: personalData.neighborhood,
        postalCode: personalData.cep.replace(/\D/g, ''),
        externalReference: `webmarcas_${Date.now()}`,
        notificationDisabled: false,
      };

      console.log('Creating customer with payload:', JSON.stringify(customerPayload));

      const customerResponse = await fetch(`${ASAAS_API_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY,
        },
        body: JSON.stringify(customerPayload),
      });

      const customerData = await customerResponse.json();
      console.log('Customer creation response:', JSON.stringify(customerData));

      if (customerData.errors) {
        throw new Error(`Error creating customer: ${JSON.stringify(customerData.errors)}`);
      }

      customerId = customerData.id;
      asaasCustomerId = customerId;
      console.log('Created new Asaas customer:', customerId);
    }

    // ========================================
    // STEP 3: Create Payment in Asaas (ONLY for PIX and Boleto)
    // For Credit Card: DO NOT create payment here - it will be created
    // when user submits card data via process-credit-card-payment
    // ========================================
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateString = dueDate.toISOString().split('T')[0];

    let billingType = 'PIX';
    let installmentCount = 1;
    let installmentValue = paymentValue;
    let paymentId: string | null = null;
    let paymentData: Record<string, unknown> = {};
    let pixQrCode = null;

    // CRITICAL: For credit card (non-recurring), we do NOT create a payment in Asaas here
    // The payment will be created when the user submits their card data
    const isCardPayment = paymentMethod === 'cartao6x';
    const isRecurringPayment = paymentMethod === 'recorrente_cartao' || paymentMethod === 'recorrente_boleto';

    if (isRecurringPayment) {
      // Create SUBSCRIPTION in Asaas for recurring plans (Premium/Corporativo)
      const subscriptionBillingType = paymentMethod === 'recorrente_cartao' ? 'CREDIT_CARD' : 'BOLETO';
      
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + 3);
      const nextDueString = nextDue.toISOString().split('T')[0];

      const subscriptionPayload = {
        customer: customerId,
        billingType: subscriptionBillingType,
        nextDueDate: nextDueString,
        value: paymentValue,
        cycle: 'MONTHLY',
        description: `Assinatura mensal - Registro de marca: ${brandData.brandName}`,
        externalReference: `marca_${brandData.brandName.replace(/\s+/g, '_')}_sub_${Date.now()}`,
      };

      console.log('Creating subscription with payload:', JSON.stringify(subscriptionPayload));

      const subResponse = await fetch(`${ASAAS_API_URL}/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY,
        },
        body: JSON.stringify(subscriptionPayload),
      });

      const subData = await subResponse.json();
      console.log('Subscription creation response:', JSON.stringify(subData));

      if (subData.errors) {
        throw new Error(`Error creating subscription: ${JSON.stringify(subData.errors)}`);
      }

      paymentId = subData.id as string;
      billingType = subscriptionBillingType;
      installmentCount = 1;
      installmentValue = paymentValue;
      console.log('Created subscription:', paymentId);
    } else if (!isCardPayment) {
      // PIX or Boleto - create payment now
      if (paymentMethod === 'boleto3x') {
        billingType = 'BOLETO';
        installmentCount = 3;
        installmentValue = Math.round((paymentValue / 3) * 100) / 100;
      }
      // else: PIX (default)

      const paymentPayload: Record<string, unknown> = {
        customer: customerId,
        billingType: billingType,
        dueDate: dueDateString,
        description: `Registro de marca: ${brandData.brandName}`,
        externalReference: `marca_${brandData.brandName.replace(/\s+/g, '_')}_${Date.now()}`,
      };

      // For installment payments, use installmentCount and installmentValue
      if (installmentCount > 1) {
        paymentPayload.installmentCount = installmentCount;
        paymentPayload.installmentValue = installmentValue;
      } else {
        paymentPayload.value = paymentValue;
      }

      console.log('Creating payment with payload:', JSON.stringify(paymentPayload));

      const paymentResponse = await fetch(`${ASAAS_API_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY,
        },
        body: JSON.stringify(paymentPayload),
      });

      paymentData = await paymentResponse.json();
      console.log('Payment creation response:', JSON.stringify(paymentData));

      if (paymentData.errors) {
        throw new Error(`Error creating payment: ${JSON.stringify(paymentData.errors)}`);
      }

      paymentId = paymentData.id as string;
      console.log('Created payment:', paymentId);

      // Get PIX QR Code if applicable
      if (billingType === 'PIX') {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const qrCodeResponse = await fetch(
          `${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`,
          {
            headers: {
              'Content-Type': 'application/json',
              'access_token': ASAAS_API_KEY,
            },
          }
        );

        const qrCodeData = await qrCodeResponse.json();
        console.log('QR Code response:', JSON.stringify(qrCodeData));

        if (qrCodeData.encodedImage && qrCodeData.payload) {
          pixQrCode = {
            encodedImage: qrCodeData.encodedImage,
            payload: qrCodeData.payload,
            expirationDate: qrCodeData.expirationDate,
          };
        }
      }
    } else {
      // Credit card - set proper values for internal tracking
      billingType = 'CREDIT_CARD';
      installmentCount = 6;
      installmentValue = Math.round((paymentValue / 6) * 100) / 100;
      console.log('Credit card payment - will be processed when user submits card data');
    }

    // ========================================
    // STEP 4: Update Lead with payment info
    // ========================================
    if (leadId) {
      await supabaseAdmin
        .from('leads')
        .update({
          status: 'em_negociacao',
          notes: `Marca: ${brandData.brandName} | Ramo: ${brandData.businessArea} | Pagamento: ${paymentMethod}${paymentId ? ` | Asaas: ${paymentId}` : ''}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);
    }

    // ========================================
    // STEP 5: Create Contract in database (signed via checkout acceptance)
    // ========================================
    const contractNumber = `WM-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    
    const { data: contractData, error: contractError } = await supabaseAdmin
      .from('contracts')
      .insert({
        contract_number: contractNumber,
        subject: `Registro de Marca: ${brandData.brandName}`,
        description: `Contrato de registro da marca "${brandData.brandName}" no ramo de ${brandData.businessArea}`,
        contract_type: 'registro_marca',
        contract_value: paymentValue,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 years
        signature_status: 'signed', // Marked as signed when customer accepts terms in checkout
        signed_at: new Date().toISOString(), // Electronic acceptance date
        signature_ip: clientIP,
        signature_user_agent: userAgent,
        signatory_name: personalData.fullName, // Store signatory name
        signatory_cpf: formattedCpf, // Store signatory CPF/CNPJ
        signatory_cnpj: brandData.hasCNPJ ? brandData.cnpj : null,
        template_id: templateId, // Link to the template used
        asaas_payment_id: paymentId || null, // Will be filled for card after payment
        lead_id: leadId || null,
        user_id: effectiveUserId || null, // Use effective user ID (found profile or session)
        contract_html: contractHtml || null,
        visible_to_client: true,
        suggested_classes: (suggestedClassesFromClient && suggestedClassesFromClient.length > 0)
          ? {
              classes: suggestedClassesFromClient,
              descriptions: suggestedClassDescsFromClient || [],
              selected: selectedClasses || [],
            }
          : (selectedClasses && selectedClasses.length > 0)
            ? {
                classes: selectedClasses,
                descriptions: classDescriptions || [],
                selected: selectedClasses,
              }
            : null,
      })
      .select('id')
      .single();

    if (contractError) {
      console.error('Error creating contract:', contractError);
    } else {
      console.log('Created contract:', contractData?.id);

      // Create Document entry for contract (CRM sync) - ALWAYS create, even without userId
      // Link to contract_id for proper synchronization
      if (contractData?.id) {
        const { error: docError } = await supabaseAdmin
          .from('documents')
          .insert({
            name: `Contrato ${contractNumber} - ${brandData.brandName}`,
            document_type: 'contrato',
            file_url: '', // Will be updated when PDF is generated
            user_id: effectiveUserId || null, // Use effective user ID
            contract_id: contractData.id, // Critical: link to contract for sync
            uploaded_by: 'system',
          });

        if (docError) {
          console.error('Error creating document entry:', docError);
        } else {
          console.log('Created document entry for contract with contract_id:', contractData.id);
        }
      }

      // Create Brand Process entry (CRM sync) - Use effectiveUserId
      if (effectiveUserId) {
        const { data: existingProcess } = await supabaseAdmin
          .from('brand_processes')
          .select('id')
          .eq('user_id', effectiveUserId)
          .eq('brand_name', brandData.brandName)
          .maybeSingle();

        if (!existingProcess) {
          const { error: processError } = await supabaseAdmin
            .from('brand_processes')
            .insert({
              user_id: effectiveUserId, // Use effective user ID
              brand_name: brandData.brandName,
              business_area: brandData.businessArea,
              status: 'em_andamento',
              pipeline_stage: 'protocolado',
              notes: `Pagamento: ${paymentMethod} | Valor: R$ ${paymentValue}`,
            });

          if (processError) {
            console.error('Error creating brand process:', processError);
          } else {
            console.log('Created brand process for:', brandData.brandName);
          }
        } else {
          console.log('Brand process already exists:', existingProcess.id);
        }
      }

      // ========================================
      // STEP 5.1: Sign contract on blockchain - ALWAYS sign when contract is created
      // This ensures blockchain evidence is captured immediately upon checkout acceptance
      // ========================================
      if (contractData?.id) {
        try {
          // Use contractHtml if provided, otherwise create a minimal record
          const htmlToSign = contractHtml || `Contrato ${contractNumber} - Registro de Marca: ${brandData.brandName} - Cliente: ${personalData.fullName} - CPF/CNPJ: ${cpfCnpj}`;
          
          console.log('Triggering blockchain signature for contract:', contractData.id);
          
          const signResponse = await fetch(`${SUPABASE_URL}/functions/v1/sign-contract-blockchain`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              contractId: contractData.id,
              contractHtml: htmlToSign,
              deviceInfo: {
                ip_address: clientIP,
                user_agent: userAgent,
                timestamp: new Date().toISOString(),
              },
              leadId: leadId || null,
              baseUrl: 'https://webmarcas.lovable.app',
            }),
          });

          if (signResponse.ok) {
            const signData = await signResponse.json();
            console.log('Contract signed on blockchain:', signData?.data?.hash);
          } else {
            const errorText = await signResponse.text();
            console.error('Error signing contract on blockchain:', errorText);
          }
        } catch (signError) {
          console.error('Error triggering blockchain signature:', signError);
          // Don't fail the payment flow
        }
      }
    }

    // ========================================
    // STEP 6: Create Invoice in database with payment details
    // For credit card: create invoice WITHOUT asaas_invoice_id (will be set after payment)
    // ========================================
    const invoiceDescription = `Registro de marca: ${brandData.brandName}`;
    const { data: invoiceData, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .insert({
        description: invoiceDescription,
        amount: paymentValue,
        due_date: dueDateString,
        status: 'pending',
        user_id: effectiveUserId || null, // Use effective user ID
        // For card payments: NO invoice_url, boleto_code, pix_code, or asaas_invoice_id yet
        invoice_url: isCardPayment ? null : (paymentData.invoiceUrl as string || null),
        pix_code: isCardPayment ? null : (pixQrCode?.payload || null),
        boleto_code: isCardPayment ? null : (paymentData.bankSlipUrl as string || null),
        asaas_invoice_id: isCardPayment ? null : paymentId,
        payment_method: billingType === 'PIX' ? 'pix' : billingType === 'BOLETO' ? 'boleto' : 'credit_card',
      })
      .select('id')
      .single();

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
    } else {
      console.log('Created invoice:', invoiceData?.id);
    }

    // ========================================
    // STEP 7: Trigger form_completed email automation
    // ========================================
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/trigger-email-automation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
          body: JSON.stringify({
          trigger_event: 'form_completed',
          lead_id: leadId || null,
          data: {
            nome: personalData.fullName,
            email: personalData.email,
            marca: brandData.brandName,
            base_url: 'https://webmarcas.net',
          },
        }),
      });
      console.log('Triggered form_completed email automation');
    } catch (emailError) {
      console.error('Error triggering form_completed email:', emailError);
    }

    // ========================================
    // STEP 7.5: Generate signature link and send notification
    // ========================================
    if (contractData?.id) {
      try {
        // Generate signature link (also triggers CRM + SMS + WhatsApp notification)
        const linkRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-signature-link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            contractId: contractData.id,
            baseUrl: 'https://webmarcas.net',
          }),
        });
        const linkData = await linkRes.json();
        console.log('Generated signature link:', linkData?.data?.url);

        // Send formal email with signature link
        if (linkData?.success) {
          await fetch(`${SUPABASE_URL}/functions/v1/send-signature-request`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              contractId: contractData.id,
              channels: ['email'],
              baseUrl: 'https://webmarcas.net',
              overrideContact: {
                email: personalData.email,
                phone: personalData.phone || '',
                name: personalData.fullName,
              },
            }),
          });
          console.log('Sent signature request email');
        }
      } catch (linkError) {
        console.error('Error generating/sending signature link:', linkError);
      }
    }

    // ========================================
    // STEP 8: Return response
    // ========================================
    const response = {
      success: true,
      customerId,
      asaasCustomerId,
      paymentId: paymentId || null,
      leadId: leadId || null,
      contractId: contractData?.id || null,
      invoiceId: invoiceData?.id || null,
      contractNumber,
      status: isCardPayment ? 'PENDING_CARD' : paymentData.status,
      billingType,
      value: paymentValue,
      installmentCount,
      installmentValue,
      dueDate: dueDateString,
      // For card payments: no invoiceUrl or bankSlipUrl
      invoiceUrl: isCardPayment ? null : (paymentData.invoiceUrl || null),
      bankSlipUrl: isCardPayment ? null : (paymentData.bankSlipUrl || null),
      pixQrCode: isCardPayment ? null : pixQrCode,
    };

    console.log('Returning response:', JSON.stringify(response));

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    console.error('Error in create-asaas-payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
