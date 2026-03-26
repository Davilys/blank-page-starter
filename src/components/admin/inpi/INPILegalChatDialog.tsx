import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Send, Paperclip, Mic, Square, Loader2, X, FileText, Scale,
  Sparkles, Shield, BookOpen, Zap, Brain, ChevronDown, Copy,
  RotateCcw, CheckCircle2, AlertCircle, Gavel, TrendingUp,
  AlignLeft, FileSearch, Microscope, ChevronRight, RefreshCw,
  Database, Calendar, Wifi, WifiOff,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fileName?: string;
  fileBase64?: string;
  fileImages?: string[];
  createdAt: Date;
}

interface INPILegalChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PdfProgressStage = 'reading' | 'rendering';

// ── Response level types ──
type ResponseLevel = 'resumida' | 'completa' | 'tecnica';

const RESPONSE_LEVELS: { id: ResponseLevel; label: string; shortLabel: string; icon: React.ElementType; color: string; glow: string; description: string; suffix: string }[] = [
  {
    id: 'resumida',
    label: 'Resumida',
    shortLabel: 'Resumo',
    icon: AlignLeft,
    color: 'text-emerald-400',
    glow: 'shadow-emerald-500/30',
    description: 'Resposta direta e objetiva em até 3 parágrafos',
    suffix: '\n\n⚡ INSTRUÇÃO DE FORMATO: Responda de forma RESUMIDA e objetiva, em no máximo 3 parágrafos. Seja direto ao ponto, sem introduções longas.',
  },
  {
    id: 'completa',
    label: 'Completa',
    shortLabel: 'Completa',
    icon: FileSearch,
    color: 'text-violet-400',
    glow: 'shadow-violet-500/30',
    description: 'Análise detalhada com fundamentos e estratégia',
    suffix: '\n\n📋 INSTRUÇÃO DE FORMATO: Forneça uma análise COMPLETA com: (1) diagnóstico do caso, (2) fundamento legal detalhado, (3) estratégia recomendada, (4) próximos passos práticos.',
  },
  {
    id: 'tecnica',
    label: 'Técnica Avançada',
    shortLabel: 'Técnica',
    icon: Microscope,
    color: 'text-amber-400',
    glow: 'shadow-amber-500/30',
    description: 'Parecer jurídico completo com jurisprudência',
    suffix: '\n\n🔬 INSTRUÇÃO DE FORMATO: Elabore um PARECER JURÍDICO TÉCNICO AVANÇADO contendo: (1) Relatório dos fatos, (2) Enquadramento legal (LPI, Manual INPI, tratados internacionais), (3) Análise jurisprudencial com decisões reais do STJ/TRF-2/TRF-3, (4) Fundamentação doutrinária, (5) Estratégia processual detalhada, (6) Conclusão e recomendações técnicas. Use linguagem jurídica profissional.',
  },
];

async function convertPdfToImages(
  base64Data: string,
  maxPages: number = 3,
  onProgress?: (info: { currentPage: number; totalPages: number; etaSeconds?: number }) => void
): Promise<string[]> {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    const images: string[] = [];
    const pagesToProcess = Math.min(pdf.numPages, maxPages);
    const start = performance.now();
    for (let i = 1; i <= pagesToProcess; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.85));
      const elapsedSec = (performance.now() - start) / 1000;
      const avgPerPage = elapsedSec / i;
      const remainingPages = pagesToProcess - i;
      const etaSeconds = remainingPages > 0 ? Math.max(0, Math.round(avgPerPage * remainingPages)) : 0;
      onProgress?.({ currentPage: i, totalPages: pagesToProcess, etaSeconds });
    }
    return images;
  } catch {
    return [];
  }
}

// Animated orb — Fernanda's avatar
function FernandaOrb({ isTyping }: { isTyping: boolean }) {
  return (
    <div className="relative flex-shrink-0">
      <motion.div
        animate={isTyping ? { scale: [1, 1.08, 1], opacity: [1, 0.85, 1] } : { scale: 1, opacity: 1 }}
        transition={{ repeat: isTyping ? Infinity : 0, duration: 1.4, ease: 'easeInOut' }}
        className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/40 relative overflow-hidden"
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent"
          animate={{ rotate: [0, 360] }}
          transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
        />
        <Scale className="h-4 w-4 text-white relative z-10" />
      </motion.div>
      {/* Status dot */}
      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500 animate-pulse" />
    </div>
  );
}

