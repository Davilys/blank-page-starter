import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Printer, Loader2, Pencil, Save, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import logoWebmarcas from '@/assets/webmarcas-logo-new.png';
import signatureImage from '@/assets/davilys-signature.png';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

interface ResourceEvidence {
  id: string;
  storage_path: string;
  caption: string | null;
  source_file_name: string | null;
  page_number: number | null;
  placement: 'inline' | 'annex';
  display_order: number;
  included: boolean;
  docNumber?: number;
  signedUrl?: string;
  dataUrl?: string;
  width?: number;
  height?: number;
}

interface ResourceData {
  id: string;
  brand_name: string | null;
  process_number: string | null;
  ncl_class: string | null;
  holder: string | null;
  approved_at: string | null;
}

interface INPIResourcePDFPreviewProps {
  resource: ResourceData;
  content: string;
  resourceType?: string;
}

const isNotificacao = (type?: string) => type === 'notificacao_extrajudicial';
const isRespostaNotificacao = (type?: string) => type === 'resposta_notificacao_extrajudicial';
const isExtrajudicial = (type?: string) => isNotificacao(type) || isRespostaNotificacao(type);

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  oposicao: 'MANIFESTAÇÃO À OPOSIÇÃO',
  indeferimento: 'RECURSO CONTRA INDEFERIMENTO',
  exigencia_merito: 'CUMPRIMENTO DE EXIGÊNCIA DE MÉRITO',
  notificacao_extrajudicial: 'NOTIFICAÇÃO EXTRAJUDICIAL',
  resposta_notificacao_extrajudicial: 'RESPOSTA À NOTIFICAÇÃO EXTRAJUDICIAL',
  troca_procurador: 'PETIÇÃO DE TROCA DE PROCURADOR',
  nomeacao_procurador: 'PETIÇÃO DE NOMEAÇÃO DE PROCURADOR',
};

const getResourceTypeLabel = (resourceType?: string): string => {
  if (!resourceType) return '';
  return RESOURCE_TYPE_LABELS[resourceType] || resourceType.toUpperCase().replace(/_/g, ' ');
};

const cleanMarkdown = (text: string): string => {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/[\u2500-\u257F\u2580-\u259F\u2550-\u256C]/g, '')
    .trim();
};

// Soft clean: preserves **bold**, *italic*, tables (| ... |), and [IMG:]/[DOC:] markers.
// Strips only headings (#), inline code (`), and box-drawing chars.
const softCleanMarkdown = (text: string): string => {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[\u2500-\u257F\u2580-\u259F\u2550-\u256C]/g, '')
    .trim();
};

