import React, { useState, useCallback } from 'react';
import { 
  Upload, Download, FileSpreadsheet, FileText, FileCode, File, 
  Loader2, ChevronRight, ChevronLeft, Check 
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

import { ImportDropzone } from './ImportDropzone';
import { FieldMappingStep } from './FieldMappingStep';
import { ImportPreviewTable } from './ImportPreviewTable';

import { 
  parseFile, 
  suggestFieldMapping, 
  applyFieldMapping, 
  validateClients,
  type ParseResult,
  type FieldMapping,
  type ParsedClient,
  SYSTEM_FIELDS
} from '@/lib/clientParser';

import { 
  exportClients, 
  type ExportableClient, 
  type ExportFormat 
} from '@/lib/clientExporter';

interface ClientImportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ExportableClient[];
  onImportComplete: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview';

export function ClientImportExportDialog({
  open,
  onOpenChange,
  clients,
  onImportComplete,
}: ClientImportExportDialogProps) {
  // Import state
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [mappedClients, setMappedClients] = useState<ParsedClient[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [existingEmails, setExistingEmails] = useState<string[]>([]);
  const [existingCpfs, setExistingCpfs] = useState<string[]>([]);
  const [existingCnpjs, setExistingCnpjs] = useState<string[]>([]);
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  // Export state
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  // Reset import state
  const resetImport = useCallback(() => {
    setImportStep('upload');
    setParseResult(null);
    setFieldMapping({});
    setMappedClients([]);
    setSelectedRows([]);
    setIsParsing(false);
  }, []);

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    setIsParsing(true);
    try {
      const result = await parseFile(file);
      setParseResult(result);
      
      // Auto-suggest field mappings
      const suggested = suggestFieldMapping(result.headers);
      setFieldMapping(suggested);
      
      // Fetch existing identifiers for duplicate detection
      const { data: profiles } = await supabase
        .from('profiles')
        .select('email, cpf, cnpj, full_name');
      
      setExistingEmails(profiles?.filter(p => p.email).map(p => p.email.toLowerCase()) || []);
      setExistingCpfs(profiles?.filter(p => p.cpf).map(p => p.cpf) || []);
      setExistingCnpjs(profiles?.filter(p => p.cnpj).map(p => p.cnpj) || []);
      setExistingNames(profiles?.filter(p => p.full_name).map(p => p.full_name.toLowerCase().trim()) || []);
      
      // Move to mapping step
      setImportStep('mapping');
      
      if (result.errors.length > 0) {
        toast.warning(`Arquivo processado com ${result.errors.length} avisos`);
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'PDF_REQUIRES_SERVER') {
        toast.error('Processamento de PDF requer IA. Esta funcionalidade será implementada em breve.');
      } else {
        toast.error(error instanceof Error ? error.message : 'Erro ao processar arquivo');
      }
    } finally {
      setIsParsing(false);
    }
  };

  // Recalculate selected rows — always include duplicates (they'll be updated)
  const recalculateSelection = useCallback((mapped: ParsedClient[]) => {
    const errors = validateClients(mapped);
    const validRows = mapped
      .map((_, index) => index)
      .filter((index) => {
        const rowErrors = errors.filter(e => e.rowIndex === index);
        return rowErrors.length === 0;
      });
    setSelectedRows(validRows);
  }, []);

  // Handle mapping confirmation
  const handleMappingConfirm = () => {
    if (!parseResult) return;
    
    // Check required fields
    const mappedFields = Object.values(fieldMapping).filter(Boolean);
    const requiredFields = SYSTEM_FIELDS.filter(f => f.required);
    const missingRequired = requiredFields.filter(f => !mappedFields.includes(f.key));
    
    if (missingRequired.length > 0) {
      toast.error(`Campos obrigatórios não mapeados: ${missingRequired.map(f => f.label).join(', ')}`);
      return;
    }
    
    // Apply mapping and validate
    const mapped = applyFieldMapping(parseResult.data, fieldMapping);
    setMappedClients(mapped);
    recalculateSelection(mapped);
    setImportStep('preview');
  };

  // ── Background import runner ─────────────────────────────────────────────
  const runImportInBackground = async (
    clientsToImport: ParsedClient[],
    totalSelected: number,
    updateExistingFlag: boolean,
  ) => {
    const CHUNK_SIZE = 50;
    const chunks: ParsedClient[][] = [];
    for (let i = 0; i < clientsToImport.length; i += CHUNK_SIZE) {
      chunks.push(clientsToImport.slice(i, i + CHUNK_SIZE));
    }

    let totalImported = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const allErrorDetails: string[] = [];

    for (let idx = 0; idx < chunks.length; idx++) {
      try {
        const { data, error } = await supabase.functions.invoke('import-clients', {
          body: { clients: chunks[idx] },
        });

        if (error) {
          console.error(`Chunk ${idx + 1} error:`, error);
          totalErrors += chunks[idx].length;
          allErrorDetails.push(`Lote ${idx + 1}: ${error.message || 'Erro desconhecido'}`);
          continue;
        }

        const { imported = 0, updated = 0, skipped = 0, errors = 0, errorDetails = [] } = data ?? {};
        totalImported += imported;
        totalUpdated += updated;
        totalSkipped += skipped;
        totalErrors += errors;
        if (errorDetails.length > 0) allErrorDetails.push(...errorDetails);
      } catch (err) {
        console.error(`Chunk ${idx + 1} exception:`, err);
        totalErrors += chunks[idx].length;
      }
    }

    if (allErrorDetails.length > 0) {
      console.warn('Import warnings:', allErrorDetails);
    }

    // ── Completion notification ───────────────────────────────────────────
    const lines: string[] = [];
    if (totalImported > 0) lines.push(`✅ ${totalImported} importado(s)`);
    if (totalUpdated > 0) lines.push(`🔄 ${totalUpdated} atualizado(s)`);
    if (totalSkipped > 0) lines.push(`⏭️ ${totalSkipped} ignorado(s)`);
    if (totalErrors > 0) lines.push(`❌ ${totalErrors} erro(s)`);

    const summary = lines.join(' · ') || 'Nenhuma alteração';

    if (totalErrors > 0 && totalImported === 0 && totalUpdated === 0) {
      toast.error('Importação concluída com erros', {
        description: summary,
        duration: 8000,
      });
    } else {
      toast.success('Importação concluída!', {
        description: summary,
        duration: 8000,
      });
    }

    onImportComplete();
  };

  // Handle import — fires in background, dialog closes immediately
  const handleImport = () => {
    if (selectedRows.length === 0) {
      toast.error('Selecione pelo menos um registro para importar');
      return;
    }

    // ── 1. Get selected clients ────────────────────────────────────────────
    const allSelected = selectedRows.map(i => mappedClients[i]);

    // ── 2. Deduplicate by email within the file ────────────────────────────
    const seenEmails = new Set<string>();
    const deduped = allSelected.filter(c => {
      const email = (c.email || '').toLowerCase().trim();
      if (!email || seenEmails.has(email)) return false;
      seenEmails.add(email);
      return true;
    });

    // ── 3. Pre-process: address concatenation + CPF/CNPJ split ─────────────
    const clientsToImport = deduped.map(c => {
      const processed: Record<string, unknown> = { ...c };

      // Concatenate address parts
      const parts = [c.address, c.address_number, c.address_complement].filter(Boolean);
      if (parts.length > 0) {
        processed.address = parts.join(', ');
      }

      // Auto-detect CPF vs CNPJ
      if (c.cpf_cnpj) {
        const digits = c.cpf_cnpj.replace(/\D/g, '');
        if (digits.length === 11) {
          processed.cpf = digits;
        } else if (digits.length === 14) {
          processed.cnpj = digits;
        }
        processed.cpf_cnpj = c.cpf_cnpj;
      }

      // Pass neighborhood directly
      if (c.neighborhood) {
        processed.neighborhood = c.neighborhood;
      }

      // Remove intermediate fields not needed by edge function
      delete processed.address_number;
      delete processed.address_complement;
      delete processed._raw;
      delete processed._rowIndex;

      return processed as ParsedClient;
    });

    const dedupedCount = allSelected.length - clientsToImport.length;

    // ── 4. Close dialog and start background job ───────────────────────────
    onOpenChange(false);
    resetImport();

    const descLines = [`${clientsToImport.length} cliente(s) sendo processado(s)`];
    if (dedupedCount > 0) descLines.push(`${dedupedCount} duplicado(s) removido(s) do arquivo`);

    toast.info('Importação iniciada em segundo plano', {
      description: descLines.join(' · '),
      duration: 5000,
    });

    // Fire-and-forget — result arrives as a new notification
    runImportInBackground(clientsToImport, allSelected.length, true);
  };

  // Handle export
  const handleExport = () => {
    setIsExporting(true);
    try {
      const filename = `clientes_${new Date().toISOString().split('T')[0]}`;
      exportClients({ clients, format: exportFormat, filename });
      toast.success(`Arquivo ${exportFormat.toUpperCase()} exportado com sucesso`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar clientes');
    } finally {
      setIsExporting(false);
    }
  };
  // Reprocess selection when preview changes
  React.useEffect(() => {
    if (importStep !== 'preview' || mappedClients.length === 0) return;
    recalculateSelection(mappedClients);
  }, [importStep, mappedClients, recalculateSelection]);

  const validationErrors = mappedClients.length > 0 ? validateClients(mappedClients) : [];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetImport();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar / Exportar Clientes</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="import" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Importar
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="import" className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto py-4">
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {(['upload', 'mapping', 'preview'] as ImportStep[]).map((step, index) => (
                  <React.Fragment key={step}>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                      importStep === step 
                        ? 'bg-primary text-primary-foreground' 
                        : index < ['upload', 'mapping', 'preview'].indexOf(importStep)
                          ? 'bg-green-100 text-green-700'
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {index < ['upload', 'mapping', 'preview'].indexOf(importStep) ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                      <span>
                        {step === 'upload' && 'Arquivo'}
                        {step === 'mapping' && 'Mapeamento'}
                        {step === 'preview' && 'Preview'}
                      </span>
                    </div>
                    {index < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </React.Fragment>
                ))}
              </div>

              {/* Step content */}
              {importStep === 'upload' && (
                <ImportDropzone 
                  onFileSelect={handleFileSelect} 
                  isLoading={isParsing}
                />
              )}

              {importStep === 'mapping' && parseResult && (
                <FieldMappingStep
                  headers={parseResult.headers}
                  mapping={fieldMapping}
                  onMappingChange={setFieldMapping}
                  sampleData={parseResult.data[0]?._raw}
                />
              )}

              {importStep === 'preview' && (
                <div className="space-y-4">
                  <h3 className="font-medium">Revisar dados</h3>
                  
                  <ImportPreviewTable
                    clients={mappedClients}
                    validationErrors={validationErrors}
                    selectedRows={selectedRows}
                    onSelectionChange={setSelectedRows}
                    existingEmails={existingEmails}
                    existingCpfs={existingCpfs}
                    existingCnpjs={existingCnpjs}
                    existingNames={existingNames}
                  />
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  if (importStep === 'mapping') setImportStep('upload');
                  if (importStep === 'preview') setImportStep('mapping');
                }}
                disabled={importStep === 'upload'}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>

              {importStep === 'mapping' && (
                <Button onClick={handleMappingConfirm}>
                  Continuar
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}

              {importStep === 'preview' && (
                <Button 
                  onClick={handleImport}
                  disabled={selectedRows.length === 0}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Importar {selectedRows.length} cliente(s) em segundo plano
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="flex-1 py-4">
            <div className="space-y-6">
              <div className="text-center text-muted-foreground mb-6">
                Exportar <strong>{clients.length}</strong> clientes
              </div>

              <RadioGroup
                value={exportFormat}
                onValueChange={(v) => setExportFormat(v as ExportFormat)}
                className="grid grid-cols-2 gap-4"
              >
                <Label
                  htmlFor="csv"
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    exportFormat === 'csv' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="csv" id="csv" />
                  <FileText className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-medium">CSV</p>
                    <p className="text-xs text-muted-foreground">Compatível com Excel, Google Sheets</p>
                  </div>
                </Label>

                <Label
                  htmlFor="xlsx"
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    exportFormat === 'xlsx' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="xlsx" id="xlsx" />
                  <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                  <div>
                    <p className="font-medium">Excel (XLSX)</p>
                    <p className="text-xs text-muted-foreground">Formatação nativa do Excel</p>
                  </div>
                </Label>

                <Label
                  htmlFor="xml"
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    exportFormat === 'xml' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="xml" id="xml" />
                  <FileCode className="h-6 w-6 text-orange-600" />
                  <div>
                    <p className="font-medium">XML</p>
                    <p className="text-xs text-muted-foreground">Compatível com Perfex CRM</p>
                  </div>
                </Label>

                <Label
                  htmlFor="pdf"
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    exportFormat === 'pdf' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="pdf" id="pdf" />
                  <File className="h-6 w-6 text-red-600" />
                  <div>
                    <p className="font-medium">PDF</p>
                    <p className="text-xs text-muted-foreground">Relatório para impressão</p>
                  </div>
                </Label>
              </RadioGroup>

              <Button 
                onClick={handleExport} 
                className="w-full" 
                size="lg"
                disabled={isExporting || clients.length === 0}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar como {exportFormat.toUpperCase()}
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
