import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseWebRTCProps {
  conversationId: string | null;
  userId: string | null;
  remoteUserId: string | null;
}

export function useWebRTC({ conversationId, userId, remoteUserId }: UseWebRTCProps) {
  const [callActive, setCallActive] = useState(false);
  const [callType, setCallType] = useState<'video' | 'audio'>('video');
  const [incomingCall, setIncomingCall] = useState<{ callerId: string; callType: string; callerName?: string } | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const iceCandidatesBuffer = useRef<RTCIceCandidateInit[]>([]);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    });

    pc.onicecandidate = async (event) => {
      if (event.candidate && conversationId && userId) {
        await (supabase.from('call_signals') as any).insert({
          conversation_id: conversationId,
          caller_id: userId,
          receiver_id: remoteUserId,
          signal_type: 'ice_candidate',
          signal_data: { candidate: event.candidate.toJSON() },
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed') {
        console.warn('[WebRTC] Connection failed, attempting ICE restart...');
        pc.restartIce();
      } else if (pc.connectionState === 'disconnected') {
        // Give 5s grace period before ending call (network blip recovery)
        setTimeout(() => {
          if (pcRef.current?.connectionState === 'disconnected') {
            console.warn('[WebRTC] Still disconnected after 5s, ending call');
            endCall();
          }
        }, 5000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', pc.iceConnectionState);
    };

    pcRef.current = pc;
    return pc;
  }, [conversationId, userId, remoteUserId]);

  const startCall = useCallback(async (type: 'video' | 'audio') => {
    if (!conversationId || !userId) return;
    setCallType(type);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: type === 'video',
          audio: true,
        });
      } catch (mediaErr: any) {
        if (type === 'video' && (mediaErr.name === 'NotFoundError' || mediaErr.name === 'NotAllowedError')) {
          toast.error('Câmera não encontrada. Tentando apenas áudio...');
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setCallType('audio');
          } catch {
            toast.error('Nenhum dispositivo de mídia encontrado.');
            return;
          }
        } else {
          toast.error(mediaErr.name === 'NotFoundError' ? 'Microfone não encontrado.' : 'Permissão de mídia negada.');
          return;
        }
      }

      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      await (supabase.from('call_signals') as any).insert({
        conversation_id: conversationId,
        caller_id: userId,
        receiver_id: remoteUserId,
        signal_type: 'call_start',
        call_type: type,
        signal_data: {},
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await (supabase.from('call_signals') as any).insert({
        conversation_id: conversationId,
        caller_id: userId,
        receiver_id: remoteUserId,
        signal_type: 'offer',
        signal_data: { sdp: offer },
        call_type: type,
      });

      setCallActive(true);
      toast.success(`Chamada de ${type === 'video' ? 'vídeo' : 'áudio'} iniciada`);

      // 30s timeout if no answer
      callTimeoutRef.current = setTimeout(() => {
        if (!pcRef.current?.remoteDescription) {
          toast.error('Chamada não atendida (tempo expirado)');
          endCall();
        }
      }, 30000);
    } catch (err) {
      console.error('Error starting call:', err);
      toast.error('Erro ao iniciar chamada.');
    }
  }, [conversationId, userId, remoteUserId, createPeerConnection]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !conversationId || !userId) return;

    try {
      const type = (incomingCall.callType as 'video' | 'audio') || 'video';
      setCallType(type);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      // Get the offer
      const { data: offerSignals } = await supabase
        .from('call_signals')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('caller_id', incomingCall.callerId)
        .eq('signal_type', 'offer')
        .eq('processed', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (offerSignals?.[0]) {
        const offerData = offerSignals[0].signal_data as any;
        await pc.setRemoteDescription(new RTCSessionDescription(offerData.sdp));

        // Apply buffered ICE candidates
        for (const c of iceCandidatesBuffer.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        iceCandidatesBuffer.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await (supabase.from('call_signals') as any).insert({
          conversation_id: conversationId,
          caller_id: userId,
          receiver_id: incomingCall.callerId,
          signal_type: 'answer',
          signal_data: { sdp: answer },
        });

        // Mark offer as processed
        await supabase.from('call_signals')
          .update({ processed: true })
          .eq('id', offerSignals[0].id);
      }

      setCallActive(true);
      setIncomingCall(null);
      // Clear any timeout from caller side
      if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
    } catch (err) {
      console.error('Error accepting call:', err);
    }
  }, [incomingCall, conversationId, userId, createPeerConnection]);

  const endCall = useCallback(async () => {
    if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
    screenStreamRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    if (conversationId && userId) {
      await (supabase.from('call_signals') as any).insert({
        conversation_id: conversationId,
        caller_id: userId,
        receiver_id: remoteUserId,
        signal_type: 'call_end',
        signal_data: {},
      });
    }

    setCallActive(false);
    setIsScreenSharing(false);
    setIncomingCall(null);
    setIsMuted(false);
    setIsCameraOff(false);
  }, [conversationId, userId, remoteUserId]);

  const rejectCall = useCallback(async () => {
    if (!conversationId || !userId || !incomingCall) return;
    await (supabase.from('call_signals') as any).insert({
      conversation_id: conversationId,
      caller_id: userId,
      receiver_id: incomingCall.callerId,
      signal_type: 'call_reject',
      signal_data: {},
    });
    setIncomingCall(null);
  }, [conversationId, userId, incomingCall]);

  const toggleScreenShare = useCallback(async () => {
    // If no active call, start a screen share call
    if (!pcRef.current || !localStreamRef.current) {
      if (!conversationId || !userId) return;
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true } as any);
        screenStreamRef.current = screenStream;
        setCallType('video');

        // Also get audio mic
        let audioStream: MediaStream | null = null;
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch { /* no mic is ok */ }

        // Combine screen video + mic audio
        const combinedStream = new MediaStream();
        screenStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
        if (audioStream) {
          audioStream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
        } else {
          screenStream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
        }

        localStreamRef.current = audioStream || new MediaStream();
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;

        const pc = createPeerConnection();
        combinedStream.getTracks().forEach(t => pc.addTrack(t, combinedStream));

        await (supabase.from('call_signals') as any).insert({
          conversation_id: conversationId,
          caller_id: userId,
          receiver_id: remoteUserId,
          signal_type: 'call_start',
          call_type: 'video',
          signal_data: {},
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await (supabase.from('call_signals') as any).insert({
          conversation_id: conversationId,
          caller_id: userId,
          receiver_id: remoteUserId,
          signal_type: 'offer',
          signal_data: { sdp: offer },
          call_type: 'video',
        });

        screenStream.getVideoTracks()[0].onended = () => {
          endCall();
        };

        setCallActive(true);
        setIsScreenSharing(true);
        toast.success('Compartilhamento de tela iniciado');
      } catch (err: any) {
        if (err?.name !== 'NotAllowedError') {
          console.error('Error starting screen share:', err);
          toast.error('Erro ao compartilhar tela.');
        }
      }
      return;
    }

    // Toggle during active call
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(videoTrack);
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true } as any);
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(screenTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        screenTrack.onended = () => toggleScreenShare();
        setIsScreenSharing(true);
        toast.success('Compartilhando tela');
      } catch (err: any) {
        if (err?.name !== 'NotAllowedError') {
          toast.error('Erro ao compartilhar tela.');
        }
      }
    }
  }, [isScreenSharing, conversationId, userId, remoteUserId, createPeerConnection, endCall]);

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(prev => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCameraOff(prev => !prev);
  }, []);

  // Listen for incoming signals
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`calls-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'call_signals',
        filter: `receiver_id=eq.${userId}`,
      }, async (payload) => {
        const signal = payload.new as any;
        if (signal.processed) return;

        switch (signal.signal_type) {
          case 'call_start':
            // Get caller name
            const { data: callerProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', signal.caller_id)
              .single();
            setIncomingCall({
              callerId: signal.caller_id,
              callType: signal.call_type || 'video',
              callerName: callerProfile?.full_name || 'Desconhecido',
            });
            break;

          case 'answer':
            if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
            if (pcRef.current) {
              const answerData = signal.signal_data as any;
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(answerData.sdp));
              for (const c of iceCandidatesBuffer.current) {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
              }
              iceCandidatesBuffer.current = [];
            }
            await supabase.from('call_signals').update({ processed: true }).eq('id', signal.id);
            break;

          case 'ice_candidate':
            const candidateData = signal.signal_data as any;
            if (pcRef.current?.remoteDescription) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidateData.candidate));
            } else {
              iceCandidatesBuffer.current.push(candidateData.candidate);
            }
            await supabase.from('call_signals').update({ processed: true }).eq('id', signal.id);
            break;

          case 'call_end':
          case 'call_reject':
            endCall();
            break;
        }
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [userId, endCall]);

  // Auto-reject incoming call after 30s
  useEffect(() => {
    if (!incomingCall) return;
    const timer = setTimeout(() => {
      toast.error('Chamada não atendida (tempo expirado)');
      rejectCall();
    }, 30000);
    return () => clearTimeout(timer);
  }, [incomingCall, rejectCall]);

  return {
    callActive,
    callType,
    incomingCall,
    isScreenSharing,
    isMuted,
    isCameraOff,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    endCall,
    rejectCall,
    toggleScreenShare,
    toggleMute,
    toggleCamera,
  };
}