// Parse a string with **bold** and *italic* markers into React inline nodes.
const renderInlineMarkdown = (text: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  // Combined regex: **bold** | *italic*
  const regex = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(<span key={`t${key++}`}>{text.slice(last, m.index)}</span>);
    if (m[2] !== undefined) {
      nodes.push(<strong key={`b${key++}`}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      nodes.push(<em key={`i${key++}`}>{m[3]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(<span key={`t${key++}`}>{text.slice(last)}</span>);
  return nodes;
};

// Detect markdown table block (paragraph composed of table rows)
const isMarkdownTable = (paragraph: string): boolean => {
  const lines = paragraph.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const rowLike = lines.filter((l) => /^\|.+\|$/.test(l));
  return rowLike.length >= 2;
};

const parseMarkdownTable = (paragraph: string): { headers: string[]; rows: string[][] } | null => {
  const lines = paragraph.split('\n').map((l) => l.trim()).filter((l) => /^\|.+\|$/.test(l));
  if (lines.length < 2) return null;
  const splitRow = (l: string) =>
    l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const headers = splitRow(lines[0]);
  // lines[1] is separator like |:---|:---|
  const dataLines = lines.slice(1).filter((l) => !/^\|?\s*:?-{2,}/.test(l.split('|').filter(Boolean)[0] || ''));
  // Filter out separator rows
  const isSep = (l: string) => splitRow(l).every((c) => /^:?-{2,}:?$/.test(c));
  const rows = lines.slice(1).filter((l) => !isSep(l)).map(splitRow);
  return { headers, rows };
};

const stripOpeningMarkers = (text: string): string => {
  let cleaned = text;
  // Remove structural markers
  cleaned = cleaned.replace(/^-{2,}\s*INÍCIO DO RECURSO\s*-{2,}\s*$/gm, '');
  cleaned = cleaned.replace(/^-{2,}\s*FIM DO RECURSO\s*-{2,}\s*$/gm, '');
  // Remove ALL occurrences of title lines (component renders these separately)
  cleaned = cleaned.replace(/^\s*RECURSO ADMINISTRATIVO\s*[–—-]\s*.+$/gm, '');
  cleaned = cleaned.replace(/^\s*MARCA:\s*[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s.]+$/gm, '');
  cleaned = cleaned.replace(/^\s*NOTIFICAÇÃO EXTRAJUDICIAL\s*$/gim, '');
  cleaned = cleaned.replace(/^\s*RESPOSTA\s*[ÀA]\s*NOTIFICAÇÃO\s*EXTRAJUDICIAL\s*$/gim, '');
  cleaned = cleaned.replace(/^\s*PETIÇÃO DE (TROCA|NOMEAÇÃO) DE PROCURADOR\s*$/gim, '');

  // Deduplicate addressing + metadata block if it appears more than once
  // Find the addressing block pattern
  const addressingPattern = /EXCELENTÍSSIMO\s+SENHOR\s+PRESIDENTE[\s\S]*?Procurador:\s*Davilys\s+Danques[^\n]*/gi;
  const matches = cleaned.match(addressingPattern);
  if (matches && matches.length > 1) {
    // Keep only the first occurrence, remove subsequent ones
    let found = false;
    cleaned = cleaned.replace(addressingPattern, (match) => {
      if (!found) { found = true; return match; }
      return '';
    });
  }

  // Clean up excessive blank lines left by removals
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n');
  return cleaned.trim();
};

const stripClosingFromContent = (text: string, resourceType?: string): string => {
  let cleaned = text.replace(/^Av\.\s*Brigadeiro.*$/gm, '');
  cleaned = cleaned.replace(/^Tel:?\s*\(11\).*$/gm, '');
  cleaned = cleaned.replace(/^[═─━╌╍┄┅┈┉▬%P\s]{3,}$/gm, '');
  cleaned = cleaned.replace(/^[\u2500-\u257F\u2580-\u259F\u2550-\u256C]{2,}.*$/gm, '');
  cleaned = cleaned.replace(/^[_]{3,}$/gm, '');
  cleaned = cleaned.replace(/Examinador\/Opoe?nte:/gi, 'Oponente:');
  
  const closingPatterns = [
    /\n\s*Protesta provar[\s\S]*$/i,
    /\n\s*Nestes termos[\s\S]*$/i,
  ];
  for (const pattern of closingPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  cleaned = cleaned.replace(/\n\s*Termos em que,?\s*\n\s*Pede deferimento\.?\s*\n[\s\S]*$/i, '');
  
  if (isExtrajudicial(resourceType)) {
    cleaned = cleaned.replace(/\n\s*São Paulo,\s*\d{1,2}\s*de\s*\w+\s*de\s*\d{4}[\s\S]*$/i, '');
    cleaned = cleaned.replace(/\n\s*Davilys Danques[\s\S]*$/i, '');
  }
  
  return cleaned.trim();
};

const isMetadataLine = (text: string): boolean => {
  const trimmed = text.trim();
  return /^(Processo\s*(INPI\s*)?n[ºo°]|Marca:|Classe\s*NCL|Titular|Requerente:|Oponente:|Procurador:|Examinador:)/i.test(trimmed);
};

const isHeadingLine = (text: string): boolean => {
  const trimmed = text.trim();
  if (trimmed.length >= 100) return false;
  return /^(I{1,4}V?\s*[–—-]|V?I{0,4}\s*[–—-]|[A-Z][A-Z\s–—-]{5,}$|DO[S]?\s|DA[S]?\s|CONCLUS|PEDIDO|FATOS|FUNDAMENT|RECURSO|EXCELENT|NOTIFICA)/i.test(trimmed);
};

const imageToBase64 = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject('No canvas context'); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = src;
  });
};

export function INPIResourcePDFPreview({ resource, content, resourceType }: INPIResourcePDFPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [evidences, setEvidences] = useState<ResourceEvidence[]>([]);
  const [liveContent, setLiveContent] = useState<string>(content);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<string>(content);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    setLiveContent(content);
    setEditDraft(content);
  }, [content]);

  const handleSaveEdit = async () => {
    setIsSavingEdit(true);
    try {
      const updateField = 'final_content';
      const { error } = await supabase
        .from('inpi_resources' as any)
        .update({ [updateField]: editDraft })
        .eq('id', resource.id);
      if (error) throw error;
      setLiveContent(editDraft);
      setIsEditing(false);
      toast({ title: 'Alterações salvas', description: 'O conteúdo do recurso foi atualizado.' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Fetch evidences for this resource + sign URLs + preload data URLs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('inpi_resource_evidences' as any)
        .select('*')
        .eq('resource_id', resource.id)
        .eq('included', true)
        .order('display_order', { ascending: true });
      const list = ((data as any[]) || []) as ResourceEvidence[];
      let n = 1;
      const numbered = list.map((r) => ({ ...r, docNumber: n++ }));
      // sign + dataurl
      await Promise.all(
        numbered.map(async (r) => {
          const { data: s } = await supabase.storage
            .from('inpi-resource-evidence')
            .createSignedUrl(r.storage_path, 3600);
          if (s?.signedUrl) {
            r.signedUrl = s.signedUrl;
            try {
              const resp = await fetch(s.signedUrl);
              const blob = await resp.blob();
              r.dataUrl = await new Promise<string>((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result as string);
                fr.onerror = reject;
                fr.readAsDataURL(blob);
              });
              const dims = await new Promise<{ w: number; h: number }>((resolve) => {
                const img = new Image();
                img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = () => resolve({ w: 800, h: 1000 });
                img.src = r.dataUrl!;
              });
              r.width = dims.w;
              r.height = dims.h;
            } catch { /* ignore */ }
          }
        }),
      );
      if (!cancelled) setEvidences(numbered);
    })();
    return () => { cancelled = true; };
  }, [resource.id]);

  const evidenceByNum = (n: number) => evidences.find((e) => e.docNumber === n);
  const inlineEvidences = evidences.filter((e) => e.placement === 'inline');
  const annexEvidences = evidences; // all included evidences also appear in annex

  const isNotif = isNotificacao(resourceType);
  const isRespostaNotif = isRespostaNotificacao(resourceType);
  const isExtrajudicialDoc = isExtrajudicial(resourceType);
  const isProcuradorPetition = resourceType === 'troca_procurador' || resourceType === 'nomeacao_procurador';
  const isOposicao = resourceType === 'oposicao';
  const isExigenciaMerito = resourceType === 'exigencia_merito';
  const cleanedContent = stripOpeningMarkers(softCleanMarkdown(liveContent));
  const bodyContent = stripClosingFromContent(cleanedContent, resourceType);

  const approvalDate = resource.approved_at 
    ? format(new Date(resource.approved_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const documentTitle = isNotif
    ? 'Notificação Extrajudicial'
    : isRespostaNotif
      ? 'Resposta à Notificação Extrajudicial'
    : isProcuradorPetition
      ? resourceType === 'troca_procurador'
        ? 'Petição de Troca de Procurador'
        : 'Petição de Nomeação de Procurador'
    : isOposicao
      ? 'Manifestação à Oposição'
    : isExigenciaMerito
      ? 'Cumprimento de Exigência de Mérito'
      : 'Recurso Administrativo';
  const documentTitleUpper = documentTitle.toUpperCase();
  const pdfFileName = isNotif
    ? `Notificacao_Extrajudicial_${resource.brand_name?.replace(/\s+/g, '_') || 'WebMarcas'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`
    : isRespostaNotif
      ? `Resposta_Notificacao_Extrajudicial_${format(new Date(), 'yyyy-MM-dd')}.pdf`
    : isProcuradorPetition
      ? `${resourceType === 'troca_procurador' ? 'Peticao_Troca_Procurador' : 'Peticao_Nomeacao_Procurador'}_${resource.brand_name?.replace(/\s+/g, '_') || 'INPI'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`
    : isOposicao
      ? `Manifestacao_Oposicao_${resource.brand_name?.replace(/\s+/g, '_') || 'INPI'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`
    : isExigenciaMerito
      ? `Cumprimento_Exigencia_Merito_${resource.brand_name?.replace(/\s+/g, '_') || 'INPI'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`
      : `Recurso_${resource.brand_name?.replace(/\s+/g, '_') || 'INPI'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para imprimir o documento.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${documentTitle} - ${resource.brand_name || 'WebMarcas'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;600;700&display=swap');
            @page { margin: 2.5cm; size: A4; }
            body { font-family: 'Crimson Pro', Georgia, serif; font-size: 12pt; line-height: 1.8; color: #1a1a1a; }
            .letterhead { margin-bottom: 40px; border-top: 8px solid #1e3a5f; padding-top: 20px; }
            .logo-container img { width: 80px; height: 80px; }
            .content { text-align: justify; margin-top: 30px; }
            .content h2 { font-weight: 600; color: #1e3a5f; font-size: 13pt; margin-top: 20px; margin-bottom: 10px; }
            .content p { margin-bottom: 14px; text-indent: 2cm; }
            .signature { margin-top: 60px; text-align: center; }
            .signature-name { font-weight: 600; color: #1e3a5f; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 25;
      const contentWidth = pageWidth - (margin * 2);
      let yPos = margin;

      let logoBase64: string | null = null;
      let signBase64: string | null = null;
      try { logoBase64 = await imageToBase64(logoWebmarcas); } catch { /* skip */ }
      try { signBase64 = await imageToBase64(signatureImage); } catch { /* skip */ }

      // ── Header Bar ──
      pdf.setFillColor(30, 58, 95);
      pdf.rect(0, 0, pageWidth, 6, 'F');
      pdf.setFillColor(200, 175, 55);
      pdf.rect(0, 6, pageWidth, 2, 'F');
      yPos = 18;

      // ── Letterhead ──
      if (logoBase64) {
        pdf.addImage(logoBase64, 'PNG', margin, yPos - 2, 16, 16);
      }
      const textX = logoBase64 ? margin + 19 : margin;
      pdf.setFontSize(16);
      pdf.setTextColor(30, 58, 95);
      pdf.setFont('helvetica', 'bold');
      pdf.text('WEBMARCAS INTELLIGENCE PI', textX, yPos + 5);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Propriedade Intelectual e Registro de Marcas', textX, yPos + 10);

      // Right-aligned contact info - positioned below header line to avoid overlap
      yPos += 16;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 58, 95);
      pdf.text('CNPJ: 39.528.012/0001-29', pageWidth - margin, yPos, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(150, 150, 150);
      pdf.text('Av. Brigadeiro Luiz Antônio, 2696 — Centro — São Paulo/SP', pageWidth - margin, yPos + 4, { align: 'right' });
      pdf.text('Tel: (11) 9 1112-0225  |  juridico@webmarcas.net', pageWidth - margin, yPos + 8, { align: 'right' });

      // ── Double Separator ──
      yPos += 12;
      pdf.setDrawColor(30, 58, 95);
      pdf.setLineWidth(0.8);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      pdf.setDrawColor(200, 175, 55);
      pdf.setLineWidth(0.3);
      pdf.line(margin, yPos + 1.5, pageWidth - margin, yPos + 1.5);
      yPos += 8;

      // ── Document Title Badge (centered) ──
      const badgeTitle = isNotif
        ? 'NOTIFICAÇÃO EXTRAJUDICIAL'
        : isRespostaNotif
          ? 'RESPOSTA À NOTIFICAÇÃO EXTRAJUDICIAL'
        : isProcuradorPetition
          ? documentTitleUpper
        : isOposicao
          ? 'MANIFESTAÇÃO À OPOSIÇÃO'
        : isExigenciaMerito
          ? 'CUMPRIMENTO DE EXIGÊNCIA DE MÉRITO'
          : 'RECURSO ADMINISTRATIVO';

      // Draw navy badge
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      const badgeTextWidth = pdf.getTextWidth(badgeTitle);
      const badgePadX = 12;
      const badgeW = badgeTextWidth + badgePadX * 2;
      const badgeH = 9;
      const badgeX = (pageWidth - badgeW) / 2;
      pdf.setFillColor(30, 58, 95);
      pdf.roundedRect(badgeX, yPos - 1, badgeW, badgeH, 1.5, 1.5, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.text(badgeTitle, pageWidth / 2, yPos + 5, { align: 'center' });
      yPos += badgeH + 5;

      // Marca line centered
      if (resource.brand_name) {
        pdf.setFontSize(12);
        pdf.setTextColor(30, 58, 95);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Marca: ${resource.brand_name}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 6;
      }

      // Process number centered
      if (resource.process_number) {
        pdf.setFontSize(10);
        pdf.setTextColor(80, 80, 80);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Processo INPI nº ${resource.process_number}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 6;
      }
      yPos += 4;

      // ── Content Body ──
      pdf.setFont('helvetica', 'normal');
      const paragraphs = bodyContent.split('\n\n').filter(p => p.trim());
      
      const addFooter = (pageNum: number, totalPages: number) => {
        const footerY = pageHeight - 12;
        pdf.setDrawColor(30, 58, 95);
        pdf.setLineWidth(0.5);
        pdf.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
        pdf.setDrawColor(200, 175, 55);
        pdf.setLineWidth(0.3);
        pdf.line(margin, footerY - 6.5, pageWidth - margin, footerY - 6.5);
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Av. Brigadeiro Luiz Antônio, 2696, Centro — São Paulo/SP — CEP 01402-000', pageWidth / 2, footerY - 2, { align: 'center' });
        pdf.text('Tel: (11) 9 1112-0225  |  juridico@webmarcas.net  |  www.webmarcas.net', pageWidth / 2, footerY + 2, { align: 'center' });
        pdf.setFontSize(8);
        pdf.setTextColor(130, 130, 130);
        pdf.text(`${pageNum}/${totalPages}`, pageWidth - margin, footerY - 2, { align: 'right' });
      };

      const bottomLimit = pageHeight - 30;

      for (const paragraph of paragraphs) {
        const trimmedParagraph = paragraph.trim();
        if (!trimmedParagraph) continue;
        if (/^(Av\.\s*Brigadeiro|Tel:\s*\(11\))/.test(trimmedParagraph)) continue;

        // ── Markdown table → simple grid in jsPDF ──
        if (isMarkdownTable(trimmedParagraph)) {
          const tbl = parseMarkdownTable(trimmedParagraph);
          if (tbl) {
            const cols = Math.max(tbl.headers.length, 1);
            const colW = contentWidth / cols;
            const rowH = 7;
            const headerH = 8;
            // Header
            if (yPos + headerH > bottomLimit) { pdf.addPage(); yPos = margin; }
            pdf.setFillColor(30, 58, 95);
            pdf.rect(margin, yPos, contentWidth, headerH, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            tbl.headers.forEach((h, i) => {
              const txt = h.replace(/\*\*/g, '').replace(/\*/g, '');
              pdf.text(txt, margin + i * colW + 2, yPos + 5.5);
            });
            yPos += headerH;
            // Rows
            pdf.setTextColor(30, 30, 30);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            tbl.rows.forEach((row, ri) => {
              if (yPos + rowH > bottomLimit) { pdf.addPage(); yPos = margin; }
              if (ri % 2 === 0) {
                pdf.setFillColor(247, 249, 252);
                pdf.rect(margin, yPos, contentWidth, rowH, 'F');
              }
              row.forEach((c, ci) => {
                const txt = (c || '').replace(/\*\*/g, '').replace(/\*/g, '');
                const lines = pdf.splitTextToSize(txt, colW - 4);
                pdf.text(lines[0] || '', margin + ci * colW + 2, yPos + 5);
              });
              yPos += rowH;
            });
            yPos += 4;
            pdf.setFontSize(11);
            continue;
          }
        }

        // Handle metadata block: split into individual lines rendered compactly
        const metadataLines = trimmedParagraph.split('\n').filter(l => l.trim());
        const hasMetadata = metadataLines.some(l => isMetadataLine(l));
        
        if (hasMetadata && metadataLines.length > 1) {
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(60, 60, 60);
          for (const mLine of metadataLines) {
            const ml = mLine.trim();
            if (!ml) continue;
            if (yPos > bottomLimit) { pdf.addPage(); yPos = margin; }
            pdf.text(ml, margin, yPos);
            yPos += 5.5;
          }
          yPos += 4;
          continue;
        }

        const heading = isHeadingLine(trimmedParagraph);
        
        if (heading) {
          if (yPos > margin + 10) yPos += 4;
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(30, 58, 95);
          
          const headingLines = pdf.splitTextToSize(trimmedParagraph, contentWidth);
          for (const line of headingLines) {
            if (yPos > bottomLimit) { pdf.addPage(); yPos = margin; }
            pdf.text(line, margin, yPos);
            yPos += 7;
          }
          
          if (trimmedParagraph.length < 80) {
            pdf.setDrawColor(200, 175, 55);
            pdf.setLineWidth(0.3);
            pdf.line(margin, yPos - 2, margin + 40, yPos - 2);
          }
          
          pdf.setFont('helvetica', 'normal');
          yPos += 3;
        } else {
          pdf.setFontSize(11);
          pdf.setTextColor(30, 30, 30);
          pdf.setFont('helvetica', 'normal');

          const isList = /^[-–•]\s/.test(trimmedParagraph);
          const indent = isList ? margin + 5 : margin;
          const lineWidth = isList ? contentWidth - 5 : contentWidth;

          const docNums: number[] = [];
          const imgSlugs: string[] = [];
          let renderText = trimmedParagraph.replace(/\[DOC:(\d{1,3})\]/g, (_full: string, n: string) => {
            const num = parseInt(n, 10);
            docNums.push(num);
            return `(Doc. ${String(num).padStart(2, '0')})`;
          });
          renderText = renderText.replace(/\[IMG:([a-z0-9_\-]+)\]/gi, (_full, slug) => {
            imgSlugs.push(String(slug).toLowerCase());
            return '';
          });
          // Strip markdown bold/italic markers for jsPDF (rendered as plain text)
          renderText = renderText.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1');
          const lines = pdf.splitTextToSize(renderText, lineWidth);
          
          for (const line of lines) {
            if (yPos > bottomLimit) { pdf.addPage(); yPos = margin; }
            pdf.text(line, indent, yPos);
            yPos += 6;
          }
          for (const n of docNums) {
            const ev = evidenceByNum(n);
            if (!ev?.dataUrl) continue;
            const maxImgW = contentWidth * 0.7;
            const maxImgH = 75;
            const ratio = ev.width && ev.height ? ev.width / ev.height : 0.75;
            let imgW = maxImgW;
            let imgH = imgW / ratio;
            if (imgH > maxImgH) { imgH = maxImgH; imgW = imgH * ratio; }
            if (yPos + imgH + 12 > bottomLimit) { pdf.addPage(); yPos = margin; }
            yPos += 3;
            const xImg = (pageWidth - imgW) / 2;
            try {
              pdf.addImage(ev.dataUrl, 'PNG', xImg, yPos, imgW, imgH);
              yPos += imgH + 2;
              pdf.setFontSize(8);
              pdf.setTextColor(80, 80, 80);
              const cap = `Doc. ${String(n).padStart(2, '0')} — ${ev.caption || ev.source_file_name || ''}`;
              const capLines = pdf.splitTextToSize(cap, contentWidth);
              for (const cl of capLines) {
                if (yPos > bottomLimit) { pdf.addPage(); yPos = margin; }
                pdf.text(cl, pageWidth / 2, yPos, { align: 'center' });
                yPos += 4;
              }
              pdf.setFontSize(11);
              pdf.setTextColor(30, 30, 30);
            } catch (e) {
              console.warn('addImage inline failed', e);
            }
          }
          // Render [IMG:slug] markers as inline figures matched by caption/filename
          for (const slug of imgSlugs) {
            const ev = evidences.find((e) => {
              const cap = (e.caption || '').toLowerCase();
              const src = (e.source_file_name || '').toLowerCase();
              return cap.includes(slug.replace(/_/g, ' ')) || src.includes(slug);
            });
            if (!ev?.dataUrl) continue;
            const maxImgW = contentWidth * 0.55;
            const maxImgH = 65;
            const ratio = ev.width && ev.height ? ev.width / ev.height : 0.75;
            let imgW = maxImgW;
            let imgH = imgW / ratio;
            if (imgH > maxImgH) { imgH = maxImgH; imgW = imgH * ratio; }
            if (yPos + imgH + 10 > bottomLimit) { pdf.addPage(); yPos = margin; }
            yPos += 3;
            const xImg = (pageWidth - imgW) / 2;
            try {
              pdf.addImage(ev.dataUrl, 'PNG', xImg, yPos, imgW, imgH);
              yPos += imgH + 2;
              pdf.setFontSize(8);
              pdf.setTextColor(80, 80, 80);
              const cap = ev.caption || ev.source_file_name || '';
              if (cap) {
                pdf.text(cap, pageWidth / 2, yPos, { align: 'center' });
                yPos += 4;
              }
              pdf.setFontSize(11);
              pdf.setTextColor(30, 30, 30);
            } catch (e) {
              console.warn('addImage IMG slug failed', e);
            }
          }
          yPos += 3;
        }
      }

      // ── Closing / Signature Block ──
      if (yPos > pageHeight - 90) { pdf.addPage(); yPos = margin; }
      
      yPos += 10;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);

      if (!isExtrajudicialDoc) {
        // Standard INPI resource closing
        pdf.text('Termos em que,', pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;
        pdf.text('Pede deferimento.', pageWidth / 2, yPos, { align: 'center' });
        yPos += 12;
      }

      pdf.text(`São Paulo, ${approvalDate}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 16;

      // Signature image
      if (signBase64) {
        const sigW = 40;
        const sigH = 16;
        pdf.addImage(signBase64, 'PNG', (pageWidth - sigW) / 2, yPos, sigW, sigH);
        yPos += sigH + 2;
      }

      // Signature line
      pdf.setDrawColor(30, 58, 95);
      pdf.setLineWidth(0.5);
      pdf.line(pageWidth / 2 - 35, yPos, pageWidth / 2 + 35, yPos);
      
      yPos += 6;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 58, 95);
      pdf.text('Davilys Danques de Oliveira Cunha', pageWidth / 2, yPos, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      pdf.text('Procurador', pageWidth / 2, yPos + 6, { align: 'center' });

      if (!isExtrajudicialDoc && !isProcuradorPetition) {
        // Only show CPF for standard INPI appeal resources
        pdf.text('CPF 393.239.118-79', pageWidth / 2, yPos + 12, { align: 'center' });
      }

      // ── ANEXOS DOCUMENTAIS ──
      if (annexEvidences.length > 0) {
        pdf.addPage();
        yPos = margin;
        pdf.setFillColor(30, 58, 95);
        pdf.rect(margin, yPos, contentWidth, 10, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('ANEXOS DOCUMENTAIS', pageWidth / 2, yPos + 7, { align: 'center' });
        yPos += 18;
        pdf.setTextColor(30, 30, 30);
        pdf.setFont('helvetica', 'normal');

        for (const ev of annexEvidences) {
          if (!ev.dataUrl) continue;
          // One page per doc
          pdf.addPage();
          yPos = margin;
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(30, 58, 95);
          const title = `Doc. ${String(ev.docNumber).padStart(2, '0')} — ${ev.caption || ev.source_file_name || ''}`;
          const titleLines = pdf.splitTextToSize(title, contentWidth);
          for (const tl of titleLines) {
            pdf.text(tl, pageWidth / 2, yPos, { align: 'center' });
            yPos += 6;
          }
          yPos += 4;
          pdf.setFont('helvetica', 'normal');

          const availableH = pageHeight - yPos - margin - 20;
          const availableW = contentWidth;
          const ratio = ev.width && ev.height ? ev.width / ev.height : 0.75;
          let imgW = availableW;
          let imgH = imgW / ratio;
          if (imgH > availableH) { imgH = availableH; imgW = imgH * ratio; }
          const xImg = (pageWidth - imgW) / 2;
          try {
            pdf.addImage(ev.dataUrl, 'PNG', xImg, yPos, imgW, imgH);
          } catch (e) {
            console.warn('addImage annex failed', e);
          }
          yPos += imgH + 4;
          if (ev.source_file_name) {
            pdf.setFontSize(8);
            pdf.setTextColor(120, 120, 120);
            pdf.text(
              `Origem: ${ev.source_file_name}${ev.page_number ? ` — pág. ${ev.page_number}` : ''}`,
              pageWidth / 2, yPos, { align: 'center' },
            );
          }
        }
      }

      // ── Footers on all pages ──
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        addFooter(i, totalPages);
      }

      pdf.save(pdfFileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const renderContent = () => {
    return bodyContent.split('\n\n').filter(p => p.trim()).map((paragraph, idx) => {
      const trimmed = paragraph.trim();
      if (/^(Av\.\s*Brigadeiro|Tel:\s*\(11\))/.test(trimmed)) return null;
      
      // Metadata block: render each line individually, no justify, no indent
      const metaLines = trimmed.split('\n').filter(l => l.trim());
      const hasMetadata = metaLines.some(l => isMetadataLine(l));
      if (hasMetadata && metaLines.length > 1) {
        return (
          <div key={idx} className="mb-4 text-sm" style={{ color: '#444', lineHeight: '1.6' }}>
            {metaLines.map((ml, mi) => (
              <p key={mi} className="mb-0.5" style={{ textIndent: '0' }}>{ml.trim()}</p>
            ))}
          </div>
        );
      }

      if (isHeadingLine(trimmed)) {
        return (
          <h2 key={idx} className="text-base font-semibold mt-6 mb-3 pb-1" style={{ color: '#1e3a5f', borderBottom: '2px solid #c8af37' }}>
            {trimmed}
          </h2>
        );
      }
      
      // Markdown table
      if (isMarkdownTable(trimmed)) {
        const tbl = parseMarkdownTable(trimmed);
        if (tbl) {
          return (
            <div key={idx} className="my-5 overflow-x-auto">
              <table className="w-full border-collapse text-sm" style={{ border: '1px solid #1e3a5f' }}>
                <thead>
                  <tr style={{ background: '#1e3a5f' }}>
                    {tbl.headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left text-white font-semibold" style={{ borderRight: '1px solid #c8af37' }}>
                        {renderInlineMarkdown(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tbl.rows.map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? '#f7f9fc' : '#fff' }}>
                      {row.map((c, ci) => (
                        <td key={ci} className="px-3 py-2 align-top" style={{ borderTop: '1px solid #d4d8e0', borderRight: '1px solid #eef0f4', color: '#1a1a1a' }}>
                          {renderInlineMarkdown(c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
      }

      const isList = /^[-–•]\s/.test(trimmed);
      if (isList) {
        return <p key={idx} className="mb-3 pl-6" style={{ textIndent: '0' }}>{renderInlineMarkdown(trimmed)}</p>;
      }
      
      // Short lines (e.g. "EXCELENTÍSSIMO...") should not be stretched by justify
      const isShort = trimmed.length < 120;
      // [DOC:N] and [IMG:slug] marker handling — split paragraph and insert <figure>
      const markerRegex = /\[(DOC:(\d{1,3})|IMG:([a-z0-9_\-]+))\]/gi;
      if (markerRegex.test(trimmed)) {
        markerRegex.lastIndex = 0;
        const parts: Array<{ type: 'text' | 'doc' | 'img'; value: string; n?: number; slug?: string }> = [];
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = markerRegex.exec(trimmed)) !== null) {
          if (m.index > last) parts.push({ type: 'text', value: trimmed.slice(last, m.index) });
          if (m[2]) {
            parts.push({ type: 'doc', value: m[0], n: parseInt(m[2], 10) });
          } else if (m[3]) {
            parts.push({ type: 'img', value: m[0], slug: m[3].toLowerCase() });
          }
          last = m.index + m[0].length;
        }
        if (last < trimmed.length) parts.push({ type: 'text', value: trimmed.slice(last) });
        const findEvidenceBySlug = (slug: string) =>
          evidences.find((e) => {
            const cap = (e.caption || '').toLowerCase();
            const src = (e.source_file_name || '').toLowerCase();
            return cap.includes(slug.replace(/_/g, ' ')) || src.includes(slug);
          });
        return (
          <div key={idx} className="mb-4">
            <p className={isShort ? '' : 'text-justify'} style={{ textIndent: '2cm', textAlignLast: 'left' }}>
              {parts.map((p, i) => {
                if (p.type === 'text') return <span key={i}>{renderInlineMarkdown(p.value)}</span>;
                if (p.type === 'doc') return <span key={i} className="font-semibold" style={{ color: '#1e3a5f' }}>(Doc. {String(p.n).padStart(2, '0')})</span>;
                return null; // img markers handled below as figures only
              })}
            </p>
            {parts.filter(p => p.type === 'doc' || p.type === 'img').map((p, i) => {
              const ev = p.type === 'doc' ? evidenceByNum(p.n!) : findEvidenceBySlug(p.slug!);
              if (!ev?.signedUrl) return null;
              const label = p.type === 'doc'
                ? <><strong>Doc. {String(p.n).padStart(2, '0')}</strong> — {ev.caption || ev.source_file_name}</>
                : <>{ev.caption || ev.source_file_name}</>;
              return (
                <figure key={`fig-${i}`} className="my-4 mx-auto text-center">
                  <img
                    src={ev.signedUrl}
                    alt={ev.caption || (p.type === 'doc' ? `Doc. ${p.n}` : p.slug)}
                    className="mx-auto border rounded"
                    style={{ maxWidth: '70%', maxHeight: '340px', objectFit: 'contain' }}
                  />
                  <figcaption className="text-xs mt-2" style={{ color: '#555' }}>
                    {label}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        );
      }
      return (
        <p key={idx} className={`mb-4 ${isShort ? '' : 'text-justify'}`} style={{ textIndent: '2cm', textAlignLast: 'left' }}>
          {renderInlineMarkdown(trimmed)}
        </p>
      );
    }).filter(Boolean);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 justify-end print:hidden">
        {isEditing ? (
          <>
            <Button
              variant="outline"
              onClick={() => { setEditDraft(liveContent); setIsEditing(false); }}
              disabled={isSavingEdit}
              className="gap-2 rounded-xl"
            >
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit} className="gap-2 rounded-xl">
              {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar alterações
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={handlePrint} className="gap-2 rounded-xl">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            <Button
              variant="outline"
              onClick={() => { setEditDraft(liveContent); setIsEditing(true); }}
              className="gap-2 rounded-xl"
            >
              <Pencil className="h-4 w-4" />
              Editar PDF
            </Button>
            <Button onClick={handleDownloadPDF} disabled={isGeneratingPDF} className="gap-2 rounded-xl shadow-lg shadow-primary/15">
          {isGeneratingPDF ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando PDF...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download PDF
            </>
          )}
            </Button>
          </>
        )}
      </div>

      {isEditing && (
        <div className="rounded-xl border bg-card p-4 print:hidden">
          <p className="text-sm text-muted-foreground mb-2">
            Edite o conteúdo abaixo para fazer correções. Marcadores como <code>[IMG:1]</code>, <code>[DOC:1]</code>, <strong>**negrito**</strong> e tabelas em markdown são preservados.
          </p>
          <Textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            className="min-h-[500px] font-mono text-sm leading-relaxed"
            spellCheck
          />
        </div>
      )}

      <div 
        ref={printRef}
        className="bg-white text-gray-900 shadow-2xl mx-auto overflow-hidden rounded-lg"
        style={{ width: '210mm', minHeight: '297mm', fontFamily: "Georgia, serif", fontSize: '12pt', lineHeight: '1.8' }}
      >
        {/* Header */}
        <div className="w-full" style={{ height: '8px', background: 'linear-gradient(90deg, #1e3a5f 0%, #2a5080 50%, #1e3a5f 100%)' }} />
        <div className="w-full" style={{ height: '3px', background: 'linear-gradient(90deg, #c8af37, #d4c050, #c8af37)' }} />

        <div className="px-16 py-10">
          {/* Letterhead */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-5">
              <img 
                src={logoWebmarcas} 
                alt="WebMarcas" 
                className="object-contain"
                style={{ width: '75px', height: '75px' }} 
              />
              <div>
                <h1 className="text-2xl font-bold tracking-wider" style={{ color: '#1e3a5f', letterSpacing: '0.15em' }}>WEBMARCAS INTELLIGENCE PI</h1>
                <p className="text-sm mt-1" style={{ color: '#666' }}>Propriedade Intelectual e Registro de Marcas</p>
              </div>
            </div>
            <div className="text-right text-xs space-y-0.5" style={{ color: '#999' }}>
              <p className="font-medium" style={{ color: '#1e3a5f' }}>CNPJ: 39.528.012/0001-29</p>
              <p>Av. Brigadeiro Luiz Antônio, 2696</p>
              <p>Centro — São Paulo/SP</p>
              <p>juridico@webmarcas.net</p>
            </div>
          </div>

          {/* Double separator */}
          <div className="w-full mb-8">
            <div style={{ height: '2px', background: 'linear-gradient(90deg, #1e3a5f, #2a5080, #1e3a5f)' }} />
            <div style={{ height: '1px', marginTop: '2px', background: 'linear-gradient(90deg, transparent, #c8af37, transparent)' }} />
          </div>

          {/* Document title badge (centered) */}
          <div className="mb-6 text-center">
            <div className="inline-block px-8 py-2 rounded" style={{ background: '#1e3a5f' }}>
              <p className="text-white font-bold tracking-wide text-sm uppercase">
                {isNotif
                  ? 'NOTIFICAÇÃO EXTRAJUDICIAL'
                    : isRespostaNotif
                      ? 'RESPOSTA À NOTIFICAÇÃO EXTRAJUDICIAL'
                  : isProcuradorPetition
                    ? documentTitleUpper
                  : isOposicao
                    ? 'MANIFESTAÇÃO À OPOSIÇÃO'
                  : isExigenciaMerito
                    ? 'CUMPRIMENTO DE EXIGÊNCIA DE MÉRITO'
                    : 'RECURSO ADMINISTRATIVO'}
              </p>
            </div>
            {resource.brand_name && (
              <p className="mt-3 text-base font-semibold" style={{ color: '#1e3a5f' }}>
                Marca: {resource.brand_name}
              </p>
            )}
            {resource.process_number && (
              <p className="mt-1 text-sm" style={{ color: '#555' }}>
                Processo INPI nº {resource.process_number}
              </p>
            )}
          </div>

          {/* Content */}
          <div className="text-justify" style={{ color: '#1a1a1a' }}>
            {renderContent()}
          </div>

          {/* Signature */}
          <div className="mt-16 text-center">
            {!isExtrajudicialDoc && (
              <>
                <p className="mb-4" style={{ color: '#374151' }}>Termos em que,</p>
                <p className="mb-4" style={{ color: '#374151' }}>Pede deferimento.</p>
              </>
            )}
            <p className="mb-8" style={{ color: '#374151' }}>São Paulo, {approvalDate}</p>
            
            <div className="mt-6">
              <div className="flex justify-center mb-2">
                <img 
                  src={signatureImage} 
                  alt="Assinatura" 
                  className="h-16 object-contain opacity-90"
                />
              </div>
              <div className="w-52 mx-auto mb-3" style={{ height: '2px', background: '#1e3a5f' }} />
              <p className="font-semibold text-base" style={{ color: '#1e3a5f' }}>Davilys Danques de Oliveira Cunha</p>
              <p className="text-sm" style={{ color: '#555' }}>Procurador</p>
              {!isExtrajudicialDoc && !isProcuradorPetition && (
                <p className="text-sm" style={{ color: '#777' }}>CPF 393.239.118-79</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 pt-3" style={{ borderTop: '2px solid #1e3a5f' }}>
            <div className="mb-2" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #c8af37, transparent)' }} />
            <div className="flex justify-center gap-6 text-xs flex-wrap" style={{ color: '#888' }}>
              <span>📍 Av. Brigadeiro Luiz Antônio, 2696, Centro — São Paulo/SP</span>
              <span>📞 (11) 9 1112-0225</span>
              <span>✉️ juridico@webmarcas.net</span>
              <span>🌐 www.webmarcas.net</span>
            </div>
          </div>

          {/* ANEXOS DOCUMENTAIS */}
          {annexEvidences.length > 0 && (
            <div className="mt-16">
              <div className="text-center mb-6">
                <div className="inline-block px-8 py-2 rounded" style={{ background: '#1e3a5f' }}>
                  <p className="text-white font-bold tracking-wide text-sm uppercase">
                    Anexos Documentais
                  </p>
                </div>
              </div>
              <div className="space-y-10">
                {annexEvidences.map((ev) => (
                  <div key={ev.id} className="text-center break-inside-avoid page-break-before-always">
                    <p className="text-sm font-semibold mb-2" style={{ color: '#1e3a5f' }}>
                      Doc. {String(ev.docNumber).padStart(2, '0')} — {ev.caption || ev.source_file_name}
                    </p>
                    {ev.signedUrl && (
                      <img
                        src={ev.signedUrl}
                        alt={ev.caption || `Doc. ${ev.docNumber}`}
                        className="mx-auto border rounded shadow"
                        style={{ maxWidth: '90%', maxHeight: '600px', objectFit: 'contain' }}
                      />
                    )}
                    {ev.source_file_name && (
                      <p className="text-xs mt-2" style={{ color: '#777' }}>
                        Origem: {ev.source_file_name}{ev.page_number ? ` — página ${ev.page_number}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