// Typing dots animation
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-violet-400"
          animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

// Particle background inside dialog
function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-violet-500/10"
          style={{
            width: Math.random() * 60 + 20,
            height: Math.random() * 60 + 20,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            x: [0, (Math.random() - 0.5) * 40],
            y: [0, (Math.random() - 0.5) * 40],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            repeat: Infinity,
            duration: 4 + Math.random() * 4,
            ease: 'easeInOut',
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  );
}

// Capability chips shown in header
const CAPABILITIES = [
  { icon: Shield, label: 'Defesas INPI', color: 'text-violet-400' },
  { icon: BookOpen, label: 'Jurisprudência', color: 'text-blue-400' },
  { icon: Brain, label: 'OCR + IA', color: 'text-emerald-400' },
  { icon: Gavel, label: 'Recursos', color: 'text-amber-400' },
];

// Quick action prompts
const QUICK_ACTIONS = [
  { label: '📋 Analisar indeferimento', prompt: 'Preciso analisar um indeferimento INPI. Como devo proceder com a defesa?' },
  { label: '⚖️ Prazo de recurso', prompt: 'Quais são os prazos para interpor recurso administrativo no INPI?' },
  { label: '🔍 Oposição de terceiro', prompt: 'Recebi uma oposição de terceiro. Quais são meus direitos e como posso me defender?' },
  { label: '✅ Estratégia de registro', prompt: 'Qual a melhor estratégia para registrar uma marca com alto risco de conflito?' },
];

