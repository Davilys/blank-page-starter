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
import html2canvas from 'html2canvas';
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
  // Remove encerramento FINAL (no fim do texto): "Termos em que, ... Pede deferimento. ..." até o fim
  cleaned = cleaned.replace(/\n+\s*Termos em que[,\.\s]*\n?\s*[Pp]ede deferimento[\s\S]*$/i, '');

  // ⚠️ Remove encerramentos PREMATUROS no MEIO do documento.
  // Quando a IA emite "Termos em que, pede deferimento / São Paulo / Procurador / (Doc. 01)..."
  // e depois reabre com uma nova seção (ex.: "V – DA CONFORMIDADE..."), o bloco fica duplicado.
  // Removemos do "Termos em que" / "Nestes termos" até a próxima seção romana ou heading em caixa-alta.
  const midClosingRegex = /\n+\s*(?:Termos em que|Nestes termos)[,\.\s]*\n?\s*[Pp]ede deferimento[\s\S]*?(?=\n\s*(?:[IVX]{1,4}\s*[–—\-]\s*[A-ZÀ-Ý]|[A-ZÀ-Ý][A-ZÀ-Ý\s–—\-]{8,}\n))/gi;
  cleaned = cleaned.replace(midClosingRegex, '\n\n');
  // Defesa adicional: linhas "(Doc. NN) – ..." soltas antes de uma nova seção também são removidas
  cleaned = cleaned.replace(/\n+\s*(?:São Paulo,[^\n]+\n)?\s*(?:_{5,}\s*\n)?\s*(?:Davilys Danques[^\n]*\n)?(?:CPF:[^\n]*\n)?(?:Procurador\(a\)[^\n]*\n)?(?:\(Doc\.\s*\d+\)[^\n]*\n)+(?=\s*[IVX]{1,4}\s*[–—\-]\s*[A-ZÀ-Ý])/gi, '\n\n');
  
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
  // Detect which [DOC:NN] markers actually appear in the AI-generated text.
  // Any evidence NOT cited will be appended inline at the end of the content
  // as a safety fallback — we never render a separate "ANEXOS" section.
  const citedDocNums = new Set<number>();
  {
    const re = /\[DOC:(\d{1,3})\]/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(liveContent)) !== null) {
      citedDocNums.add(parseInt(m[1], 10));
    }
  }
  const uncitedEvidences = evidences.filter((e) => e.docNumber != null && !citedDocNums.has(e.docNumber));

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
    // Same window print — reuses the preview DOM & its @media print styles,
    // guaranteeing that "impressão" is visually identical to "preview".
    document.body.classList.add('printing-inpi-doc');
    window.print();
    // remove flag after print dialog closes
    setTimeout(() => document.body.classList.remove('printing-inpi-doc'), 1000);
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);

    const originalSrcs: Array<{ el: HTMLImageElement; src: string }> = [];
    try {
      const root = printRef.current;
      if (!root) throw new Error('Preview não disponível.');

      // A4 full page — pixel-perfect capture of the preview (210mm wide).
      const A4_W = 210;
      const A4_H = 297;
      const CONTENT_W = A4_W;
      const CONTENT_H = A4_H;
      const NATIVE_WIDTH_PX = 794; // 210mm at 96dpi — matches the preview's native A4 width

      // 1) Embed logo + signature as base64 to avoid html2canvas losing them.
      let logoDataUrl: string | null = null;
      let sigDataUrl: string | null = null;
      try {
        const [logoData, sigData] = await Promise.all([
          imageToBase64(logoWebmarcas).catch(() => null),
          imageToBase64(signatureImage).catch(() => null),
        ]);
        logoDataUrl = logoData;
        sigDataUrl = sigData;
        const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
        for (const el of imgs) {
          const src = el.getAttribute('src') || '';
          if (logoData && src === logoWebmarcas) {
            originalSrcs.push({ el, src });
            el.src = logoData;
          } else if (sigData && src === signatureImage) {
            originalSrcs.push({ el, src });
            el.src = sigData;
          }
        }
      } catch { /* keep originals */ }

      // 2) Wait until every image in the preview is fully decoded.
      const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
      await Promise.all(
        imgs.map(async (img) => {
          if (img.complete && img.naturalWidth > 0) {
            try { await (img as any).decode?.(); } catch { /* ignore */ }
            return;
          }
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
          try { await (img as any).decode?.(); } catch { /* ignore */ }
        }),
      );

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // 3) Single-shot render at the preview's native width (=210mm ~ 794px).
      const captureWidth = NATIVE_WIDTH_PX;
      const captureHeight = root.scrollHeight;
      const canvas = await html2canvas(root, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        width: captureWidth,
        height: captureHeight,
        windowWidth: captureWidth,
        windowHeight: captureHeight,
        scrollX: 0,
        scrollY: -window.scrollY,
        onclone: (clonedDoc) => {
          // Re-apply base64 images inside the clone (the clone may still hold original srcs)
          const cloneImgs = Array.from(clonedDoc.querySelectorAll('img')) as HTMLImageElement[];
          for (const el of cloneImgs) {
            const src = el.getAttribute('src') || '';
            if (logoDataUrl && (src === logoWebmarcas || src.includes('webmarcas-logo'))) {
              el.src = logoDataUrl;
            } else if (sigDataUrl && src === signatureImage) {
              el.src = sigDataUrl;
            }
          }
          // html2canvas fails to render a block-level <p> inside an inline-block
          // container (badge boxes come out empty). Rebuild each badge as an
          // inline-block <span> carrying the box styles + text directly.
          const cloneWin = clonedDoc.defaultView || window;
          const badgePs = Array.from(clonedDoc.querySelectorAll('.print-target p')) as HTMLElement[];
          for (const p of badgePs) {
            const parent = p.parentElement;
            if (!parent) continue;
            const parentStyle = cloneWin.getComputedStyle(parent);
            if (parentStyle.display !== 'inline-block') continue;
            const pStyle = cloneWin.getComputedStyle(p);
            const span = clonedDoc.createElement('span');
            span.textContent = (p.textContent || '').trim().toUpperCase();
            span.style.display = 'inline-block';
            span.style.background = parentStyle.backgroundColor || '#1e3a5f';
            span.style.borderRadius = parentStyle.borderRadius;
            span.style.padding = `${parentStyle.paddingTop} ${parentStyle.paddingRight} ${parentStyle.paddingBottom} ${parentStyle.paddingLeft}`;
            span.style.color = pStyle.color || '#ffffff';
            span.style.fontFamily = pStyle.fontFamily;
            span.style.fontSize = pStyle.fontSize;
            span.style.fontWeight = pStyle.fontWeight || '700';
            span.style.letterSpacing = pStyle.letterSpacing;
            span.style.lineHeight = pStyle.lineHeight;
            parent.replaceWith(span);
          }
        },
      });

      const pxWidth = canvas.width;
      const pxHeight = canvas.height;
      const pxPerMM = pxWidth / CONTENT_W;

      // Reserve room at the bottom of every page for the footer bar.
      const FOOTER_H_MM = 17;
      const usablePagePx = Math.floor((A4_H - FOOTER_H_MM) * pxPerMM);

      // Collect safe break boundaries (tops of block elements) so pages never
      // cut through a line of text. Coordinates are mapped into canvas pixels.
      const rootRect = root.getBoundingClientRect();
      const domToCanvas = pxHeight / root.scrollHeight;
      const boundarySet = new Set<number>();
      const blockEls = Array.from(
        root.querySelectorAll('[data-pdf-section], .legal-p, .legal-p-short, .legal-list, .legal-heading, .legal-table-wrap, .legal-figure, figure, h1, h2, h3, img'),
      ) as HTMLElement[];
      for (const el of blockEls) {
        const top = el.getBoundingClientRect().top - rootRect.top;
        if (top > 0) boundarySet.add(Math.floor(top * domToCanvas));
      }
      const boundaries = Array.from(boundarySet).sort((a, b) => a - b);

      // First pass: compute cut points snapped to element boundaries.
      const cuts: Array<{ start: number; height: number }> = [];
      let offsetPx = 0;
      while (offsetPx < pxHeight) {
        const target = offsetPx + usablePagePx;
        let end = Math.min(target, pxHeight);
        if (target < pxHeight) {
          // Snap to the last element boundary within the page (but keep at
          // least 40% of the page filled to avoid degenerate tiny pages).
          const minEnd = offsetPx + Math.floor(usablePagePx * 0.4);
          for (let i = boundaries.length - 1; i >= 0; i--) {
            const b = boundaries[i];
            if (b <= target && b > minEnd) { end = b - 2; break; }
            if (b <= minEnd) break;
          }
        }
        cuts.push({ start: offsetPx, height: end - offsetPx });
        offsetPx = end;
      }

      const totalPages = cuts.length;
      const drawFooter = (pageNum: number) => {
        const lineY = A4_H - FOOTER_H_MM + 3;
        pdf.setDrawColor(30, 58, 95);
        pdf.setLineWidth(0.7);
        pdf.line(15, lineY, A4_W - 15, lineY);
        pdf.setDrawColor(200, 175, 55);
        pdf.setLineWidth(0.25);
        pdf.line(15, lineY + 1, A4_W - 15, lineY + 1);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(110, 110, 110);
        pdf.text('Av. Brigadeiro Luiz Antônio, 2696, Centro — São Paulo/SP — CEP 01402-000', A4_W / 2, lineY + 5.2, { align: 'center' });
        pdf.text('Tel: (11) 9 1112-0225  |  juridico@webmarcas.net  |  www.webmarcas.net', A4_W / 2, lineY + 8.8, { align: 'center' });
        pdf.setTextColor(90, 90, 90);
        pdf.text(`${pageNum}/${totalPages}`, A4_W - 15, lineY + 5.2, { align: 'right' });
      };

      // Second pass: render each page slice + footer.
      cuts.forEach((cut, pageIndex) => {
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = pxWidth;
        sliceCanvas.height = cut.height;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pxWidth, cut.height);
          ctx.drawImage(canvas, 0, cut.start, pxWidth, cut.height, 0, 0, pxWidth, cut.height);
        }
        const sliceHeightMM = (cut.height * CONTENT_W) / pxWidth;
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, CONTENT_W, sliceHeightMM);
        drawFooter(pageIndex + 1);
      });

      pdf.save(pdfFileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Erro ao gerar PDF',
        description: (error as Error)?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      // Restore original <img> src values
      for (const { el, src } of originalSrcs) {
        try { el.src = src; } catch { /* ignore */ }
      }
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
          <div key={idx} data-pdf-section className="legal-meta mb-4 text-sm" style={{ color: '#444', lineHeight: '1.6' }}>
            {metaLines.map((ml, mi) => (
              <p key={mi} className="mb-0.5" style={{ textIndent: '0' }}>{ml.trim()}</p>
            ))}
          </div>
        );
      }

      if (isHeadingLine(trimmed)) {
        return (
          <h2 key={idx} data-pdf-section className="legal-heading text-base font-semibold mt-6 mb-3 pb-1" style={{ color: '#1e3a5f', borderBottom: '2px solid #c8af37' }}>
            {trimmed}
          </h2>
        );
      }
      
      // Markdown table
      if (isMarkdownTable(trimmed)) {
        const tbl = parseMarkdownTable(trimmed);
        if (tbl) {
          return (
            <div key={idx} data-pdf-section className="legal-table-wrap my-5">
              <table className="legal-table w-full text-sm" style={{ border: '1px solid #1e3a5f', tableLayout: 'auto', borderCollapse: 'collapse' }}>
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

      // Tolerant bullet detection: accepts -, –, —, •, *, ·, optional indent,
      // and any whitespace (including non-breaking space) after the marker.
      const BULLET_RE = /^\s{0,4}[-–—•*·][\s\u00a0\t]+/;
      if (BULLET_RE.test(trimmed)) {
        // Normalize the leading marker to "- " so renderInlineMarkdown never
        // sees a weird non-breaking space that could disable wrapping.
        const normalized = trimmed.replace(BULLET_RE, '- ');
        return (
          <p key={idx} data-pdf-section className="legal-list mb-3">
            {renderInlineMarkdown(normalized)}
          </p>
        );
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
          <div key={idx} data-pdf-section className="mb-4">
            <p className={`legal-p ${isShort ? 'legal-p-short' : ''}`}>
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
        <p key={idx} data-pdf-section className={`legal-p ${isShort ? 'legal-p-short' : ''}`}>
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
        className="legal-body bg-white text-gray-900 shadow-2xl mx-auto overflow-hidden rounded-lg print-target"
        style={{ width: '210mm', minHeight: '297mm', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '11.5pt', lineHeight: '1.7' }}
      >
        <style>{`
          .legal-body { color: #1a1a1a; }
          .legal-body .legal-p {
            text-align: left;
            hyphens: none;
            -webkit-hyphens: none;
            -ms-hyphens: none;
            overflow-wrap: break-word;
            word-break: normal;
            text-indent: 0;
            margin: 0 0 0.55em 0;
            orphans: 3;
            widows: 3;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .legal-body .legal-p-short {
            text-align: left;
            text-indent: 0;
          }
          .legal-body .legal-list {
            text-align: left !important;
            text-justify: auto !important;
            letter-spacing: normal !important;
            word-spacing: normal !important;
            hyphens: none;
            -webkit-hyphens: none;
            overflow-wrap: break-word;
            word-break: normal;
            padding-left: 1.5em;
            text-indent: -1.1em;
            margin: 0 0 0.4em 0;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .legal-body .legal-heading {
            page-break-after: avoid;
            break-after: avoid;
          }
          .legal-body .legal-table-wrap { page-break-inside: avoid; break-inside: avoid; }
          .legal-body .legal-table { width: 100%; border-collapse: collapse; }
          .legal-body .legal-table th,
          .legal-body .legal-table td {
            word-wrap: break-word;
            overflow-wrap: break-word;
            vertical-align: top;
          }
          @media print {
            @page { size: A4; margin: 18mm 15mm 20mm 15mm; }
            body > *:not(.printing-inpi-doc-wrapper) { visibility: hidden; }
            .print-target, .print-target * { visibility: visible; }
            .print-target { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border-radius: 0 !important; }
            .print\\:hidden { display: none !important; }
          }
          body.printing-inpi-doc > *:not(.print-target-holder) { display: none !important; }
        `}</style>

        {/* Header */}
        <div data-pdf-section>
          <div className="w-full" style={{ height: '8px', background: 'linear-gradient(90deg, #1e3a5f 0%, #2a5080 50%, #1e3a5f 100%)' }} />
          <div className="w-full" style={{ height: '3px', background: 'linear-gradient(90deg, #c8af37, #d4c050, #c8af37)' }} />
        </div>

        <div className="px-16 py-10">
          {/* Letterhead */}
          <div data-pdf-section className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-5">
              <img 
                src={logoWebmarcas} 
                alt="WebMarcas" 
                className="object-contain"
                style={{ width: '75px', height: '75px' }} 
              />
              <div>
                <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>WEBMARCAS INTELLIGENCE PI</h1>
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
          <div data-pdf-section className="w-full mb-8">
            <div style={{ height: '2px', background: 'linear-gradient(90deg, #1e3a5f, #2a5080, #1e3a5f)' }} />
            <div style={{ height: '1px', marginTop: '2px', background: 'linear-gradient(90deg, transparent, #c8af37, transparent)' }} />
          </div>

          {/* Document title badge (centered) */}
          <div data-pdf-section className="mb-6 text-center">
            <div className="inline-block px-8 py-2 rounded" style={{ background: '#1e3a5f' }}>
              <p data-pdf-badge className="font-bold tracking-wide text-sm uppercase" style={{ color: '#ffffff' }}>
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
          <div style={{ color: '#1a1a1a' }}>
            {renderContent()}
            {uncitedEvidences.length > 0 && (
              <div data-pdf-section className="mt-6">
                <p className="legal-p" style={{ fontStyle: 'italic', color: '#374151' }}>
                  Para complementação probatória, seguem, ainda, os seguintes documentos comprobatórios anexos:
                </p>
                {uncitedEvidences.map((ev) => (
                  <figure key={ev.id} data-pdf-section className="my-4 mx-auto text-center legal-figure" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    {ev.signedUrl && (
                      <img
                        src={ev.signedUrl}
                        alt={ev.caption || `Doc. ${ev.docNumber}`}
                        className="mx-auto border rounded"
                        style={{ maxWidth: '70%', maxHeight: '340px', objectFit: 'contain' }}
                      />
                    )}
                    <figcaption className="text-xs mt-2" style={{ color: '#555' }}>
                      <strong>Doc. {String(ev.docNumber).padStart(2, '0')}</strong> — {ev.caption || ev.source_file_name}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>

          {/* Signature */}
          <div data-pdf-section className="mt-16 text-center">
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
          <div data-pdf-section className="mt-16 pt-3" style={{ borderTop: '2px solid #1e3a5f' }}>
            <div className="mb-2" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #c8af37, transparent)' }} />
            <div className="flex justify-center gap-6 text-xs flex-wrap" style={{ color: '#888' }}>
              <span>📍 Av. Brigadeiro Luiz Antônio, 2696, Centro — São Paulo/SP</span>
              <span>📞 (11) 9 1112-0225</span>
              <span>✉️ juridico@webmarcas.net</span>
              <span>🌐 www.webmarcas.net</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
