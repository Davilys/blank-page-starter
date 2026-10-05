import { useEffect, useRef, useState, type ElementType } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Globe2,
  Headphones,
  Loader2,
  MessageCircle,
  Scale,
  ShieldCheck,
  Sparkles,
  Video,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { INPILegalChatDialog } from '@/components/admin/inpi/INPILegalChatDialog';
import { AdminChatWidget } from '@/components/admin/AdminChatWidget';
import { useChatMode } from '@/contexts/ChatModeContext';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { cn } from '@/lib/utils';

const BOTCONVERSA_URL = 'https://app.botconversa.com.br/8572/live-chat/all';

type ChannelTone = 'chat' | 'legal' | 'automation';

interface ChannelCardProps {
  title: string;
  description: string;
  badge: string;
  action: string;
  icon: ElementType;
  tone: ChannelTone;
  features: readonly string[];
  onClick: () => void;
}

const toneStyles: Record<ChannelTone, {
  card: string;
  icon: string;
  badge: string;
  feature: string;
  action: string;
}> = {
  chat: {
    card: 'border-success/20 hover:border-success/40 hover:shadow-[0_20px_50px_-28px_hsl(var(--success)/0.5)]',
    icon: 'bg-success text-success-foreground shadow-[0_12px_28px_-12px_hsl(var(--success)/0.7)]',
    badge: 'border-success/20 bg-success/10 text-success',
    feature: 'border-success/15 bg-success/5 text-success',
    action: 'text-success',
  },
  legal: {
    card: 'border-primary/20 hover:border-primary/45 hover:shadow-[0_20px_50px_-28px_hsl(var(--primary)/0.55)]',
    icon: 'bg-primary text-primary-foreground shadow-[0_12px_28px_-12px_hsl(var(--primary)/0.75)]',
    badge: 'border-primary/20 bg-primary/10 text-primary',
    feature: 'border-primary/15 bg-primary/5 text-primary',
    action: 'text-primary',
  },
  automation: {
    card: 'border-accent/20 hover:border-accent/45 hover:shadow-[0_20px_50px_-28px_hsl(var(--accent)/0.55)]',
    icon: 'bg-accent text-accent-foreground shadow-[0_12px_28px_-12px_hsl(var(--accent)/0.75)]',
    badge: 'border-accent/20 bg-accent/10 text-accent-foreground',
    feature: 'border-accent/15 bg-accent/5 text-foreground',
    action: 'text-accent-foreground',
  },
};

function ChannelCard({ title, description, badge, action, icon: Icon, tone, features, onClick }: ChannelCardProps) {
  const styles = toneStyles[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-w-0"
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onClick}
        className={cn(
          'group h-full min-h-[330px] w-full whitespace-normal rounded-2xl border bg-card p-0 text-left text-card-foreground shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:bg-card',
          styles.card,
        )}
      >
        <span className="flex h-full w-full min-w-0 flex-col items-start p-6 sm:p-7">
          <span className="mb-7 flex w-full items-start justify-between gap-4">
            <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', styles.icon)}>
              <Icon className="h-7 w-7" aria-hidden="true" />
            </span>
            <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold', styles.badge)}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {badge}
            </span>
          </span>

          <span className="text-xl font-bold text-foreground">{title}</span>
          <span className="mt-3 min-h-[72px] text-sm font-normal leading-6 text-muted-foreground">{description}</span>

          <span className="mt-5 flex flex-wrap gap-2">
            {features.map((feature) => (
              <span key={feature} className={cn('rounded-md border px-2.5 py-1 text-[11px] font-semibold', styles.feature)}>
                {feature}
              </span>
            ))}
          </span>

          <span className={cn('mt-auto flex items-center gap-2 pt-7 text-sm font-bold', styles.action)}>
            {action}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
          </span>
        </span>
      </Button>
    </motion.div>
  );
}