export function INPILegalChatDialog({ open, onOpenChange }: INPILegalChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Olá! Sou **Fernanda**, sua consultora jurídica especialista em **Propriedade Intelectual e Recursos INPI**.

Posso ajudar com:
- 📄 **Análise de documentos** — envie um PDF do INPI para análise instantânea
- ⚖️ **Estratégias de defesa** — indeferimentos, exigências, oposições
- 🔍 **Consulta de jurisprudência** — decisões relevantes do INPI e STJ
- 🎤 **Consulta por voz** — fale sua pergunta diretamente

Como posso ajudar você hoje?`,
      createdAt: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [responseLevel, setResponseLevel] = useState<ResponseLevel>('completa');
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [attachedFile, setAttachedFile] = useState<{ name: string; base64: string; images: string[] } | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{
    stage: PdfProgressStage; progress: number; etaSeconds?: number; detail?: string;
  } | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [knowledgeMeta, setKnowledgeMeta] = useState<{
    lastSync: string | null;
    knowledgeItemsCount: number;
    categoriesSynced: string[];
    syncStatus: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch knowledge base metadata on open
  const fetchKnowledgeMeta = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-inpi-legal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ getMetadata: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setKnowledgeMeta(data);
      }
    } catch { /* silent */ }
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-inpi-knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ manual: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`✅ INPI sincronizado! ${data.created + data.updated} itens atualizados.`);
        await fetchKnowledgeMeta();
      } else {
        toast.error('Erro ao sincronizar dados do INPI');
      }
    } catch {
      toast.error('Erro ao sincronizar dados do INPI');
    } finally {
      setIsSyncing(false);
    }
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open) fetchKnowledgeMeta();
  }, [open, fetchKnowledgeMeta]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    };
  }, []);

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copiado!');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Por favor, selecione um arquivo PDF'); return; }
    setIsProcessingPdf(true);
    setPdfProgress({ stage: 'reading', progress: 0, detail: 'Lendo arquivo...' });
    try {
      const startedAt = performance.now();
      const reader = new FileReader();
      reader.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        const progress = Math.round((evt.loaded / evt.total) * 100);
        const elapsedSec = (performance.now() - startedAt) / 1000;
        const speed = evt.loaded / Math.max(elapsedSec, 0.2);
        const etaSeconds = speed > 0 ? Math.round((evt.total - evt.loaded) / speed) : undefined;
        setPdfProgress({ stage: 'reading', progress, etaSeconds, detail: `Lendo arquivo (${progress}%)` });
      };
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        setPdfProgress({ stage: 'rendering', progress: 0, detail: 'Convertendo páginas para OCR...' });
        const images = await convertPdfToImages(base64, 3, ({ currentPage, totalPages, etaSeconds }) => {
          setPdfProgress({ stage: 'rendering', progress: Math.round((currentPage / totalPages) * 100), etaSeconds, detail: `Convertendo página ${currentPage}/${totalPages}` });
        });
        setAttachedFile({ name: file.name, base64, images });
        toast.success(images.length > 0 ? `PDF pronto: ${images.length} página(s) processada(s)` : 'PDF anexado (sem OCR disponível)');
        setIsProcessingPdf(false);
        setPdfProgress(null);
      };
      reader.onerror = () => { toast.error('Erro ao ler o PDF'); setIsProcessingPdf(false); setPdfProgress(null); };
      reader.readAsDataURL(file);
    } catch { toast.error('Erro ao processar o PDF'); setIsProcessingPdf(false); setPdfProgress(null); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = () => setAttachedFile(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/ogg';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
        setRecordingTime(0);
        if (audioChunksRef.current.length > 0) await transcribeAndSend(mimeType);
      };
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
      toast.info('🎤 Gravando... Clique no botão para parar');
    } catch { toast.error('Não foi possível acessar o microfone.'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAndSend = async (mimeType: string) => {
    setIsTranscribing(true);
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      });
      reader.readAsDataURL(audioBlob);
      const audioBase64 = await base64Promise;
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ audioBase64, mimeType }),
      });
      if (!response.ok) throw new Error('Erro na transcrição');
      const { text } = await response.json();
      if (text?.trim()) { toast.success('✅ Áudio transcrito!'); setInput(text); setTimeout(() => sendMessageWithText(text), 100); }
      else toast.error('Não foi possível entender o áudio.');
    } catch { toast.error('Erro ao transcrever o áudio'); }
    finally { setIsTranscribing(false); }
  };

  const sendMessageWithText = async (text: string) => {
    if (!text.trim() && !attachedFile) return;
    setShowQuickActions(false);
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim() || `Analise este documento: ${attachedFile?.name}`,
      fileName: attachedFile?.name,
      fileBase64: attachedFile?.base64,
      fileImages: attachedFile?.images,
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachedFile(null);
    setIsLoading(true);
    try {
      const level = RESPONSE_LEVELS.find(l => l.id === responseLevel)!;
      // Inject level suffix only into the last (current) user message for the API
      const apiMessages = messages
        .filter(m => !(m.role === 'assistant' && m.id === '1'))
        .concat(userMessage)
        .map((m, idx, arr) => {
          const isLast = idx === arr.length - 1 && m.role === 'user';
          return {
            role: m.role,
            content: isLast ? (m.content + level.suffix) : m.content,
            fileImages: m.fileImages,
            fileBase64: m.fileBase64,
            fileName: m.fileName,
          };
        });
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-inpi-legal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: apiMessages }),
      });
      if (!response.ok) throw new Error('Erro ao conectar com a IA');
      const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '', createdAt: new Date() };
      setMessages(prev => [...prev, assistantMessage]);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullContent = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '' || !line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated.length - 1;
                  if (updated[last]?.role === 'assistant') updated[last] = { ...updated[last], content: fullContent };
                  return updated;
                });
              }
            } catch { textBuffer = line + '\n' + textBuffer; break; }
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Desculpe, ocorreu um erro. Por favor, tente novamente.', createdAt: new Date() }]);
    } finally { setIsLoading(false); }
  };

  const sendMessage = () => sendMessageWithText(input);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const isStreamingLast = isLoading && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content === '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[88vh] flex flex-col p-0 gap-0 border-0 shadow-2xl overflow-hidden rounded-2xl bg-transparent">
        {/* Glassmorphism shell */}
        <div className="relative flex flex-col h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-2xl overflow-hidden border border-white/10">
          <ParticleField />

          {/* ── HEADER ── */}
          <div className="relative z-10 flex-shrink-0 px-5 pt-5 pb-4 border-b border-white/10 bg-gradient-to-r from-violet-950/60 via-slate-900/60 to-indigo-950/60 backdrop-blur-xl">
            {/* Top row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* Animated logo */}
                <motion.div
                  animate={{ boxShadow: ['0 0 20px rgba(139,92,246,0.4)', '0 0 35px rgba(139,92,246,0.7)', '0 0 20px rgba(139,92,246,0.4)'] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                  className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center shadow-xl relative overflow-hidden"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-tr from-white/15 to-transparent"
                    animate={{ rotate: [0, 360] }}
                    transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
                  />
                  <Scale className="h-6 w-6 text-white relative z-10" />
                </motion.div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">Fernanda</h2>
                    <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[10px] h-5 px-2">
                      <Sparkles className="h-2.5 w-2.5 mr-1" />
                      GPT-5 · Elite
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <motion.span
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ repeat: Infinity, duration: 1.8 }}
                      className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                    />
                    <p className="text-[11px] text-slate-400">Consultora Jurídica INPI • Online</p>
                    {knowledgeMeta && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Database className="h-2.5 w-2.5 text-cyan-400" />
                        <span className="text-[10px] text-cyan-400 font-medium">
                          {knowledgeMeta.knowledgeItemsCount} fontes INPI
                        </span>
                        {knowledgeMeta.lastSync && (
                          <span className="text-[10px] text-slate-500">
                            • Sync {new Date(knowledgeMeta.lastSync).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* HUD stats */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="text-center px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest">Msgs</p>
                  <p className="text-sm font-bold text-white">{messages.length}</p>
                </div>
                {/* Dynamic level badge */}
                {(() => {
                  const lvl = RESPONSE_LEVELS.find(l => l.id === responseLevel)!;
                  const Icon = lvl.icon;
                  return (
                    <motion.div
                      key={responseLevel}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border',
                        responseLevel === 'resumida' ? 'bg-emerald-500/10 border-emerald-500/30' :
                        responseLevel === 'completa' ? 'bg-violet-500/10 border-violet-500/20' :
                        'bg-amber-500/10 border-amber-500/30'
                      )}
                    >
                      <Icon className={cn('h-3 w-3', lvl.color)} />
                      <div>
                        <p className={cn('text-[9px] uppercase tracking-widest', lvl.color)}>Resposta</p>
                        <p className={cn('text-xs font-bold', lvl.color)}>{lvl.shortLabel}</p>
                      </div>
                    </motion.div>
                  );
                })()}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  title="Sincronizar dados INPI agora"
                >
                  <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Capability chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {CAPABILITIES.map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-medium">
                  <Icon className={cn('h-3 w-3', color)} />
                  <span className="text-slate-300">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── MESSAGES AREA ── */}
          <ScrollArea className="flex-1 relative z-10">
            <div className="px-5 py-4 space-y-5">

              {/* Quick actions — shown before first user message */}
              <AnimatePresence>
                {showQuickActions && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-2 mb-1"
                  >
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-amber-400" /> Ações Rápidas
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {QUICK_ACTIONS.map((qa) => (
                        <motion.button
                          key={qa.label}
                          whileHover={{ scale: 1.02, y: -1 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { setInput(qa.prompt); textareaRef.current?.focus(); }}
                          className="text-left text-xs p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-violet-500/10 hover:border-violet-500/30 text-slate-300 hover:text-white transition-all"
                        >
                          {qa.label}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              {messages.map((message, idx) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx === 0 ? 0 : 0 }}
                  className={cn('flex gap-3', message.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
                >
                  {/* Avatar */}
                  {message.role === 'assistant' ? (
                    <FernandaOrb isTyping={isStreamingLast && idx === messages.length - 1} />
                  ) : (
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-lg shadow-primary/30">
                      EU
                    </div>
                  )}

                  <div className={cn('flex flex-col gap-1 max-w-[78%]', message.role === 'user' ? 'items-end' : 'items-start')}>
                    {/* File badge */}
                    {message.fileName && (
                      <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1.5 text-[10px] text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-lg"
                      >
                        <FileText className="h-3 w-3" />
                        {message.fileName}
                      </motion.div>
                    )}

                    {/* Bubble */}
                    <motion.div
                      layout
                      className={cn(
                        'relative rounded-2xl px-4 py-3 text-sm shadow-lg group',
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-primary to-primary/80 text-white rounded-tr-sm shadow-primary/30'
                          : 'bg-gradient-to-br from-slate-800 to-slate-800/80 text-slate-100 rounded-tl-sm border border-white/10 shadow-black/30'
                      )}
                    >
                      {/* Streaming glow effect */}
                      {isStreamingLast && idx === messages.length - 1 && (
                        <motion.div
                          className="absolute inset-0 rounded-2xl rounded-tl-sm"
                          animate={{ boxShadow: ['0 0 0px rgba(139,92,246,0)', '0 0 16px rgba(139,92,246,0.5)', '0 0 0px rgba(139,92,246,0)'] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        />
                      )}

                      {/* Content */}
                      {message.content ? (
                        message.role === 'assistant' ? (
                          <div className="prose prose-sm prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-0.5 prose-headings:text-white prose-strong:text-violet-300 prose-code:text-emerald-300 prose-code:bg-black/30 prose-code:rounded prose-code:px-1">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        )
                      ) : isStreamingLast && idx === messages.length - 1 ? (
                        <TypingDots />
                      ) : null}

                      {/* Copy button — appears on hover */}
                      {message.content && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          whileHover={{ opacity: 1 }}
                          className={cn(
                            'absolute opacity-0 group-hover:opacity-100 transition-opacity',
                            message.role === 'user' ? '-left-8 top-2' : '-right-8 top-2'
                          )}
                          onClick={() => copyMessage(message.id, message.content)}
                        >
                          {copiedId === message.id
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            : <Copy className="h-4 w-4 text-slate-500 hover:text-slate-300" />
                          }
                        </motion.button>
                      )}
                    </motion.div>

                    {/* Timestamp */}
                    <span className="text-[9px] text-slate-600 px-1">
                      {message.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator — before assistant starts streaming */}
              <AnimatePresence>
                {isLoading && !isStreamingLast && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-3"
                  >
                    <FernandaOrb isTyping />
                    <div className="rounded-2xl rounded-tl-sm bg-slate-800/80 border border-white/10 shadow-lg">
                      <TypingDots />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* ── INPUT AREA ── */}
          <div className="relative z-10 flex-shrink-0 border-t border-white/10 bg-slate-900/80 backdrop-blur-xl px-4 py-3 space-y-2.5">

            {/* Attached file */}
            <AnimatePresence>
              {attachedFile && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-xl"
                >
                  <FileText className="h-4 w-4 text-violet-400 flex-shrink-0" />
                  <span className="text-xs text-violet-300 flex-1 truncate">
                    {attachedFile.name} · {attachedFile.images.length} página{attachedFile.images.length !== 1 ? 's' : ''}
                  </span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-400 hover:text-white" onClick={removeAttachment}>
                    <X className="h-3 w-3" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* PDF progress */}
            <AnimatePresence>
              {(isProcessingPdf || pdfProgress) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5"
                >
                  <div className="flex items-center gap-2 text-xs text-amber-300">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {pdfProgress?.detail ?? 'Processando PDF...'}
                    {typeof pdfProgress?.etaSeconds === 'number' && ` · ~${formatTime(pdfProgress.etaSeconds)} restante`}
                  </div>
                  <Progress value={pdfProgress?.progress ?? 5} className="h-1" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Transcribing */}
            <AnimatePresence>
              {isTranscribing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-xl text-xs text-violet-300"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Transcrevendo áudio com Whisper...
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── RESPONSE LEVEL PICKER ── */}
            <div className="space-y-1.5">
              {/* Trigger row */}
              <motion.button
                onClick={() => setShowLevelPicker(p => !p)}
                disabled={isLoading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-xs',
                  showLevelPicker
                    ? 'bg-violet-500/15 border-violet-500/40'
                    : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
                )}
              >
                <div className="flex items-center gap-2">
                  {(() => {
                    const lvl = RESPONSE_LEVELS.find(l => l.id === responseLevel)!;
                    const Icon = lvl.icon;
                    return (
                      <>
                        <div className={cn('h-6 w-6 rounded-lg flex items-center justify-center', 
                          responseLevel === 'resumida' ? 'bg-emerald-500/15' :
                          responseLevel === 'completa' ? 'bg-violet-500/15' : 'bg-amber-500/15'
                        )}>
                          <Icon className={cn('h-3.5 w-3.5', lvl.color)} />
                        </div>
                        <div className="text-left">
                          <span className="text-slate-300 font-medium">Resposta: </span>
                          <span className={cn('font-semibold', lvl.color)}>{lvl.label}</span>
                          <span className="text-slate-600 ml-2 text-[10px]">· {lvl.description}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <motion.div animate={{ rotate: showLevelPicker ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                </motion.div>
              </motion.button>

              {/* Expanded level cards */}
              <AnimatePresence>
                {showLevelPicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -4 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {RESPONSE_LEVELS.map((lvl) => {
                        const Icon = lvl.icon;
                        const isActive = responseLevel === lvl.id;
                        return (
                          <motion.button
                            key={lvl.id}
                            onClick={() => { setResponseLevel(lvl.id); setShowLevelPicker(false); }}
                            whileHover={{ scale: 1.03, y: -1 }}
                            whileTap={{ scale: 0.97 }}
                            className={cn(
                              'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center overflow-hidden',
                              isActive
                                ? lvl.id === 'resumida' ? 'bg-emerald-500/15 border-emerald-500/50'
                                  : lvl.id === 'completa' ? 'bg-violet-500/15 border-violet-500/50'
                                  : 'bg-amber-500/15 border-amber-500/50'
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                            )}
                          >
                            {/* Active glow */}
                            {isActive && (
                              <motion.div
                                className="absolute inset-0 rounded-xl"
                                animate={{ opacity: [0.3, 0.6, 0.3] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                style={{
                                  background: lvl.id === 'resumida'
                                    ? 'radial-gradient(circle at center, rgba(16,185,129,0.15) 0%, transparent 70%)'
                                    : lvl.id === 'completa'
                                    ? 'radial-gradient(circle at center, rgba(139,92,246,0.15) 0%, transparent 70%)'
                                    : 'radial-gradient(circle at center, rgba(245,158,11,0.15) 0%, transparent 70%)',
                                }}
                              />
                            )}
                            <div className={cn(
                              'h-8 w-8 rounded-xl flex items-center justify-center relative z-10',
                              lvl.id === 'resumida' ? 'bg-emerald-500/20' :
                              lvl.id === 'completa' ? 'bg-violet-500/20' : 'bg-amber-500/20'
                            )}>
                              <Icon className={cn('h-4 w-4', lvl.color)} />
                            </div>
                            <div className="relative z-10">
                              <p className={cn('text-[11px] font-bold', isActive ? lvl.color : 'text-slate-300')}>{lvl.label}</p>
                              <p className="text-[9px] text-slate-500 leading-tight mt-0.5 hidden sm:block">{lvl.description}</p>
                            </div>
                            {isActive && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className={cn(
                                  'absolute top-1.5 right-1.5 h-3.5 w-3.5 rounded-full flex items-center justify-center',
                                  lvl.id === 'resumida' ? 'bg-emerald-500' :
                                  lvl.id === 'completa' ? 'bg-violet-500' : 'bg-amber-500'
                                )}
                              >
                                <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Main input row */}
            <div className="flex items-end gap-2">
              {/* Hidden file input */}
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />

              {/* PDF button */}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isProcessingPdf || isRecording}
                  className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-violet-500/20 hover:border-violet-500/30"
                  title="Anexar PDF"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </motion.div>

              {/* Mic button */}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost" size="icon"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading || isTranscribing || isProcessingPdf}
                  className={cn(
                    'h-10 w-10 rounded-xl border transition-all',
                    isRecording
                      ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-violet-500/20 hover:border-violet-500/30'
                  )}
                  title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
                >
                  {isRecording ? (
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>
                      <Square className="h-4 w-4" />
                    </motion.div>
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              </motion.div>

              {/* Recording timer */}
              <AnimatePresence>
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl overflow-hidden"
                  >
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="h-2 w-2 rounded-full bg-red-400"
                    />
                    <span className="text-xs text-red-400 font-mono font-semibold whitespace-nowrap">
                      {formatTime(recordingTime)}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Textarea */}
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua consulta jurídica ou envie um PDF…"
                  className="min-h-[44px] max-h-32 resize-none rounded-xl border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:ring-violet-500/50 focus:border-violet-500/40 pr-3 py-3 text-sm"
                  rows={1}
                  disabled={isLoading || isRecording}
                />
              </div>

              {/* Send button */}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={sendMessage}
                  disabled={isLoading || isRecording || isTranscribing || (!input.trim() && !attachedFile)}
                  className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 shadow-lg shadow-violet-500/30 p-0"
                >
                  {isLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />
                  }
                </Button>
              </motion.div>
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] text-slate-600">
                <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[9px]">Enter</kbd> enviar ·{' '}
                <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[9px]">Shift+Enter</kbd> nova linha
              </p>
              <div className="flex items-center gap-1 text-[10px] text-slate-600">
                <AlertCircle className="h-3 w-3 text-amber-500/60" />
                Conteúdo jurídico — revise antes de usar
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
