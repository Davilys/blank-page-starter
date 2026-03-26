import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ClientLayout } from '@/components/cliente/ClientLayout';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { VideoCallOverlay, IncomingCallNotification } from '@/components/chat/VideoCallOverlay';
import { MeetingScheduleDialog } from '@/components/chat/MeetingScheduleDialog';
import { useChat, type ChatMessage } from '@/hooks/useChat';
import { useWebRTC } from '@/hooks/useWebRTC';
import { whatsappBgStyle, whatsappBgDarkStyle } from '@/components/chat/WhatsAppBackground';
import {
  Bot, Phone, Video, Calendar, ArrowLeft, Sparkles, User,
  MessageSquare, MoreVertical, Zap, Shield, Star, Clock,
  ChevronRight, Wifi, Signal, Battery, Globe, Lock,
  FileText, Search, TrendingUp, AlertCircle, CheckCircle2,
  Headphones, Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';
import type { User as SupabaseUser } from '@supabase/supabase-js';

type ChatMode = 'select' | 'ai' | 'human';

// ──────────────────────────────────────────────
// Particle Field
// ──────────────────────────────────────────────
// Partículas fixas para evitar re-render com valores aleatórios diferentes a cada ciclo
const FIXED_PARTICLES = Array.from({ length: 28 }).map((_, i) => ({
  id: i,
  x: (i * 37.3) % 100,
  y: (i * 53.7 + 11) % 100,
  size: 1.5 + (i % 5) * 0.5,
  duration: 6 + (i % 10),
  delay: (i * 0.3) % 8,
  opacity: 0.08 + (i % 4) * 0.04,
}));

function ParticleField() {
  const particles = FIXED_PARTICLES;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, rgba(139,92,246,${p.opacity}) 0%, rgba(59,130,246,${p.opacity * 0.5}) 100%)`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, 10, -10, 0],
            opacity: [p.opacity, p.opacity * 2.5, p.opacity],
            scale: [1, 1.6, 1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
      {/* Scanning line */}
      <motion.div
        className="absolute left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.25) 50%, transparent 100%)' }}
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// AI Avatar / Orb
// ──────────────────────────────────────────────
function FernandaOrb({ isTyping, size = 'lg' }: { isTyping?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-10 w-10' : size === 'md' ? 'h-14 w-14' : 'h-20 w-20';
  const iconDim = size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-6 w-6' : 'h-9 w-9';

  return (
    <motion.div
      className={cn('relative flex-shrink-0', dim)}
      animate={isTyping ? { scale: [1, 1.07, 1] } : { scale: 1 }}
      transition={{ repeat: isTyping ? Infinity : 0, duration: 1.2 }}
    >
      {/* Outer glow ring */}
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{ background: 'conic-gradient(from 0deg, #7c3aed, #3b82f6, #06b6d4, #7c3aed)' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />
      {/* Inner bg */}
      <div
        className={cn(
          'absolute inset-[2px] rounded-[14px] flex items-center justify-center',
          'bg-gradient-to-br from-violet-700 via-purple-600 to-indigo-700'
        )}
      >
        <motion.div
          animate={isTyping ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
          transition={{ repeat: isTyping ? Infinity : 0, duration: 0.8 }}
        >
          <Sparkles className={cn(iconDim, 'text-white drop-shadow-lg')} />
        </motion.div>
      </div>
      {/* Online pulse */}
      <motion.div
        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white"
        animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </motion.div>
  );
}

// ──────────────────────────────────────────────
// Human Agent Avatar
// ──────────────────────────────────────────────
function HumanOrb({ name, size = 'lg' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-10 w-10' : size === 'md' ? 'h-14 w-14' : 'h-20 w-20';
  const iconDim = size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-6 w-6' : 'h-9 w-9';
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <motion.div
      className={cn('relative flex-shrink-0', dim)}
      whileHover={{ scale: 1.05 }}
    >
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{ background: 'conic-gradient(from 0deg, #059669, #10b981, #34d399, #059669)' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
      />
      <div className="absolute inset-[2px] rounded-[14px] bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center">
        {initials ? (
          <span className={cn('font-bold text-white', size === 'lg' ? 'text-2xl' : 'text-sm')}>{initials}</span>
        ) : (
          <User className={cn(iconDim, 'text-white')} />
        )}
      </div>
      <motion.div
        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white"
        animate={{ scale: [1, 1.4, 1] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      />
    </motion.div>
  );
}

// ──────────────────────────────────────────────
// Quick Action Card
// ──────────────────────────────────────────────
function QuickActionCard({
  icon: Icon, label, description, gradient, onClick, delay
}: {
  icon: React.ElementType; label: string; description: string;
  gradient: string; onClick: () => void; delay: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl border border-white/10 relative overflow-hidden group"
      style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}
    >
      <div className={cn('absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300', gradient)} />
      <div className="relative flex items-center gap-3">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', gradient)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/90 truncate">{label}</p>
          <p className="text-[10px] text-white/50 truncate">{description}</p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60 transition-colors flex-shrink-0" />
      </div>
    </motion.button>
  );
}

// ──────────────────────────────────────────────
// Status Bar
// ──────────────────────────────────────────────
function StatusBar({ time }: { time: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-black/20">
      <span className="text-[10px] font-medium text-white/60">{time}</span>
      <div className="flex items-center gap-1.5">
        <Signal className="h-2.5 w-2.5 text-white/60" />
        <Wifi className="h-2.5 w-2.5 text-white/60" />
        <Battery className="h-2.5 w-2.5 text-white/60" />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Typing dots premium
// ──────────────────────────────────────────────
function TypingBubble({ isAI }: { isAI: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex gap-2 items-end"
    >
      <div className={cn(
        'rounded-xl rounded-tl-none px-4 py-3 shadow-lg flex items-center gap-1.5',
        isAI
          ? 'bg-gradient-to-br from-violet-900/80 to-indigo-900/80 border border-violet-500/20 backdrop-blur-sm'
          : 'bg-white/10 backdrop-blur-sm border border-white/10'
      )}>
        {[0, 150, 300].map(delay => (
          <motion.span
            key={delay}
            className={cn('w-2 h-2 rounded-full', isAI ? 'bg-violet-400' : 'bg-emerald-400')}
            animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, delay: delay / 1000, repeat: Infinity }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function ChatSuporte() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userName, setUserName] = useState('');
  const [chatMode, setChatMode] = useState<ChatMode>('select');
  const [assignedAdmin, setAssignedAdmin] = useState<{ id: string; full_name: string | null } | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // AI chat state
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const chat = useChat(user);
  const webrtc = useWebRTC({
    conversationId: chat.activeConversation?.id || null,
    userId: user?.id || null,
    remoteUserId: assignedAdmin?.id || null,
  });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    };
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (!session) { navigate('/cliente/login'); return; }

      setUser(session.user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, assigned_to, created_by')
        .eq('id', session.user.id)
        .single();

      if (!isMounted) return;
      if (profile?.full_name) setUserName(profile.full_name.split(' ')[0]);

      const adminId = profile?.assigned_to || profile?.created_by;
      if (adminId) {
        const { data: admin } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', adminId)
          .single();
        if (!isMounted) return;
        if (admin) setAssignedAdmin(admin);
      }
      if (isMounted) setLoadingAdmin(false);
    };

    init();
    return () => { isMounted = false; };
  }, [navigate]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat.messages, aiMessages]);

  // AI streaming
  const handleAISend = useCallback(async (text: string) => {
    if (!user || aiLoading) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), conversation_id: '', sender_id: user.id, content: text,
      message_type: 'text', file_url: null, file_name: null, file_size: null, file_mime_type: null,
      reply_to_id: null, is_read: true, created_at: new Date().toISOString(), edited_at: null, deleted_at: null,
      sender_profile: { full_name: userName, email: '' },
    };
    setAiMessages(prev => [...prev, userMsg]);
    setAiLoading(true);
    let content = '';
    const assistantId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantId, conversation_id: '', sender_id: null, content: '',
      message_type: 'text', file_url: null, file_name: null, file_size: null, file_mime_type: null,
      reply_to_id: null, is_read: true, created_at: new Date().toISOString(), edited_at: null, deleted_at: null,
    };
    setAiMessages(prev => [...prev, assistantMsg]);
    try {
      const history = [...aiMessages, userMsg].map(m => ({ role: m.sender_id ? 'user' : 'assistant', content: m.content || '' }));
      await chat.streamAIChat(history, (delta) => {
        content += delta;
        setAiMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content } : m));
      }, () => setAiLoading(false));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
      setAiLoading(false);
      setAiMessages(prev => prev.filter(m => m.id !== assistantId));
    }
  }, [user, aiLoading, aiMessages, chat, userName]);

  const handleHumanSend = async (text: string) => {
    if (!assignedAdmin) { toast.error('Nenhum consultor atribuído'); return; }
    let conv = chat.activeConversation;
    if (!conv) {
      conv = await chat.openDirectConversation(assignedAdmin.id);
      if (!conv) { toast.error('Erro ao iniciar conversa'); return; }
    }
    await chat.sendMessage(text);
  };

  const handleFileUpload = async (file: File) => {
    try {
      if (chatMode === 'human' && !chat.activeConversation && assignedAdmin) {
        const conv = await chat.openDirectConversation(assignedAdmin.id);
        if (!conv) { toast.error('Erro ao iniciar conversa'); return; }
      }
      const fileData = await chat.uploadFile(file);
      if (fileData) {
        const mimeType = file.type;
        const msgType = mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('video/') ? 'video' : mimeType.startsWith('audio/') ? 'audio' : 'file';
        await chat.sendMessage(file.name, msgType, fileData);
        toast.success('Arquivo enviado!');
      }
    } catch { toast.error('Erro ao enviar arquivo'); }
  };

  const handleAudioSend = async (file: File) => { await handleFileUpload(file); };

  const startHumanChat = async () => {
    setChatMode('human');
    if (assignedAdmin) await chat.openDirectConversation(assignedAdmin.id);
  };

  const AI_QUICK_ACTIONS = [
    { label: 'Status da minha marca', prompt: 'Qual é o status atual do processo de registro da minha marca?' },
    { label: 'Prazo de análise INPI', prompt: 'Qual é o prazo médio de análise no INPI atualmente em 2026?' },
    { label: 'Proteger em outros países', prompt: 'Como faço para proteger minha marca em outros países?' },
    { label: 'Classes NCL', prompt: 'Como funciona o sistema de classes NCL e qual a certa para minha marca?' },
  ];

  const isDark = document.documentElement.classList.contains('dark');
  const currentMessages = chatMode === 'ai' ? aiMessages : chat.messages;

  // ── Selection Screen ──────────────────────────────────
  const SelectMode = () => (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Deep dark gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #0a0a1a 0%, #0d0d2b 30%, #0f0a1e 60%, #080818 100%)',
        }}
      />
      <ParticleField />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Status bar */}
      <div className="relative z-10">
        <StatusBar time={currentTime} />
      </div>

      {/* Header */}
      <div className="relative z-10 px-6 pt-6 pb-8">
        {/* Top badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 mb-6"
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border border-violet-500/30"
            style={{ background: 'rgba(139,92,246,0.12)', backdropFilter: 'blur(8px)' }}
          >
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-violet-300">WebMarcas · Suporte Premium 2026</span>
          </div>
        </motion.div>

        {/* Welcome text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-3xl font-bold text-white mb-1">
            Olá, <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">{userName || 'visitante'}</span> 👋
          </h1>
          <p className="text-white/50 text-sm">Como posso te ajudar hoje?</p>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="flex gap-3 mt-5"
        >
          {[
            { icon: Clock, label: 'Resposta em', value: '< 30s' },
            { icon: CheckCircle2, label: 'Satisfação', value: '99.2%' },
            { icon: Globe, label: 'Disponível', value: '24 / 7' },
          ].map(({ icon: Icon, label, value }, i) => (
            <div
              key={i}
              className="flex-1 rounded-xl p-2.5 border border-white/8 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)' }}
            >
              <Icon className="h-3.5 w-3.5 text-violet-400 mx-auto mb-1" />
              <p className="text-[9px] text-white/40 leading-none mb-0.5">{label}</p>
              <p className="text-xs font-bold text-white">{value}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Channel cards */}
      <div className="relative z-10 flex-1 px-5 space-y-3 overflow-y-auto pb-4">
        {/* Fernanda IA */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 300 }}
          whileHover={{ scale: 1.02, x: 4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setChatMode('ai')}
          className="w-full text-left rounded-2xl p-4 border border-violet-500/25 relative overflow-hidden group"
          style={{ background: 'rgba(139,92,246,0.1)', backdropFilter: 'blur(16px)' }}
        >
          {/* Hover glow */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
            style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />

          <div className="relative flex items-center gap-4">
            <FernandaOrb size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-bold text-white text-sm">Fernanda IA</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  GPT-5 · Elite
                </span>
              </div>
              <p className="text-xs text-white/50">Especialista em marcas · Resposta instantânea 24/7</p>
              <div className="flex items-center gap-3 mt-2">
                {[Zap, Shield, Star].map((Icon, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Icon className="h-3 w-3 text-violet-400" />
                    <span className="text-[10px] text-white/40">{['Rápida', 'Segura', 'Premium'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <motion.div
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <ChevronRight className="h-5 w-5 text-violet-400/60" />
            </motion.div>
          </div>
        </motion.button>

        {/* Human consultant */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 300 }}
          whileHover={{ scale: assignedAdmin ? 1.02 : 1, x: assignedAdmin ? 4 : 0 }}
          whileTap={{ scale: assignedAdmin ? 0.98 : 1 }}
          onClick={assignedAdmin ? startHumanChat : undefined}
          disabled={loadingAdmin || !assignedAdmin}
          className="w-full text-left rounded-2xl p-4 border border-emerald-500/25 relative overflow-hidden group disabled:cursor-not-allowed"
          style={{ background: 'rgba(16,185,129,0.08)', backdropFilter: 'blur(16px)' }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
            style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(16,185,129,0.12) 0%, transparent 70%)' }} />

          <div className="relative flex items-center gap-4">
            {loadingAdmin ? (
              <div className="h-14 w-14 flex-shrink-0 rounded-2xl overflow-hidden">
                <Skeleton className="h-full w-full bg-white/10" />
              </div>
            ) : (
              <HumanOrb name={assignedAdmin?.full_name || 'Consultor'} size="md" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {loadingAdmin ? (
                  <Skeleton className="h-4 w-32 bg-white/10 rounded" />
                ) : (
                  <>
                    <p className="font-bold text-white text-sm">
                      {assignedAdmin?.full_name || 'Sem consultor atribuído'}
                    </p>
                    {assignedAdmin && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Online
                      </span>
                    )}
                  </>
                )}
              </div>
              {loadingAdmin ? (
                <Skeleton className="h-3 w-48 bg-white/10 rounded mt-1" />
              ) : (
                <p className="text-xs text-white/50">
                  {assignedAdmin
                    ? 'Consultor especializado · Atendimento personalizado'
                    : 'Nenhum consultor foi atribuído ainda'}
                </p>
              )}
              {!loadingAdmin && (
                <div className="flex items-center gap-3 mt-2">
                  {[Headphones, Lock, Hash].map((Icon, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <Icon className="h-3 w-3 text-emerald-400" />
                      <span className="text-[10px] text-white/40">{['Ao vivo', 'Privado', 'Direto'][i]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!loadingAdmin && assignedAdmin && (
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 2.3, repeat: Infinity }}
              >
                <ChevronRight className="h-5 w-5 text-emerald-400/60" />
              </motion.div>
            )}
          </div>
        </motion.button>

        {/* Schedule meeting */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, type: 'spring', stiffness: 300 }}
          whileHover={{ scale: 1.02, x: 4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setMeetingOpen(true)}
          className="w-full text-left rounded-2xl p-4 border border-blue-500/25 relative overflow-hidden group"
          style={{ background: 'rgba(59,130,246,0.08)', backdropFilter: 'blur(16px)' }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
            style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.12) 0%, transparent 70%)' }} />

          <div className="relative flex items-center gap-4">
            <div className="h-14 w-14 flex-shrink-0 relative">
              <motion.div
                className="absolute inset-0 rounded-2xl"
                style={{ background: 'conic-gradient(from 0deg, #1d4ed8, #3b82f6, #60a5fa, #1d4ed8)' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              />
              <div className="absolute inset-[2px] rounded-[14px] bg-gradient-to-br from-blue-700 to-indigo-800 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm mb-0.5">Agendar Reunião</p>
              <p className="text-xs text-white/50">Vídeo ou áudio com seu consultor</p>
              <div className="flex items-center gap-3 mt-2">
                {[Video, Phone, Star].map((Icon, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Icon className="h-3 w-3 text-blue-400" />
                    <span className="text-[10px] text-white/40">{['Vídeo', 'Áudio', 'Premium'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-blue-400/60" />
          </div>
        </motion.button>

        {/* Quick actions for AI */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72 }}
          className="pt-1"
        >
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2 px-1">
            Perguntas frequentes
          </p>
          <div className="grid grid-cols-2 gap-2">
            {AI_QUICK_ACTIONS.map((action, i) => (
              <QuickActionCard
                key={i}
                icon={[FileText, TrendingUp, Globe, AlertCircle][i]}
                label={action.label}
                description="Pergunte à Fernanda"
                gradient={['bg-violet-600/80', 'bg-cyan-600/80', 'bg-emerald-600/80', 'bg-amber-600/80'][i]}
                onClick={() => { setChatMode('ai'); setTimeout(() => handleAISend(action.prompt), 200); }}
                delay={0.75 + i * 0.06}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );

  // ── Chat Header ───────────────────────────────
  const renderChatHeader = ({
    title, subtitle, onBack, isAI
  }: { title: string; subtitle: string; onBack: () => void; isAI?: boolean }) => (
    <div
      className="flex items-center gap-3 px-4 py-3 relative overflow-hidden"
      style={{
        background: isAI
          ? 'linear-gradient(135deg, #1a0533 0%, #0d1a3a 50%, #0a1020 100%)'
          : 'linear-gradient(135deg, #003322 0%, #004d2e 50%, #002a1a 100%)',
        borderBottom: `1px solid ${isAI ? 'rgba(139,92,246,0.2)' : 'rgba(16,185,129,0.2)'}`,
      }}
    >
      {/* Subtle animated bg line */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: isAI
            ? 'linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(16,185,129,0.6), transparent)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />

      <Button
        variant="ghost" size="icon"
        className="h-8 w-8 rounded-full text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0"
        onClick={onBack}
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      {isAI ? <FernandaOrb size="sm" isTyping={aiLoading} /> : <HumanOrb name={title} size="sm" />}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-white text-sm truncate">{title}</p>
          {isAI && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30 flex-shrink-0">
              GPT-5
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <p className="text-[11px] text-white/50">{subtitle}</p>
        </div>
      </div>

      {!isAI && (
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10" onClick={() => webrtc.startCall('video')}>
            <Video className="h-4.5 w-4.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10" onClick={() => webrtc.startCall('audio')}>
            <Phone className="h-4.5 w-4.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10">
            <MoreVertical className="h-4.5 w-4.5" />
          </Button>
        </div>
      )}
    </div>
  );

  // ── Empty State ───────────────────────────────
  const EmptyState = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 }}
      className="flex flex-col items-center justify-center h-full gap-4 py-16"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className={cn(
          'w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl',
          chatMode === 'ai'
            ? 'bg-gradient-to-br from-violet-600 to-indigo-700 shadow-violet-500/30'
            : 'bg-gradient-to-br from-emerald-600 to-teal-700 shadow-emerald-500/30'
        )}
      >
        {chatMode === 'ai'
          ? <Sparkles className="h-9 w-9 text-white" />
          : <MessageSquare className="h-9 w-9 text-white" />}
      </motion.div>
      <div className="text-center">
        <p className="font-semibold text-white/80 text-sm mb-1">
          {chatMode === 'ai' ? 'Fernanda está pronta!' : 'Inicie a conversa'}
        </p>
        <p className="text-xs text-white/40">
          {chatMode === 'ai'
            ? 'Especialista em registro de marcas 24/7'
            : 'Seu consultor responderá em breve'}
        </p>
      </div>
      {chatMode === 'ai' && (
        <div className="flex flex-wrap gap-2 justify-center px-4">
          {AI_QUICK_ACTIONS.slice(0, 2).map((action, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => handleAISend(action.prompt)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-violet-500/30 text-violet-300 hover:bg-violet-500/15 transition-colors"
              style={{ background: 'rgba(139,92,246,0.08)' }}
            >
              {action.label}
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );

  return (
    <ClientLayout>
      <div className="max-w-lg mx-auto h-[calc(100vh-8rem)]">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full overflow-hidden flex flex-col rounded-2xl shadow-2xl relative"
          style={{
            background: 'linear-gradient(135deg, #0a0a1a 0%, #0d0d2b 100%)',
            boxShadow: '0 0 0 1px rgba(139,92,246,0.15), 0 32px 80px -20px rgba(0,0,0,0.8), 0 0 60px -20px rgba(139,92,246,0.15)',
          }}
        >
          <AnimatePresence mode="wait">
            {chatMode === 'select' ? (
              <motion.div
                key="select"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3 }}
                className="flex-1 overflow-hidden"
              >
                <SelectMode />
              </motion.div>
            ) : (
              <motion.div
                key={chatMode}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                {renderChatHeader({
                  title: chatMode === 'ai' ? 'Fernanda IA' : (assignedAdmin?.full_name || 'Consultor'),
                  subtitle: chatMode === 'ai' ? 'IA Especialista · Sempre online' : 'Consultor · Online',
                  onBack: () => setChatMode('select'),
                  isAI: chatMode === 'ai',
                })}

                {/* Messages area */}
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
                  style={isDark ? whatsappBgDarkStyle : whatsappBgStyle}
                >
                  {currentMessages.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <>
                      {currentMessages.map((msg, i) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: i < 5 ? i * 0.04 : 0, duration: 0.25 }}
                        >
                          <ChatMessageBubble
                            message={msg}
                            isOwnMessage={msg.sender_id === user?.id}
                          />
                        </motion.div>
                      ))}
                    </>
                  )}

                  <AnimatePresence>
                    {(aiLoading || chat.sendingMessage) &&
                      currentMessages[currentMessages.length - 1]?.sender_id === user?.id && (
                        <TypingBubble key="typing" isAI={chatMode === 'ai'} />
                      )}
                  </AnimatePresence>
                </div>

                {/* Input area with dark premium style */}
                <div
                  className="border-t"
                  style={{
                    borderColor: chatMode === 'ai' ? 'rgba(139,92,246,0.2)' : 'rgba(16,185,129,0.2)',
                    background: 'linear-gradient(180deg, rgba(10,10,26,0.95) 0%, rgba(8,8,20,1) 100%)',
                  }}
                >
                  <ChatInput
                    onSend={chatMode === 'ai' ? handleAISend : handleHumanSend}
                    onFileUpload={handleFileUpload}
                    onAudioSend={handleAudioSend}
                    disabled={chatMode === 'ai' ? aiLoading : chat.sendingMessage}
                    placeholder={chatMode === 'ai' ? '✦ Pergunte à Fernanda...' : 'Digite uma mensagem...'}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {webrtc.callActive && (
        <VideoCallOverlay
          callActive={webrtc.callActive}
          callType={webrtc.callType}
          isMuted={webrtc.isMuted}
          isCameraOff={webrtc.isCameraOff}
          isScreenSharing={webrtc.isScreenSharing}
          localVideoRef={webrtc.localVideoRef}
          remoteVideoRef={webrtc.remoteVideoRef}
          callerName={assignedAdmin?.full_name || ''}
          onEndCall={webrtc.endCall}
          onToggleMute={webrtc.toggleMute}
          onToggleCamera={webrtc.toggleCamera}
          onToggleScreenShare={webrtc.toggleScreenShare}
        />
      )}

      <AnimatePresence>
        {webrtc.incomingCall && (
          <IncomingCallNotification
            key="incoming-call"
            callerName={webrtc.incomingCall.callerName || ''}
            callType={webrtc.incomingCall.callType}
            onAccept={webrtc.acceptCall}
            onReject={webrtc.rejectCall}
          />
        )}
      </AnimatePresence>

      <MeetingScheduleDialog
        open={meetingOpen}
        onOpenChange={setMeetingOpen}
        conversationId={chat.activeConversation?.id}
        currentUserId={user?.id}
        participants={chat.activeConversation?.participants}
        isAdmin={false}
        assignedAdmin={assignedAdmin}
      />
    </ClientLayout>
  );
}
