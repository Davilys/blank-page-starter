import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'ai_support';
  title: string | null;
  created_by: string | null;
  created_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  participants?: ConversationParticipant[];
  unread_count?: number;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  last_read_at: string | null;
  is_typing: boolean;
  is_online: boolean;
  profile?: { full_name: string | null; email: string };
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string | null;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_mime_type: string | null;
  reply_to_id: string | null;
  is_read: boolean;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  sender_profile?: { full_name: string | null; email: string };
}

const CHAT_SUPPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-support`;

export function useChat(user: User | null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (!participations?.length) { setLoading(false); return; }

      const convIds = participations.map(p => p.conversation_id);
      const { data: convos } = await supabase
        .from('conversations')
        .select('*')
        .in('id', convIds)
        .order('last_message_at', { ascending: false });

      if (convos) {
        // Get participants for each conversation
        const { data: allParticipants } = await supabase
          .from('conversation_participants')
          .select('*')
          .in('conversation_id', convIds);

        const participantUserIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', participantUserIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const enriched = convos.map(c => ({
          ...c,
          type: c.type as 'direct' | 'group' | 'ai_support',
          participants: allParticipants
            ?.filter(p => p.conversation_id === c.id)
            .map(p => ({ ...p, profile: profileMap.get(p.user_id) })) || [],
        }));

        setConversations(enriched);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch messages for active conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    const { data } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (data) {
      const senderIds = [...new Set(data.map(m => m.sender_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', senderIds as string[]);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const enriched = data.map(m => ({
        ...m,
        sender_profile: m.sender_id ? profileMap.get(m.sender_id) : undefined,
      }));

      setMessages(enriched);
    }
  }, []);

  // Subscribe to realtime messages — com deduplicação robusta
  useEffect(() => {
    if (!activeConversation) return;

    let isMounted = true;

    channelRef.current = supabase
      .channel(`conv-${activeConversation.id}-${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_messages',
        filter: `conversation_id=eq.${activeConversation.id}`,
      }, async (payload) => {
        if (!isMounted) return;

        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id?: string })?.id;
          if (oldId) setMessages(prev => prev.filter(m => m.id !== oldId));
          return;
        }

        const newMsg = payload.new as ChatMessage;
        if (!newMsg?.id) return;

        // Busca perfil do remetente
        if (newMsg.sender_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', newMsg.sender_id)
            .single();
          if (isMounted && profile) newMsg.sender_profile = profile;
        }

        // Deduplicação: remove qualquer registro com mesmo id antes de inserir
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== newMsg.id);
          if (payload.eventType === 'UPDATE') {
            return filtered.map(m => m.id === newMsg.id ? newMsg : m).concat(
              filtered.find(m => m.id === newMsg.id) ? [] : [newMsg]
            );
          }
          // INSERT — só adiciona se ainda não existe
          return [...filtered, newMsg].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });

        // Marca como lida
        if (newMsg.sender_id !== user?.id) {
          await supabase.from('conversation_messages')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', newMsg.id);
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      channelRef.current?.unsubscribe();
    };
  }, [activeConversation, user]);

  // Open/create direct conversation
  const openDirectConversation = useCallback(async (otherUserId: string) => {
    if (!user) return null;

    // Find existing direct conversation
    const { data: myParticipations } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (myParticipations) {
      for (const p of myParticipations) {
        const { data: otherP } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('conversation_id', p.conversation_id)
          .eq('user_id', otherUserId);

        if (otherP?.length) {
          const { data: conv } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', p.conversation_id)
            .eq('type', 'direct')
            .single();

          if (conv) {
            // Fetch participants with profiles for this conversation
            const { data: parts } = await supabase
              .from('conversation_participants')
              .select('*')
              .eq('conversation_id', conv.id);

            const partUserIds = [...new Set(parts?.map(p => p.user_id) || [])];
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', partUserIds);

            const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

            const c = {
              ...conv,
              type: conv.type as 'direct' | 'group' | 'ai_support',
              participants: parts?.map(p => ({ ...p, profile: profileMap.get(p.user_id) })) || [],
            };
            setActiveConversation(c);
            await fetchMessages(c.id);
            return c;
          }
        }
      }
    }

    // Create new conversation
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({ type: 'direct', created_by: user.id })
      .select()
      .single();

    if (error || !newConv) return null;

    await supabase.from('conversation_participants').insert([
      { conversation_id: newConv.id, user_id: user.id, role: 'member' },
      { conversation_id: newConv.id, user_id: otherUserId, role: 'member' },
    ]);

    // Fetch profiles for participants
    const { data: participantProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', [user.id, otherUserId]);

    const profileMap = new Map(participantProfiles?.map(p => [p.id, p]) || []);

    const c = {
      ...newConv,
      type: newConv.type as 'direct' | 'group' | 'ai_support',
      participants: [
        { id: '', conversation_id: newConv.id, user_id: user.id, role: 'member', joined_at: new Date().toISOString(), last_read_at: null, is_typing: false, is_online: true, profile: profileMap.get(user.id) },
        { id: '', conversation_id: newConv.id, user_id: otherUserId, role: 'member', joined_at: new Date().toISOString(), last_read_at: null, is_typing: false, is_online: false, profile: profileMap.get(otherUserId) },
      ],
    };
    setActiveConversation(c);
    await fetchMessages(c.id);
    await fetchConversations();
    return c;
  }, [user, fetchMessages, fetchConversations]);

  // Send message
  const sendMessage = useCallback(async (content: string, messageType = 'text', fileData?: { url: string; name: string; size: number; mime: string }) => {
    if (!user || !activeConversation) return;
    setSendingMessage(true);

    try {
      const msgData: any = {
        conversation_id: activeConversation.id,
        sender_id: user.id,
        content,
        message_type: messageType,
      };

      if (fileData) {
        msgData.file_url = fileData.url;
        msgData.file_name = fileData.name;
        msgData.file_size = fileData.size;
        msgData.file_mime_type = fileData.mime;
      }

      await supabase.from('conversation_messages').insert(msgData);

      // Update conversation preview
      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString(),
        last_message_preview: content?.substring(0, 100) || fileData?.name || '',
      }).eq('id', activeConversation.id);

    } finally {
      setSendingMessage(false);
    }
  }, [user, activeConversation]);

  // Stream AI chat
  const streamAIChat = useCallback(async (
    allMessages: { role: string; content: string }[],
    onDelta: (text: string) => void,
    onDone: () => void
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Não autenticado");

    const resp = await fetch(CHAT_SUPPORT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ messages: allMessages, userName: '' }),
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || "Erro ao conectar com a IA");
    }
    if (!resp.body) throw new Error("Sem resposta");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") { onDone(); return; }
        try {
          const c = JSON.parse(json).choices?.[0]?.delta?.content;
          if (c) onDelta(c);
        } catch { buf = line + "\n" + buf; break; }
      }
    }
    onDone();
  }, []);

  // Upload file
  const uploadFile = useCallback(async (file: File): Promise<{ url: string; name: string; size: number; mime: string } | null> => {
    if (!user) return null;

    const ext = file.name.split('.').pop();
    const path = `chat/${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { error } = await supabase.storage.from('documents').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (error) throw error;

    const { data: publicData } = supabase.storage.from('documents').getPublicUrl(path);
    if (!publicData?.publicUrl) throw new Error('Failed to get public URL');

    return { url: publicData.publicUrl, name: file.name, size: file.size, mime: file.type };
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    activeConversation,
    setActiveConversation,
    messages,
    setMessages,
    loading,
    sendingMessage,
    fetchConversations,
    fetchMessages,
    openDirectConversation,
    sendMessage,
    streamAIChat,
    uploadFile,
  };
}
