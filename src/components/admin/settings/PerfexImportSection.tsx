import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SettingsCard } from './SettingsCard';
import { toast } from 'sonner';
import { Loader2, Users, FileText, FolderArchive, AlertTriangle, ShieldCheck, DatabaseBackup, Upload, FileArchive } from 'lucide-react';

type Phase = 'customers' | 'contracts' | 'files';

interface PhaseState {
  running: boolean;
  done: boolean;
  total: number;
  processed: number;
  imported: number;
  skipped: number;
  errors: number;
  notFound?: number;
  missingClient?: number;
  errorDetails: string[];
}

const initialState: PhaseState = {
  running: false, done: false, total: 0, processed: 0,
  imported: 0, skipped: 0, errors: 0, errorDetails: [],
};

const PHASE_CONFIG = {
  customers: { fn: 'import-perfex-customers', limit: 30, label: 'Clientes', icon: Users },
  contracts: { fn: 'import-perfex-contracts', limit: 25, label: 'Contratos Assinados', icon: FileText },
  files:     { fn: 'import-perfex-files',     limit: 10, label: 'Arquivos do Servidor Antigo', icon: FolderArchive },
} as const;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export function PerfexImportSection() {
  const [isMaster, setIsMaster] = useState(false);
  const [checking, setChecking] = useState(true);
  const [state, setState] = useState<Record<Phase, PhaseState>>({
    customers: { ...initialState },
    contracts: { ...initialState },
    files: { ...initialState },
  });
  const [errorModal, setErrorModal] = useState<{ phase: Phase; details: string[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parseStats, setParseStats] = useState<{ customers: number; contracts: number; files: number } | null>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  const handleDirectDownload = async () => {
    setParseStats(null);
    setParsing(true);
    try {
      const res = await supabase.functions.invoke('parse-perfex-dump', { body: {} });
      if (res.error) throw new Error(res.error.message);
      if ((res.data as any)?.error) throw new Error((res.data as any).error);
      setParseStats(res.data.stats);
      setUploadedFile('crm.webmarcas.net/u973561543_perfexcrm.sql');
      toast.success(`Dump processado: ${res.data.stats.customers} clientes, ${res.data.stats.contracts} contratos, ${res.data.stats.files} arquivos`);
    } catch (e) {
      toast.error(`Falha: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setParsing(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!file) return;
    const okExt = /\.(zip|sql|sql\.gz|gz)$/i.test(file.name);
    if (!okExt) { toast.error('Use .zip, .sql ou .sql.gz'); return; }

    setUploading(true);
    setUploadProgress(0);
    setParseStats(null);
    try {
      const path = `uploads/${Date.now()}-${file.name}`;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload ${xhr.status}: ${xhr.responseText}`));
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/perfex-import/${path}`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.send(file);
      });

      setUploadedFile(path);
      toast.success('Upload concluído. Processando dump...');

      setUploading(false);
      setParsing(true);
      const res = await supabase.functions.invoke('parse-perfex-dump', {
        body: { storagePath: path },
      });
      if (res.error) throw new Error(res.error.message);
      setParseStats(res.data.stats);
      toast.success(`Dump processado: ${res.data.stats.customers} clientes, ${res.data.stats.contracts} contratos, ${res.data.stats.files} arquivos`);
    } catch (e) {
      toast.error(`Falha: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsMaster(data.user?.email === 'davillys@gmail.com');
      setChecking(false);
    });
  }, []);

  const runPhase = async (phase: Phase) => {
    const cfg = PHASE_CONFIG[phase];
    setState(s => ({ ...s, [phase]: { ...initialState, running: true } }));

    let offset = 0;
    let total = 0;
    let aggImported = 0, aggSkipped = 0, aggErrors = 0, aggNotFound = 0, aggMissing = 0;
    const aggErrorDetails: string[] = [];

    try {
      while (true) {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const url = `${SUPABASE_URL}/functions/v1/${cfg.fn}?offset=${offset}&limit=${cfg.limit}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Erro desconhecido');

        total = body.total;
        aggImported += body.imported;
        aggSkipped += body.skipped;
        aggErrors += body.errors;
        aggNotFound += body.notFound || 0;
        aggMissing += body.missingClient || 0;
        if (body.errorDetails?.length) aggErrorDetails.push(...body.errorDetails);

        setState(s => ({
          ...s,
          [phase]: {
            running: !body.done,
            done: body.done,
            total,
            processed: body.processed,
            imported: aggImported,
            skipped: aggSkipped,
            errors: aggErrors,
            notFound: aggNotFound,
            missingClient: aggMissing,
            errorDetails: aggErrorDetails,
          },
        }));

        if (body.done) break;
        offset = body.nextOffset;
      }

      toast.success(`${cfg.label}: ${aggImported} importados, ${aggSkipped} pulados, ${aggErrors} erros`);
    } catch (e) {
      toast.error(`Erro em ${cfg.label}: ${e instanceof Error ? e.message : String(e)}`);
      setState(s => ({ ...s, [phase]: { ...s[phase], running: false } }));
    }
  };

  if (checking) return null;
  if (!isMaster) return null;

  const renderPhase = (phase: Phase) => {
    const s = state[phase];
    const cfg = PHASE_CONFIG[phase];
    const Icon = cfg.icon;
    const pct = s.total > 0 ? Math.round((s.processed / s.total) * 100) : 0;

    return (
      <div className="border rounded-lg p-4 space-y-3 bg-card">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <span className="font-semibold">{cfg.label}</span>
          </div>
          <Button
            size="sm"
            onClick={() => runPhase(phase)}
            disabled={s.running}
            variant={s.done ? 'outline' : 'default'}
          >
            {s.running ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Importando...</>
            ) : s.done ? (
              'Reexecutar'
            ) : (
              'Iniciar'
            )}
          </Button>
        </div>

        {(s.running || s.done) && (
          <>
            <Progress value={pct} className="h-2" />
            <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
              <span>{s.processed}/{s.total} ({pct}%)</span>
              <Badge variant="default" className="bg-green-600">✓ {s.imported} novos</Badge>
              <Badge variant="secondary">↻ {s.skipped} pulados</Badge>
              {s.errors > 0 && (
                <Badge
                  variant="destructive"
                  className="cursor-pointer"
                  onClick={() => setErrorModal({ phase, details: s.errorDetails })}
                >
                  ⚠ {s.errors} erros
                </Badge>
              )}
              {s.notFound !== undefined && s.notFound > 0 && (
                <Badge variant="outline">⊘ {s.notFound} não encontrados</Badge>
              )}
              {s.missingClient !== undefined && s.missingClient > 0 && (
                <Badge variant="outline">⊘ {s.missingClient} sem cliente</Badge>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <SettingsCard
        icon={DatabaseBackup}
        title="Importação Legado Perfex CRM"
        description="Migra clientes, contratos assinados e arquivos do CRM antigo (crm.webmarcas.net). Apenas Master Admin."
      >
        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Upload do Dump SQL</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Envie um arquivo <code className="bg-muted px-1 rounded">.zip</code>, <code className="bg-muted px-1 rounded">.sql</code> ou <code className="bg-muted px-1 rounded">.sql.gz</code> do dump do Perfex CRM. Será processado e usado nas 3 fases abaixo.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="default"
                disabled={uploading || parsing}
                onClick={handleDirectDownload}
              >
                {parsing ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Processando...</>
                ) : (
                  <>Baixar do CRM antigo e processar</>
                )}
              </Button>
              <input
                type="file"
                id="perfex-dump-upload"
                accept=".zip,.sql,.gz"
                className="hidden"
                disabled={uploading || parsing}
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={uploading || parsing}
                onClick={() => document.getElementById('perfex-dump-upload')?.click()}
              >
                {uploading ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Enviando {uploadProgress}%</>
                ) : parsing ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Processando...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-1" />Ou enviar arquivo manual</>
                )}
              </Button>
              {uploadedFile && !uploading && !parsing && (
                <span className="text-xs text-muted-foreground truncate">{uploadedFile.split('/').pop()}</span>
              )}
            </div>
            {(uploading || parsing) && uploadProgress > 0 && uploadProgress < 100 && (
              <Progress value={uploadProgress} className="h-1.5" />
            )}
            {parseStats && (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="default" className="bg-green-600">✓ Dump pronto</Badge>
                <Badge variant="secondary">{parseStats.customers} clientes</Badge>
                <Badge variant="secondary">{parseStats.contracts} contratos</Badge>
                <Badge variant="secondary">{parseStats.files} arquivos</Badge>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-amber-900 dark:text-amber-200">Execute na ordem 1 → 2 → 3</p>
              <ul className="text-xs text-amber-800 dark:text-amber-300 list-disc list-inside space-y-0.5">
                <li>Clientes existentes (mesmo email/CPF/CNPJ) serão <strong>preservados intactos</strong></li>
                <li>Contratos só importam se o cliente já existir no CRM atual</li>
                <li>Arquivos serão baixados de crm.webmarcas.net (pode demorar)</li>
                <li>Operação <strong>idempotente</strong>: pode reexecutar sem duplicar</li>
              </ul>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="bg-primary/10 text-primary rounded-full w-6 h-6 inline-flex items-center justify-center text-xs">1</span>
              Importar Clientes
            </div>
            {renderPhase('customers')}

            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mt-2">
              <span className="bg-primary/10 text-primary rounded-full w-6 h-6 inline-flex items-center justify-center text-xs">2</span>
              Importar Contratos Assinados
            </div>
            {renderPhase('contracts')}

            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mt-2">
              <span className="bg-primary/10 text-primary rounded-full w-6 h-6 inline-flex items-center justify-center text-xs">3</span>
              Baixar Arquivos do Servidor Antigo
            </div>
            {renderPhase('files')}
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Senha padrão dos novos clientes: <code className="bg-muted px-1 rounded">123Mudar@</code>. Origem marcada como <code className="bg-muted px-1 rounded">import_perfex</code> para rastreamento.
          </div>
        </div>
      </SettingsCard>

      <Dialog open={!!errorModal} onOpenChange={(o) => !o && setErrorModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Erros durante importação ({errorModal?.details.length})</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <ul className="text-sm space-y-1 font-mono">
              {errorModal?.details.map((e, i) => (
                <li key={i} className="p-2 bg-muted/50 rounded text-xs break-all">{e}</li>
              ))}
            </ul>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}