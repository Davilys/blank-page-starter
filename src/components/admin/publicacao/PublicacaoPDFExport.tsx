import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  '003': '003',
  oposicao: 'Oposição',
  exigencia_merito: 'Exigência de Mérito',
  indeferimento: 'Indeferimento',
  deferimento: 'Deferimento',
  certificado: 'Certificado',
  renovacao: 'Renovação',
  arquivado: 'Arquivado',
};

interface ExportData {
  cliente: string;
  marca: string;
  processo: string;
  responsavel: string;
  status: string;
  dataDeposito: string;
  dataPubRpi: string;
  prazoOposicao: string;
  proximoPrazo: string;
}

export function exportPublicacaoPDF(
  data: ExportData[],
  filters: { status?: string; cliente?: string; prazo?: string }
) {
  if (data.length === 0) {
    toast.error('Nenhum dado para exportar');
    return;
  }

  const doc = new jsPDF({ orientation: 'landscape' });
  const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  // Header
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.text('Relatório de Publicações de Marcas', 14, 20);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em: ${now}`, 14, 28);

  // Active filters
  const activeFilters: string[] = [];
  if (filters.status && filters.status !== 'todos') activeFilters.push(`Status: ${STATUS_LABELS[filters.status] || filters.status}`);
  if (filters.cliente && filters.cliente !== 'todos') activeFilters.push(`Cliente filtrado`);
  if (filters.prazo && filters.prazo !== 'todos') activeFilters.push(`Prazo: ${filters.prazo}`);
  if (activeFilters.length > 0) {
    doc.text(`Filtros: ${activeFilters.join(' | ')}`, 14, 34);
  }

  doc.text(`Total de registros: ${data.length}`, 14, activeFilters.length > 0 ? 40 : 34);

  // Table
  autoTable(doc, {
    startY: activeFilters.length > 0 ? 45 : 39,
    head: [['Cliente', 'Marca', 'Processo', 'Responsável', 'Status', 'Depósito', 'Pub. RPI', 'Prazo Op.', 'Próx. Prazo']],
    body: data.map(row => [
      row.cliente,
      row.marca,
      row.processo,
      row.responsavel,
      STATUS_LABELS[row.status] || row.status,
      row.dataDeposito,
      row.dataPubRpi,
      row.prazoOposicao,
      row.proximoPrazo,
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 7, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Webmarcas - Relatório de Publicações | Página ${i} de ${pageCount}`, 14, doc.internal.pageSize.height - 10);
  }

  doc.save(`relatorio_publicacoes_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  toast.success('PDF exportado com sucesso');
}
