import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Dynamic imports for heavy libraries
let jsPDF: any = null;
let html2canvas: any = null;

async function loadPdfLibraries() {
  if (!jsPDF) {
    const jsPDFModule = await import('jspdf');
    jsPDF = jsPDFModule.jsPDF;
  }
  if (!html2canvas) {
    const html2canvasModule = await import('html2canvas');
    html2canvas = html2canvasModule.default;
  }
}

interface UploadResult {
  success: boolean;
  publicUrl?: string;
  documentId?: string;
  error?: string;
}

interface GeneratePdfOptions {
  contractId: string;
  contractHtml: string;
  brandName: string;
  documentType?: string;
  userId?: string;
  processId?: string;
}

/**
 * Generates a PDF from HTML content and uploads it to storage.
 * This creates a real PDF file that can be viewed and downloaded.
 */
export async function generateAndUploadContractPdf(
  options: GeneratePdfOptions
): Promise<UploadResult> {
  const { contractId, contractHtml, brandName, documentType, userId, processId } = options;

  try {
    console.log('Starting PDF generation for contract:', contractId);

    // Load libraries dynamically
    await loadPdfLibraries();

    // Create a temporary container for the HTML
    const container = document.createElement('div');
    container.innerHTML = contractHtml;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '800px';
    container.style.backgroundColor = 'white';
    container.style.padding = '40px';
    document.body.appendChild(container);

    // Wait for images to load
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate canvas from HTML
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Remove temporary container
    document.body.removeChild(container);

    // Create PDF from canvas
    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20; // 10mm margin on each side
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Add pages if content is too tall
    let yOffset = 10;
    const maxPageHeight = pageHeight - 20; // 10mm margin on top and bottom

    if (imgHeight <= maxPageHeight) {
      // Single page
      pdf.addImage(imgData, 'JPEG', 10, yOffset, imgWidth, imgHeight);
    } else {
      // Multiple pages
      let remainingHeight = imgHeight;
      let sourceY = 0;

      while (remainingHeight > 0) {
        const pageImgHeight = Math.min(remainingHeight, maxPageHeight);
        const canvasSliceHeight = (pageImgHeight * canvas.width) / imgWidth;

        // Create a slice of the canvas
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = canvasSliceHeight;
        const sliceCtx = sliceCanvas.getContext('2d');
        
        if (sliceCtx) {
          sliceCtx.drawImage(
            canvas, 
            0, sourceY, canvas.width, canvasSliceHeight,
            0, 0, canvas.width, canvasSliceHeight
          );

          const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.9);
          
          if (sourceY > 0) {
            pdf.addPage();
          }
          
          pdf.addImage(sliceImgData, 'JPEG', 10, 10, imgWidth, pageImgHeight);
        }

        sourceY += canvasSliceHeight;
        remainingHeight -= pageImgHeight;
      }
    }

    // Convert PDF to base64
    const pdfBase64 = pdf.output('datauristring');
    
    console.log('PDF generated, uploading...');

    // Upload to backend
    const fileName = `Contrato_${brandName.replace(/\s+/g, '_')}_${Date.now()}`;
    
    const { data, error } = await supabase.functions.invoke('upload-signed-contract-pdf', {
      body: {
        contractId,
        documentType: documentType || 'contrato',
        pdfBase64,
        fileName,
        userId,
        processId,
        contractHtml,
      },
    });

    if (error) {
      console.error('Error uploading PDF:', error);
      return {
        success: false,
        error: error.message || 'Erro ao fazer upload do PDF',
      };
    }

    if (!data?.success) {
      return {
        success: false,
        error: data?.error || 'Erro desconhecido ao fazer upload',
      };
    }

    console.log('PDF uploaded successfully:', data.data);

    return {
      success: true,
      publicUrl: data.data.publicUrl,
      documentId: data.data.documentId,
    };
  } catch (error: any) {
    console.error('Error generating/uploading PDF:', error);
    return {
      success: false,
      error: error.message || 'Erro ao gerar PDF',
    };
  }
}

/**
 * Generates PDF HTML content with all certification data
 */
