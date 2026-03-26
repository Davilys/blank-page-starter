import { useState, useRef, useCallback, useEffect, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Send, Paperclip, Mic, X, Loader2, Image, FileText, Film, Smile, Trash2, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (content: string) => void;
  onFileUpload: (file: File) => void;
  onAudioSend?: (file: File) => void;
  disabled?: boolean;
  uploading?: boolean;
  placeholder?: string;
}

// Common emojis grid for quick access
const QUICK_EMOJIS = [
  '😀','😂','😍','🥰','😊','😎','🤔','😢','😡','👍','👎','❤️','🔥','⭐','✅',
  '🎉','💪','🙏','👋','🤝','💯','🚀','📌','📎','💼','📊','📈','🎯','⚡','🏆',
  '😁','😃','😄','😅','🤣','😇','🥲','😋','😜','🤪','😝','🤑','🤗','🤭','🤫',
  '🤩','😤','😠','🥺','😱','😰','🤯','😴','🤮','🤧','😷','🤒','👀','💀','🫡',
];

export const ChatInput = forwardRef<HTMLDivElement, ChatInputProps>(
  ({ onSend, onFileUpload, onAudioSend, disabled, uploading, placeholder = 'Digite uma mensagem...' }, ref) => {
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const insertEmoji = (emoji: string) => {
    setInput(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  const startRecording = useCallback(async () => {
    try {
      // CRITICAL: getUserMedia called directly in click handler for browser gesture policy
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      // Prefer OGG/Opus for better compatibility, fallback to webm then mp4
      const mimeType = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
      
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 100) {
          console.warn('Audio blob too small, discarding');
          return;
        }
        const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: mimeType });
        if (onAudioSend) { onAudioSend(file); } else { onFileUpload(file); }
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };

      recorder.start(1000); // Collect data every second for more reliable chunks
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
    }
  }, [onAudioSend, onFileUpload]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecordingTime(0);
  }, []);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile) { onFileUpload(selectedFile); setSelectedFile(null); return; }
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // Recording UI - WhatsApp style
  if (isRecording) {
    return (
      <div ref={ref} className="border-t bg-[#f0f2f5] dark:bg-[#1f2c33] px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Delete / cancel button */}
          <Button type="button" variant="ghost" size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0 text-[#54656f] dark:text-[#aebac1] hover:text-destructive hover:bg-transparent"
            onClick={cancelRecording}>
            <Trash2 className="h-5 w-5" />
          </Button>

          {/* Waveform area */}
          <div className="flex-1 flex items-center gap-3 bg-white dark:bg-[#2a3942] rounded-lg px-4 py-2.5">
            {/* Red recording dot */}
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
            {/* Timer */}
            <span className="text-sm font-mono text-foreground/80 font-medium flex-shrink-0 min-w-[40px]">{formatTime(recordingTime)}</span>
            {/* Animated waveform bars */}
            <div className="flex-1 flex items-center justify-center gap-[2px] h-[28px] overflow-hidden">
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-[#54656f] dark:bg-[#aebac1]"
                  style={{
                    height: `${Math.max(4, Math.random() * 24)}px`,
                    animation: `waveform ${0.4 + Math.random() * 0.6}s ease-in-out ${Math.random() * 0.5}s infinite alternate`,
                  }}
                />
              ))}
            </div>
            {/* Pause button */}
            <Button type="button" variant="ghost" size="icon"
              className="h-8 w-8 rounded-full flex-shrink-0 text-[#54656f] dark:text-[#aebac1] hover:bg-transparent"
              onClick={stopRecording}>
              <Pause className="h-5 w-5" />
            </Button>
          </div>

          {/* Send button */}
          <Button type="button" size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0 bg-[#00a884] hover:bg-[#008069] text-white shadow-md"
            onClick={stopRecording}>
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="border-t bg-[#f0f2f5] dark:bg-[#1f2c33] px-3 py-2">
      {selectedFile && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-white dark:bg-[#2a3942] rounded-lg">
          {selectedFile.type.startsWith('image/') ? <Image className="h-4 w-4 text-blue-500" /> :
           selectedFile.type.startsWith('video/') ? <Film className="h-4 w-4 text-purple-500" /> :
           <FileText className="h-4 w-4 text-red-500" />}
          <span className="text-xs flex-1 truncate">{selectedFile.name}</span>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setSelectedFile(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept="*" />

        {/* Emoji button */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon"
              className="h-10 w-10 rounded-full flex-shrink-0 text-[#54656f] dark:text-[#aebac1] hover:text-foreground hover:bg-transparent">
              <Smile className="h-6 w-6" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-[320px] p-3 z-[300]">
            <p className="text-xs font-medium text-muted-foreground mb-2">Emojis</p>
            <div className="grid grid-cols-8 gap-1 max-h-[240px] overflow-y-auto">
              {QUICK_EMOJIS.map((emoji, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { insertEmoji(emoji); }}
                  className="text-xl w-8 h-8 flex items-center justify-center hover:bg-muted rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Attach button */}
        <Button type="button" variant="ghost" size="icon"
          className="h-10 w-10 rounded-full flex-shrink-0 text-[#54656f] dark:text-[#aebac1] hover:text-foreground hover:bg-transparent"
          onClick={() => fileInputRef.current?.click()} disabled={disabled || uploading}>
          <Paperclip className="h-6 w-6" />
        </Button>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea ref={textareaRef} value={input} onChange={handleTextareaChange} onKeyDown={handleKeyDown}
            placeholder={placeholder} rows={1}
            className={cn(
              "w-full resize-none rounded-lg bg-white dark:bg-[#2a3942] border-0 px-4 py-2.5 text-sm",
              "focus:outline-none focus:ring-0",
              "placeholder:text-[#667781] dark:placeholder:text-[#8696a0]",
              "max-h-[120px] scrollbar-thin"
            )}
            disabled={disabled || uploading} />
        </div>

        {/* Send / Mic button */}
        {input.trim() || selectedFile ? (
          <Button type="submit" size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0 bg-[#00a884] hover:bg-[#008069] text-white shadow-md"
            disabled={disabled || uploading || (!input.trim() && !selectedFile)}>
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        ) : (
          <Button type="button" size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0 bg-[#00a884] hover:bg-[#008069] text-white shadow-md"
            onClick={startRecording} disabled={disabled || uploading}>
            <Mic className="h-5 w-5" />
          </Button>
        )}
      </form>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';