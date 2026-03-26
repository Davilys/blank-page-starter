import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  cpf_cnpj: string | null;
  status: string;
  origin: string | null;
  estimated_value: number | null;
  notes: string | null;
  created_at: string;
}

interface LeadImportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
  onImportComplete: () => void;
}

export function LeadImportExportDialog({ 
  open, 
  onOpenChange, 
  leads,
  onImportComplete 
}: LeadImportExportDialogProps) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const extension = file.name.split('.').pop()?.toLowerCase();

    const filterValidRows = (data: any[]) => {
      return data.filter((row) => {
        const name = row.Nome || row.full_name || row.nome || row['Nome Completo'];
        const email = row['E-mail'] || row.Email || row.email;
        return name && String(name).trim().length >= 2 && name !== 'Leads' && name !== '#' && name !== 'Nome';
      });
    };

    if (extension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const valid = filterValidRows(results.data);
          setImportData(valid);
          toast.success(`${valid.length} registros encontrados`);
        },
        error: () => toast.error('Erro ao ler arquivo CSV'),
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Try to detect the header row by looking for known column names
        // Some Excel files have merged header rows that need to be skipped
        let jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        // Check if first row has expected column names
        if (jsonData.length > 0) {
          const firstRowKeys = Object.keys(jsonData[0]);
          const hasValidHeaders = firstRowKeys.some(k => 
            ['Nome', 'E-mail', 'Email', 'Telefone', 'Marca', 'nome', 'email', 'phone', 'full_name'].includes(k)
          );
          
          if (!hasValidHeaders) {
            // Try skipping first row (merged header like "Leads")
            jsonData = XLSX.utils.sheet_to_json(firstSheet, { range: 1 });
            
            // Still no valid headers? Try range 2
            if (jsonData.length > 0) {
              const keys2 = Object.keys(jsonData[0]);
              const hasValid2 = keys2.some(k => 
                ['Nome', 'E-mail', 'Email', 'Telefone', 'Marca', 'nome', 'email', 'phone', 'full_name'].includes(k)
              );
              if (!hasValid2) {
                jsonData = XLSX.utils.sheet_to_json(firstSheet, { range: 2 });
              }
            }
          }
        }
        
        // Filter out __EMPTY keys and rows without valid data
        jsonData = jsonData.map((row: any) => {
          const cleaned: any = {};
          for (const [key, value] of Object.entries(row)) {
            if (!key.startsWith('__EMPTY') && key !== '#') {
              cleaned[key] = value;
            }
          }
          return cleaned;
        });
        
        const valid = filterValidRows(jsonData);
        setImportData(valid);
        toast.success(`${valid.length} registros encontrados`);
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error('Formato não suportado. Use CSV ou Excel.');
    }
  }, []);

  const detectColumns = (data: any[]) => {
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  };

  const getFieldValue = (row: any, ...keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        return String(row[key]).trim();
      }
    }
    return null;
  };

  const handleImport = async () => {
    if (importData.length === 0) {
      toast.error('Nenhum dado para importar');
      return;
    }

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Process in batches of 50
      const BATCH = 50;
      for (let i = 0; i < importData.length; i += BATCH) {
        const batch = importData.slice(i, i + BATCH);
        const rows = batch.map((row) => ({
          full_name: getFieldValue(row, 'Nome', 'full_name', 'nome', 'Nome Completo') || 'Lead Importado',
          email: getFieldValue(row, 'E-mail', 'Email', 'email', 'e-mail'),
          phone: getFieldValue(row, 'Telefone', 'phone', 'telefone', 'celular', 'Celular'),
          company_name: getFieldValue(row, 'Marca', 'Empresa', 'company_name', 'empresa', 'marca'),
          cpf_cnpj: getFieldValue(row, 'CPF/CNPJ', 'cpf_cnpj', 'cpf', 'cnpj', 'CPF', 'CNPJ'),
          status: getFieldValue(row, 'Status', 'status')?.toLowerCase() || 'novo',
          origin: getFieldValue(row, 'Fonte', 'Origem', 'origin', 'fonte') || 'import',
          estimated_value: parseFloat(getFieldValue(row, 'Valor do lead', 'estimated_value', 'valor', 'Valor') || '') || null,
          notes: getFieldValue(row, 'notes', 'observacoes', 'Observações'),
          tags: getFieldValue(row, 'Tags', 'tags') ? [getFieldValue(row, 'Tags', 'tags')!] : [],
        }));

        const { error, count } = await supabase.from('leads').insert(rows);
        if (error) {
          errorCount += batch.length;
          console.error('Batch import error:', error);
        } else {
          successCount += batch.length;
        }
      }

      toast.success(`Importação concluída: ${successCount} leads importados, ${errorCount} erros`);
      onImportComplete();
      setImportData([]);
      setFileName('');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro durante a importação');
    } finally {
      setImporting(false);
    }
  };

  const exportToCSV = () => {
    setExporting(true);
    try {
      const exportData = leads.map(lead => ({
        Nome: lead.full_name,
        Email: lead.email || '',
        Telefone: lead.phone || '',
        Empresa: lead.company_name || '',
        'CPF/CNPJ': lead.cpf_cnpj || '',
        Status: lead.status,
        Origem: lead.origin || '',
        'Valor Estimado': lead.estimated_value || '',
        Observações: lead.notes || '',
        'Criado em': new Date(lead.created_at).toLocaleDateString('pt-BR'),
      }));

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Leads exportados com sucesso');
    } catch (error) {
      toast.error('Erro ao exportar');
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = () => {
    setExporting(true);
    try {
      const exportData = leads.map(lead => ({
        Nome: lead.full_name,
        Email: lead.email || '',
        Telefone: lead.phone || '',
        Empresa: lead.company_name || '',
        'CPF/CNPJ': lead.cpf_cnpj || '',
        Status: lead.status,
        Origem: lead.origin || '',
        'Valor Estimado': lead.estimated_value || '',
        Observações: lead.notes || '',
        'Criado em': new Date(lead.created_at).toLocaleDateString('pt-BR'),
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
      XLSX.writeFile(workbook, `leads_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Leads exportados com sucesso');
    } catch (error) {
      toast.error('Erro ao exportar');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar / Exportar Leads</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </TabsTrigger>
            <TabsTrigger value="export">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Clique para selecionar ou arraste um arquivo
                </p>
                <p className="text-xs text-muted-foreground">
                  Suporta CSV, XLSX e XLS
                </p>
              </label>
            </div>

            {fileName && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="font-medium">{fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {importData.length} registros prontos para importar
                </p>
                {importData.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Colunas detectadas:</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(importData[0]).map((col) => (
                        <span key={col} className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {importData.length > 0 && (
                  <div className="mt-2 text-xs border rounded-lg overflow-auto max-h-40">
                    <table className="w-full text-left">
                      <thead className="bg-muted/50">
                        <tr>
                          {['Nome', 'E-mail', 'Telefone', 'Marca'].map((h) => (
                            <th key={h} className="px-2 py-1 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importData.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-2 py-1">{row.Nome || row.full_name || row.nome || '-'}</td>
                            <td className="px-2 py-1">{row['E-mail'] || row.Email || row.email || '-'}</td>
                            <td className="px-2 py-1">{row.Telefone || row.phone || row.telefone || '-'}</td>
                            <td className="px-2 py-1">{row.Marca || row.Empresa || row.empresa || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm">
              <p className="font-medium mb-2">Mapeamento automático de colunas:</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span>Nome → Nome, full_name</span>
                <span>E-mail → E-mail, Email</span>
                <span>Telefone → Telefone, phone</span>
                <span>Marca/Empresa → Marca, Empresa</span>
                <span>Valor → Valor do lead, valor</span>
                <span>Tags → Tags</span>
              </div>
            </div>

            <Button 
              onClick={handleImport} 
              disabled={importData.length === 0 || importing}
              className="w-full"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar {importData.length} Leads
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-medium">{leads.length} leads disponíveis para exportar</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={exportToCSV} 
                variant="outline" 
                disabled={exporting || leads.length === 0}
                className="h-24 flex-col gap-2"
              >
                <FileText className="h-8 w-8" />
                <span>Exportar CSV</span>
              </Button>
              <Button 
                onClick={exportToExcel} 
                variant="outline" 
                disabled={exporting || leads.length === 0}
                className="h-24 flex-col gap-2"
              >
                <FileSpreadsheet className="h-8 w-8" />
                <span>Exportar Excel</span>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
