import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Reply, Forward, Trash2, Star, Clock, Sparkles,
  MoreHorizontal, Archive, Eye, ChevronDown, MailOpen, MailX,
  AlertTriangle, Copy, Printer, Paperclip, FileText, Download,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Email } from '@/pages/admin/Emails';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { AIEmailAssistant } from './AIEmailAssistant';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

function AttachmentSection({ emailId, attachments }: { emailId: string; attachments: Array<{ filename: string; content_type: string; size: number }> }) {
  const [downloading, setDownloading] = useState<number | null>(null);

  const handleDownload = async (idx: number, filename: string) => {
    setDownloading(idx);
    try {
      const { data, error } = await supabase.functions.invoke('download-attachment', {
        body: { email_id: emailId, attachment_index: idx }
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Erro ao baixar');

      const byteChars = atob(data.data_base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);

      const blob = new Blob([byteArray], { type: data.content_type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`📎 ${filename} baixado com sucesso`);
    } catch (err: any) {
      console.error('Download error:', err);
      toast.error('Erro ao baixar anexo: ' + err.message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="mt-4 p-3 rounded-lg border border-border/50 bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <Paperclip className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">
          {attachments.length} anexo{attachments.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {attachments.map((att, idx) => (
          <button
            key={idx}
            onClick={() => handleDownload(idx, att.filename)}
            disabled={downloading === idx}
            className="flex items-center gap-2 p-2 rounded-md border border-border/50 bg-background hover:bg-muted/50 transition-colors text-left group"
          >
            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{att.filename}</p>
              <p className="text-[10px] text-muted-foreground">
                {att.content_type} · {att.size > 1024 ? `${Math.round(att.size / 1024)}KB` : `${att.size}B`}
              </p>
            </div>
            {downloading === idx ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
            ) : (
              <Download className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

interface EmailViewProps {
  email: Email;
  onBack: () => void;
  onReply: () => void;
  onForward?: (email: Email) => void;
  onUseDraftFromAI?: (text: string) => void;
}

const TRACKING_MOCK = {
  opens: 3,
  lastOpen: '14:22',
  device: 'Desktop · Chrome',
  location: 'São Paulo, SP',
  clicks: 1,
};

export function EmailView({ email, onBack, onReply, onForward, onUseDraftFromAI }: EmailViewProps) {
  const [showAI, setShowAI] = useState(false);
  const [isStarred, setIsStarred] = useState(email.is_starred);
  const [draftText, setDraftText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [hydratedBody, setHydratedBody] = useState<{
    body_text?: string;
    body_html?: string;
    attachments?: Array<{ filename: string; content_type: string; size: number }>;
  }>({});
  const queryClient = useQueryClient();

  // Auto-hydrate email content if missing or previously failed
  const isFailedHydration = !!email.body_fetched_at && 
    (email.body_text?.startsWith("(") || (!email.body_text && !email.body_html));
  
  const hydrateEmail = () => {
    setIsHydrating(true);
    supabase.functions.invoke('hydrate-email', { body: { email_id: email.id } })
      .then(({ data, error }) => {
        if (error) {
          console.error('Hydrate error:', error);
          return;
        }
        if (data?.success) {
          setHydratedBody({
            body_text: data.body_text,
            body_html: data.body_html,
            attachments: data.attachments,
          });
          queryClient.invalidateQueries({ queryKey: ['emails'] });
        }
      })
      .finally(() => setIsHydrating(false));
  };

  useEffect(() => {
    const hasBody = (email.body_text || email.body_html) && !isFailedHydration;
    if (hasBody || email.body_fetched_at && !isFailedHydration) {
      setHydratedBody({});
      return;
    }
    hydrateEmail();
  }, [email.id]);

  // Use hydrated content or original
  const displayBodyText = hydratedBody.body_text || email.body_text;
  const displayBodyHtml = hydratedBody.body_html || email.body_html;
  const displayAttachments = hydratedBody.attachments || email.attachments || [];

  useEffect(() => {
    if (!email.is_read) {
      supabase.from('email_inbox').update({ is_read: true }).eq('id', email.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['emails'] });
        queryClient.invalidateQueries({ queryKey: ['email-stats'] });
      });
    }
  }, [email.id, email.is_read, queryClient]);

  const emailDate = email.received_at || email.sent_at;

  const handleUseDraft = (text: string) => {
    setDraftText(text);
    setShowAI(false);
    if (onUseDraftFromAI) {
      onUseDraftFromAI(text);
    } else {
      onReply();
      toast.success('✅ Rascunho pronto! Clique em Responder para editar.');
    }
  };

  const handleToggleStar = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsStarred(prev => !prev);
    await supabase.from('email_inbox').update({ is_starred: !isStarred }).eq('id', email.id);
    queryClient.invalidateQueries({ queryKey: ['emails'] });
    toast.success(isStarred ? 'Removido dos favoritos' : '⭐ Adicionado aos favoritos');
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('email_inbox').delete().eq('id', email.id);
    if (error) {
      toast.error('Erro ao excluir email: ' + error.message);
      return;
    }
    toast.success('🗑️ Email excluído com sucesso');
    queryClient.invalidateQueries({ queryKey: ['emails'] });
    queryClient.invalidateQueries({ queryKey: ['email-stats'] });
    onBack();
  };

  const handleArchive = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const { error } = await supabase.from('email_inbox').update({ is_archived: true }).eq('id', email.id);
    if (error) {
      toast.error('Erro ao arquivar email: ' + error.message);
      return;
    }
    toast.success('📦 Email arquivado');
    queryClient.invalidateQueries({ queryKey: ['emails'] });
    queryClient.invalidateQueries({ queryKey: ['email-stats'] });
    onBack();
  };

  const handleMarkUnread = async () => {
    await supabase.from('email_inbox').update({ is_read: false }).eq('id', email.id);
    queryClient.invalidateQueries({ queryKey: ['emails'] });
    toast.success('Marcado como não lido');
    onBack();
  };

  const handleForward = () => {
    if (onForward) {
      onForward(email);
    } else {
      toast.info('Funcionalidade de encaminhar em desenvolvimento');
    }
  };

  const handleCopyContent = () => {
    const text = email.body_text || email.subject || '';
    navigator.clipboard.writeText(text);
    toast.success('Conteúdo copiado para a área de transferência');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html><head><title>${email.subject}</title>
        <style>body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto}
        .header{border-bottom:1px solid #ccc;padding-bottom:10px;margin-bottom:20px}
        .meta{color:#666;font-size:14px}</style></head>
        <body><div class="header"><h1>${email.subject}</h1>
        <p class="meta">De: ${email.from_name || email.from_email}</p>
        <p class="meta">Para: ${email.to_email}</p>
        <p class="meta">Data: ${emailDate ? format(new Date(emailDate), "dd MMM yyyy, HH:mm", { locale: ptBR }) : ''}</p>
        </div><div>${email.body_html || email.body_text || '(Sem conteúdo)'}</div></body></html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <>
      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir Email
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este email? Esta ação não pode ser desfeita.
              <br /><br />
              <strong>Assunto:</strong> {email.subject}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Assistant as Dialog/Modal */}
      <Dialog open={showAI} onOpenChange={setShowAI}>
        <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden max-h-[90vh]">
          <AIEmailAssistant
            email={email}
            onUseDraft={handleUseDraft}
            onClose={() => setShowAI(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Main Email View */}
      <div className="h-full flex flex-col w-full">
        <Card className="h-full flex flex-col rounded-none border-0 shadow-none">
          {/* Top Toolbar */}
          <CardHeader className="pb-0 pt-2 md:pt-3 px-3 md:px-4 flex-shrink-0">
            <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
              <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 md:h-8 md:w-8 hover:bg-muted">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1" />
              <div className="flex items-center gap-0.5 md:gap-1">
                <Button
                  variant={showAI ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    "gap-1 md:gap-1.5 text-[10px] md:text-xs h-8 transition-all",
                    showAI ? "shadow-lg" : ""
                  )}
                  onClick={() => setShowAI(prev => !prev)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">✨ IA Assistente</span>
                  <span className="md:hidden">IA</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleToggleStar(e)}>
                  <Star className={cn('h-4 w-4 transition-colors', isStarred ? 'fill-primary text-primary' : 'text-muted-foreground')} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground hidden md:flex"
                  onClick={(e) => handleArchive(e)}
                  title="Arquivar"
                >
                  <Archive className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                {/* 3-dot Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hidden md:flex">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleMarkUnread} className="gap-2">
                      <MailX className="h-4 w-4" />
                      Marcar como não lido
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyContent} className="gap-2">
                      <Copy className="h-4 w-4" />
                      Copiar conteúdo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handlePrint} className="gap-2">
                      <Printer className="h-4 w-4" />
                      Imprimir
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleArchive()} className="gap-2">
                      <Archive className="h-4 w-4" />
                      Arquivar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowDeleteConfirm(true)}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir email
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Subject */}
            <h2 className="text-base md:text-lg font-bold leading-tight mb-2 md:mb-3">{email.subject}</h2>

            {/* Tracking Bar */}
            <div className="hidden md:flex items-center gap-3 py-2 px-3 bg-muted/30 rounded-xl border border-border/30 text-[10px] text-muted-foreground mb-3">
              <div className="flex items-center gap-1.5">
                <Eye className="h-3 w-3 text-primary" />
                <span className="font-semibold text-foreground">{TRACKING_MOCK.opens}x</span> aberto
              </div>
              <div className="w-px h-3 bg-border" />
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Última: {TRACKING_MOCK.lastOpen}
              </div>
              <div className="w-px h-3 bg-border" />
              <span>{TRACKING_MOCK.device}</span>
              <div className="w-px h-3 bg-border" />
              <span>{TRACKING_MOCK.location}</span>
            </div>
          </CardHeader>

          <Separator />

          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {/* Sender Block */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-sm">
                        {(email.from_name || email.from_email)[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{email.from_name || email.from_email}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground">{email.from_email}</p>
                        <span className="text-muted-foreground text-xs">→</span>
                        <p className="text-xs text-muted-foreground">{email.to_email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                    <Clock className="h-3.5 w-3.5" />
                    {emailDate && format(new Date(emailDate), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                  </div>
                </div>

                <Separator />

                {/* Email Body */}
                {isHydrating ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                    <p className="text-sm font-medium">Carregando conteúdo do email...</p>
                    <p className="text-xs">Sincronizando com o servidor de email</p>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {displayBodyHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: displayBodyHtml }} className="leading-relaxed" />
                    ) : displayBodyText ? (
                      <p className="whitespace-pre-wrap leading-relaxed text-sm text-foreground/90">{displayBodyText}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">(Sem conteúdo)</p>
                    )}
                  </div>
                )}

                {/* Attachments Section */}
                {displayAttachments.length > 0 && (
                  <AttachmentSection emailId={email.id} attachments={displayAttachments} />
                )}

                {/* AI Draft Preview */}
                <AnimatePresence>
                  {draftText && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <p className="text-xs font-semibold text-primary">Rascunho gerado pela IA</p>
                        <Badge variant="outline" className="text-[9px]">Aguardando revisão</Badge>
                      </div>
                      <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{draftText}</p>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={onReply}>
                          <Reply className="h-3 w-3" />
                          Editar e Enviar
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDraftText('')}>
                          Descartar
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </CardContent>

          <Separator />

          {/* Action Bar */}
          <div className="p-2.5 md:p-3 flex items-center gap-1.5 md:gap-2 flex-shrink-0 bg-background/50">
            <Button onClick={onReply} className="gap-1.5 md:gap-2 h-9 shadow-sm shadow-primary/20 text-xs md:text-sm flex-1 md:flex-none">
              <Reply className="h-4 w-4" />
              Responder
            </Button>
            <Button variant="outline" className="gap-1.5 md:gap-2 h-9 text-xs md:text-sm flex-1 md:flex-none" onClick={handleForward}>
              <Forward className="h-4 w-4" />
              Encaminhar
            </Button>
            <div className="flex-1 hidden md:block" />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 text-xs flex-shrink-0"
              onClick={() => setShowAI(true)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden md:inline">✨ IA</span>
              <span className="md:hidden">IA</span>
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
