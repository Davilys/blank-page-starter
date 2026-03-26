import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface ExportableClient {
  id: string;
  full_name?: string | null;
  email: string;
  phone?: string | null;
  company_name?: string | null;
  cpf_cnpj?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  origin?: string | null;
  priority?: string | null;
  contract_value?: number | null;
  created_at?: string | null;
}

export type ExportFormat = 'csv' | 'xlsx' | 'xml' | 'pdf';

interface ExportOptions {
  clients: ExportableClient[];
  format: ExportFormat;
  filename?: string;
  includeLogo?: boolean;
}

// Column configuration for exports
const EXPORT_COLUMNS = [
  { key: 'full_name', label: 'Nome Completo' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefone' },
  { key: 'company_name', label: 'Empresa' },
  { key: 'cpf_cnpj', label: 'CPF/CNPJ' },
  { key: 'address', label: 'Endereço' },
  { key: 'city', label: 'Cidade' },
  { key: 'state', label: 'Estado' },
  { key: 'zip_code', label: 'CEP' },
  { key: 'origin', label: 'Origem' },
  { key: 'priority', label: 'Prioridade' },
  { key: 'contract_value', label: 'Valor do Contrato' },
  { key: 'created_at', label: 'Data de Cadastro' },
];

/**
 * Prepare data for export (normalize values)
 */
function prepareData(clients: ExportableClient[]): Record<string, string | number>[] {
  return clients.map(client => {
    const row: Record<string, string | number> = {};
    const clientRecord = client as unknown as Record<string, unknown>;
    
    EXPORT_COLUMNS.forEach(col => {
      let value = clientRecord[col.key];
      
      if (col.key === 'contract_value' && value) {
        row[col.label] = `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      } else if (col.key === 'created_at' && value) {
        row[col.label] = new Date(value as string).toLocaleDateString('pt-BR');
      } else if (col.key === 'priority' && value) {
        const priorities: Record<string, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };
        row[col.label] = priorities[value as string] || String(value);
      } else if (col.key === 'origin' && value) {
        const origins: Record<string, string> = { site: 'Site', whatsapp: 'WhatsApp' };
        row[col.label] = origins[value as string] || String(value);
      } else {
        row[col.label] = value ? String(value) : '';
      }
    });
    
    return row;
  });
}

/**
 * Export to CSV
 */
export function exportToCSV(clients: ExportableClient[], filename: string = 'clientes'): void {
  const data = prepareData(clients);
  const csv = Papa.unparse(data, {
    quotes: true,
    delimiter: ';', // Brazilian Excel default
  });
  
  // Add BOM for UTF-8 encoding in Excel
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Export to Excel (XLSX)
 */
export function exportToExcel(clients: ExportableClient[], filename: string = 'clientes'): void {
  const data = prepareData(clients);
  
  // Create workbook and worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  
  // Set column widths
  const colWidths = EXPORT_COLUMNS.map(col => ({ wch: Math.max(col.label.length, 15) }));
  ws['!cols'] = colWidths;
  
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  
  // Generate and download
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export to XML (Perfex CRM compatible)
 */
export function exportToXML(clients: ExportableClient[], filename: string = 'clientes'): void {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<clients>\n';
  
  clients.forEach(client => {
    xml += '  <client>\n';
    
    // Use snake_case keys for compatibility
    xml += `    <id>${escapeXML(client.id)}</id>\n`;
    xml += `    <full_name>${escapeXML(client.full_name || '')}</full_name>\n`;
    xml += `    <email>${escapeXML(client.email)}</email>\n`;
    xml += `    <phone>${escapeXML(client.phone || '')}</phone>\n`;
    xml += `    <company_name>${escapeXML(client.company_name || '')}</company_name>\n`;
    xml += `    <cpf_cnpj>${escapeXML(client.cpf_cnpj || '')}</cpf_cnpj>\n`;
    xml += `    <address>${escapeXML(client.address || '')}</address>\n`;
    xml += `    <city>${escapeXML(client.city || '')}</city>\n`;
    xml += `    <state>${escapeXML(client.state || '')}</state>\n`;
    xml += `    <zip_code>${escapeXML(client.zip_code || '')}</zip_code>\n`;
    xml += `    <origin>${escapeXML(client.origin || '')}</origin>\n`;
    xml += `    <priority>${escapeXML(client.priority || '')}</priority>\n`;
    xml += `    <contract_value>${client.contract_value || 0}</contract_value>\n`;
    xml += `    <created_at>${client.created_at || ''}</created_at>\n`;
    
    xml += '  </client>\n';
  });
  
  xml += '</clients>';
  
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
  downloadBlob(blob, `${filename}.xml`);
}

/**
 * Export to PDF
 */
export function exportToPDF(clients: ExportableClient[], filename: string = 'clientes'): void {
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for more columns
  
  // Title
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text('Relatório de Clientes', 14, 22);
  
  // Subtitle with date
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Exportado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);
  doc.text(`Total de registros: ${clients.length}`, 14, 36);
  
  // Prepare table data (limited columns for PDF)
  const pdfColumns = [
    'Nome Completo',
    'E-mail',
    'Telefone',
    'Empresa',
    'Cidade',
    'Estado',
    'Valor',
  ];
  
  const pdfData = clients.map(client => [
    client.full_name || '',
    client.email,
    client.phone || '',
    client.company_name || '',
    client.city || '',
    client.state || '',
    client.contract_value 
      ? `R$ ${client.contract_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : '',
  ]);
  
  // Add table using autoTable
  (doc as unknown as { autoTable: Function }).autoTable({
    head: [pdfColumns],
    body: pdfData,
    startY: 42,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  doc.save(`${filename}.pdf`);
}

/**
 * Main export function
 */
export function exportClients(options: ExportOptions): void {
  const { clients, format, filename = 'clientes' } = options;
  
  switch (format) {
    case 'csv':
      exportToCSV(clients, filename);
      break;
    case 'xlsx':
      exportToExcel(clients, filename);
      break;
    case 'xml':
      exportToXML(clients, filename);
      break;
    case 'pdf':
      exportToPDF(clients, filename);
      break;
  }
}

// Utility functions
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
