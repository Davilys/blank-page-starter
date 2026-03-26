import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ClientLayout } from '@/components/cliente/ClientLayout';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Send, Bot, Loader2, Home, ExternalLink, Sparkles,
  Bell, CheckCircle, AlertTriangle, Info, FileText, CreditCard,
  Zap, Clock, Star, HeadphonesIcon, ChevronRight, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import avatar1 from '@/assets/avatars/avatar-1.jpg';
import avatar2 from '@/assets/avatars/avatar-2.jpg';
import avatar3 from '@/assets/avatars/avatar-3.jpg';
import webmarcasIcon from '@/assets/webmarcas-icon.png';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string | null;
  read: boolean;
  link: string | null;
  created_at: string;
}

type ViewType = 'home' | 'chat' | 'notifications';
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-support`;

const QUICK_QUESTIONS = [
  'Qual o status do meu processo?',
  'Como pagar minha fatura?',
  'Quanto tempo leva o registro?',
  'O que é NCL?',
  'Posso cancelar o pedido?',
  'Como funciona a assinatura?',
];

const EXTERNAL_LINKS = [
  { label: 'Buscar marcas no INPI', url: 'https://busca.inpi.gov.br/pePI/', icon: FileText },
  { label: 'Tabela de Taxas INPI', url: 'https://www.gov.br/inpi/pt-br/servicos/marcas/guia-basico/taxas', icon: CreditCard },
  { label: 'WhatsApp da WebMarcas', url: 'https://wa.me/5511911120225', icon: MessageSquare },
];

function NotifIcon({ type }: { type: string | null }) {
  const cls = 'h-4 w-4';
  switch (type) {
    case 'success':   return <CheckCircle className={cn(cls, 'text-emerald-500')} />;
    case 'warning':   return <AlertTriangle className={cn(cls, 'text-amber-500')} />;
    case 'error':     return <AlertTriangle className={cn(cls, 'text-rose-500')} />;
    case 'info':      return <Info className={cn(cls, 'text-sky-500')} />;
    case 'process':   return <FileText className={cn(cls, 'text-primary')} />;
    case 'payment':   return <CreditCard className={cn(cls, 'text-emerald-500')} />;
    default:          return <Bell className={cn(cls, 'text-muted-foreground')} />;
  }
}

const NOTIF_COLORS: Record<string, { border: string; bg: string }> = {
  success: { border: 'border-l-emerald-500', bg: 'bg-emerald-500/5' },
  warning: { border: 'border-l-amber-500',   bg: 'bg-amber-500/5' },
  error:   { border: 'border-l-rose-500',    bg: 'bg-rose-500/5' },
  info:    { border: 'border-l-sky-500',     bg: 'bg-sky-500/5' },
  process: { border: 'border-l-primary',     bg: 'bg-primary/5' },
  payment: { border: 'border-l-emerald-500', bg: 'bg-emerald-500/5' },
};

export default function Suporte() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/cliente/login'); return; }
      setUser(session.user);
      fetchUserProfile(session.user.id);
      fetchMessages(session.user.id);
      fetchNotifications(session.user.id);
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, sess) => {
      if (!sess) navigate('/cliente/login');
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchUserProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', uid).single();
    if (data?.full_name) setUserName(data.full_name.split(' ')[0]);
  };

  const fetchMessages = async (uid: string) => {
    const { data } = await supabase.from('chat_messages').select('*').eq('user_id', uid).order('created_at', { ascending: true });
    const msgs = (data as Message[]) || [];
    setMessages(msgs);
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    setUnreadCount(Math.min(msgs.filter(m => m.role === 'assistant' && m.created_at > dayAgo).length, 9));
  };

  const fetchNotifications = async (uid: string) => {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    const notifs = (data as Notification[]) || [];
    setNotifications(notifs);
    setUnreadNotificationsCount(Math.min(notifs.filter(n => !n.read).length, 9));
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (user) fetchNotifications(user.id);
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    fetchNotifications(user.id);
    toast.success('Todas marcadas como lidas');
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const streamChat = useCallback(async (
    allMessages: { role: string; content: string }[],
    onDelta: (text: string) => void,
    onDone: () => void
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Não autenticado');

    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ messages: allMessages, userName }),
    });
    if (!resp.ok) throw new Error((await resp.json()).error || 'Erro ao conectar com IA');
    if (!resp.body) throw new Error('Sem resposta do servidor');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = ''; let done = false;
    while (!done) {
      const { done: d, value } = await reader.read();
      if (d) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n')) !== -1) {
        let line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (json === '[DONE]') { done = true; break; }
        try {
          const p = JSON.parse(json);
          const c = p.choices?.[0]?.delta?.content as string | undefined;
          if (c) onDelta(c);
        } catch { buf = line + '\n' + buf; break; }
      }
    }
    onDone();
  }, [userName]);

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || !user || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: msg, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setCurrentView('chat');

    try { await supabase.from('chat_messages').insert({ user_id: user.id, role: 'user', content: msg }); } catch {}

    let assistContent = '';
    const assistId = crypto.randomUUID();
    const pending = { current: '' };
    const raf = { current: 0 as number };

    setMessages(prev => [...prev, { id: assistId, role: 'assistant', content: '', created_at: new Date().toISOString() }]);

    const flush = () => {
      raf.current = 0;
      if (!pending.current) return;
      assistContent += pending.current;
      pending.current = '';
      setMessages(prev => prev.map(m => m.id === assistId ? { ...m, content: assistContent } : m));
    };

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: msg });
      await streamChat(history, chunk => {
        pending.current += chunk;
        if (!raf.current) raf.current = requestAnimationFrame(flush);
      }, async () => {
        setLoading(false);
        if (assistContent) {
          try { await supabase.from('chat_messages').insert({ user_id: user.id, role: 'assistant', content: assistContent }); } catch {}
        }
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar mensagem');
      setLoading(false);
      setMessages(prev => prev.filter(m => m.id !== assistId));
    }
  };

  // ── Views ─────────────────────────────────────────────
  const HomeView = () => (
    <div className="flex flex-col h-full">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-t-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-violet-600 to-primary/80" />
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        
        <div className="relative p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-[11px] font-bold">
              <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Online agora
            </div>
            <div className="flex -space-x-2">
              {[avatar1, avatar2, avatar3].map((av, i) => (
                <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1 }}>
                  <Avatar className="w-8 h-8 border-2 border-white/40">
                    <AvatarImage src={av} />
                    <AvatarFallback>W</AvatarFallback>
                  </Avatar>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="text-white/70 text-sm font-medium mb-1">Bem-vindo de volta</p>
            <h2 className="text-white text-2xl font-black leading-tight">
              Olá, {userName || 'Visitante'} 👋
            </h2>
            <p className="text-white/70 text-sm mt-1">Como podemos ajudar você hoje?</p>
          </motion.div>
        </div>

        {/* Stats strip */}
        <div className="relative flex border-t border-white/10">
          {[
            { label: 'Resposta', value: '< 2min' },
            { label: 'Satisfação', value: '99%' },
            { label: 'Suporte', value: '24/7' },
          ].map((s, i) => (
            <div key={i} className={cn('flex-1 py-2.5 text-center', i > 0 && 'border-l border-white/10')}>
              <p className="text-white font-black text-sm">{s.value}</p>
              <p className="text-white/50 text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-background p-4 space-y-4">
        {/* Chat CTA */}
        <motion.button
          onClick={() => setCurrentView('chat')}
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="w-full flex items-center justify-between p-4 rounded-2xl border bg-card hover:bg-accent transition-all group shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm text-foreground">Falar com a Fernanda</p>
              <p className="text-xs text-muted-foreground">IA especialista em marcas no INPI</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-primary">
            <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>

        {/* Quick questions */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Perguntas frequentes
          </p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_QUESTIONS.map((q, i) => (
              <motion.button
                key={q}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                onClick={() => handleSend(q)}
                className="p-3 text-left text-xs bg-card hover:bg-accent rounded-xl border border-border/50 transition-colors leading-relaxed"
              >
                <Zap className="h-3 w-3 text-primary mb-1.5" />
                {q}
              </motion.button>
            ))}
          </div>
        </div>

        {/* External links */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Shield className="h-3 w-3" /> Links úteis
          </p>
          <div className="space-y-2">
            {EXTERNAL_LINKS.map((link, i) => {
              const Icon = link.icon;
              return (
                <motion.a
                  key={link.label}
                  href={link.url} target="_blank" rel="noopener noreferrer"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.07 }}
                  className="flex items-center justify-between p-3.5 rounded-xl border bg-card hover:bg-accent transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{link.label}</span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </motion.a>
              );
            })}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );

  const ChatView = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-card/80 backdrop-blur-sm">
        <div className="relative">
          <Avatar className="w-10 h-10 border border-border/50">
            <AvatarImage src={webmarcasIcon} />
            <AvatarFallback className="bg-primary/10"><Bot className="h-5 w-5 text-primary" /></AvatarFallback>
          </Avatar>
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background"
          />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm">Fernanda – IA WebMarcas</h3>
          <p className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Respondendo em segundos
          </p>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 border border-primary/20">
          <Star className="h-3 w-3 text-primary fill-primary" />
          <span className="text-[10px] font-bold text-primary">4.9</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto bg-muted/20">
        <div className="space-y-3">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-8 gap-3 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 border border-primary/20 flex items-center justify-center">
                <HeadphonesIcon className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h4 className="font-bold mb-1">Olá! Sou a Fernanda da WebMarcas 👋</h4>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Especialista em registro de marcas no INPI. Faça sua pergunta!
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {QUICK_QUESTIONS.slice(0, 3).map(q => (
                  <Button key={q} variant="outline" size="sm" onClick={() => handleSend(q)} className="text-xs h-7">
                    {q}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className={cn('flex gap-2.5', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {msg.role === 'assistant' && (
                  <Avatar className="w-7 h-7 flex-shrink-0 mt-0.5">
                    <AvatarImage src={webmarcasIcon} />
                    <AvatarFallback className="bg-primary/10 text-[10px]">IA</AvatarFallback>
                  </Avatar>
                )}
                <div className={cn(
                  'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-card border border-border/50 rounded-bl-sm text-foreground'
                )}>
                  {msg.content || (loading && i === messages.length - 1 ? (
                    <div className="flex gap-1 py-0.5">
                      {[0, 150, 300].map(d => (
                        <motion.span key={d} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, delay: d / 1000, repeat: Infinity }}
                          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                      ))}
                    </div>
                  ) : '')}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-card/80 backdrop-blur-sm">
        <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Escreva sua pergunta..."
            className="flex-1 rounded-full bg-muted border border-border/50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
          <Button type="submit" disabled={loading || !input.trim()} size="icon"
            className="rounded-full h-9 w-9 bg-primary shadow-lg shrink-0">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </form>
      </div>

      <BottomNav />
    </div>
  );

  const NotificationsView = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card/80 backdrop-blur-sm">
        <div>
          <h3 className="font-bold text-sm">Notificações</h3>
          <p className="text-[11px] text-muted-foreground">
            {unreadNotificationsCount > 0 ? `${unreadNotificationsCount} não lida${unreadNotificationsCount > 1 ? 's' : ''}` : 'Todas lidas'}
          </p>
        </div>
        {unreadNotificationsCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs text-primary">
            Marcar todas
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 bg-background">
        <div className="p-3 space-y-2">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <Bell className="h-7 w-7 text-muted-foreground opacity-40" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma notificação ainda</p>
            </div>
          ) : (
            <AnimatePresence>
              {notifications.map((n, i) => {
                const colors = NOTIF_COLORS[n.type || 'info'] || NOTIF_COLORS.info;
                return (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => { if (!n.read) markAsRead(n.id); if (n.link) navigate(n.link); }}
                    className={cn(
                      'p-3.5 rounded-xl border cursor-pointer transition-all border-l-[3px]',
                      colors.border, colors.bg,
                      n.read ? 'opacity-70 hover:opacity-90' : 'hover:brightness-105',
                    )}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <NotifIcon type={n.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <h4 className={cn('font-semibold text-xs', !n.read && 'text-foreground')}>{n.title}</h4>
                          {!n.read && <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1.5 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>

      <BottomNav />
    </div>
  );

  const BottomNav = () => (
    <div className="border-t bg-card/90 backdrop-blur-sm p-2 flex gap-1 rounded-b-xl">
      {[
        { view: 'home' as ViewType, icon: Home, label: 'Início', badge: 0 },
        { view: 'chat' as ViewType, icon: MessageSquare, label: 'Chat', badge: unreadCount },
        { view: 'notifications' as ViewType, icon: Bell, label: 'Avisos', badge: unreadNotificationsCount },
      ].map(({ view, icon: Icon, label, badge }) => (
        <motion.button
          key={view}
          onClick={() => setCurrentView(view)}
          whileTap={{ scale: 0.92 }}
          className={cn(
            'flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-colors relative',
            currentView === view ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          <div className="relative">
            <Icon className="h-5 w-5" />
            {badge > 0 && (
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black"
              >
                {badge}
              </motion.span>
            )}
          </div>
          <span className="text-[10px] font-semibold">{label}</span>
          {currentView === view && (
            <motion.div layoutId="nav-indicator" className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-primary" />
          )}
        </motion.button>
      ))}
    </div>
  );

  const renderView = () => {
    switch (currentView) {
      case 'home':          return <HomeView />;
      case 'chat':          return <ChatView />;
      case 'notifications': return <NotificationsView />;
    }
  };

  return (
    <ClientLayout>
      <div className="max-w-md mx-auto h-[calc(100vh-7rem)]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl shadow-2xl border border-border/50 h-full overflow-hidden flex flex-col"
          style={{ boxShadow: '0 20px 60px -15px hsl(var(--foreground)/0.12)' }}
        >
          {renderView()}
        </motion.div>
      </div>
    </ClientLayout>
  );
}
