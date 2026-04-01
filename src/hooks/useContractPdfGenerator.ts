import jsPDF from 'jspdf';
import { getLogoBase64, BlockchainSignature } from '@/components/contracts/ContractRenderer';

interface ContractPdfOptions {
  brandName: string;
  clientName: string;
  clientCpf: string;
  blockchainSignature?: BlockchainSignature;
}

export async function generateContractPDF(
  content: string,
  options: ContractPdfOptions
): Promise<Blob> {
  const { brandName, clientName, clientCpf, blockchainSignature } = options;
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Helper function to add new page if needed
  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Load and add logo with correct aspect ratio
  try {
    const logoBase64 = await getLogoBase64();
    // Logo dimensions: The WebMarcas logo has ~1.4:1 width:height ratio (wider than tall)
    const logoWidth = 28;
    const logoHeight = 20;
    pdf.addImage(logoBase64, 'PNG', margin, yPosition, logoWidth, logoHeight);
  } catch (error) {
    console.error('Failed to add logo:', error);
  }

  // Add website URL
  pdf.setFontSize(10);
  pdf.setTextColor(2, 132, 199); // Blue color
  pdf.text('www.webmarcas.net', pageWidth - margin, yPosition + 10, { align: 'right' });

  yPosition += 20;

  // Orange/Yellow Gradient Bar (simulated with rectangle)
  pdf.setFillColor(249, 115, 22); // Orange
  pdf.rect(margin, yPosition, contentWidth, 3, 'F');
  yPosition += 8;

  // Main Title - CONTRATO underlined
  pdf.setFontSize(16);
  pdf.setTextColor(2, 132, 199); // Blue
  pdf.setFont('helvetica', 'bold');
  pdf.text('CONTRATO', pageWidth / 2, yPosition, { align: 'center' });
  // Add underline
  const titleWidth = pdf.getTextWidth('CONTRATO');
  pdf.line((pageWidth - titleWidth) / 2, yPosition + 1, (pageWidth + titleWidth) / 2, yPosition + 1);
  yPosition += 10;

  // Light Blue Box with Contract Title
  pdf.setFillColor(30, 58, 95); // Dark blue #1e3a5f
  pdf.rect(margin, yPosition, contentWidth, 16, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORAMENTO', pageWidth / 2, yPosition + 6, { align: 'center' });
  pdf.text('PARA REGISTRO DE MARCA JUNTO AO INPI', pageWidth / 2, yPosition + 12, { align: 'center' });
  yPosition += 22;

  // Yellow Highlight Box - LEFT BORDER ONLY
  pdf.setFillColor(254, 249, 231); // Light yellow #FEF9E7
  pdf.rect(margin, yPosition, contentWidth, 24, 'F');
  // Draw left border only
  pdf.setDrawColor(245, 158, 11); // Yellow border #F59E0B
  pdf.setLineWidth(2);
  pdf.line(margin, yPosition, margin, yPosition + 24);
  pdf.setTextColor(55, 65, 81); // Gray text #374151
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  const highlightText1 = 'Os termos deste instrumento aplicam-se apenas a contratações com negociações personalizadas, tratadas diretamente com a equipe comercial da WebMarcas Intelligence PI.';
  const highlightText2 = 'Os termos aqui celebrados são adicionais ao "Contrato de Prestação de Serviços e Gestão de Pagamentos e Outras Avenças" com aceite integral no momento do envio da Proposta.';
  
  const splitText1 = pdf.splitTextToSize(highlightText1, contentWidth - 8);
  const splitText2 = pdf.splitTextToSize(highlightText2, contentWidth - 8);
  
  pdf.text(splitText1, margin + 4, yPosition + 5);
  pdf.text(splitText2, margin + 4, yPosition + 14);
  yPosition += 30;

  // Contract Content
  pdf.setTextColor(31, 41, 55); // Dark gray
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      yPosition += 4;
      continue;
    }

    // Skip main title (already in header)
    if (trimmed.includes('CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS')) {
      continue;
    }

    checkNewPage(8);

    // Clause titles - Blue and bold
    if (/^\d+\.\s*CLÁUSULA/.test(trimmed)) {
      yPosition += 4;
      pdf.setTextColor(2, 132, 199);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      const splitLine = pdf.splitTextToSize(trimmed, contentWidth);
      pdf.text(splitLine, margin, yPosition);
      yPosition += splitLine.length * 5 + 2;
      pdf.setTextColor(31, 41, 55);
      pdf.setFont('helvetica', 'normal');
      continue;
    }

    // Sub-items
    if (/^\d+\.\d+\s/.test(trimmed)) {
      const splitLine = pdf.splitTextToSize(trimmed, contentWidth - 8);
      checkNewPage(splitLine.length * 4 + 2);
      pdf.text(splitLine, margin + 8, yPosition);
      yPosition += splitLine.length * 4 + 2;
      continue;
    }

    // List items with letters
    if (/^[a-z]\)/.test(trimmed)) {
      const splitLine = pdf.splitTextToSize(trimmed, contentWidth - 16);
      checkNewPage(splitLine.length * 4 + 1);
      pdf.text(splitLine, margin + 16, yPosition);
      yPosition += splitLine.length * 4 + 1;
      continue;
    }

    // Party identification headers
    if (trimmed === 'CONTRATADA:' || trimmed === 'CONTRATANTE:') {
      yPosition += 6;
      checkNewPage(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(trimmed, pageWidth / 2, yPosition, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      yPosition += 5;
      continue;
    }

    // Company/client details - wrap long text to prevent overflow
    if (trimmed.includes('WEB MARCAS PATENTES EIRELI') || trimmed.includes('WebMarcas Intelligence PI') || 
        trimmed.startsWith('CNPJ:') || 
        trimmed.startsWith('CPF:') ||
        trimmed.startsWith('CPF/CNPJ:')) {
      pdf.setTextColor(107, 114, 128); // Gray
      pdf.setFontSize(9);
      const splitLine = pdf.splitTextToSize(trimmed, contentWidth);
      checkNewPage(splitLine.length * 4 + 2);
      splitLine.forEach((line: string) => {
        pdf.text(line, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 4;
      });
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(10);
      continue;
    }

    // Date line
    if (trimmed.startsWith('São Paulo,')) {
      yPosition += 6;
      checkNewPage(10);
      pdf.text(trimmed, margin, yPosition);
      yPosition += 6;
      continue;
    }

    // Skip signature lines
    if (trimmed.match(/^_+$/)) {
      continue;
    }

    // Regular paragraphs
    const splitLine = pdf.splitTextToSize(trimmed, contentWidth);
    checkNewPage(splitLine.length * 4 + 3);
    pdf.text(splitLine, margin, yPosition);
    yPosition += splitLine.length * 4 + 3;
  }

  // Footer
  yPosition += 10;
  checkNewPage(30);
  
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(8);
  pdf.text('Contrato gerado e assinado eletronicamente pelo sistema WebMarcas', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 4;
  pdf.text('www.webpatentes.com.br | juridico@webpatentes.com.br', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 4;
  pdf.text(`Data e hora da geração: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, yPosition, { align: 'center' });

  // Add blockchain certification if signed
  if (blockchainSignature?.hash) {
    pdf.addPage();
    yPosition = margin;

    // Blue divider
    pdf.setFillColor(2, 132, 199);
    pdf.rect(margin, yPosition, contentWidth, 3, 'F');
    yPosition += 10;

    // Certification header
    pdf.setTextColor(2, 132, 199);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CERTIFICAÇÃO DIGITAL E VALIDADE JURÍDICA', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // Certification box
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(margin, yPosition, contentWidth, 60, 'FD');

    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    
    let certY = yPosition + 8;
    pdf.text('HASH SHA-256', margin + 4, certY);
    certY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    const hashLines = pdf.splitTextToSize(blockchainSignature.hash || '', contentWidth - 8);
    pdf.text(hashLines, margin + 4, certY);
    certY += hashLines.length * 3 + 6;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('DATA/HORA DA ASSINATURA', margin + 4, certY);
    certY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(blockchainSignature.timestamp || '-', margin + 4, certY);
    certY += 8;

    if (blockchainSignature.txId) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('ID DA TRANSAÇÃO', margin + 4, certY);
      certY += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      const txLines = pdf.splitTextToSize(blockchainSignature.txId, contentWidth - 8);
      pdf.text(txLines, margin + 4, certY);
      certY += txLines.length * 3 + 6;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('REDE BLOCKCHAIN', margin + 4, certY);
    certY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(blockchainSignature.network || 'Bitcoin (OpenTimestamps)', margin + 4, certY);

    yPosition += 70;

    // Legal footer
    pdf.setTextColor(100, 116, 139);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'italic');
    pdf.text('Este documento foi assinado eletronicamente e possui validade jurídica conforme Lei 14.063/2020 e MP 2.200-2/2001.', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;
    pdf.setTextColor(2, 132, 199);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Verifique a autenticidade em: ${window.location.origin}/verificar-contrato`, pageWidth / 2, yPosition, { align: 'center' });
  }

  return pdf.output('blob');
}

export async function downloadContractPDF(
  content: string,
  options: ContractPdfOptions
): Promise<void> {
  const blob = await generateContractPDF(content, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Contrato_WebMarcas_${options.brandName.replace(/\s+/g, '_')}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
