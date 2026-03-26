import { forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface VideoCallOverlayProps {
  callActive: boolean;
  callType: 'video' | 'audio';
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  callerName?: string;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
}

export function VideoCallOverlay({
  callActive,
  callType,
  isMuted,
  isCameraOff,
  isScreenSharing,
  localVideoRef,
  remoteVideoRef,
  callerName,
  onEndCall,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
}: VideoCallOverlayProps) {
  if (!callActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
    >
      {/* Remote video (main) */}
      <div className="flex-1 relative flex items-center justify-center">
        {callType === 'video' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
              <Phone className="h-10 w-10 text-primary animate-pulse" />
            </div>
            <p className="text-white text-lg font-medium">{callerName || 'Chamada em andamento...'}</p>
            <p className="text-white/50 text-sm">Chamada de áudio</p>
          </div>
        )}

        {/* Local video (PIP) */}
        {callType === 'video' && (
          <div className="absolute bottom-4 right-4 w-32 h-44 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {isCameraOff && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                <VideoOff className="h-6 w-6 text-white/50" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full transition-all",
            isMuted ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-white/10 text-white hover:bg-white/20"
          )}
          onClick={onToggleMute}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>

        {callType === 'video' && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-14 w-14 rounded-full transition-all",
              isCameraOff ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-white/10 text-white hover:bg-white/20"
            )}
            onClick={onToggleCamera}
          >
            {isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full transition-all",
            isScreenSharing ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30" : "bg-white/10 text-white hover:bg-white/20"
          )}
          onClick={onToggleScreenShare}
        >
          {isScreenSharing ? <MonitorOff className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
        </Button>

        <Button
          size="icon"
          className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg"
          onClick={onEndCall}
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </motion.div>
  );
}

// Incoming call notification
interface IncomingCallProps {
  callerName: string;
  callType: string;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallNotification = forwardRef<HTMLDivElement, IncomingCallProps>(
  function IncomingCallNotification({ callerName, callType, onAccept, onReject }, ref) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: -50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.9 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[340px]"
      >
        <div className="bg-card border shadow-2xl rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center animate-pulse">
              {callType === 'video' ? <Video className="h-6 w-6 text-primary" /> : <Phone className="h-6 w-6 text-primary" />}
            </div>
            <div>
              <p className="font-semibold">{callerName}</p>
              <p className="text-sm text-muted-foreground">
                Chamada de {callType === 'video' ? 'vídeo' : 'áudio'} recebida...
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={onReject} variant="destructive" className="flex-1 rounded-xl">
              <PhoneOff className="h-4 w-4 mr-2" /> Recusar
            </Button>
            <Button onClick={onAccept} className="flex-1 rounded-xl bg-green-600 hover:bg-green-700">
              <Phone className="h-4 w-4 mr-2" /> Atender
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }
);
