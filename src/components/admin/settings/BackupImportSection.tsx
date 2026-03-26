import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SettingsCard } from './SettingsCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ImportDropzone } from '@/components/admin/clients/ImportDropzone';
import { 
  Upload, Loader2, AlertTriangle, CheckCircle2, FileJson, FileSpreadsheet, Database
} from 'lucide-react';
import { ALL_BACKUP_TABLES, TYPE_TO_TABLE } from '@/lib/backupTables';

type ImportTarget = 'auto' | string; // 'auto' or any table name

interface ImportResult {
  total: number;
  imported: number;
  failed: number;
  errors: string[];
}

// Group tables by category for the select
const groupedTables = ALL_BACKUP_TABLES.reduce((acc, t) => {
  if (!acc[t.category]) acc[t.category] = [];
  acc[t.category].push(t);
  return acc;
}, {} as Record<string, typeof ALL_BACKUP_TABLES>);

export function BackupImportSection() {
  const [importing, setImporting] = useState(false);
  const [target, setTarget] = useState<ImportTarget>('auto');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, tableName: '' });

  const parseFile = async (file: File): Promise<Record<string, unknown>[]> => {
    const text = await file.text();
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'json') {
      const json = JSON.parse(text);
      if (Array.isArray(json)) {
        return json;
      }
      // Handle grouped format: { "leads": [...], "profiles": [...], ... }
      // or { "data": { "leads": [...] }, ... } or { "tables": { ... } }
      const source = json.data ?? json.tables ?? json;
      if (typeof source === 'object' && source !== null) {
        const keys = Object.keys(source);
        const hasArrayValues = keys.some(k => Array.isArray(source[k]));
        if (hasArrayValues) {
          return keys.flatMap(tableName => {
            const rows = source[tableName];
            if (!Array.isArray(rows)) return [];
            return rows.map((r: any) => ({ ...r, _type: r._type ?? tableName }));
          });
        }
      }
      // Single object fallback
      return [json];
    } else if (ext === 'csv') {
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV vazio');
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      return lines.slice(1).map(line => {
        const values = line.match(/(".*?"|[^,]+)/g) || [];
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          let val = (values[i] || '').trim().replace(/^"|"$/g, '');
          obj[h] = val === '' ? null : val;
        });
        return obj;
      });
    }
    throw new Error('Formato não suportado. Use JSON ou CSV.');
  };

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    setResult(null);

    try {
      const parsed = await parseFile(file);
      setPreview(parsed.slice(0, 5));

      // Auto-detect target
      if (target === 'auto' && parsed.length > 0) {
        const first = parsed[0];
        if (first._type && typeof first._type === 'string') {
          // Mixed backup file - keep auto
        } else {
          const keys = Object.keys(first);
          if (keys.includes('brand_name') && keys.includes('phone') && keys.includes('source')) {
            setTarget('leads');
          } else if (keys.includes('full_name') && (keys.includes('cpf') || keys.includes('cnpj'))) {
            setTarget('profiles');
          } else if (keys.includes('contract_html') || keys.includes('signature_status')) {
            setTarget('contracts');
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao ler arquivo');
    }
  }, [target]);

  const importData = async () => {
    if (!selectedFile) return;
    setImporting(true);
    setResult(null);

    try {
      const records = await parseFile(selectedFile);
      let imported = 0;
      let failed = 0;
      const errors: string[] = [];

      // Group records by destination table
      const grouped: Record<string, Record<string, unknown>[]> = {};

      for (const record of records) {
        let tableName: string;

        if (target !== 'auto') {
          // Direct target selected
          tableName = target;
        } else if (record._type && typeof record._type === 'string') {
          // Mixed backup with _type field
          const resolved = TYPE_TO_TABLE[record._type as string];
          if (!resolved) {
            errors.push(`Tipo desconhecido: ${record._type}`);
            failed++;
            continue;
          }
          tableName = resolved;
        } else {
          errors.push('Registro sem _type e sem destino selecionado');
          failed++;
          continue;
        }

        const clean = { ...record };
        delete clean._type;

        if (!grouped[tableName]) grouped[tableName] = [];
        grouped[tableName].push(clean);
      }

      const tableNames = Object.keys(grouped);
      let tableIndex = 0;

      for (const [tableName, items] of Object.entries(grouped)) {
        tableIndex++;
        const tableInfo = ALL_BACKUP_TABLES.find(t => t.name === tableName);
        setImportProgress({
          current: tableIndex,
          total: tableNames.length,
          tableName: tableInfo?.label || tableName,
        });

        // Insert in batches of 50
        for (let i = 0; i < items.length; i += 50) {
          const batch = items.slice(i, i + 50);
          // Try upsert with id if records have id, otherwise plain insert
          const hasIds = batch.every(r => r.id);
          let error: any;
          if (hasIds) {
            const res = await (supabase as any)
              .from(tableName)
              .upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
            error = res.error;
          } else {
            // Remove id fields and do plain insert
            const cleanBatch = batch.map(r => { const { id, ...rest } = r as any; return rest; });
            const res = await (supabase as any)
              .from(tableName)
              .insert(cleanBatch);
            error = res.error;
          }

          if (error) {
            errors.push(`Erro em ${tableInfo?.label || tableName} (lote ${Math.floor(i / 50) + 1}): ${error.message}`);
            failed += batch.length;
          } else {
            imported += batch.length;
          }
        }
      }

      // Log import
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('import_logs').insert({
        import_type: target === 'auto' ? 'backup_restore_completo' : `backup_${target}`,
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
      setImportProgress({ current: 0, total: 0, tableName: '' });
    }
  };

  return (
    <SettingsCard
      icon={Upload}
      iconColor="text-emerald-500"
      title="Importar / Restaurar Backup"
      description="Restaure dados a partir de um arquivo JSON ou CSV exportado (suporta todas as tabelas)"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1.5 block">Destino da importação</label>
            <Select value={target} onValueChange={(v) => setTarget(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o destino" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="auto">
                  <span className="flex items-center gap-2">
                    <Database className="h-3 w-3" /> Auto-detectar (via campo _type)
                  </span>
                </SelectItem>
                {Object.entries(groupedTables).map(([category, tables]) => (
                  <SelectGroup key={category}>
                    <SelectLabel className="text-xs font-semibold text-muted-foreground">{category}</SelectLabel>
                    {tables.map(t => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ImportDropzone
          onFileSelect={handleFileSelect}
          isLoading={importing}
          accept=".json,.csv"
        />

        {/* Import progress */}
        {importing && importProgress.total > 0 && (
          <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-500 animate-pulse" />
                <span className="font-medium">Importando: {importProgress.tableName}</span>
              </span>
              <span className="text-muted-foreground">
                {importProgress.current} de {importProgress.total} tabelas
              </span>
            </div>
            <Progress value={(importProgress.current / importProgress.total) * 100} className="h-2" />
          </div>
        )}

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
                  {result.errors.length > 5 && (
                    <li className="text-muted-foreground">... e mais {result.errors.length - 5} erros</li>
                  )}
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
          Suporta backup completo com campo <code>_type</code> para distribuição automática entre tabelas.
        </p>
      </div>
    </SettingsCard>
  );
}
