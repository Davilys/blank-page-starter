import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { VideoCallOverlay, IncomingCallNotification } from '@/components/chat/VideoCallOverlay';
import { MeetingScheduleDialog } from '@/components/chat/MeetingScheduleDialog';
import { useChat, type Conversation, type ChatMessage } from '@/hooks/useChat';
import { useWebRTC } from '@/hooks/useWebRTC';
import {
  MessageCircle, X, Search, Phone, Video, Calendar, ChevronLeft,
  Users, Minimize2, Maximize2, Monitor, Mail, Clock,
  CreditCard, Edit, MoreVertical, UserCheck, Filter,
  Zap, Shield, Star, Sparkles, ChevronRight, Signal,
  Wifi, MessageSquare, Bot, Globe, Lock, Hash, CheckCircle2,
  TrendingUp, Bell, Settings, Layers, Activity, Radio
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { whatsappBgStyle, whatsappBgDarkStyle } from '@/components/chat/WhatsAppBackground';
import type { User } from '@supabase/supabase-js';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '@/contexts/ThemeContext';

interface ClientProfile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  cpf_cnpj: string | null;
  created_at: string | null;
  assigned_to: string | null;
}

// ──────────────────────────────────────────────────────
// Particle Field
// ──────────────────────────────────────────────────────
function ParticleField({ density = 20 }: { density?: number }) {
  const particles = Array.from({ length: density }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1.5 + Math.random() * 2,
    duration: 7 + Math.random() * 10,
    delay: Math.random() * 8,
    opacity: 0.06 + Math.random() * 0.14,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            background: `radial-gradient(circle, rgba(0,168,132,${p.opacity}) 0%, rgba(59,130,246,${p.opacity * 0.5}) 100%)`,
          }}
          animate={{ y: [0, -25, 0], x: [0, 8, -8, 0], opacity: [p.opacity, p.opacity * 2.5, p.opacity], scale: [1, 1.6, 1] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <motion.div
        className="absolute left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(0,168,132,0.2) 50%, transparent 100%)' }}
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Avatar Orb
// ──────────────────────────────────────────────────────
function ContactOrb({
  initials, isOnline, size = 'md', isActive, isAI
}: { initials: string; isOnline?: boolean; size?: 'sm' | 'md' | 'lg'; isActive?: boolean; isAI?: boolean }) {
  const dim = size === 'sm' ? 'h-9 w-9' : size === 'md' ? 'h-12 w-12' : 'h-16 w-16';
  const text = size === 'sm' ? 'text-[11px]' : size === 'md' ? 'text-sm' : 'text-xl';
  const dot = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';
  return (
    <div className={cn('relative flex-shrink-0', dim)}>
      <motion.div
        className="absolute inset-0 rounded-xl"
        style={{
          background: isAI
            ? 'conic-gradient(from 0deg, #7c3aed, #3b82f6, #06b6d4, #7c3aed)'
            : isActive
              ? 'conic-gradient(from 0deg, #059669, #10b981, #34d399, #059669)'
              : 'none',
        }}
        animate={isActive ? { rotate: 360 } : { rotate: 0 }}
        transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
      />
      <div className={cn(
        'absolute flex items-center justify-center rounded-[10px] font-bold text-white',
        isActive || isAI ? 'inset-[2px]' : 'inset-0',
        isAI
          ? 'bg-gradient-to-br from-violet-600 to-indigo-700'
          : 'bg-gradient-to-br from-emerald-600 to-teal-800',
        text
      )}>
        {isAI ? <Sparkles className="h-4 w-4" /> : initials}
      </div>
      {isOnline && (
        <motion.div
          className={cn('absolute -bottom-0.5 -right-0.5 rounded-full bg-emerald-400 border-2 border-background', dot)}
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Scanning header line
// ──────────────────────────────────────────────────────
function ScanLine({ color = 'emerald' }: { color?: string }) {
  return (
    <motion.div
      className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
      style={{
        background: `linear-gradient(90deg, transparent, rgba(${color === 'emerald' ? '16,185,129' : '139,92,246'},0.6), transparent)`,
      }}
      animate={{ x: ['-100%', '100%'] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
    />
  );
}

// ──────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────
export function AdminChatWidget({ inlineMode = false }: { inlineMode?: boolean }) {
  const location = useLocation();
  const isChatPage = location.pathname === '/admin/chat-ao-vivo';
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [meetingOpen, setMeetingOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [contactProfile, setContactProfile] = useState<ClientProfile | null>(null);
  const [adminProfiles, setAdminProfiles] = useState<Map<string, string>>(new Map());
  const [convFilter, setConvFilter] = useState<'all' | 'unread'>('all');
  const [activeTab, setActiveTab] = useState<'clients' | 'internal'>('clients');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState('');
  const [panelWidth, setPanelWidth] = useState(940);
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const chat = useChat(user);
  const remoteId = chat.activeConversation?.participants?.find(p => p.user_id !== user?.id)?.user_id || null;
  const webrtc = useWebRTC({
    conversationId: chat.activeConversation?.id || null,
    userId: user?.id || null,
    remoteUserId: remoteId,
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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      setUser(session.user);
      const { data: hasAdmin } = await supabase.rpc('has_role', { _user_id: session.user.id, _role: 'admin' });
      setIsAdmin(!!hasAdmin);
      if (hasAdmin) {
        const { data: allClients } = await supabase.from('profiles').select('id, full_name, email, phone, cpf_cnpj, created_at, assigned_to').order('full_name');
        if (allClients) setClients(allClients);
        const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
        if (roles) {
          const { data: adminP } = await supabase.from('profiles').select('id, full_name, email').in('id', roles.map(r => r.user_id));
          if (adminP) {
            const map = new Map<string, string>();
            adminP.forEach(a => map.set(a.id, a.full_name || a.email));
            setAdminProfiles(map);
          }
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const presenceChannel = supabase.channel('online-users-listen', { config: { presence: { key: user.id } } });
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineUsers(new Set<string>(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await presenceChannel.track({ user_id: user.id, online_at: new Date().toISOString() });
      });
    return () => { supabase.removeChannel(presenceChannel); };
  }, [user, isAdmin]);

  useEffect(() => {
    const handleOpenChat = async (e: Event) => {
      const clientId = (e as CustomEvent).detail?.clientId;
      setOpen(true);
      setExpanded(true);
      if (clientId) await chat.openDirectConversation(clientId);
    };
    const handleCloseChat = () => {
      setOpen(false);
      setExpanded(false);
    };
    window.addEventListener('open-admin-chat', handleOpenChat);
    window.addEventListener('close-admin-chat', handleCloseChat);
    return () => {
      window.removeEventListener('open-admin-chat', handleOpenChat);
      window.removeEventListener('close-admin-chat', handleCloseChat);
    };
  }, [chat]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat.messages]);

  useEffect(() => {
    if (!chat.activeConversation || !remoteId) { setContactProfile(null); return; }
    const found = clients.find(c => c.id === remoteId);
    if (found) setContactProfile(found);
  }, [chat.activeConversation, remoteId, clients]);

  const adminUserIds = new Set(adminProfiles.keys());

  const buildUnifiedList = () => {
    const convByUserId = new Map<string, Conversation>();
    chat.conversations.forEach(conv => {
      const otherP = conv.participants?.find(p => p.user_id !== user?.id);
      if (otherP) convByUserId.set(otherP.user_id, conv);
    });
    if (activeTab === 'clients') {
      const allClients = clients
        .filter(c => c.id !== user?.id && !adminUserIds.has(c.id))
        .map(c => ({ client: c, conversation: convByUserId.get(c.id) || null }));
      allClients.sort((a, b) => {
        const aTime = a.conversation?.last_message_at;
        const bTime = b.conversation?.last_message_at;
        if (aTime && !bTime) return -1;
        if (!aTime && bTime) return 1;
        if (aTime && bTime) return new Date(bTime).getTime() - new Date(aTime).getTime();
        return (a.client.full_name || a.client.email).localeCompare(b.client.full_name || b.client.email);
      });
      return allClients;
    } else {
      const adminEntries = Array.from(adminProfiles.entries())
        .filter(([id]) => id !== user?.id)
        .map(([id, name]) => ({
          client: { id, full_name: name, email: '', phone: null, cpf_cnpj: null, created_at: null, assigned_to: null } as ClientProfile,
          conversation: convByUserId.get(id) || null,
        }));
      adminEntries.sort((a, b) => {
        const aTime = a.conversation?.last_message_at;
        const bTime = b.conversation?.last_message_at;
        if (aTime && !bTime) return -1;
        if (!aTime && bTime) return 1;
        if (aTime && bTime) return new Date(bTime).getTime() - new Date(aTime).getTime();
        return (a.client.full_name || '').localeCompare(b.client.full_name || '');
      });
      return adminEntries;
    }
  };

  const unifiedList = buildUnifiedList().filter(item => {
    if (convFilter === 'unread') {
      if (!item.conversation || !(item.conversation.unread_count && item.conversation.unread_count > 0)) return false;
    }
    if (!searchQuery) return true;
    const name = item.client.full_name || item.client.email || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const openChatWith = async (clientId: string) => { await chat.openDirectConversation(clientId); };
  const handleSend = async (content: string) => { await chat.sendMessage(content); };
  const handleFileUpload = async (file: File) => {
    try {
      const fd = await chat.uploadFile(file);
      if (fd) {
        const mt = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'file';
        await chat.sendMessage(file.name, mt, fd);
      }
    } catch { toast.error('Erro ao enviar'); }
  };
  const handleAudioSend = async (file: File) => { await handleFileUpload(file); };

  const otherParticipant = chat.activeConversation?.participants?.find(p => p.user_id !== user?.id);
  const activeName = otherParticipant?.profile?.full_name || otherParticipant?.profile?.email || 'Cliente';
  const activeInitials = activeName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  const unreadTotal = chat.conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
  const isFullView = expanded && open;
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const ts = {
    // Panel
    panelBg: isDark ? 'linear-gradient(160deg,#08080f 0%,#0a0a1a 40%,#060612 100%)' : 'linear-gradient(160deg,#ffffff 0%,#f8fafc 60%,#f1f5f9 100%)',
    panelShadow: isDark ? '0 0 0 1px rgba(16,185,129,0.15),-20px 0 80px -20px rgba(0,0,0,0.8),0 0 60px -20px rgba(16,185,129,0.12)' : '0 0 0 1px rgba(16,185,129,0.25),-20px 0 60px -20px rgba(0,0,0,0.12)',
    // Header
    headerBg: isDark ? 'linear-gradient(135deg,#040d08 0%,#061510 50%,#020a06 100%)' : 'linear-gradient(135deg,#f0fdf4 0%,#dcfce7 50%,#f0fdf4 100%)',
    headerBorder: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.3)',
    titleColor: isDark ? '#ffffff' : '#0f172a',
    headerSubColor: isDark ? 'rgba(52,211,153,0.7)' : 'rgba(5,150,105,0.9)',
    headerBtnColor: isDark ? 'rgba(255,255,255,0.5)' : '#475569',
    headerBtnHoverBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
    // Stats HUD
    statsBg: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.07)',
    statsBorder: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.2)',
    statsTextColor: isDark ? '#86efac' : '#065f46',
    statsIconColor: isDark ? '#34d399' : '#059669',
    // Left panel (contacts)
    leftBorder: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.15)',
    tabBorder: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.15)',
    activeTabBg: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.1)',
    activeTabBorder: isDark ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.3)',
    activeTabColor: isDark ? '#86efac' : '#047857',
    inactiveTabColor: isDark ? 'rgba(255,255,255,0.4)' : '#64748b',
    // Search
    searchBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    searchBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
    searchColor: isDark ? 'rgba(255,255,255,0.85)' : '#1e293b',
    searchPlaceholderColor: isDark ? 'rgba(255,255,255,0.3)' : '#94a3b8',
    searchIconColor: isDark ? 'rgba(255,255,255,0.3)' : '#94a3b8',
    // Contact items
    contactActiveBg: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.08)',
    contactActiveBorder: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.25)',
    contactDefaultBg: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
    contactNameUnread: isDark ? '#ffffff' : '#0f172a',
    contactNameRead: isDark ? 'rgba(255,255,255,0.75)' : '#334155',
    contactPreviewUnread: isDark ? 'rgba(255,255,255,0.65)' : '#475569',
    contactPreviewRead: isDark ? 'rgba(255,255,255,0.3)' : '#94a3b8',
    contactTimeUnread: '#34d399',
    contactTimeRead: isDark ? 'rgba(255,255,255,0.25)' : '#94a3b8',
    // Empty state
    emptyIconBg: isDark ? 'linear-gradient(135deg,rgba(5,150,105,0.2),rgba(16,185,129,0.1))' : 'linear-gradient(135deg,rgba(5,150,105,0.1),rgba(16,185,129,0.05))',
    emptyIconBorder: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)',
    emptyIconShadow: isDark ? '0 0 40px rgba(16,185,129,0.15)' : '0 0 30px rgba(16,185,129,0.08)',
    emptyTitle: isDark ? 'rgba(255,255,255,0.6)' : '#475569',
    emptySub: isDark ? 'rgba(255,255,255,0.25)' : '#64748b',
    chipBg: isDark ? 'rgba(16,185,129,0.07)' : 'rgba(16,185,129,0.07)',
    chipBorder: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.15)',
    chipColor: isDark ? 'rgba(255,255,255,0.35)' : '#475569',
    // Chat area header
    chatHeaderBg: isDark ? 'linear-gradient(135deg,#040d08 0%,#061510 100%)' : 'linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)',
    chatHeaderBorder: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.25)',
    chatNameColor: isDark ? '#ffffff' : '#0f172a',
    chatSubColor: isDark ? 'rgba(52,211,153,0.6)' : 'rgba(5,150,105,0.85)',
    chatBtnBg: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
    chatBtnColor: isDark ? 'rgba(255,255,255,0.4)' : '#475569',
    // Input area
    inputBg: isDark ? 'rgba(4,13,8,0.98)' : 'rgba(248,250,252,0.98)',
    inputBorder: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.2)',
    // Right panel (profile details)
    rightBorderL: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.15)',
    rightBg: isDark ? 'rgba(6,6,18,0.95)' : 'rgba(248,250,252,0.98)',
    rightHeaderBg: isDark ? 'rgba(4,13,8,0.8)' : 'rgba(240,253,244,0.9)',
    rightHeaderBorder: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.15)',
    rightTitle: isDark ? 'rgba(255,255,255,0.6)' : '#475569',
    rightBtnColor: isDark ? 'rgba(255,255,255,0.3)' : '#64748b',
    profileName: isDark ? '#ffffff' : '#0f172a',
    profilePhone: isDark ? 'rgba(255,255,255,0.4)' : '#475569',
    profileDotBorder: isDark ? '#060612' : '#f0fdf4',
    profileSectionBorder: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.12)',
    infoFieldBg: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
    infoFieldBorder: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
    infoLabel: isDark ? 'rgba(255,255,255,0.3)' : '#64748b',
    infoValue: isDark ? 'rgba(255,255,255,0.75)' : '#1e293b',
    assignBg: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.07)',
    assignBorder: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.2)',
    assignLabel: isDark ? 'rgba(255,255,255,0.3)' : '#64748b',
    // No contacts empty
    noContactTitle: isDark ? 'rgba(255,255,255,0.3)' : '#64748b',
    noContactSub: isDark ? 'rgba(255,255,255,0.15)' : '#94a3b8',
  };

  const getDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Hoje';
    if (isYesterday(d)) return 'Ontem';
    return format(d, "EEE, d MMM yyyy", { locale: ptBR });
  };

  const getConvTimeLabel = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return 'ontem';
    return format(d, 'dd/MM', { locale: ptBR });
  };

  const renderMessagesWithDateSeparators = (msgs: ChatMessage[]) => {
    const elements: React.ReactNode[] = [];
    let lastDate = '';
    msgs.forEach((msg) => {
      const dateLabel = getDateLabel(msg.created_at);
      if (dateLabel !== lastDate) {
        lastDate = dateLabel;
        elements.push(
          <div key={`date-${msg.created_at}`} className="flex justify-center my-4">
            <span className="text-[11px] bg-white/80 dark:bg-card/80 text-muted-foreground px-4 py-1.5 rounded-lg shadow-sm font-medium backdrop-blur-sm">
              {dateLabel}
            </span>
          </div>
        );
      }
      elements.push(<ChatMessageBubble key={msg.id} message={msg} isOwnMessage={msg.sender_id === user?.id} />);
    });
    return elements;
  };

  const getLastMsgPreview = (conv: Conversation) => {
    const preview = conv.last_message_preview;
    if (!preview) return 'Sem mensagens';
    if (preview.startsWith('audio-')) return '🎤 Áudio';
    return preview;
  };

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - ev.clientX;
      setPanelWidth(Math.max(420, Math.min(newWidth, window.innerWidth - 100)));
    };
    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  // ── Modo inline: força painel aberto e ocupa o contêiner pai ──
  useEffect(() => {
    if (inlineMode) {
      setOpen(true);
      setExpanded(true);
    }
  }, [inlineMode]);

  if (!isAdmin) return null;

  // ──────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────

  return (
    <>
      {/* ── Chat Panel ───────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, x: inlineMode ? 0 : 60, scale: inlineMode ? 1 : 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: inlineMode ? 0 : 60, scale: inlineMode ? 1 : 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className={cn(
              "flex flex-col overflow-hidden",
              inlineMode
                ? "absolute inset-0"
                : cn(
                    "fixed z-[100]",
                    isFullView
                      ? "top-0 right-0 bottom-0 rounded-l-2xl"
                      : "bottom-6 right-6 w-[440px] h-[600px] rounded-2xl"
                  )
            )}
            style={{
              ...(!inlineMode && isFullView ? { width: panelWidth } : {}),
              background: ts.panelBg,
              boxShadow: inlineMode ? 'none' : ts.panelShadow,
            }}
          >
            {/* Resize handle */}
            {isFullView && (
              <div
                onMouseDown={handleResizeStart}
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 group"
              >
                <motion.div
                  className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-16 rounded-full"
                  style={{ background: 'rgba(16,185,129,0.3)' }}
                  whileHover={{ scaleY: 1.4, background: 'rgba(16,185,129,0.8)' }}
                />
              </div>
            )}

            {/* ── Top Header ──────────────────────────── */}
            <div
              className="flex items-center justify-between px-5 py-3 relative overflow-hidden flex-shrink-0"
              style={{
                background: ts.headerBg,
                borderBottom: `1px solid ${ts.headerBorder}`,
              }}
            >
              <ParticleField density={10} />
              <ScanLine />

              <div className="relative flex items-center gap-3">
                {/* Logo mark */}
                <motion.div
                  className="w-8 h-8 rounded-xl flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    boxShadow: '0 0 16px rgba(16,185,129,0.4)',
                  }}
                  animate={{ boxShadow: ['0 0 16px rgba(16,185,129,0.4)', '0 0 28px rgba(16,185,129,0.7)', '0 0 16px rgba(16,185,129,0.4)'] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  <motion.div
                    className="absolute inset-0"
                    style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                  />
                  <MessageCircle className="h-4 w-4 text-white relative z-10" />
                </motion.div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold tracking-tight" style={{ color: ts.titleColor }}>WebMarcas Inbox</h2>
                    <motion.div
                      className="px-1.5 py-0.5 rounded-full text-[9px] font-bold border"
                      style={{
                        background: 'rgba(16,185,129,0.15)',
                        borderColor: 'rgba(16,185,129,0.3)',
                        color: '#34d399',
                      }}
                    >
                      2026
                    </motion.div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="text-[10px]" style={{ color: ts.headerSubColor }}>{currentTime} · Sistema ativo</span>
                  </div>
                </div>
              </div>

              {/* Stats HUD */}
              {isFullView && (
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
                  {[
                    { icon: Users, label: `${clients.length} clientes` },
                    { icon: MessageSquare, label: `${chat.conversations.length} convs` },
                    { icon: Activity, label: `${onlineUsers.size} online` },
                  ].map(({ icon: Icon, label }, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                      style={{ background: ts.statsBg, border: `1px solid ${ts.statsBorder}` }}>
                      <Icon className="h-3 w-3" style={{ color: ts.statsIconColor }} />
                      <span className="text-[10px] font-medium" style={{ color: ts.statsTextColor }}>{label}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative flex items-center gap-1">
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 rounded-xl transition-colors"
                  style={{ background: ts.headerBtnHoverBg, color: ts.headerBtnColor }}
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 rounded-xl hover:bg-red-500/20 transition-colors"
                  style={{ color: ts.headerBtnColor }}
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* ── Body ──────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">

              {/* ── LEFT: Contact List ─────────────────── */}
              {(isFullView || !chat.activeConversation) && (
                <div className={cn(
                  "flex flex-col overflow-hidden",
                  isFullView ? "w-[300px] shrink-0" : "flex-1"
                )}
                style={{ borderRight: `1px solid ${ts.leftBorder}` }}
                >
                  {/* Tabs */}
                  <div className="px-3 pt-3 pb-2 flex items-center gap-1"
                    style={{ borderBottom: `1px solid ${ts.tabBorder}` }}>
                    {[
                      { key: 'clients', icon: Users, label: 'Clientes' },
                      { key: 'internal', icon: MessageCircle, label: 'Interno' },
                    ].map(({ key, icon: Icon, label }) => (
                      <button
                        key={key}
                        onClick={() => setActiveTab(key as 'clients' | 'internal')}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200"
                        style={activeTab === key ? {
                          background: ts.activeTabBg,
                          border: `1px solid ${ts.activeTabBorder}`,
                          color: ts.activeTabColor,
                        } : { background: 'transparent', border: '1px solid transparent', color: ts.inactiveTabColor }}
                      >
                        <Icon className="h-3 w-3" />
                        {label}
                      </button>
                    ))}
                    <div className="flex-1" />
                    <button
                      onClick={() => setConvFilter(f => f === 'all' ? 'unread' : 'all')}
                      className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all"
                      style={convFilter === 'unread' ? {
                        background: ts.activeTabBg,
                        border: `1px solid ${ts.activeTabBorder}`,
                        color: ts.activeTabColor,
                      } : { background: 'transparent', border: '1px solid transparent', color: ts.inactiveTabColor }}
                    >
                      <Filter className="h-2.5 w-2.5" />
                      {convFilter === 'unread' ? 'Não lidos' : 'Todos'}
                    </button>
                  </div>

                  {/* Search */}
                  <div className="px-3 py-2.5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: ts.searchIconColor }} />
                      <input
                        placeholder="Buscar contato..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full h-9 pl-9 pr-3 text-xs rounded-xl outline-none focus:ring-1 focus:ring-emerald-500/40"
                        style={{
                          background: ts.searchBg,
                          border: `1px solid ${ts.searchBorder}`,
                          color: ts.searchColor,
                        }}
                      />
                    </div>
                  </div>

                  {/* Contact List */}
                  <ScrollArea className="flex-1">
                    <div className="px-2 pb-2 space-y-0.5">
                      {unifiedList.map(({ client, conversation: conv }, idx) => {
                        const name = client.full_name || client.email || 'Cliente';
                        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                        const isActive = conv && chat.activeConversation?.id === conv.id;
                        const preview = conv ? getLastMsgPreview(conv) : 'Toque para iniciar';
                        const hasUnread = conv?.unread_count && conv.unread_count > 0;
                        const isOnline = onlineUsers.has(client.id);

                        return (
                          <motion.button
                            key={client.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03, duration: 0.25 }}
                            whileHover={{ x: 3 }}
                            onClick={() => {
                              if (conv) { chat.setActiveConversation(conv); chat.fetchMessages(conv.id); }
                              else openChatWith(client.id);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200",
                            )}
                            style={isActive ? {
                               background: ts.contactActiveBg,
                               border: `1px solid ${ts.contactActiveBorder}`,
                             } : { background: ts.contactDefaultBg, border: '1px solid transparent' }}
                           >
                             <ContactOrb initials={initials} isOnline={isOnline} isActive={!!isActive} />
                             <div className="flex-1 min-w-0">
                               <div className="flex items-center justify-between gap-1">
                                 <p className="text-sm truncate" style={{
                                   fontWeight: hasUnread ? 700 : 500,
                                   color: hasUnread ? ts.contactNameUnread : ts.contactNameRead,
                                 }}>{name}</p>
                                 <span className="text-[10px] shrink-0 font-medium" style={{
                                   color: hasUnread ? ts.contactTimeUnread : ts.contactTimeRead,
                                 }}>
                                   {conv ? getConvTimeLabel(conv.last_message_at) : ''}
                                 </span>
                               </div>
                               <div className="flex items-center gap-1.5 mt-0.5">
                                 <p className="text-[11px] truncate flex-1" style={{
                                   color: hasUnread ? ts.contactPreviewUnread : ts.contactPreviewRead,
                                   fontWeight: hasUnread ? 500 : 400,
                                 }}>{preview}</p>
                                 {hasUnread && (
                                   <motion.span
                                     initial={{ scale: 0 }}
                                     animate={{ scale: 1 }}
                                     className="min-w-5 h-5 px-1.5 text-[10px] rounded-full flex items-center justify-center font-bold shrink-0 text-white"
                                     style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                                   >
                                     {conv?.unread_count}
                                   </motion.span>
                                 )}
                               </div>
                             </div>
                           </motion.button>
                         );
                       })}

                       {unifiedList.length === 0 && (
                         <motion.div
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           className="p-10 text-center"
                         >
                           <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                             style={{ background: ts.emptyIconBg, border: `1px solid ${ts.emptyIconBorder}` }}>
                             <MessageCircle className="h-7 w-7 text-emerald-500/40" />
                           </div>
                           <p className="text-sm font-medium" style={{ color: ts.noContactTitle }}>Nenhum contato</p>
                           <p className="text-xs mt-1" style={{ color: ts.noContactSub }}>Ajuste o filtro de busca</p>
                         </motion.div>
                       )}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* ── CENTER: Chat Area ──────────────────── */}
              {(isFullView ? true : !!chat.activeConversation) && (
                <div
                  className="flex-1 flex flex-col overflow-hidden min-w-0"
                  style={isDark ? whatsappBgDarkStyle : whatsappBgStyle}
                >
                  {chat.activeConversation ? (
                    <>
                      {/* Chat header premium */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 flex-shrink-0 relative overflow-hidden"
                        style={{
                          background: ts.chatHeaderBg,
                          borderBottom: `1px solid ${ts.chatHeaderBorder}`,
                        }}
                      >
                        <ScanLine />
                        {!isFullView && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 rounded-xl flex-shrink-0 transition-colors"
                            style={{ color: ts.chatBtnColor, background: ts.chatBtnBg }}
                            onClick={() => chat.setActiveConversation(null)}
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </Button>
                        )}
                        <ContactOrb initials={activeInitials} isOnline={true} isActive size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold truncate" style={{ color: ts.chatNameColor }}>{activeName}</p>
                            {activeTab === 'clients' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
                                style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                                Cliente
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <motion.div
                              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            />
                            <p className="text-[11px]" style={{ color: ts.chatSubColor }}>online</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {[
                            { icon: Video, action: () => webrtc.startCall('video'), title: 'Vídeo' },
                            { icon: Phone, action: () => webrtc.startCall('audio'), title: 'Áudio' },
                            { icon: Monitor, action: () => webrtc.toggleScreenShare(), title: 'Tela' },
                            { icon: Calendar, action: () => setMeetingOpen(true), title: 'Reunião' },
                            { icon: MoreVertical, action: () => {}, title: 'Mais' },
                          ].map(({ icon: Icon, action, title }, i) => (
                            <Button
                              key={i}
                              variant="ghost" size="icon"
                              className="h-8 w-8 rounded-xl transition-colors"
                              style={{ color: ts.chatBtnColor, background: ts.chatBtnBg }}
                              onClick={action}
                              title={title}
                            >
                              <Icon className="h-4 w-4" />
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Messages */}
                      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
                        {renderMessagesWithDateSeparators(chat.messages)}
                      </div>

                      {/* Input premium */}
                      <div style={{ borderTop: `1px solid ${ts.inputBorder}`, background: ts.inputBg }}>
                        <ChatInput
                          onSend={handleSend}
                          onFileUpload={handleFileUpload}
                          onAudioSend={handleAudioSend}
                          disabled={chat.sendingMessage}
                          placeholder="✦ Escreva uma mensagem..."
                        />
                      </div>
                    </>
                  ) : (
                    /* Empty state premium */
                    <div className="flex-1 flex items-center justify-center">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-center space-y-4 max-w-xs"
                      >
                        <motion.div
                          animate={{ y: [0, -10, 0] }}
                          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                          className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center"
                          style={{
                            background: ts.emptyIconBg,
                            border: `1px solid ${ts.emptyIconBorder}`,
                            boxShadow: ts.emptyIconShadow,
                          }}
                        >
                          <MessageCircle className="h-9 w-9 text-emerald-400/60" />
                        </motion.div>
                        <div>
                          <p className="font-bold text-base" style={{ color: ts.emptyTitle }}>WebMarcas Inbox</p>
                          <p className="text-sm mt-1" style={{ color: ts.emptySub }}>Selecione um contato para conversar</p>
                        </div>
                        {/* Capability chips */}
                        <div className="flex flex-wrap gap-2 justify-center">
                          {[
                            { icon: Video, label: 'Vídeo' },
                            { icon: Radio, label: 'Áudio' },
                            { icon: Layers, label: 'Arquivos' },
                          ].map(({ icon: Icon, label }, i) => (
                            <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                              style={{ background: ts.chipBg, border: `1px solid ${ts.chipBorder}` }}>
                              <Icon className="h-3 w-3 text-emerald-400/70" />
                              <span className="text-[11px]" style={{ color: ts.chipColor }}>{label}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </div>
                  )}
                </div>
              )}

              {/* ── RIGHT: Contact Details ─────────────── */}
              {isFullView && chat.activeConversation && contactProfile && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-[280px] shrink-0 flex flex-col overflow-y-auto"
                  style={{ borderLeft: `1px solid ${ts.rightBorderL}`, background: ts.rightBg }}
                >
                  {/* Right header */}
                  <div className="px-4 py-3 flex items-center justify-between flex-shrink-0 relative overflow-hidden"
                    style={{ borderBottom: `1px solid ${ts.rightHeaderBorder}`, background: ts.rightHeaderBg }}>
                    <ScanLine />
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: ts.rightTitle }}>Perfil</span>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg transition-colors" style={{ color: ts.rightBtnColor }}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg transition-colors" style={{ color: ts.rightBtnColor }}>
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Avatar & name */}
                  <div className="p-6 text-center"
                    style={{ borderBottom: `1px solid ${ts.profileSectionBorder}` }}>
                    <div className="w-20 h-20 mx-auto mb-4 relative">
                      <motion.div
                        className="absolute inset-0 rounded-2xl"
                        style={{ background: 'conic-gradient(from 0deg, #059669, #10b981, #34d399, #059669)' }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                      />
                      <div className="absolute inset-[2px] rounded-[14px] bg-gradient-to-br from-emerald-700 to-teal-900 flex items-center justify-center">
                        <span className="text-xl font-bold text-white">{activeInitials}</span>
                      </div>
                      <motion.div
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-400"
                        style={{ border: `2px solid ${ts.profileDotBorder}` }}
                        animate={{ scale: [1, 1.4, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                    <p className="font-bold text-sm" style={{ color: ts.profileName }}>{activeName}</p>
                    {contactProfile.phone && (
                      <p className="text-xs mt-1" style={{ color: ts.profilePhone }}>{contactProfile.phone}</p>
                    )}
                    {/* Status pill */}
                    <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      <span className="text-[10px] font-semibold text-emerald-400">Atendimento Aberto</span>
                    </div>
                  </div>

                  {/* Info fields */}
                  <div className="px-4 py-4 space-y-3"
                    style={{ borderBottom: `1px solid ${ts.profileSectionBorder}` }}>
                    {[
                      { icon: Mail, label: 'E-mail', value: contactProfile.email },
                      contactProfile.phone ? { icon: Phone, label: 'Telefone', value: contactProfile.phone } : null,
                      contactProfile.created_at ? { icon: Clock, label: 'Inscrito em', value: format(new Date(contactProfile.created_at), 'dd.MM.yyyy') } : null,
                      contactProfile.cpf_cnpj ? { icon: CreditCard, label: 'CPF/CNPJ', value: contactProfile.cpf_cnpj } : null,
                    ].filter(Boolean).map((field, i) => {
                      const { icon: Icon, label, value } = field!;
                      return (
                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl"
                          style={{ background: ts.infoFieldBg, border: `1px solid ${ts.infoFieldBorder}` }}>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(16,185,129,0.1)' }}>
                            <Icon className="h-3.5 w-3.5 text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: ts.infoLabel }}>{label}</p>
                            <p className="text-xs font-medium truncate" style={{ color: ts.infoValue }}>{value}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Assignment */}
                  <div className="px-4 py-4 space-y-3">
                    {contactProfile.assigned_to && (
                      <div className="p-3 rounded-xl"
                        style={{ background: ts.assignBg, border: `1px solid ${ts.assignBorder}` }}>
                        <p className="text-[9px] uppercase tracking-widest font-semibold mb-1" style={{ color: ts.assignLabel }}>Atribuído a</p>
                        <p className="text-sm font-bold text-emerald-500">
                          {adminProfiles.get(contactProfile.assigned_to) || 'Admin'}
                        </p>
                      </div>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 relative overflow-hidden"
                      style={{
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                        boxShadow: '0 4px 20px rgba(16,185,129,0.3)',
                      }}
                      onClick={async () => {
                        if (!user || !contactProfile) return;
                        await supabase.from('profiles').update({ assigned_to: user.id }).eq('id', contactProfile.id);
                        setContactProfile(prev => prev ? { ...prev, assigned_to: user.id } : null);
                        toast.success('Atribuído a você!');
                      }}
                    >
                      <motion.div
                        className="absolute inset-0"
                        style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)' }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                      />
                      <UserCheck className="h-4 w-4 relative z-10" />
                      <span className="relative z-10">Atribuir a mim</span>
                    </motion.button>
                    {contactProfile.assigned_to && (
                      <button
                        className="w-full text-center py-1.5 text-xs text-red-400/70 hover:text-red-400 transition-colors"
                        onClick={async () => {
                          if (!contactProfile) return;
                          await supabase.from('profiles').update({ assigned_to: null }).eq('id', contactProfile.id);
                          setContactProfile(prev => prev ? { ...prev, assigned_to: null } : null);
                          toast.success('Atribuição removida');
                        }}
                      >
                        Remover atribuição
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video call overlay */}
      <AnimatePresence>
        <VideoCallOverlay
          callActive={webrtc.callActive} callType={webrtc.callType}
          isMuted={webrtc.isMuted} isCameraOff={webrtc.isCameraOff} isScreenSharing={webrtc.isScreenSharing}
          localVideoRef={webrtc.localVideoRef} remoteVideoRef={webrtc.remoteVideoRef}
          callerName={activeName}
          onEndCall={webrtc.endCall} onToggleMute={webrtc.toggleMute}
          onToggleCamera={webrtc.toggleCamera} onToggleScreenShare={webrtc.toggleScreenShare}
        />
        {webrtc.incomingCall && (
          <IncomingCallNotification
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
        isAdmin={true}
      />
    </>
  );
}
