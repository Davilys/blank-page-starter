import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SettingsCard } from './SettingsCard';
import { toast } from 'sonner';
import { Loader2, Users, FileText, FolderArchive, AlertTriangle, ShieldCheck, DatabaseBackup, CheckCircle2 } from 'lucide-react';

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
          <div className="border rounded-lg p-3 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-emerald-900 dark:text-emerald-200">
              <strong>Dados Perfex prontos.</strong> Os arquivos NDJSON do dump (clientes, contratos e arquivos) já estão embutidos no projeto. Não é necessário enviar SQL nem rodar parse — basta executar as 3 fases abaixo na ordem.
            </div>
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