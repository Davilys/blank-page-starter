import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { SettingsCard } from './SettingsCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  HardDrive, Download, FileJson, FileSpreadsheet, History, 
  Trash2, Loader2, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BackupImportSection } from './BackupImportSection';

export function BackupSettings() {
  const [exporting, setExporting] = useState<string | null>(null);

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

  const exportData = async (type: 'leads' | 'clients' | 'contracts' | 'all', format: 'json' | 'csv') => {
    setExporting(`${type}-${format}`);
    try {
      let data: Record<string, unknown>[] = [];
      
      if (type === 'leads' || type === 'all') {
        const { data: leads } = await supabase.from('leads').select('*');
        if (type === 'leads') data = leads || [];
        else if (type === 'all' && leads) data.push(...leads.map(l => ({ ...l, _type: 'lead' })));
      }
      
      if (type === 'clients' || type === 'all') {
        const { data: profiles } = await supabase.from('profiles').select('*');
        if (type === 'clients') data = profiles || [];
        else if (type === 'all' && profiles) data.push(...profiles.map(p => ({ ...p, _type: 'client' })));
      }
      
      if (type === 'contracts' || type === 'all') {
        const { data: contracts } = await supabase.from('contracts').select('*');
        if (type === 'contracts') data = contracts || [];
        else if (type === 'all' && contracts) data.push(...contracts.map(c => ({ ...c, _type: 'contract' })));
      }

      let content: string;
      let mimeType: string;
      let extension: string;

      if (format === 'json') {
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
        extension = 'json';
      } else {
        // CSV
        if (data.length === 0) {
          toast.error('Nenhum dado para exportar');
          return;
        }
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
        content = csvRows.join('\n');
        mimeType = 'text/csv';
        extension = 'csv';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `webmarcas_${type}_${format}_${Date.now()}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Dados exportados com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar dados');
    } finally {
      setExporting(null);
    }
  };

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
        description="Faça backup dos dados do sistema"
      >
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
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => exportData('leads', 'json')}
                disabled={exporting !== null}
              >
                {exporting === 'leads-json' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Leads
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => exportData('clients', 'json')}
                disabled={exporting !== null}
              >
                {exporting === 'clients-json' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Clientes
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => exportData('contracts', 'json')}
                disabled={exporting !== null}
              >
                {exporting === 'contracts-json' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Contratos
              </Button>
              <Button 
                size="sm" 
                onClick={() => exportData('all', 'json')}
                disabled={exporting !== null}
              >
                {exporting === 'all-json' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Tudo
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
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => exportData('leads', 'csv')}
                disabled={exporting !== null}
              >
                {exporting === 'leads-csv' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Leads
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => exportData('clients', 'csv')}
                disabled={exporting !== null}
              >
                {exporting === 'clients-csv' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Clientes
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => exportData('contracts', 'csv')}
                disabled={exporting !== null}
              >
                {exporting === 'contracts-csv' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Contratos
              </Button>
              <Button 
                size="sm" 
                onClick={() => exportData('all', 'csv')}
                disabled={exporting !== null}
              >
                {exporting === 'all-csv' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Tudo
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
