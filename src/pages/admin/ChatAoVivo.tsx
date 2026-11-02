import { useEffect, useRef, useState, type ElementType } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Bot,
  BrainCircuit,
  Check,
  ExternalLink,
  FileText,
  Globe2,
  Loader2,
  MessagesSquare,
  Scale,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { INPILegalChatDialog } from '@/components/admin/inpi/INPILegalChatDialog';
import { AdminChatWidget } from '@/components/admin/AdminChatWidget';
import { ConsultorIaSearch } from '@/components/admin/consultor-ia/ConsultorIaSearch';
import { useChatMode } from '@/contexts/ChatModeContext';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import robotImg from '@/assets/central-inteligente-robot.png';
import logoCircular from '@/assets/webmarcas-logo-circular.png';

const BOTCONVERSA_URL = 'https://app.botconversa.com.br/8572/live-chat/all';
const WEBCONVERSA_URL = 'https://chat.webmarcas.net';

type ChannelTone = 'chat' | 'legal' | 'automation' | 'webconversa' | 'viability' | 'marcas';

interface AccessCardProps {
  title: string;
  description: string;
  badge: string;
  action: string;
  icon: ElementType;
  tone: ChannelTone;
  onClick: () => void;
}

const toneStyles: Record<ChannelTone, {
  card: string;
  icon: string;
  badge: string;
  button: string;
}> = {
  chat: {
    card: 'border-emerald-200/90 bg-emerald-50/80 hover:border-emerald-300 hover:shadow-[0_18px_40px_-24px_rgba(16,185,129,0.55)] dark:border-emerald-500/25 dark:bg-emerald-500/10',
    icon: 'bg-emerald-500 shadow-[0_10px_24px_-10px_rgba(16,185,129,0.8)]',
    badge: 'bg-emerald-100/90 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    button: 'hover:border-emerald-400 hover:text-emerald-700 dark:hover:border-emerald-400/60 dark:hover:text-emerald-300',
  },
  automation: {
    card: 'border-teal-200/90 bg-teal-50/80 hover:border-teal-300 hover:shadow-[0_18px_40px_-24px_rgba(20,184,166,0.55)] dark:border-teal-500/25 dark:bg-teal-500/10',
    icon: 'bg-teal-500 shadow-[0_10px_24px_-10px_rgba(20,184,166,0.8)]',
    badge: 'bg-teal-100/90 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
    button: 'hover:border-teal-400 hover:text-teal-700 dark:hover:border-teal-400/60 dark:hover:text-teal-300',
  },
  webconversa: {
    card: 'border-sky-200/90 bg-sky-50/80 hover:border-sky-300 hover:shadow-[0_18px_40px_-24px_rgba(14,165,233,0.55)] dark:border-sky-500/25 dark:bg-sky-500/10',
    icon: 'bg-sky-500 shadow-[0_10px_24px_-10px_rgba(14,165,233,0.8)]',
    badge: 'bg-sky-100/90 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    button: 'hover:border-sky-400 hover:text-sky-700 dark:hover:border-sky-400/60 dark:hover:text-sky-300',
  },
  legal: {
    card: 'border-blue-200/90 bg-blue-50/80 hover:border-blue-300 hover:shadow-[0_18px_40px_-24px_rgba(37,99,235,0.55)] dark:border-blue-500/25 dark:bg-blue-500/10',
    icon: 'bg-blue-600 shadow-[0_10px_24px_-10px_rgba(37,99,235,0.8)]',
    badge: 'bg-blue-100/90 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    button: 'hover:border-blue-400 hover:text-blue-700 dark:hover:border-blue-400/60 dark:hover:text-blue-300',
  },
  viability: {
    card: 'border-violet-200/90 bg-violet-50/80 hover:border-violet-300 hover:shadow-[0_18px_40px_-24px_rgba(139,92,246,0.55)] dark:border-violet-500/25 dark:bg-violet-500/10',
    icon: 'bg-violet-500 shadow-[0_10px_24px_-10px_rgba(139,92,246,0.8)]',
    badge: 'bg-violet-100/90 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    button: 'hover:border-violet-400 hover:text-violet-700 dark:hover:border-violet-400/60 dark:hover:text-violet-300',
  },
  marcas: {
    card: 'border-rose-200/90 bg-rose-50/80 hover:border-rose-300 hover:shadow-[0_18px_40px_-24px_rgba(244,63,94,0.5)] dark:border-rose-500/25 dark:bg-rose-500/10',
    icon: 'bg-rose-500 shadow-[0_10px_24px_-10px_rgba(244,63,94,0.8)]',
    badge: 'bg-rose-100/90 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    button: 'hover:border-rose-400 hover:text-rose-700 dark:hover:border-rose-400/60 dark:hover:text-rose-300',
  },
};

