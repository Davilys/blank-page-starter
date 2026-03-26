import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Play, Pause } from 'lucide-react';

interface WhatsAppAudioPlayerProps {
  src: string;
  isOwn: boolean;
}

export function WhatsAppAudioPlayer({ src, isOwn }: WhatsAppAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Generate pseudo-random waveform bars (deterministic per src)
  const waveformBars = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < src.length; i++) seed = ((seed << 5) - seed + src.charCodeAt(i)) | 0;
    const bars: number[] = [];
    for (let i = 0; i < 36; i++) {
      seed = (seed * 16807 + 0) % 2147483647;
      const h = 4 + (Math.abs(seed) % 24);
      bars.push(h);
    }
    return bars;
  }, [src]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.preload = 'metadata';

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => { if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration); };
    const onEnded = () => setPlaying(false);
    const onError = () => {
      if (!audio.src.startsWith('blob:')) {
        fetch(src)
          .then(r => r.arrayBuffer())
          .then(buf => {
            const blob = new Blob([buf], { type: 'audio/webm;codecs=opus' });
            audio.src = URL.createObjectURL(blob);
            audio.load();
          })
          .catch(e => console.error('Audio fallback failed:', e));
      }
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.src = src;
    audio.load();

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
      audio.src = '';
      audioRef.current = null;
    };
  }, [src]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      if (playing) { a.pause(); setPlaying(false); }
      else { await a.play(); setPlaying(true); }
    } catch { setPlaying(false); }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const idx = speeds.indexOf(playbackRate);
    const next = speeds[(idx + 1) % speeds.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const seekByClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const t = pct * duration;
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const playedBars = Math.floor(progress * waveformBars.length);

  return (
    <div className="flex items-center gap-2 min-w-[240px] max-w-[320px]">
      {/* Play/Pause button */}
      <button
        onClick={toggle}
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
          isOwn
            ? "bg-white/20 text-white hover:bg-white/30"
            : "bg-[#00a884]/15 text-[#00a884] hover:bg-[#00a884]/25"
        )}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>

      {/* Waveform + time */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* Waveform bars */}
        <div
          className="flex items-end gap-[1.5px] h-[28px] cursor-pointer"
          onClick={seekByClick}
        >
          {waveformBars.map((h, i) => (
            <div
              key={i}
              className={cn(
                "w-[3px] rounded-full transition-colors duration-150",
                i < playedBars
                  ? isOwn ? "bg-white/80" : "bg-[#00a884]"
                  : isOwn ? "bg-white/30" : "bg-[#00a884]/30"
              )}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>

        {/* Time display */}
        <div className="flex items-center justify-between">
          <span className={cn("text-[11px] font-mono", isOwn ? "text-white/60" : "text-muted-foreground")}>
            {playing ? fmt(currentTime) : fmt(duration)}
          </span>
        </div>
      </div>

      {/* Speed button */}
      <button
        onClick={cycleSpeed}
        className={cn(
          "text-[11px] font-bold shrink-0 w-7 h-5 rounded-full flex items-center justify-center transition-colors",
          isOwn
            ? "bg-white/15 text-white/70 hover:bg-white/25 hover:text-white"
            : "bg-[#00a884]/10 text-muted-foreground hover:text-foreground hover:bg-[#00a884]/20"
        )}
      >
        {playbackRate}×
      </button>
    </div>
  );
}
