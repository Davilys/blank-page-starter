import webmarcasLogo from '@/assets/webmarcas-logo-new.png';

export interface BlockchainSignature {
  hash: string;
  timestamp: string;
  txId: string;
  network: string;
  ipAddress: string;
}

export interface UnifiedContractDownloadOptions {
  content: string;
  documentType: 'contract' | 'procuracao' | 'distrato_multa' | 'distrato_sem_multa';
  subject: string;
  signatoryName?: string;
  signatoryCpf?: string;
  signatoryCnpj?: string;
  clientSignature?: string | null;
  blockchainSignature?: BlockchainSignature;
  contractTitle?: string;
}

/**
 * Converts the imported logo to base64 for embedding in HTML
 */
async function getLogoBase64(): Promise<string> {
  try {
    const response = await fetch(webmarcasLogo);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result && result.startsWith('data:')) {
          resolve(result);
        } else {
          reject(new Error('Invalid base64 result'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to load logo:', error);
    // Fallback placeholder
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgNTAiPjxyZWN0IGZpbGw9IiMxZTNhNWYiIHdpZHRoPSIyMDAiIGhlaWdodD0iNTAiLz48dGV4dCB4PSIxMCIgeT0iMzUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNmZmYiPldlYk1hcmNhczwvdGV4dD48L3N2Zz4=';
  }
}

/**
 * Generates HTML that renders the contract content with proper formatting.
 * Uses the same formatting rules as ContractRenderer but generates pure HTML.
 */
function generateContractHTML(
  content: string,
  logoBase64: string,
  blockchainSignature?: BlockchainSignature,
  documentType: 'contract' | 'procuracao' | 'distrato_multa' | 'distrato_sem_multa' = 'contract',
  contractTitle?: string
): string {
  // Format content with proper styling - matching ContractRenderer component exactly
  const formatContent = (text: string): string => {
    const lines = text.split('\n');
    return lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<div style="height: 12px;"></div>';
      
      // Clause titles - BLUE color as per design
      if (/^\d+\.\s*CLÁUSULA/.test(trimmed)) {
        return `<h2 style="font-weight: bold; font-size: 12px; color: #0284c7; margin-top: 20px; margin-bottom: 8px;">${trimmed}</h2>`;
      }
      
      // Sub-items (like 1.1, 2.1, etc.)
      if (/^\d+\.\d+\s/.test(trimmed)) {
        return `<p style="font-size: 11px; color: #1f2937; margin-bottom: 8px; padding-left: 16px;">${trimmed}</p>`;
      }
      
      // List items with letters (a), b), etc.)
      if (/^[a-z]\)/.test(trimmed)) {
        return `<p style="font-size: 11px; color: #1f2937; margin-bottom: 4px; padding-left: 32px;">${trimmed}</p>`;
      }
      
      // Bullet points
      if (trimmed.startsWith('•')) {
        return `<p style="font-size: 11px; color: #1f2937; margin-bottom: 8px; padding-left: 16px;">${trimmed}</p>`;
      }
      
      // Roman numerals (I), II))
      if (/^I+\)/.test(trimmed)) {
        return `<p style="font-size: 11px; color: #1f2937; margin-bottom: 12px; font-weight: 500;">${trimmed}</p>`;
      }
      
      // Skip manual signature lines
      if (trimmed.match(/^_+$/)) {
        return '';
      }
      
      // Party identification headers
      if (trimmed === 'CONTRATADA:' || trimmed === 'CONTRATANTE:') {
        return `<p style="font-size: 11px; font-weight: bold; text-align: center; color: #1f2937; margin-top: 24px; margin-bottom: 4px;">${trimmed}</p>`;
      }
      
      // Company/client details
      if (trimmed.includes('WEB MARCAS PATENTES EIRELI') || trimmed.includes('WebMarcas Intelligence PI') || 
          trimmed.startsWith('CNPJ:') || 
          trimmed.startsWith('CPF:') ||
          trimmed.startsWith('CPF/CNPJ:')) {
        return `<p style="font-size: 10px; text-align: center; color: #6b7280; margin-bottom: 4px;">${trimmed}</p>`;
      }
      
      // Date line
      if (trimmed.startsWith('São Paulo,')) {
        return `<p style="font-size: 11px; color: #1f2937; margin-top: 24px; margin-bottom: 24px;">${trimmed}</p>`;
      }
      
      // Signatory names - all uppercase, letters/spaces/accented only
      if (/^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]+$/.test(trimmed) && trimmed.length > 3) {
        return `<p style="font-size: 10px; text-align: center; color: #1f2937; font-weight: 600; margin-bottom: 4px;">${trimmed}</p>`;
      }

      // Regular paragraphs
      return `<p style="font-size: 11px; color: #1f2937; margin-bottom: 12px; line-height: 1.6;">${trimmed}</p>`;
    }).join('\n');
  };

  // Build certification section if blockchain data exists
  let certificationSection = '';
  if (blockchainSignature?.hash) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`${window.location.origin}/verificar-contrato?hash=${blockchainSignature.hash}`)}`;
    
    certificationSection = `
      <!-- Footer before certification -->
      <div class="pdf-footer">
        <p>Contrato gerado e assinado eletronicamente pelo sistema WebMarcas</p>
        <p>www.webmarcas.net | juridico@webmarcas.net</p>
        <p>Data e hora da geração: ${new Date().toLocaleString('pt-BR')}</p>
      </div>
      
      <!-- Blue divider -->
      <div class="pdf-blue-divider"></div>
      
      <!-- Certification Box -->
      <div class="pdf-certification">
        <div class="pdf-certification-box">
          <div class="pdf-certification-header">
            <div class="pdf-certification-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <span class="pdf-certification-title">CERTIFICAÇÃO DIGITAL E VALIDADE JURÍDICA</span>
          </div>
          
          <div class="pdf-certification-content">
            <div class="pdf-certification-data">
              <div style="margin-bottom: 16px;">
                <p class="pdf-label">HASH SHA-256</p>
                <div class="pdf-hash-box">${blockchainSignature.hash}</div>
              </div>
              
              <div style="margin-bottom: 16px;">
                <p class="pdf-label">DATA/HORA DA ASSINATURA</p>
                <p style="font-size: 11px; color: #1f2937 !important;">${blockchainSignature.timestamp || '-'}</p>
              </div>
              
              ${blockchainSignature.txId ? `
              <div style="margin-bottom: 16px;">
                <p class="pdf-label">ID DA TRANSAÇÃO</p>
                <p style="font-size: 11px; font-family: monospace; word-break: break-all; color: #1f2937 !important;">${blockchainSignature.txId}</p>
              </div>
              ` : ''}
              
              <div style="margin-bottom: 16px;">
                <p class="pdf-label">REDE BLOCKCHAIN</p>
                <p style="font-size: 11px; color: #1f2937 !important;">${blockchainSignature.network || 'Bitcoin (OpenTimestamps via a.pool.opentimestamps.org)'}</p>
              </div>
              
              ${blockchainSignature.ipAddress ? `
              <div>
                <p class="pdf-label">IP DO SIGNATÁRIO</p>
                <p style="font-size: 11px; color: #1f2937 !important;">${blockchainSignature.ipAddress}</p>
              </div>
              ` : ''}
            </div>
            
            <div class="pdf-certification-qr">
              <p class="pdf-label">QR CODE DE VERIFICAÇÃO</p>
              <img src="${qrUrl}" alt="QR Code" style="width: 128px; height: 128px; margin: 12px 0;" />
              <p style="font-size: 9px; color: #6b7280 !important;">Escaneie para verificar</p>
            </div>
          </div>
          
          <div class="pdf-legal-footer">
            <p style="font-size: 10px; font-style: italic; color: #6b7280 !important;">
              Este documento foi assinado eletronicamente e possui validade jurídica conforme Lei 14.063/2020 e MP 2.200-2/2001.
            </p>
            <p style="font-size: 10px; color: #0284c7 !important; margin-top: 8px;">${window.location.origin}/verificar-contrato</p>
          </div>
        </div>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=210mm, initial-scale=1.0">
  <title>Contrato WebMarcas</title>
  <style>
    /* PDF/Print-specific settings - Fixed layout, no responsive */
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
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      line-height: 1.6; 
      color: #1f2937 !important; 
      background: white !important; 
      padding: 30px; 
      font-size: 11px; 
      max-width: 210mm;
      margin: 0 auto;
    }
    
    /* Header styles */
    .pdf-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      page-break-inside: avoid;
    }
    
    .pdf-header img {
      height: 48px;
      width: auto;
      object-fit: contain;
    }
    
    .pdf-header-url {
      color: #0284c7 !important;
      font-weight: 600;
      font-size: 14px;
    }
    
    /* Gradient bar - preserved colors */
    .pdf-gradient-bar {
      height: 8px;
      width: 100%;
      background: linear-gradient(90deg, #f97316, #fbbf24) !important;
      border-radius: 3px;
      margin-bottom: 24px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    /* Main title */
    .pdf-main-title {
      text-align: center;
      color: #0284c7 !important;
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 16px;
      text-decoration: underline;
    }
    
    /* Dark Blue contract title box */
    .pdf-contract-title-box {
      background-color: #1e3a5f !important;
      color: white !important;
      text-align: center;
      padding: 14px 20px;
      border-radius: 6px;
      margin-bottom: 16px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .pdf-contract-title-box p {
      font-weight: 600;
      font-size: 12px;
      line-height: 1.5;
      color: white !important;
    }
    
    /* Yellow highlight box - LEFT BORDER ONLY */
    .pdf-highlight-box {
      background-color: #FEF9E7 !important;
      border-left: 4px solid #F59E0B !important;
      padding: 16px;
      margin-bottom: 24px;
      color: #374151 !important;
      font-size: 11px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .pdf-highlight-box p {
      color: #374151 !important;
    }
    
    /* Content area */
    .pdf-content {
      margin-top: 16px;
    }
    
    /* Certification section */
    .pdf-certification {
      margin-top: 32px;
      page-break-inside: avoid;
    }
    
    .pdf-certification-box {
      padding: 24px;
      background-color: #f8fafc !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 12px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .pdf-certification-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    
    .pdf-certification-icon {
      width: 32px;
      height: 32px;
      background-color: #0284c7 !important;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .pdf-certification-title {
      font-size: 18px;
      font-weight: bold;
      color: #0284c7 !important;
    }
    
    .pdf-certification-content {
      display: flex;
      gap: 24px;
      align-items: flex-start;
    }
    
    .pdf-certification-data {
      flex: 1;
    }
    
    .pdf-certification-qr {
      flex-shrink: 0;
      text-align: center;
      padding: 16px;
      background-color: white !important;
      border-radius: 8px;
      border: 1px solid #e2e8f0 !important;
    }
    
    .pdf-label {
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      color: #1f2937 !important;
      margin-bottom: 4px;
    }
    
    .pdf-hash-box {
      background-color: white !important;
      padding: 12px;
      border-radius: 4px;
      border: 1px solid #e2e8f0 !important;
      font-family: monospace;
      font-size: 10px;
      word-break: break-all;
      color: #1f2937 !important;
    }
    
    /* Footer */
    .pdf-footer {
      margin-top: 32px;
      border-top: 1px solid #e5e7eb;
      padding-top: 16px;
      text-align: center;
      color: #6b7280 !important;
      font-size: 9px;
    }
    
    /* Blue divider */
    .pdf-blue-divider {
      height: 4px;
      width: 100%;
      background-color: #0284c7 !important;
      margin: 16px 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    /* Legal footer */
    .pdf-legal-footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }
    
    /* Print media query - reinforce colors */
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      
      body {
        padding: 0;
      }
      
      .pdf-gradient-bar,
      .pdf-contract-title-box,
      .pdf-highlight-box,
      .pdf-certification-box,
      .pdf-certification-icon,
      .pdf-blue-divider {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <!-- Header with Logo and URL -->
  <div class="pdf-header">
    <img src="${logoBase64}" alt="WebMarcas" />
    <span class="pdf-header-url">www.webmarcas.net</span>
  </div>
  
  <!-- Orange/Yellow Gradient Bar -->
  <div class="pdf-gradient-bar"></div>
  
  ${documentType === 'procuracao' ? `
  <!-- Título da Procuração -->
  <h1 class="pdf-main-title">PROCURAÇÃO PARA REPRESENTAÇÃO JUNTO AO INPI</h1>
  <p style="text-align: center; color: #4B5563; font-size: 14px; font-style: italic; margin-bottom: 24px;">Instrumento Particular de Procuração para fins de Registro de Marca</p>
  
  <!-- Caixa Amarela - Aviso Legal de Procuração -->
  <div class="pdf-highlight-box">
    <p>Pelo presente instrumento particular de PROCURAÇÃO, o(a) outorgante abaixo identificado(a) nomeia e constitui como seu bastante PROCURADOR o(a) Sr(a). Davilys Danques de Oliveira Cunha, para representá-lo(a) de forma exclusiva junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL – INPI, podendo praticar todos os atos necessários, legais e administrativos relacionados ao pedido, acompanhamento, defesa e manutenção do registro de marca, inclusive apresentação de requerimentos, cumprimento de exigências, interposição de recursos e recebimento de notificações.</p>
  </div>
  ` : `
  <!-- Main Title - CONTRATO underlined -->
  <h1 class="pdf-main-title" style="text-decoration: underline;">CONTRATO</h1>
  
  <!-- Light Blue Contract Title Box -->
  <div class="pdf-contract-title-box">
    <p>${contractTitle 
      ? contractTitle.replace(/ PARA /g, '<br/>PARA ') 
      : 'CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORAMENTO<br/>PARA REGISTRO DE MARCA JUNTO AO INPI'}</p>
  </div>
  
  <!-- Yellow Highlight Box - LEFT BORDER ONLY -->
  <div class="pdf-highlight-box">
    <p style="margin-bottom: 8px;">Os termos deste instrumento aplicam-se apenas a contratações com negociações personalizadas, tratadas diretamente com a equipe comercial da WebMarcas Intelligence PI.</p>
    <p>Os termos aqui celebrados são adicionais ao "Contrato de Prestação de Serviços e Gestão de Pagamentos e Outras Avenças" com aceite integral no momento do envio da Proposta.</p>
  </div>
  `}
  
  <!-- Contract Content -->
  <div class="pdf-content">
    ${formatContent(content)}
  </div>
  
  ${certificationSection}
</body>
</html>
`;
}

/**
 * Opens a preview window with the contract content and triggers print dialog for PDF download.
 * Uses native browser print-to-PDF for text-selectable output.
 */
export async function downloadUnifiedContractPDF(options: UnifiedContractDownloadOptions): Promise<void> {
  const {
    content,
    documentType,
    subject,
    blockchainSignature,
    contractTitle,
  } = options;

  const logoBase64 = await getLogoBase64();
  let printHtml = generateContractHTML(content, logoBase64, blockchainSignature, documentType, contractTitle);
  
  // Add print-specific styles and floating save button
  const printStyles = `
    <style>
      @media print {
        .no-print { display: none !important; }
      }
      .save-pdf-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        gap: 8px;
      }
      .save-pdf-btn {
        background: linear-gradient(135deg, #0284c7, #0369a1);
        color: white;
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .save-pdf-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(2, 132, 199, 0.4);
      }
      .close-btn {
        background: #6b7280;
        color: white;
        padding: 12px 20px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .close-btn:hover {
        background: #4b5563;
      }
    </style>
  `;
  
  const floatingButtons = `
    <div class="save-pdf-container no-print">
      <button class="save-pdf-btn" onclick="window.print()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Salvar como PDF
      </button>
      <button class="close-btn" onclick="window.close()">Fechar</button>
    </div>
  `;
  
  // Insert styles before </head> and buttons after <body>
  printHtml = printHtml.replace('</head>', `${printStyles}</head>`);
  printHtml = printHtml.replace('<body>', `<body>${floatingButtons}`);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Não foi possível abrir a janela de visualização.');
  }

  printWindow.document.write(printHtml);
  printWindow.document.close();
  
  // Auto-trigger print dialog after page loads
  printWindow.onload = () => {
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };
}

/**
 * Opens a print preview window with the contract content.
 */
export async function printUnifiedContract(options: UnifiedContractDownloadOptions): Promise<void> {
  const {
    content,
    documentType,
    blockchainSignature,
    contractTitle,
  } = options;

  const logoBase64 = await getLogoBase64();
  let printHtml = generateContractHTML(content, logoBase64, blockchainSignature, documentType, contractTitle);
  
  // Add print-specific styles and floating buttons
  const printStyles = `
    <style>
      @media print {
        .no-print { display: none !important; }
      }
      .save-pdf-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        gap: 8px;
      }
      .save-pdf-btn {
        background: linear-gradient(135deg, #0284c7, #0369a1);
        color: white;
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .save-pdf-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(2, 132, 199, 0.4);
      }
      .close-btn {
        background: #6b7280;
        color: white;
        padding: 12px 20px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .close-btn:hover {
        background: #4b5563;
      }
    </style>
  `;
  
  const floatingButtons = `
    <div class="save-pdf-container no-print">
      <button class="save-pdf-btn" onclick="window.print()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Salvar como PDF
      </button>
      <button class="close-btn" onclick="window.close()">Fechar</button>
    </div>
  `;
  
  printHtml = printHtml.replace('</head>', `${printStyles}</head>`);
  printHtml = printHtml.replace('<body>', `<body>${floatingButtons}`);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Não foi possível abrir a janela de impressão.');
  }

  printWindow.document.write(printHtml);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}
