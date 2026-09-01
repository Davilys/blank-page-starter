import DOMPurify from 'dompurify';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ArrowLeft, Paperclip, Download, AlertTriangle } from 'lucide-react';

export interface EmailAttachmentRef {
  name?: string;
  filename?: string;
  url?: string;
  size?: number;
  type?: string;
}

export interface ClientEmailLog {
  id: string;
  from_email: string;
  to_email: string;
  cc_emails: string[] | null;
  bcc_emails: string[] | null;
  subject: string;
  body: string;
  html_body: string | null;
  status: string | null;
  error_message: string | null;
  sent_at: string | null;
  sent_by: string | null;
  attachments: EmailAttachmentRef[] | null;
  provider_message_id: string | null;
  trigger_type: string | null;
  client_id: string | null;
}

function statusMeta(status?: string | null) {
  const s = (status || 'pending').toLowerCase();
  if (s === 'sent' || s === 'delivered') return { label: s === 'sent' ? 'Enviado' : 'Entregue', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
  if (s === 'failed' || s === 'error') return { label: s === 'failed' ? 'Falhou' : 'Erro no envio', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
  if (s === 'bounced') return { label: 'Rejeitado', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' };
  if (s === 'pending') return { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
  return { label: status || 'Desconhecido', cls: 'bg-muted text-muted-foreground' };
}

function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatSize(bytes?: number) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex gap-2 text-xs">
    <span className="text-muted-foreground w-24 flex-shrink-0">{label}</span>
    <span className="font-medium break-all">{value}</span>
  </div>
);

export function ClientEmailViewer({ email, onBack }: { email: ClientEmailLog; onBack: () => void }) {
  const meta = statusMeta(email.status);
  const anexos = Array.isArray(email.attachments) ? email.attachments : [];

  // Sanitização obrigatória: nada de <script>, handlers inline ou iframes.
  const safeHtml = useMemo(() => {
    const raw = email.html_body || (email.body ? email.body.replace(/\n/g, '<br/>') : '');
    return DOMPurify.sanitize(raw, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'link', 'base'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'formaction', 'srcdoc'],
    });
  }, [email.html_body, email.body]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar à lista
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold leading-snug">{email.subject || '(sem assunto)'}</h3>
              <Badge variant="secondary" className={cn('flex-shrink-0 text-[10px]', meta.cls)}>{meta.label}</Badge>
            </div>
            <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3">
              <Row label="De" value={email.from_email} />
              <Row label="Para" value={email.to_email} />
              {email.cc_emails?.length ? <Row label="Cc" value={email.cc_emails.join(', ')} /> : null}
              {email.bcc_emails?.length ? <Row label="Cco" value={email.bcc_emails.join(', ')} /> : null}
              <Row label="Enviado em" value={formatDateTime(email.sent_at)} />
              {email.provider_message_id ? <Row label="ID no provedor" value={email.provider_message_id} /> : null}
              {email.trigger_type ? <Row label="Origem" value={email.trigger_type} /> : null}
            </div>
          </div>

          {email.error_message && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 flex gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span className="break-all">{email.error_message}</span>
            </div>
          )}

          {anexos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" /> Anexos ({anexos.length})
              </p>
              <div className="space-y-1.5">
                {anexos.map((a, i) => {
                  const nome = a.name || a.filename || `anexo-${i + 1}`;
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs">
                      <span className="truncate">{nome} {formatSize(a.size) && <span className="text-muted-foreground">· {formatSize(a.size)}</span>}</span>
                      {a.url ? (
                        <Button asChild variant="ghost" size="sm" className="h-7 gap-1 flex-shrink-0">
                          <a href={a.url} target="_blank" rel="noopener noreferrer" download={nome}>
                            <Download className="h-3.5 w-3.5" /> Abrir
                          </a>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground flex-shrink-0">sem link</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border bg-background p-4">
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed break-words"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