export function generateSignedContractHtml(
  content: string,
  brandName: string,
  clientName: string,
  clientCpf: string,
  blockchainSignature?: {
    hash?: string;
    timestamp?: string;
    txId?: string;
    network?: string;
    ipAddress?: string;
  },
  documentType: 'contract' | 'procuracao' | 'distrato_multa' | 'distrato_sem_multa' = 'contract'
): string {
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
      
      if (trimmed.match(/^_+$/)) return '';
      
      if (trimmed === 'CONTRATADA:' || trimmed === 'CONTRATANTE:') {
        return `<p style="font-size: 11px; font-weight: bold; text-align: center; margin-top: 24px; margin-bottom: 4px;">${trimmed}</p>`;
      }
      
      if (trimmed.startsWith('São Paulo,')) {
        return `<p style="font-size: 11px; margin-top: 24px; margin-bottom: 24px;">${trimmed}</p>`;
      }
      
      return `<p style="font-size: 11px; margin-bottom: 12px; line-height: 1.6;">${trimmed}</p>`;
    })
    .join('\n');

  const certificationSection = blockchainSignature?.hash ? `
    <!-- Digital Certification Section -->
    <div style="margin-top: 32px;">
      <!-- Footer before certification -->
      <div style="text-align: center; padding: 16px 0; border-top: 1px solid #e5e7eb; font-size: 10px; color: #6b7280;">
        <p>Contrato gerado e assinado eletronicamente pelo sistema WebMarcas</p>
        <p>www.webmarcas.net | juridico@webmarcas.net</p>
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
              <p style="font-size: 13px; color: #1e293b;">${blockchainSignature.timestamp ? new Date(blockchainSignature.timestamp).toLocaleString('pt-BR') : '-'}</p>
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
  ` : '';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=210mm, initial-scale=1.0">
  <title>${documentType === 'procuracao' ? 'Procuração' : documentType.includes('distrato') ? 'Distrato' : 'Contrato'} WebMarcas - ${brandName}</title>
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
      padding: 40px; 
      font-size: 11px; 
      max-width: 210mm;
      margin: 0 auto;
    }
    
    .header { 
      display: flex; 
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      margin-bottom: 0;
    }
    
    .header-logo {
      font-size: 24px;
      font-weight: bold;
      color: #0284c7 !important;
    }
    
    .header-url {
      color: #0284c7 !important;
      font-size: 14px;
      font-weight: 600;
    }
    
    .gradient-bar {
      height: 8px;
      width: 100%;
      background: linear-gradient(90deg, #f97316, #fbbf24) !important;
      border-radius: 3px;
      margin-bottom: 24px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .main-title {
      text-align: center;
      color: #0284c7 !important;
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 16px;
      text-decoration: underline;
    }
    
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
      font-size: 12px;
      line-height: 1.5;
      color: white !important;
    }
    
    .highlight-box { 
      background-color: #FEF9E7 !important; 
      padding: 16px; 
      margin-bottom: 24px; 
      border-left: 4px solid #F59E0B !important;
      color: #374151 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .highlight-box p {
      color: #374151 !important;
    }
    
    .content-area {
      margin-top: 16px;
    }
    
    .footer {
      margin-top: 40px;
      text-align: center;
      color: #6b7280 !important;
      font-size: 9px;
      border-top: 1px solid #e5e7eb;
      padding-top: 16px;
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
      
      .gradient-bar,
      .contract-title-box,
      .highlight-box {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="header-logo">WebMarcas</span>
    <span class="header-url">www.webmarcas.net</span>
  </div>
  
  <div class="gradient-bar"></div>
  
  ${documentType === 'procuracao' ? `
  <h1 class="main-title">PROCURAÇÃO PARA REPRESENTAÇÃO JUNTO AO INPI</h1>
  <p style="text-align: center; color: #4B5563; font-size: 14px; font-style: italic; margin-bottom: 24px;">Instrumento Particular de Procuração para fins de Registro de Marca</p>
  
  <div class="highlight-box">
    <p>Pelo presente instrumento particular de PROCURAÇÃO, o(a) outorgante abaixo identificado(a) nomeia e constitui como seu bastante PROCURADOR o(a) Sr(a). Davilys Danques de Oliveira Cunha, para representá-lo(a) de forma exclusiva junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL – INPI, podendo praticar todos os atos necessários, legais e administrativos relacionados ao pedido, acompanhamento, defesa e manutenção do registro de marca, inclusive apresentação de requerimentos, cumprimento de exigências, interposição de recursos e recebimento de notificações.</p>
  </div>
  ` : documentType === 'distrato_multa' || documentType === 'distrato_sem_multa' ? `
  <h1 class="main-title">ACORDO DE DISTRATO</h1>
  
  <div class="contract-title-box">
    <p>INSTRUMENTO PARTICULAR DE DISTRATO DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS</p>
  </div>
  
  <div class="highlight-box">
    <p>As partes abaixo qualificadas resolvem, de comum acordo, distratar o contrato de prestação de serviços firmado anteriormente, nos termos e condições a seguir estabelecidos.</p>
  </div>
  ` : `
  <h1 class="main-title" style="text-decoration: underline;">CONTRATO</h1>
  
  <div class="contract-title-box">
    <p>CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORAMENTO<br/>PARA REGISTRO DE MARCA JUNTO AO INPI</p>
  </div>
  
  <div class="highlight-box">
    <p style="margin-bottom: 8px;">Os termos deste instrumento aplicam-se apenas a contratações com negociações personalizadas, tratadas diretamente com a equipe comercial da Web Marcas e Patentes Eireli.</p>
    <p>Os termos aqui celebrados são adicionais ao "Contrato de Prestação de Serviços e Gestão de Pagamentos e Outras Avenças" com aceite integral no momento do envio da Proposta.</p>
  </div>
  `}
  
  <div class="content-area">
    ${htmlContent}
  </div>
  
  ${certificationSection}
  
  <div class="footer">
    <p>Contrato gerado e assinado eletronicamente pelo sistema WebMarcas</p>
    <p>www.webmarcas.net | contato@webmarcas.net</p>
  </div>
</body>
</html>`;
}