function ChatAoVivoContent() {
  const { chatMode, setChatMode } = useChatMode();
  const { hasPermission, isLoading: isLoadingPermissions } = useAdminPermissions();
  const [isLoading, setIsLoading] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canUseLegalConsultancy = hasPermission('inpi_resources', 'can_view');
  const showSelector = !chatMode || chatMode === 'selector' || chatMode === 'consultoria';

  useEffect(() => {
    if (!chatMode) setChatMode('selector');
    return () => setChatMode(null);
  }, []);

  useEffect(() => {
    if (chatMode !== 'botconversa') return;
    const timeout = window.setTimeout(() => {
      if (isLoading) {
        setIframeError(true);
        setIsLoading(false);
      }
    }, 15000);
    return () => window.clearTimeout(timeout);
  }, [isLoading, chatMode]);

  useEffect(() => {
    const handleReload = () => {
      if (!iframeRef.current) return;
      setIsLoading(true);
      setIframeError(false);
      iframeRef.current.src = BOTCONVERSA_URL;
    };
    window.addEventListener('botconversa-reload', handleReload);
    return () => window.removeEventListener('botconversa-reload', handleReload);
  }, []);

  const handleSelectBotConversa = () => {
    setChatMode('botconversa');
    setIsLoading(true);
    setIframeError(false);
  };

  const channelCount = canUseLegalConsultancy ? 3 : 2;

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {showSelector && (
            <motion.div
              key="selector"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="absolute inset-0 overflow-y-auto bg-background"
            >
              <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
                <div className="mx-auto mb-9 max-w-2xl text-center lg:mb-12">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/15 bg-card text-primary shadow-[0_16px_36px_-20px_hsl(var(--primary)/0.65)]">
                    <Headphones className="h-8 w-8" aria-hidden="true" />
                  </div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                    {channelCount} canais disponíveis
                  </div>
                  <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Central de Atendimento</h1>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                    Escolha o canal especializado para atender clientes, automatizar conversas ou consultar questões do INPI.
                  </p>
                </div>

                <div className={cn('grid w-full grid-cols-1 gap-5', canUseLegalConsultancy ? 'lg:grid-cols-3' : 'mx-auto max-w-4xl md:grid-cols-2')}>
                  <ChannelCard
                    title="ChatWeb"
                    description="Atendimento interno do CRM com inteligência artificial, vídeo, áudio e histórico completo das conversas."
                    badge="Nativo"
                    action="Abrir ChatWeb"
                    icon={Globe2}
                    tone="chat"
                    features={['IA integrada', 'Vídeo e áudio', 'Tempo real']}
                    onClick={() => setChatMode('chatweb')}
                  />

                  {canUseLegalConsultancy && (
                    <ChannelCard
                      title="Consultoria Jurídica"
                      description="Acesse a Fernanda para análise de documentos, estratégias de defesa e orientação especializada em Recursos INPI."
                      badge="Especializada"
                      action="Consultar Fernanda"
                      icon={Scale}
                      tone="legal"
                      features={['Defesas INPI', 'Análise de PDF', 'Jurisprudência']}
                      onClick={() => setChatMode('consultoria')}
                    />
                  )}

                  <ChannelCard
                    title="BotConversa"
                    description="Plataforma externa para atendimento e automações de WhatsApp, chatbots e organização de funis."
                    badge="Externo"
                    action="Abrir BotConversa"
                    icon={Bot}
                    tone="automation"
                    features={['WhatsApp', 'Automação', 'Funis']}
                    onClick={handleSelectBotConversa}
                  />
                </div>

                <div className="mx-auto mt-9 flex w-full max-w-3xl flex-col items-center justify-center gap-3 border-t border-border/70 pt-6 text-sm text-muted-foreground sm:flex-row sm:gap-7">
                  <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Canais operacionais</span>
                  <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
                  <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Acesso conforme permissões</span>
                  <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
                  <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent-foreground" /> Intelligence PI</span>
                </div>

                {isLoadingPermissions && (
                  <span className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando canais disponíveis
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {chatMode === 'chatweb' && (
            <motion.div key="chatweb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
              <AdminChatWidget inlineMode />
            </motion.div>
          )}

          {chatMode === 'botconversa' && (
            <motion.div key="botconversa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
              {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">Carregando BotConversa...</p>
                  </div>
                </div>
              )}
              {iframeError ? (
                <div className="flex h-full flex-col items-center justify-center bg-muted/30 px-6 text-center">
                  <AlertCircle className="mb-4 h-16 w-16 text-destructive" />
                  <h2 className="mb-2 text-xl font-semibold text-foreground">Acesso restrito pelo BotConversa</h2>
                  <p className="mb-6 max-w-md text-muted-foreground">O BotConversa não permite exibição integrada. Você pode acessá-lo em uma nova aba.</p>
                  <Button onClick={() => window.open(BOTCONVERSA_URL, '_blank')} size="lg">
                    <ExternalLink className="mr-2 h-5 w-5" /> Abrir BotConversa
                  </Button>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  src={BOTCONVERSA_URL}
                  className="h-full w-full border-0"
                  onLoad={() => setIsLoading(false)}
                  allow="microphone; camera; clipboard-write"
                  title="BotConversa Live Chat"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {canUseLegalConsultancy && (
        <INPILegalChatDialog
          open={chatMode === 'consultoria'}
          onOpenChange={(open) => setChatMode(open ? 'consultoria' : 'selector')}
        />
      )}
    </div>
  );
}

export default function ChatAoVivo() {
  return <ChatAoVivoContent />;
}
