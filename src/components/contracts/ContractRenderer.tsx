import { useMemo } from 'react';
import webmarcasLogo from '@/assets/webmarcas-logo-mark.png';
import { CheckCircle } from 'lucide-react';

export interface BlockchainSignature {
  hash?: string;
  timestamp?: string;
  txId?: string;
  network?: string;
  ipAddress?: string;
}

interface ContractRendererProps {
  content: string;
  showLetterhead?: boolean;
  className?: string;
  blockchainSignature?: BlockchainSignature;
  showCertificationSection?: boolean;
  documentType?: 'contract' | 'procuracao' | 'distrato_multa' | 'distrato_sem_multa';
  contractTitle?: string;
}

export function ContractRenderer({ 
  content, 
  showLetterhead = true, 
  className = '',
  blockchainSignature,
  showCertificationSection = false,
  documentType = 'contract',
  contractTitle
}: ContractRendererProps) {
  const renderedContent = useMemo(() => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        elements.push(<div key={index} className="h-3" />);
        return;
      }

      // Skip the main title as it's in the letterhead now
      if (trimmedLine.includes('CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS')) {
        return;
      }

      // Clause titles - BLUE color as per design
      if (/^\d+\.\s*CLÁUSULA/.test(trimmedLine)) {
        elements.push(
          <h2 key={index} className="font-bold text-sm mt-6 mb-2" style={{ color: '#0284c7' }}>
            {trimmedLine}
          </h2>
        );
        return;
      }

      // Sub-items (like 1.1, 2.1, etc.) - support HTML for bold brand names
      if (/^\d+\.\d+\s/.test(trimmedLine)) {
        elements.push(
          <p 
            key={index} 
            className="text-sm mb-2 pl-4" 
            style={{ color: '#1f2937' }}
            dangerouslySetInnerHTML={{ __html: trimmedLine }}
          />
        );
        return;
      }

      // List items with letters (a), b), etc.)
      if (/^[a-z]\)/.test(trimmedLine)) {
        elements.push(
          <p key={index} className="text-sm mb-1 pl-8" style={{ color: '#1f2937' }}>
            {trimmedLine}
          </p>
        );
        return;
      }

      // Bullet points - support HTML for total value
      if (trimmedLine.startsWith('•')) {
        elements.push(
          <p 
            key={index} 
            className="text-sm mb-2 pl-4" 
            style={{ color: '#1f2937' }}
            dangerouslySetInnerHTML={{ __html: trimmedLine }}
          />
        );
        return;
      }

      // Roman numerals (I), II))
      if (/^I+\)/.test(trimmedLine)) {
        elements.push(
          <p key={index} className="text-sm mb-3 font-medium" style={{ color: '#1f2937' }}>
            {trimmedLine}
          </p>
        );
        return;
      }

      // Skip signature lines - electronic contracts don't use manual signature lines
      if (trimmedLine.match(/^_+$/)) {
        return; // Don't render manual signature lines (______)
      }

      // Party identification headers (CONTRATADA:, CONTRATANTE:)
      if (trimmedLine === 'CONTRATADA:' || trimmedLine === 'CONTRATANTE:') {
        elements.push(
          <p key={index} className="text-xs font-bold text-center mt-6 mb-1" style={{ color: '#1f2937' }}>
            {trimmedLine}
          </p>
        );
        return;
      }

      // Company name and identification details (after party headers)
      if (trimmedLine.includes('WEB MARCAS PATENTES EIRELI') || trimmedLine.includes('WebMarcas Intelligence PI') || 
          trimmedLine.startsWith('CNPJ:') || 
          trimmedLine.startsWith('CPF:') ||
          trimmedLine.startsWith('CPF/CNPJ:')) {
        elements.push(
          <p key={index} className="text-xs text-center" style={{ color: '#6b7280' }}>
            {trimmedLine}
          </p>
        );
        return;
      }

      // Date line
      if (trimmedLine.startsWith('São Paulo,')) {
        elements.push(
          <p key={index} className="text-sm mt-6 mb-6" style={{ color: '#1f2937' }}>
            {trimmedLine}
          </p>
        );
        return;
      }

      // Signatory names - all uppercase, letters/spaces/accented only
      if (/^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]+$/.test(trimmedLine) && trimmedLine.length > 3) {
        elements.push(
          <p key={index} className="text-[10px] text-center font-semibold mb-1" style={{ color: '#1f2937' }}>
            {trimmedLine}
          </p>
        );
        return;
      }

      // Regular paragraphs
      elements.push(
        <p key={index} className="text-sm mb-3 leading-relaxed" style={{ color: '#1f2937' }}>
          {trimmedLine}
        </p>
      );
    });

    return elements;
  }, [content]);

  return (
    <div className={`bg-white ${className}`} style={{ color: '#1f2937' }}>
      {showLetterhead && (
        <>
          {/* Header with Logo and URL */}
          <div className="flex items-center justify-between pb-3">
            <img 
              src={webmarcasLogo} 
              alt="WebMarcas" 
              className="h-12 object-contain"
              onError={(e) => { e.currentTarget.src = WEBMARCAS_LOGO_FALLBACK; }}
            />
            <span className="text-sm font-medium" style={{ color: '#0284c7' }}>
              www.webmarcas.net
            </span>
          </div>
          
          {/* Orange/Yellow Gradient Bar */}
          <div 
            className="h-2 w-full rounded-sm mb-6"
            style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)' }}
          />
          
          {documentType === 'procuracao' ? (
            <>
              {/* Título da Procuração */}
              <h1 
                className="text-center text-xl font-bold mb-2"
                style={{ color: '#0284c7' }}
              >
                PROCURAÇÃO PARA REPRESENTAÇÃO JUNTO AO INPI
              </h1>
              <p className="text-center text-sm text-gray-600 italic mb-4">
                Instrumento Particular de Procuração para fins de Registro de Marca
              </p>
              
              {/* Caixa Amarela - Aviso Legal de Procuração */}
              <div 
                className="p-4 rounded mb-6 text-sm"
                style={{ 
                  backgroundColor: '#fef3c7', 
                  border: '1px solid #f59e0b',
                  color: '#92400e'
                }}
              >
                <p>
                  Pelo presente instrumento particular de PROCURAÇÃO, o(a) outorgante abaixo identificado(a) nomeia e constitui como seu bastante PROCURADOR o(a) Sr(a). Davilys Danques de Oliveira Cunha, para representá-lo(a) de forma exclusiva junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL – INPI, podendo praticar todos os atos necessários, legais e administrativos relacionados ao pedido, acompanhamento, defesa e manutenção do registro de marca, inclusive apresentação de requerimentos, cumprimento de exigências, interposição de recursos e recebimento de notificações.
                </p>
              </div>
            </>
          ) : (documentType === 'distrato_multa' || documentType === 'distrato_sem_multa') ? (
            <>
              {/* Blue Title - DISTRATO underlined */}
              <h1 
                className="text-center text-xl font-bold mb-4"
                style={{ color: '#0284c7', textDecoration: 'underline' }}
              >
                DISTRATO
              </h1>
              
              {/* Dark Blue Box with Distrato Title */}
              <div 
                className="text-center py-3 px-4 rounded mb-4"
                style={{ backgroundColor: '#1e3a5f' }}
              >
                <p className="text-white font-semibold text-sm leading-tight">
                  DISTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORAMENTO<br />PARA REGISTRO DE MARCA JUNTO AO INPI
                </p>
              </div>
              
              {/* Yellow Highlight Section - LEFT BORDER ONLY */}
              <div 
                className="p-4 mb-6 text-sm"
                style={{ 
                  backgroundColor: '#FEF9E7', 
                  borderLeft: '4px solid #F59E0B',
                  color: '#374151'
                }}
              >
                <p className="mb-3">
                  Os termos deste instrumento aplicam-se exclusivamente à formalização do cancelamento de contratações realizadas mediante negociações personalizadas, conduzidas diretamente com a equipe comercial da WebMarcas Intelligence PI.
                </p>
                <p>
                  O presente distrato estabelece as condições para encerramento da relação contratual anteriormente firmada, estando vinculado ao "Contrato de Prestação de Serviços e Gestão de Pagamentos e Outras Avenças", cujo aceite integral ocorreu no momento do envio da Proposta.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Blue Title - CONTRATO underlined */}
              <h1 
                className="text-center text-xl font-bold mb-4"
                style={{ color: '#0284c7', textDecoration: 'underline' }}
              >
                CONTRATO
              </h1>
              
              {/* Dark Blue Box with Contract Title */}
              <div 
                className="text-center py-3 px-4 rounded mb-4"
                style={{ backgroundColor: '#1e3a5f' }}
              >
                <p className="text-white font-semibold text-sm leading-tight">
                  {contractTitle 
                    ? contractTitle.split(' PARA ').map((part, i) => i === 0 ? <span key={i}>{part}<br /></span> : <span key={i}>PARA {part}</span>)
                    : <>CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORAMENTO<br />PARA REGISTRO DE MARCA JUNTO AO INPI</>
                  }
                </p>
              </div>
              
              {/* Yellow Highlight Section - LEFT BORDER ONLY */}
              <div 
                className="p-4 mb-6 text-sm"
                style={{ 
                  backgroundColor: '#FEF9E7', 
                  borderLeft: '4px solid #F59E0B',
                  color: '#374151'
                }}
              >
                 <p className="mb-3">
                   Os termos deste instrumento aplicam-se apenas a contratações com negociações personalizadas, tratadas diretamente com a equipe comercial da WebMarcas Intelligence PI.
                </p>
                <p>
                  Os termos aqui celebrados são adicionais ao "Contrato de Prestação de Serviços e Gestão de Pagamentos e Outras Avenças" com aceite integral no momento do envio da Proposta.
                </p>
              </div>
            </>
          )}
        </>
      )}
      
      <div className="contract-content">
        {renderedContent}
      </div>

      {/* Digital Certification Section - only shown when contract is SIGNED with blockchain data */}
      {blockchainSignature?.hash && (
        <div className="mt-8 print:mt-4">
          {/* Footer text before certification */}
          <div className="text-center py-4 text-xs border-t" style={{ color: '#6b7280', borderColor: '#e5e7eb' }}>
            <p>Contrato gerado e assinado eletronicamente pelo sistema WebMarcas</p>
            <p>www.webmarcas.net | juridico@webmarcas.net</p>
            <p>Data e hora da geração: {new Date().toLocaleString('pt-BR')}</p>
          </div>
          
          {/* Blue divider line */}
          <div className="h-1 w-full bg-primary my-4" />
          
          {/* Certification Box */}
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl shadow-sm">
            {/* Header with checkmark */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-primary">
                CERTIFICAÇÃO DIGITAL E VALIDADE JURÍDICA
              </h3>
            </div>
            
            {/* Content Grid - Signature Data + QR Code */}
            <div className="flex gap-6 items-start">
              {/* Left: Signature Data */}
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#1f2937' }}>HASH SHA-256</p>
                  <div className="bg-white p-3 rounded border border-slate-200 font-mono text-xs break-all" style={{ color: '#1f2937' }}>
                    {blockchainSignature.hash}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#1f2937' }}>DATA/HORA DA ASSINATURA</p>
                  <p className="text-sm" style={{ color: '#1f2937' }}>
                    {blockchainSignature.timestamp || '-'}
                  </p>
                </div>
                
                {blockchainSignature.txId && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#1f2937' }}>ID DA TRANSAÇÃO</p>
                    <p className="text-sm font-mono break-all" style={{ color: '#1f2937' }}>
                      {blockchainSignature.txId}
                    </p>
                  </div>
                )}
                
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#1f2937' }}>REDE BLOCKCHAIN</p>
                  <p className="text-sm" style={{ color: '#1f2937' }}>
                    {blockchainSignature.network || 'Bitcoin (OpenTimestamps via a.pool.opentimestamps.org)'}
                  </p>
                </div>
                
                {blockchainSignature.ipAddress && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#1f2937' }}>IP DO SIGNATÁRIO</p>
                    <p className="text-sm" style={{ color: '#1f2937' }}>
                      {blockchainSignature.ipAddress}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Right: QR Code */}
              <div className="flex-shrink-0 text-center p-4 bg-white rounded-lg border border-slate-200">
                <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#1f2937' }}>QR CODE DE VERIFICAÇÃO</p>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`${window.location.origin}/verificar-contrato?hash=${blockchainSignature.hash}`)}`}
                  alt="QR Code de Verificação"
                  className="w-32 h-32 mx-auto"
                />
                <p className="text-[10px] mt-2" style={{ color: '#6b7280' }}>Escaneie para verificar</p>
              </div>
            </div>
            
            {/* Legal footer */}
            <div className="mt-6 pt-4 border-t border-slate-200 text-center">
              <p className="text-xs italic" style={{ color: '#6b7280' }}>
                Este documento foi assinado eletronicamente e possui validade jurídica conforme Lei 14.063/2020 e MP 2.200-2/2001.
              </p>
              <p className="text-xs mt-2" style={{ color: '#0284c7' }}>
                Verifique a autenticidade em: {window.location.origin}/verificar-contrato
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Embedded WebMarcas logo as base64 for offline HTML rendering
// This ensures the logo displays correctly when the HTML is downloaded and opened locally
// Note: This is a small placeholder - actual logo will be fetched dynamically
const WEBMARCAS_LOGO_FALLBACK = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgNTAiPjxyZWN0IGZpbGw9IiMxZTNhNWYiIHdpZHRoPSIyMDAiIGhlaWdodD0iNTAiLz48dGV4dCB4PSIxMCIgeT0iMzUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNmZmYiPldlYk1hcmNhczwvdGV4dD48L3N2Zz4=';

// Helper function to convert imported logo to base64 (for dynamic updates)
export const getLogoBase64 = async (): Promise<string> => {
  try {
    // First try to use the imported logo
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
    // Fallback to embedded base64
    return WEBMARCAS_LOGO_FALLBACK;
  }
};

// Generate full HTML for printing/download with the exact letterhead design
export function generateContractPrintHTML(
  content: string,
  brandName: string,
  clientName: string,
  clientCpf: string,
  blockchainSignature?: BlockchainSignature,
  showCertificationSection: boolean = true,
  documentType: 'contract' | 'procuracao' | 'distrato_multa' | 'distrato_sem_multa' = 'contract',
  logoBase64?: string,
  contractTitle?: string
): string {
  // Convert plain text to HTML with proper formatting
  const htmlContent = content
    .split('\n')
    .filter(line => !line.includes('CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS'))
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<div style="height: 12px;"></div>';
      
      // Clause titles in BLUE
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
      
        // Skip manual signature lines - electronic contracts don't use them
        if (trimmed.match(/^_+$/)) {
          return ''; // Don't render manual signature lines
        }
        
        // Party identification headers
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

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contrato WebMarcas - ${brandName}</title>
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
    
    /* Blue Main Title - CONTRATO underlined */
    .main-title {
      text-align: center;
      color: #0284c7 !important;
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 16px;
      letter-spacing: -0.5px;
      text-decoration: underline;
    }
    
    /* Light Blue Box with Contract Title */
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
    
    /* Certification section */
    .certification-box {
      padding: 24px;
      background-color: #f8fafc !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 12px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
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
        background-color: #1e3a5f !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      .highlight-box {
        background-color: #FEF9E7 !important;
        border-left: 4px solid #F59E0B !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      .certification-box {
        background-color: #f8fafc !important;
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
    <img src="${logoBase64 || WEBMARCAS_LOGO_FALLBACK}" alt="WebMarcas" class="header-logo" />
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
  <h1 class="main-title">DISTRATO</h1>
  <div class="contract-title-box">
    <p>DISTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORAMENTO<br/>PARA REGISTRO DE MARCA JUNTO AO INPI</p>
  </div>
  
  <div class="highlight-box">
    <p>Os termos deste instrumento aplicam-se exclusivamente à formalização do cancelamento de contratações realizadas mediante negociações personalizadas, conduzidas diretamente com a equipe comercial da WebMarcas Intelligence PI.</p>
    <p style="margin-top: 12px;">O presente distrato estabelece as condições para encerramento da relação contratual anteriormente firmada, estando vinculado ao "Contrato de Prestação de Serviços e Gestão de Pagamentos e Outras Avenças", cujo aceite integral ocorreu no momento do envio da Proposta.</p>
  </div>
  ` : `
  <!-- Blue Title - CONTRATO underlined -->
  <h1 class="main-title">CONTRATO</h1>
  
  <!-- Light Blue Box with Contract Title -->
  <div class="contract-title-box">
    <p>${contractTitle 
      ? contractTitle.replace(/ PARA /g, '<br/>PARA ') 
      : 'CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORAMENTO<br/>PARA REGISTRO DE MARCA JUNTO AO INPI'}</p>
  </div>
  
  <!-- Yellow Highlight Section - LEFT BORDER ONLY -->
  <div class="highlight-box">
    <p>Os termos deste instrumento aplicam-se apenas a contratações com negociações personalizadas, tratadas diretamente com a equipe comercial da Web Marcas e Patentes Eireli.</p>
    <p>Os termos aqui celebrados são adicionais ao "Contrato de Prestação de Serviços e Gestão de Pagamentos e Outras Avenças" com aceite integral no momento do envio da Proposta.</p>
  </div>
  `}
  
  <div class="content">
    ${htmlContent}
  </div>
  
  
  ${blockchainSignature?.hash ? `
  <!-- Digital Certification Section - ONLY shown when signed -->
  <div style="margin-top: 32px;">
    <!-- Footer before certification -->
    <div style="text-align: center; padding: 16px 0; border-top: 1px solid #e5e7eb; font-size: 10px; color: #6b7280;">
      <p>Contrato gerado e assinado eletronicamente pelo sistema WebMarcas</p>
      <p>www.webmarcas.net | contato@webmarcas.net</p>
      <p>Data e hora da geração: ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    
    <!-- Blue divider line -->
    <div style="height: 4px; background: #0284c7; margin: 16px 0;"></div>
    
    <!-- Certification Box -->
    <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
      <!-- Header with checkmark -->
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
        <div style="width: 32px; height: 32px; background: #0284c7; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <h3 style="font-size: 20px; font-weight: bold; color: #0284c7; margin: 0;">CERTIFICAÇÃO DIGITAL E VALIDADE JURÍDICA</h3>
      </div>
      
      <!-- Content Grid - Signature Data + QR Code -->
      <div style="display: flex; gap: 24px; align-items: flex-start;">
        <!-- Left: Signature Data -->
        <div style="flex: 1;">
          <div style="margin-bottom: 16px;">
            <p style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; margin-bottom: 6px;">HASH SHA-256</p>
            <div style="background: white; padding: 12px; border-radius: 4px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 11px; word-break: break-all; color: #1e293b;">
              ${blockchainSignature.hash}
            </div>
          </div>
          
          <div style="margin-bottom: 16px;">
            <p style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; margin-bottom: 6px;">DATA/HORA DA ASSINATURA</p>
            <p style="font-size: 13px; color: #1e293b;">${blockchainSignature.timestamp || '-'}</p>
          </div>
          
          ${blockchainSignature.txId ? `
          <div style="margin-bottom: 16px;">
            <p style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; margin-bottom: 6px;">ID DA TRANSAÇÃO</p>
            <p style="font-size: 13px; font-family: monospace; color: #1e293b; word-break: break-all;">${blockchainSignature.txId}</p>
          </div>
          ` : ''}
          
          <div style="margin-bottom: 16px;">
            <p style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; margin-bottom: 6px;">REDE BLOCKCHAIN</p>
            <p style="font-size: 13px; color: #1e293b;">${blockchainSignature.network || 'Bitcoin (OpenTimestamps via a.pool.opentimestamps.org)'}</p>
          </div>
          
          ${blockchainSignature.ipAddress ? `
          <div>
            <p style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; margin-bottom: 6px;">IP DO SIGNATÁRIO</p>
            <p style="font-size: 13px; color: #1e293b;">${blockchainSignature.ipAddress}</p>
          </div>
          ` : ''}
        </div>
        
        <!-- Right: QR Code -->
        <div style="flex-shrink: 0; text-align: center; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e2e8f0;">
          <p style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; margin-bottom: 12px;">QR CODE DE VERIFICAÇÃO</p>
          <img 
            src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`${window.location.origin}/verificar-contrato?hash=${blockchainSignature.hash}`)}" 
            alt="QR Code de Verificação"
            style="width: 140px; height: 140px;"
          />
          <p style="font-size: 10px; color: #64748b; margin-top: 8px;">Escaneie para verificar</p>
        </div>
      </div>
      
      <!-- Legal footer -->
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="font-size: 11px; color: #64748b; font-style: italic;">
          Este documento foi assinado eletronicamente e possui validade jurídica conforme Lei 14.063/2020 e MP 2.200-2/2001.
        </p>
        <p style="font-size: 11px; color: #0284c7; margin-top: 8px;">
          Verifique a autenticidade em: ${window.location.origin}/verificar-contrato
        </p>
      </div>
    </div>
  </div>
  ` : `
  <!-- Footer for unsigned contracts -->
  <div class="footer">
    <p>Contrato gerado e assinado eletronicamente pelo sistema WebMarcas</p>
    <p>www.webmarcas.net | contato@webmarcas.net</p>
    <p>Data e hora da geração: ${new Date().toLocaleString('pt-BR')}</p>
  </div>
  `}
</body>
</html>`;
}

export default ContractRenderer;