function AccessCard({ title, description, badge, action, icon: Icon, tone, onClick }: AccessCardProps) {
  const styles = toneStyles[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="min-w-0"
    >
      <div
        className={cn(
          'flex h-full flex-col rounded-2xl border p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5',
          styles.card,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white', styles.icon)}>
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', styles.badge)}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {badge}
          </span>
        </div>

        <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-foreground">{title}</h3>
        <p className="mt-1.5 min-h-[3rem] text-sm leading-6 text-slate-600 line-clamp-2 dark:text-muted-foreground">{description}</p>

        <button
          type="button"
          onClick={onClick}
          className={cn(
            'mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300/90 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10',
            styles.button,
          )}
        >
          {action}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  );
}

const bannerPills: Array<{ icon: ElementType; label: string }> = [
  { icon: Search, label: 'Análise de viabilidade' },
  { icon: MessagesSquare, label: 'Tire suas dúvidas' },
  { icon: FileText, label: 'Orientação completa' },
];

function ChatAoVivoContent() {
  const { chatMode, setChatMode } = useChatMode();
  const { hasPermission } = useAdminPermissions();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [query, setQuery] = useState('');
  const [adminName, setAdminName] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const webconversaIframeRef = useRef<HTMLIFrameElement>(null);
  const canUseLegalConsultancy = hasPermission('inpi_resources', 'can_view');
  const showSelector = !chatMode || chatMode === 'selector' || chatMode === 'consultoria';

  useEffect(() => {
    if (!chatMode) setChatMode('selector');
    return () => setChatMode(null);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .maybeSingle();
        if (active && data?.full_name) {
          setAdminName(String(data.full_name).trim().split(' ')[0]);
        }
      } catch {
        // Saudação é cosmética; falha silenciosa mantém a página utilizável.
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (chatMode !== 'botconversa' && chatMode !== 'webconversa') return;
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

  useEffect(() => {
    const handleReload = () => {
      if (!webconversaIframeRef.current) return;
      setIsLoading(true);
      setIframeError(false);
      webconversaIframeRef.current.src = WEBCONVERSA_URL;
    };
    window.addEventListener('webconversa-reload', handleReload);
    return () => window.removeEventListener('webconversa-reload', handleReload);
  }, []);

  const handleSelectBotConversa = () => {
    setChatMode('botconversa');
    setIsLoading(true);
    setIframeError(false);
  };

  const handleSelectWebConversa = () => {
    setChatMode('webconversa');
    setIsLoading(true);
    setIframeError(false);
  };

  const accessCards: AccessCardProps[] = [
    {
      title: 'Chat web',
      description: 'Atendimento interno do CRM com inteligência artificial, vídeo, áudio e histórico completo das conversas.',
      badge: 'Online',
      action: 'Acessar',
      icon: MessagesSquare,
      tone: 'chat',
      onClick: () => setChatMode('chatweb'),
    },
    {
      title: 'Botconversa',
      description: 'Plataforma externa para atendimento e automações de WhatsApp, chatbots e organização de funis.',
      badge: 'Externo',
      action: 'Acessar',
      icon: Bot,
      tone: 'automation',
      onClick: handleSelectBotConversa,
    },
    {
      title: 'WebConversa',
      description: 'Plataforma de atendimento WhatsApp em equipe, com automações e gestão de conversas da operação.',
      badge: 'Externo',
      action: 'Acessar',
      icon: Globe2,
      tone: 'webconversa',
      onClick: handleSelectWebConversa,
    },
    ...(canUseLegalConsultancy
      ? [{
          title: 'Consultoria jurídica',
          description: 'Análise de documentos, estratégias de defesa e orientação especializada em Recursos INPI.',
          badge: 'Especializada',
          action: 'Acessar',
          icon: Scale,
          tone: 'legal' as ChannelTone,
          onClick: () => setChatMode('consultoria'),
        }]
      : []),
    {
      title: 'Busca de viabilidade',
      description: 'Consulte a viabilidade de uma marca usando apenas o nome e o ramo de atividade, com laudo oficial em PDF.',
      badge: 'Novo',
      action: 'Acessar',
      icon: Search,
      tone: 'viability',
      onClick: () => setChatMode('viabilidade'),
    },
    {
      title: 'Marcas IA',
      description: 'Agente que cria nomes de marca já filtrados pela busca e modelos de logotipo, tudo sob sua aprovação.',
      badge: 'Em desenvolvimento',
      action: 'Em breve',
      icon: BrainCircuit,
      tone: 'marcas',
      onClick: () => toast.info('Marcas IA em desenvolvimento', { description: 'O agente de criação de marcas e logotipos entra em breve nesta central.' }),
    },
  ];

  const normalizedQuery = query.trim().toLowerCase();
  const visibleCards = normalizedQuery
    ? accessCards.filter((card) => `${card.title} ${card.description}`.toLowerCase().includes(normalizedQuery))
    : accessCards;

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
              <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
                <header className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-foreground sm:text-2xl">
                      Olá{adminName ? `, ${adminName}` : ''}! <span aria-hidden="true">👋</span>
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">Bem-vindo ao CRM da WebMarcas.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="relative flex-1 lg:w-80 lg:flex-none">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar atendimento ou consultoria..."
                        aria-label="Buscar acessos da Central Inteligente"
                        className="h-11 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => navigate('/admin/notificacoes')}
                      aria-label="Ir para notificações"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground"
                    >
                      <Bell className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0a1f44] p-1.5 shadow-sm">
                      <img src={logoCircular} alt="WebMarcas" className="h-full w-full object-contain" />
                    </span>
                  </div>
                </header>

                <section className="relative overflow-hidden rounded-3xl shadow-[0_24px_60px_-30px_rgba(4,42,102,0.8)]">
                  <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(115deg,#032052_0%,#063a8f_45%,#0a54c0_78%,#0d63e8_100%)]" />
                  <div aria-hidden="true" className="absolute -bottom-24 left-1/4 h-64 w-2/3 rounded-full bg-sky-400/20 blur-3xl" />
                  <div className="relative flex flex-col gap-4 p-5 sm:p-8 lg:flex-row lg:items-center lg:gap-6 lg:p-10">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-bold text-white sm:text-2xl lg:text-2xl xl:text-3xl">
                        Central Inteligente <br className="hidden lg:block" /><span className="text-sky-300">WebMarcas</span>
                      </h2>
                      <p className="mt-3 max-w-md text-sm leading-6 text-sky-100/85 sm:text-[15px]">
                        Tire dúvidas, receba orientação especializada e faça a busca de viabilidade da sua marca.
                      </p>
                      <button
                        type="button"
                        onClick={() => setChatMode('viabilidade')}
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#052a66] shadow-lg transition hover:bg-sky-50 sm:mt-6 sm:px-6 sm:py-3"
                      >
                        Iniciar agora
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    <img
                      src={robotImg}
                      alt="Robô assistente da WebMarcas"
                      className="pointer-events-none w-32 self-end sm:w-40 lg:w-36 lg:self-center xl:w-44"
                    />

                    <div className="flex flex-row flex-wrap gap-1.5 lg:w-56 lg:shrink-0 lg:flex-col lg:gap-3">
                      {bannerPills.map(({ icon: PillIcon, label }) => (
                        <span
                          key={label}
                          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm sm:gap-2.5 sm:px-4 sm:py-2.5 sm:text-sm"
                        >
                          <PillIcon className="h-4 w-4 shrink-0 text-sky-200" aria-hidden="true" />
                          <span className="whitespace-nowrap">{label}</span>
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500" aria-hidden="true">
                            <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </section>

                <div className="mt-8 mb-5 flex items-center justify-between gap-4 sm:mt-10">
                  <h2 className="text-base font-bold text-foreground sm:text-xl">Atendimento e Consultoria</h2>
                  <span className="hidden whitespace-nowrap text-sm font-medium text-primary sm:inline">Acesso rápido</span>
                </div>

                {visibleCards.length > 0 ? (
                  <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleCards.map((card) => (
                      <AccessCard key={card.title} {...card} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center text-sm text-muted-foreground">
                    Nenhum acesso encontrado para “{query.trim()}”.
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {chatMode === 'chatweb' && (
            <motion.div key="chatweb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
              <AdminChatWidget inlineMode />
            </motion.div>
          )}

          {chatMode === 'viabilidade' && (
            <motion.div key="viabilidade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
              <ConsultorIaSearch />
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

          {chatMode === 'webconversa' && (
            <motion.div key="webconversa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
              {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">Carregando WebConversa...</p>
                  </div>
                </div>
              )}
              {iframeError ? (
                <div className="flex h-full flex-col items-center justify-center bg-muted/30 px-6 text-center">
                  <AlertCircle className="mb-4 h-16 w-16 text-destructive" />
                  <h2 className="mb-2 text-xl font-semibold text-foreground">Acesso restrito pelo WebConversa</h2>
                  <p className="mb-6 max-w-md text-muted-foreground">O WebConversa não permite exibição integrada. Você pode acessá-lo em uma nova aba.</p>
                  <Button onClick={() => window.open(WEBCONVERSA_URL, '_blank', 'noopener')} size="lg">
                    <ExternalLink className="mr-2 h-5 w-5" /> Abrir WebConversa
                  </Button>
                </div>
              ) : (
                <iframe
                  ref={webconversaIframeRef}
                  src={WEBCONVERSA_URL}
                  className="h-full w-full border-0"
                  onLoad={() => setIsLoading(false)}
                  allow="microphone; camera; clipboard-write"
                  title="WebConversa Atendimento"
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
