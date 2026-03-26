import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SettingsCard } from './SettingsCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ImportDropzone } from '@/components/admin/clients/ImportDropzone';
import { 
  Upload, Loader2, AlertTriangle, CheckCircle2, FileJson, FileSpreadsheet 
} from 'lucide-react';

type ImportTarget = 'leads' | 'clients' | 'contracts' | 'auto';

interface ImportResult {
  total: number;
  imported: number;
  failed: number;
  errors: string[];
}

export function BackupImportSection() {
  const [importing, setImporting] = useState(false);
  const [target, setTarget] = useState<ImportTarget>('auto');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    setResult(null);

    try {
      const text = await file.text();
      const ext = file.name.split('.').pop()?.toLowerCase();

      let parsed: Record<string, unknown>[] = [];

      if (ext === 'json') {
        const json = JSON.parse(text);
        parsed = Array.isArray(json) ? json : [json];
      } else if (ext === 'csv') {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) {
          toast.error('Arquivo CSV vazio ou sem dados');
          return;
        }
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        parsed = lines.slice(1).map(line => {
          const values = line.match(/(".*?"|[^,]+)/g) || [];
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => {
            let val = (values[i] || '').trim().replace(/^"|"$/g, '');
            obj[h] = val === '' ? null : val;
          });
          return obj;
        });
      } else {
        toast.error('Formato não suportado. Use JSON ou CSV.');
        return;
      }

      setPreview(parsed.slice(0, 5));

      // Auto-detect target
      if (target === 'auto' && parsed.length > 0) {
        const keys = Object.keys(parsed[0]);
        if (keys.includes('_type')) {
          // Mixed export - keep auto
        } else if (keys.includes('brand_name') || keys.includes('phone') || keys.includes('source')) {
          setTarget('leads');
        } else if (keys.includes('full_name') || keys.includes('cpf') || keys.includes('cnpj')) {
          setTarget('clients');
        } else if (keys.includes('contract_html') || keys.includes('signature_status') || keys.includes('contract_type')) {
          setTarget('contracts');
        }
      }
    } catch (err) {
      toast.error('Erro ao ler arquivo');
    }
  }, [target]);

  const importData = async () => {
    if (!selectedFile) return;
    setImporting(true);
    setResult(null);

    try {
      const text = await selectedFile.text();
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();

      let records: Record<string, unknown>[] = [];

      if (ext === 'json') {
        const json = JSON.parse(text);
        records = Array.isArray(json) ? json : [json];
      } else if (ext === 'csv') {
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        records = lines.slice(1).map(line => {
          const values = line.match(/(".*?"|[^,]+)/g) || [];
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => {
            let val = (values[i] || '').trim().replace(/^"|"$/g, '');
            obj[h] = val === '' ? null : val;
          });
          return obj;
        });
      }

      let imported = 0;
      let failed = 0;
      const errors: string[] = [];

      // Group by type if mixed export
      const grouped: Record<string, Record<string, unknown>[]> = {};

      for (const record of records) {
        const recordType = (record._type as string) || target;
        // Remove internal fields
        const clean = { ...record };
        delete clean._type;
        delete clean.id; // Let DB generate new IDs

        if (!grouped[recordType]) grouped[recordType] = [];
        grouped[recordType].push(clean);
      }

      for (const [type, items] of Object.entries(grouped)) {
        let tableName: string;
        switch (type) {
          case 'lead':
          case 'leads':
            tableName = 'leads';
            break;
          case 'client':
          case 'clients':
            tableName = 'profiles';
            break;
          case 'contract':
          case 'contracts':
            tableName = 'contracts';
            break;
          default:
            errors.push(`Tipo desconhecido: ${type}`);
            failed += items.length;
            continue;
        }

        // Insert in batches of 50
        for (let i = 0; i < items.length; i += 50) {
          const batch = items.slice(i, i + 50);
          const { error } = await (supabase as any)
            .from(tableName)
            .upsert(batch, { onConflict: 'id', ignoreDuplicates: true });

          if (error) {
            errors.push(`Erro em ${tableName} (lote ${Math.floor(i/50)+1}): ${error.message}`);
            failed += batch.length;
          } else {
            imported += batch.length;
          }
        }
      }

      // Log import
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('import_logs').insert({
        import_type: target === 'auto' ? 'backup_restore' : `backup_${target}`,
        file_name: selectedFile.name,
        total_records: records.length,
        imported_records: imported,
        failed_records: failed,
        errors: errors.length > 0 ? errors : null,
        imported_by: userData?.user?.id || null,
      });

      setResult({ total: records.length, imported, failed, errors });

      if (failed === 0) {
        toast.success(`${imported} registros importados com sucesso!`);
      } else {
        toast.warning(`${imported} importados, ${failed} falharam`);
      }
    } catch (err: any) {
      toast.error(`Erro na importação: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <SettingsCard
      icon={Upload}
      iconColor="text-emerald-500"
      title="Importar / Restaurar Backup"
      description="Restaure dados a partir de um arquivo JSON ou CSV exportado"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1.5 block">Destino da importação</label>
            <Select value={target} onValueChange={(v) => setTarget(v as ImportTarget)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  <span className="flex items-center gap-2">Auto-detectar</span>
                </SelectItem>
                <SelectItem value="leads">Leads</SelectItem>
                <SelectItem value="clients">Clientes (Profiles)</SelectItem>
                <SelectItem value="contracts">Contratos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ImportDropzone
          onFileSelect={handleFileSelect}
          isLoading={importing}
          accept=".json,.csv"
        />

        {preview && preview.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Pré-visualização ({preview.length} de {selectedFile ? '...' : 0} registros)
              </span>
              <Badge variant="outline" className="text-xs">
                {selectedFile?.name.endsWith('.json') ? (
                  <><FileJson className="h-3 w-3 mr-1" /> JSON</>
                ) : (
                  <><FileSpreadsheet className="h-3 w-3 mr-1" /> CSV</>
                )}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground max-h-32 overflow-auto">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(preview[0], null, 2).slice(0, 500)}
              </pre>
            </div>
          </div>
        )}

        {result && (
          <Alert variant={result.failed > 0 ? 'destructive' : 'default'} className={result.failed === 0 ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20' : ''}>
            <AlertDescription className="space-y-1">
              <div className="flex items-center gap-2">
                {result.failed === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <span className="font-medium">
                  {result.imported} de {result.total} registros importados
                  {result.failed > 0 && ` (${result.failed} falhas)`}
                </span>
              </div>
              {result.errors.length > 0 && (
                <ul className="text-xs mt-1 space-y-0.5 ml-6">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-3">
          <Button
            onClick={importData}
            disabled={!selectedFile || importing}
            className="flex-1"
          >
            {importing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" /> Importar Dados</>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          ⚠️ Registros com IDs existentes serão ignorados. Novos registros receberão IDs automáticos.
        </p>
      </div>
    </SettingsCard>
  );
}
