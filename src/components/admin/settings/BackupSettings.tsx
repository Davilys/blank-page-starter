import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { SettingsCard } from './SettingsCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  HardDrive, Download, FileJson, FileSpreadsheet, History, 
  Loader2, CheckCircle2, AlertCircle, Database, FileCode2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BackupImportSection } from './BackupImportSection';
import { ALL_BACKUP_TABLES, fetchAllFromTable } from '@/lib/backupTables';

export function BackupSettings() {
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0, tableName: '' });

  const { data: importLogs, isLoading } = useQuery({
    queryKey: ['import-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const exportSingleTable = async (tableName: string, typeLabel: string, fmt: 'json' | 'csv') => {
    const key = `${tableName}-${fmt}`;
    setExporting(key);
    try {
      const rawData = await fetchAllFromTable(supabase, tableName);
      if (rawData.length === 0) {
        toast.error('Nenhum dado para exportar');
        return;
      }
<<<<<<< HEAD
      const data = rawData.map(r => ({ ...r, _type: tableName }));
      downloadData(data, `webmarcas_${tableName}_${Date.now()}`, fmt);
=======
      const dataWithType = data.map(r => ({ ...r, _type: tableName }));
      downloadData(dataWithType, `webmarcas_${tableName}_${Date.now()}`, fmt);
>>>>>>> 7ac15ff7900ed90e0b657575adeb1da7ceeca162
      toast.success(`${data.length} registros de ${typeLabel} exportados!`);
    } catch {
      toast.error('Erro ao exportar dados');
    } finally {
      setExporting(null);
    }
  };

  const exportAll = async (fmt: 'json' | 'csv') => {
    setExporting(`all-${fmt}`);
    const tables = ALL_BACKUP_TABLES;
    const allData: Record<string, unknown>[] = [];
    let totalRecords = 0;

    try {
      for (let i = 0; i < tables.length; i++) {
        const t = tables[i];
        setExportProgress({ current: i + 1, total: tables.length, tableName: t.label });

        try {
          const rows = await fetchAllFromTable(supabase, t.name);
          if (rows.length > 0) {
            rows.forEach(r => allData.push({ ...r, _type: t.name }));
            totalRecords += rows.length;
          }
        } catch {
          console.warn(`Skipping table ${t.name}`);
        }
      }

      if (allData.length === 0) {
        toast.error('Nenhum dado para exportar');
        return;
      }

      downloadData(allData, `webmarcas_backup_completo_${Date.now()}`, fmt);
      toast.success(`Backup completo: ${totalRecords} registros de ${tables.length} tabelas exportados!`);
    } catch {
      toast.error('Erro ao exportar dados');
    } finally {
      setExporting(null);
      setExportProgress({ current: 0, total: 0, tableName: '' });
    }
  };

  const downloadData = (data: Record<string, unknown>[], filename: string, fmt: 'json' | 'csv') => {
    let content: string;
    let mimeType: string;
    let extension: string;

    if (fmt === 'json') {
      content = JSON.stringify(data, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    } else {
      const headers = Object.keys(data[0]);
      const csvRows = [headers.join(',')];
      data.forEach(row => {
        const values = headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
      });
      content = '\ufeff' + csvRows.join('\n');
      mimeType = 'text/csv;charset=utf-8;';
      extension = 'csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSQL = async () => {
    setExporting('sql');
    const tables = ALL_BACKUP_TABLES;
    const sqlLines: string[] = [];
    let totalRecords = 0;

    sqlLines.push('-- WebMarcas SQL Dump');
    sqlLines.push(`-- Gerado em: ${new Date().toISOString()}`);
    sqlLines.push('-- Formato: INSERT statements para migração');
    sqlLines.push('BEGIN;');
    sqlLines.push('');

    try {
      for (let i = 0; i < tables.length; i++) {
        const t = tables[i];
        setExportProgress({ current: i + 1, total: tables.length, tableName: t.label });

        try {
          const rows = await fetchAllFromTable(supabase, t.name);
          if (rows.length === 0) continue;

          sqlLines.push(`-- Tabela: ${t.name} (${rows.length} registros)`);

          const columns = Object.keys(rows[0]);
          const colList = columns.map(c => `"${c}"`).join(', ');

          for (const row of rows) {
            const values = columns.map(col => {
              const val = row[col];
              if (val === null || val === undefined) return 'NULL';
              if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
              if (typeof val === 'number') return String(val);
              if (typeof val === 'object') {
                return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
              }
              return `'${String(val).replace(/'/g, "''")}'`;
            });
            sqlLines.push(`INSERT INTO public."${t.name}" (${colList}) VALUES (${values.join(', ')}) ON CONFLICT (id) DO NOTHING;`);
          }
          sqlLines.push('');
          totalRecords += rows.length;
        } catch {
          sqlLines.push(`-- ERRO ao exportar tabela: ${t.name} (pulada)`);
        }
      }

      sqlLines.push('COMMIT;');

      const content = sqlLines.join('\n');
      const blob = new Blob([content], { type: 'application/sql' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `webmarcas_dump_${Date.now()}.sql`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`SQL exportado: ${totalRecords} registros de ${tables.length} tabelas!`);
    } catch {
      toast.error('Erro ao gerar SQL');
    } finally {
      setExporting(null);
      setExportProgress({ current: 0, total: 0, tableName: '' });
    }
  };

  const isExporting = exporting !== null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Export Data */}
      <SettingsCard
        icon={Download}
        iconColor="text-blue-500"
        title="Exportar Dados"
        description="Faça backup completo de todas as tabelas do sistema (~60 tabelas com paginação)"
      >
        <div className="space-y-4">
          {/* Progress bar during full export */}
          {exporting?.startsWith('all-') && exportProgress.total > 0 && (
            <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-500 animate-pulse" />
                  <span className="font-medium">Exportando: {exportProgress.tableName}</span>
                </span>
                <span className="text-muted-foreground">
                  {exportProgress.current} de {exportProgress.total} tabelas
                </span>
              </div>
              <Progress value={(exportProgress.current / exportProgress.total) * 100} className="h-2" />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
              <div className="flex items-center gap-2">
                <FileJson className="h-5 w-5 text-orange-500" />
                <span className="font-medium">Formato JSON</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Ideal para backup completo e restauração
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => exportSingleTable('leads', 'Leads', 'json')} disabled={isExporting}>
                  {exporting === 'leads-json' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Leads
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportSingleTable('profiles', 'Clientes', 'json')} disabled={isExporting}>
                  {exporting === 'profiles-json' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Clientes
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportSingleTable('contracts', 'Contratos', 'json')} disabled={isExporting}>
                  {exporting === 'contracts-json' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Contratos
                </Button>
                <Button size="sm" onClick={() => exportAll('json')} disabled={isExporting}>
                  {exporting === 'all-json' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  <Database className="h-3 w-3 mr-1" /> Tudo ({ALL_BACKUP_TABLES.length} tabelas)
                </Button>
              </div>
            </div>

            <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-500" />
                <span className="font-medium">Formato CSV</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Para uso em Excel ou Google Sheets
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => exportSingleTable('leads', 'Leads', 'csv')} disabled={isExporting}>
                  {exporting === 'leads-csv' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Leads
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportSingleTable('profiles', 'Clientes', 'csv')} disabled={isExporting}>
                  {exporting === 'profiles-csv' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Clientes
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportSingleTable('contracts', 'Contratos', 'csv')} disabled={isExporting}>
                  {exporting === 'contracts-csv' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Contratos
                </Button>
                <Button size="sm" onClick={() => exportAll('csv')} disabled={isExporting}>
                  {exporting === 'all-csv' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  <Database className="h-3 w-3 mr-1" /> Tudo ({ALL_BACKUP_TABLES.length} tabelas)
                </Button>
              </div>
            </div>

          {/* SQL Export */}
          <div className="p-4 rounded-xl border bg-muted/30 space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-violet-500" />
              <span className="font-medium">Formato SQL (Migração)</span>
              <Badge variant="outline" className="text-xs">Completo</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Gera INSERT statements para todas as tabelas — ideal para migrar dados entre projetos Supabase
            </p>
            <Button size="sm" onClick={exportSQL} disabled={isExporting}>
              {exporting === 'sql' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              <Database className="h-3 w-3 mr-1" /> Exportar SQL ({ALL_BACKUP_TABLES.length} tabelas)
            </Button>
          </div>
        </div>
        </div>
      </SettingsCard>

      {/* Import / Restore */}
      <BackupImportSection />

      {/* Import History */}
      <SettingsCard
        icon={History}
        iconColor="text-violet-500"
        title="Histórico de Importações"
        description="Últimas importações realizadas no sistema"
      >
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : importLogs && importLogs.length > 0 ? (
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Registros</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.import_type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">
                      {log.file_name || '-'}
                    </TableCell>
                    <TableCell>
                      <span className="text-green-600">{log.imported_records || 0}</span>
                      {log.failed_records ? (
                        <span className="text-destructive ml-1">/ {log.failed_records} falhas</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {log.failed_records === 0 || !log.failed_records ? (
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Sucesso
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Parcial
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma importação registrada</p>
          </div>
        )}
      </SettingsCard>
    </motion.div>
  );
}
