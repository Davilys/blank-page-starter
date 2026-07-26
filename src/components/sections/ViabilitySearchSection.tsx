import { useState, useEffect } from "react";
import { Search, AlertCircle, CheckCircle, AlertTriangle, ArrowRight, ShieldX, Printer, Shield, Zap, TrendingUp, Globe, Building2, Brain, Clock, Target, BarChart3, Database, Cpu, ScanLine, FileSearch, Lock, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { checkViability, type ViabilityResult } from "@/lib/api/viability";
import { supabase } from "@/integrations/supabase/client";
import webmarcasIcon from "@/assets/webmarcas-icon.webp";

type ViabilityLevel = "high" | "medium" | "low" | "blocked" | null;

const FEATURE_CARDS = [
  { icon: Shield, label: "100% Seguro", sub: "Dados protegidos" },
  { icon: Zap, label: "Tempo Real", sub: "Base oficial INPI" },
  { icon: TrendingUp, label: "Laudo Técnico", sub: "IA especializada" },
];

// ─── Futuristic Search Animation ─────────────────────
function INPISearchAnimation({ brandName }: { brandName: string }) {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [progress, setProgress] = useState(0);

  const phases = [
    { label: "Conectando ao INPI", icon: Globe, detail: "Estabelecendo conexão segura..." },
    { label: "Varrendo base de marcas", icon: Database, detail: "Consultando registros oficiais..." },
    { label: "Buscando CNPJs similares", icon: Building2, detail: "Verificando colidência empresarial..." },
    { label: "Analisando presença web", icon: ScanLine, detail: "Redes sociais e internet..." },
    { label: "Processando com IA jurídica", icon: Cpu, detail: "Gerando laudo especializado..." },
    { label: "Finalizando laudo técnico", icon: FileSearch, detail: "Compilando resultado final..." },
  ];

  useEffect(() => {
    const totalDuration = 5000;
    const phaseInterval = totalDuration / phases.length;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 60;
      setProgress(Math.min((elapsed / totalDuration) * 100, 98));
      setCurrentPhase(Math.min(Math.floor(elapsed / phaseInterval), phases.length - 1));
      if (elapsed >= totalDuration) clearInterval(timer);
    }, 60);
    return () => clearInterval(timer);
  }, []);

  const CurrentIcon = phases[currentPhase].icon;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}
      className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm shadow-md p-8 space-y-8">
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex items-center justify-center w-36 h-36">
          <motion.div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30" animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} />
          <motion.div className="absolute inset-3 rounded-full border border-primary/50" animate={{ rotate: -360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 144 144">
            <circle cx="72" cy="72" r="64" fill="none" stroke="hsl(var(--primary)/0.1)" strokeWidth="4" />
            <motion.circle cx="72" cy="72" r="64" fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 64}`}
              style={{ strokeDashoffset: `${2 * Math.PI * 64 * (1 - progress / 100)}`, filter: "drop-shadow(0 0 6px hsl(var(--primary)/0.8))" }} />
          </svg>
          <motion.div className="absolute inset-6 rounded-full bg-primary/5" animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
          <div className="relative z-10 flex flex-col items-center gap-1">
            <AnimatePresence mode="wait">
              <motion.div key={currentPhase} initial={{ scale: 0.5, opacity: 0, y: 5 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.5, opacity: 0, y: -5 }} transition={{ duration: 0.3 }}>
                <CurrentIcon className="w-8 h-8 text-primary" />
              </motion.div>
            </AnimatePresence>
            <span className="text-xs font-bold text-primary tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Consultando</p>
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <motion.span className="w-1.5 h-1.5 rounded-full bg-primary" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1, repeat: Infinity }} />
            <span className="text-sm font-bold text-primary tracking-wider">{brandName.toUpperCase()}</span>
            <Lock className="w-3 h-3 text-primary/60" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {phases.map((phase, i) => {
          const PhaseIcon = phase.icon;
          const isDone = i < currentPhase;
          const isActive = i === currentPhase;
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: i <= currentPhase ? 1 : 0.3, x: 0 }} transition={{ delay: i * 0.1, duration: 0.3 }}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-500",
                isActive ? "bg-primary/10 border-primary/30" : isDone ? "bg-muted/30 border-border/30" : "bg-muted/10 border-border/10"
              )}>
              <div className={cn("flex items-center justify-center w-7 h-7 rounded-lg shrink-0",
                isActive ? "bg-primary/20" : isDone ? "bg-muted/50" : "bg-muted/20"
              )}>
                {isDone ? <CheckCircle className="w-4 h-4 text-primary" /> : <PhaseIcon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground/40")} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-semibold", isActive ? "text-foreground" : isDone ? "text-muted-foreground" : "text-muted-foreground/40")}>{phase.label}</p>
                {isActive && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-muted-foreground mt-0.5">{phase.detail}</motion.p>}
              </div>
              {isActive && (
                <motion.div className="flex gap-0.5 shrink-0" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                  {[0, 1, 2].map(j => <motion.div key={j} className="w-1 h-1 rounded-full bg-primary" animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: j * 0.15 }} />)}
                </motion.div>
              )}
              {isDone && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-4 h-4 shrink-0"><div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-primary" /></div></motion.div>}
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 pt-2">
        <Lock className="w-3 h-3 text-muted-foreground/50" />
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Conexão criptografada • Base oficial INPI</p>
      </div>
    </motion.div>
  );
}

// ─── Commercial Intelligence Module ─────────────────────
interface CommercialIntelligenceProps {
  classes?: number[];
  businessArea: string;
  inpiTotal?: number;
  cnpjMatches?: { nome: string; cnpj: string; situacao: string }[];
  socialMatches?: { plataforma: string; encontrado: boolean; url?: string }[];
}

function CommercialIntelligenceModule({ classes, businessArea, inpiTotal = 0, cnpjMatches = [], socialMatches = [] }: CommercialIntelligenceProps) {
  // ── Score 1: Potencial de Deferimento ──
  // Alto por padrão. Só cai se houver marcas registradas no INPI.
  const hasInpiConflict = inpiTotal > 0;
  const deferimentScore = hasInpiConflict
    ? Math.max(15, 90 - (inpiTotal * 18)) // cada marca encontrada reduz ~18 pontos
    : 92; // sem conflito INPI = alto potencial

  // ── Score 2: Risco de Concorrente Registrar ──
  // 1 marca em colidência = 73%, mais de 3 = 91%
  const activeCnpjs = cnpjMatches.filter(m => m.situacao?.toLowerCase() === 'ativa').length;
  const socialPresence = socialMatches.filter(s => s.encontrado).length;
  const competitorSignals = activeCnpjs + socialPresence;
  let competitorRiskScore: number;
  if (competitorSignals === 0) {
    competitorRiskScore = 15;
  } else if (competitorSignals === 1) {
    competitorRiskScore = 73;
  } else if (competitorSignals <= 3) {
    competitorRiskScore = 73 + Math.round((competitorSignals - 1) * 6); // 79, 85
  } else {
    competitorRiskScore = 91;
  }

  // Labels Score 1
  const d = deferimentScore;
  const dLabel = d >= 80 ? 'Alto' : d >= 60 ? 'Médio' : 'Baixo';
  const dColor = d >= 80 ? 'text-emerald-500' : d >= 60 ? 'text-amber-500' : 'text-red-500';
  const dBarColor = d >= 80 ? 'from-emerald-500 to-green-400' : d >= 60 ? 'from-amber-500 to-orange-400' : 'from-red-500 to-rose-400';

  // Labels Score 2
  const c = competitorRiskScore;
  const cLabel = c >= 70 ? 'Alto' : c >= 40 ? 'Médio' : 'Baixo';
  const cColor = c >= 70 ? 'text-red-500' : c >= 40 ? 'text-amber-500' : 'text-emerald-500';
  const cBarColor = c >= 70 ? 'from-red-500 to-rose-400' : c >= 40 ? 'from-amber-500 to-orange-400' : 'from-emerald-500 to-green-400';

  // Overall border/bg based on worst scenario
  const worstScore = Math.min(d, 100 - c); // lower = worse
  const borderColor = worstScore >= 60 ? 'border-emerald-500/30' : worstScore >= 30 ? 'border-amber-500/30' : 'border-red-500/30';
  const bgGlow = worstScore >= 60 ? 'bg-emerald-500/5' : worstScore >= 30 ? 'bg-amber-500/5' : 'bg-red-500/5';

  // Dynamic messages
  const deferimentMessage = d >= 80
    ? 'Alto potencial de deferimento. Recomendamos protocolar imediatamente.'
    : d >= 60
    ? 'Marca viável, porém o registro imediato reduz riscos futuros.'
    : 'Foram encontradas marcas similares no INPI. Recomendamos avaliação estratégica do nome antes do protocolo.';

  const competitorMessage = c >= 70
    ? `⚠️ Alto risco de outra empresa registrar! ${activeCnpjs > 0 ? `${activeCnpjs} empresa(s) ativa(s) com nome similar encontrada(s).` : ''} ${socialPresence > 0 ? `Presença detectada em ${socialPresence} rede(s) social(is).` : ''} Registre primeiro!`
    : c >= 40
    ? `Existem sinais de uso por terceiros. O registro antecipado é recomendado para garantir exclusividade.`
    : 'Baixo risco concorrencial detectado. Momento ideal para garantir a marca.';

  // Gauge component
  const ScoreGauge = ({ value, color, label, sublabel }: { value: number; color: string; label: string; sublabel: string }) => (
    <div className="flex items-center gap-3">
      <div className="relative w-16 h-16">
        <svg width="64" height="64" className="-rotate-90">
          <circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
          <motion.circle
            cx="32" cy="32" r="26" fill="none"
            stroke={color}
            strokeWidth="5" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 26}
            initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - value / 100) }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-black" style={{ color }}>{value}</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs font-semibold" style={{ color }}>{sublabel}</p>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className={`rounded-2xl border ${borderColor} ${bgGlow} p-5 md:p-6 mb-6 space-y-5`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md">
          <Brain className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <h4 className="font-display font-semibold text-base">🧠 Análise Inteligente da Marca</h4>
          <p className="text-[11px] text-muted-foreground">Motor preditivo WebMarcas Intelligence PI™</p>
        </div>
      </div>

      {/* ── Score 1: Potencial de Deferimento ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Potencial de Deferimento</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <ScoreGauge
            value={d}
            color={d >= 80 ? '#10b981' : d >= 60 ? '#f59e0b' : '#ef4444'}
            label="Score de Deferimento"
            sublabel={`Potencial ${dLabel}`}
          />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-muted-foreground">Potencial</span>
              <span className={`text-xs font-bold ${dColor}`}>{d}/100</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted/40 overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${dBarColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${d}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {hasInpiConflict ? `${inpiTotal} marca(s) similar(es) encontrada(s) no INPI` : 'Nenhuma marca idêntica encontrada no INPI'}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-card/60 border border-border/30">
          <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-foreground leading-relaxed">{deferimentMessage}</p>
        </div>
      </div>

      {/* ── Score 2: Risco de Concorrente Registrar ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Risco de Concorrente Registrar</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <ScoreGauge
            value={c}
            color={c >= 70 ? '#ef4444' : c >= 40 ? '#f59e0b' : '#10b981'}
            label="Risco Concorrencial"
            sublabel={`Risco ${cLabel}`}
          />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-muted-foreground">Nível de risco</span>
              <span className={`text-xs font-bold ${cColor}`}>{c}/100</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted/40 overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${cBarColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${c}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground mt-1.5 space-y-0.5">
              {activeCnpjs > 0 && <p>🏢 {activeCnpjs} empresa(s) ativa(s) com nome similar</p>}
              {socialPresence > 0 && <p>🌐 Presença em {socialPresence} rede(s) social(is)</p>}
              {competitorSignals === 0 && <p>✅ Nenhum sinal concorrencial detectado</p>}
            </div>
          </div>
        </div>
        <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${c >= 70 ? 'bg-red-500/5 border-red-500/20' : c >= 40 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
          <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${cColor}`} />
          <p className="text-sm text-foreground leading-relaxed">{competitorMessage}</p>
        </div>
      </div>

      {/* Legal Disclaimer */}
      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
        Indicador baseado em dados históricos internos e públicos. Não representa garantia de resultado.
      </p>
    </motion.div>
  );
}

const ViabilitySearchSection = ({ compact = false }: { compact?: boolean }) => {
  const [brandName, setBrandName] = useState("");
  const [businessArea, setBusinessArea] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<ViabilityResult | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!brandName.trim() || !businessArea.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha o nome da marca e o ramo de atividade.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);

    try {
      const viabilityResult = await checkViability(brandName.trim(), businessArea.trim());
      setResult(viabilityResult);

      await supabase.from('viability_searches').insert({
        brand_name: brandName.trim(),
        business_area: businessArea.trim(),
        result_level: viabilityResult.level
      });
    } catch (error) {
      console.error('Error checking viability:', error);
      toast({
        title: "Erro na consulta",
        description: "Não foi possível realizar a consulta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const resetSearch = () => {
    setResult(null);
    setBrandName("");
    setBusinessArea("");
  };

  const getViabilityText = (level: ViabilityLevel) => {
    switch (level) {
      case "high": return "✅ Viável";
      case "medium": return "⚠️ Baixa viabilidade";
      case "low": return "❌ Alto risco de colidência";
      case "blocked": return "❌ Marca bloqueada";
      default: return "";
    }
  };

  const printLaudo = () => {
    const currentDate = new Date().toLocaleString('pt-BR');
    const viabilityText = getViabilityText(result?.level || null);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Erro", description: "Não foi possível abrir a janela de impressão.", variant: "destructive" });
      return;
    }

    // Build INPI table rows
    const inpiRows = (result?.inpiData?.resultados || []).map((r, i) =>
      `<tr><td>${i + 1}</td><td>${r.marca}</td><td>${r.processo}</td><td>${r.situacao}</td><td>${r.classe}</td></tr>`
    ).join('');

    // Build CNPJ rows
    const cnpjRows = (result?.cnpjData?.matches || []).map((m, i) =>
      `<tr><td>${i + 1}</td><td>${m.nome}</td><td>${m.cnpj}</td><td>${m.situacao}</td></tr>`
    ).join('');

    // Build social rows
    const socialRows = (result?.internetData?.socialMatches || []).map(s =>
      `<tr><td>${s.plataforma}</td><td>${s.encontrado ? '✅ Encontrado' : '❌ Não encontrado'}</td><td>${s.url || '-'}</td></tr>`
    ).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Laudo Técnico de Viabilidade - WebMarcas</title>
        <style>
          @page { size: A4; margin: 20mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1a1a2e; background: white; padding: 40px; }
          .header { display: flex; align-items: center; gap: 20px; border-bottom: 3px solid #0ea5e9; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { width: 80px; height: 80px; }
          .company-info h1 { font-size: 28px; color: #0ea5e9; margin-bottom: 5px; }
          .company-info p { color: #64748b; font-size: 14px; }
          .official-badge { background: #dcfce7; color: #166534; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; display: inline-block; margin-bottom: 20px; }
          .title { text-align: center; font-size: 24px; color: #1a1a2e; margin-bottom: 30px; padding: 15px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 8px; border-left: 4px solid #0ea5e9; }
          .info-section { margin-bottom: 25px; }
          .info-section h3 { font-size: 16px; color: #0ea5e9; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .info-item { background: #f8fafc; padding: 12px 16px; border-radius: 6px; border-left: 3px solid #0ea5e9; }
          .info-item label { display: block; font-size: 12px; color: #64748b; margin-bottom: 4px; }
          .info-item span { font-size: 16px; font-weight: 600; color: #1a1a2e; }
          .result-box { padding: 20px; border-radius: 8px; margin-bottom: 25px; text-align: center; font-size: 20px; font-weight: bold; }
          .result-high { background: #dcfce7; color: #166534; border: 2px solid #22c55e; }
          .result-medium { background: #fef9c3; color: #854d0e; border: 2px solid #eab308; }
          .result-low, .result-blocked { background: #fee2e2; color: #991b1b; border: 2px solid #ef4444; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
          th { background: #f0f9ff; color: #0369a1; font-weight: 600; }
          .laudo-content { background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 25px; white-space: pre-wrap; font-size: 14px; line-height: 1.8; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px; }
          .footer .site { color: #0ea5e9; font-weight: 600; }
          .footer .disclaimer { margin-top: 15px; padding: 10px; background: #dcfce7; border-radius: 6px; color: #166534; font-style: italic; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${webmarcasIcon}" alt="WebMarcas" class="logo" />
          <div class="company-info"><h1>WebMarcas</h1><p>Registro de Marcas</p></div>
        </div>
        <div class="official-badge">📋 PESQUISA REAL – INPI + MERCADO + INTERNET</div>
        <div class="title">📋 Laudo Técnico de Viabilidade de Marca</div>

        <div class="info-section">
          <h3>📋 Dados da Consulta</h3>
          <div class="info-grid">
            <div class="info-item"><label>Nome da Marca</label><span>${brandName}</span></div>
            <div class="info-item"><label>Ramo de Atividade</label><span>${businessArea}</span></div>
            <div class="info-item"><label>Data da Consulta</label><span>${result?.searchDate || currentDate}</span></div>
            <div class="info-item"><label>Tipo de Pesquisa</label><span>Completa (INPI + CNPJ + Internet)</span></div>
          </div>
        </div>

        <div class="info-section">
          <h3>📊 Resultado da Análise</h3>
          <div class="result-box result-${result?.level || 'low'}">${viabilityText}</div>
        </div>

        ${(result?.inpiData?.totalResultados ?? 0) > 0 ? `
        <div class="info-section">
          <h3>🔍 Resultado da Pesquisa no INPI</h3>
          <p style="margin-bottom:10px;font-size:14px;">Total de resultados: <strong>${result?.inpiData?.totalResultados}</strong></p>
          <table>
            <thead><tr><th>#</th><th>Marca</th><th>Processo</th><th>Situação</th><th>Classe</th></tr></thead>
            <tbody>${inpiRows}</tbody>
          </table>
        </div>` : `
        <div class="info-section">
          <h3>🔍 Resultado da Pesquisa no INPI</h3>
          <p style="font-size:14px;">✅ Nenhuma marca idêntica encontrada na base do INPI.</p>
        </div>`}

        ${(result?.cnpjData?.total ?? 0) > 0 ? `
        <div class="info-section">
          <h3>🏢 Colidência Empresarial (CNPJ)</h3>
          <table>
            <thead><tr><th>#</th><th>Empresa</th><th>CNPJ</th><th>Situação</th></tr></thead>
            <tbody>${cnpjRows}</tbody>
          </table>
        </div>` : `
        <div class="info-section">
          <h3>🏢 Colidência Empresarial (CNPJ)</h3>
          <p style="font-size:14px;">✅ Nenhuma empresa com nome idêntico encontrada.</p>
        </div>`}

        <div class="info-section">
          <h3>🌐 Colidência na Internet</h3>
          ${socialRows ? `<table><thead><tr><th>Plataforma</th><th>Status</th><th>URL</th></tr></thead><tbody>${socialRows}</tbody></table>` : '<p style="font-size:14px;">Nenhuma presença identificada.</p>'}
        </div>

        ${result?.classDescriptions ? `
        <div class="info-section">
          <h3>🏷️ Classes NCL Recomendadas</h3>
          <ul style="list-style:none;padding:0;">
            ${result.classDescriptions.map(d => `<li style="background:#f8fafc;padding:10px 16px;border-radius:6px;border-left:3px solid #0ea5e9;margin-bottom:8px;font-size:14px;">${d}</li>`).join('')}
          </ul>
        </div>` : ''}

        <div class="info-section">
          <h3>⚖️ Parecer Técnico Completo</h3>
          <div class="laudo-content">${result?.laudo || result?.description || 'Análise não disponível'}</div>
        </div>

        <div class="footer">
          <p>Documento gerado automaticamente pelo sistema WebMarcas</p>
          <p class="site">www.webmarcas.net</p>
          <p>Data e hora da geração: ${currentDate}</p>
          <div class="disclaimer">✅ Pesquisa realizada diretamente na base oficial do INPI + análise de mercado.</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
  };

  const handleRegisterClick = () => {
    sessionStorage.setItem('viabilityData', JSON.stringify({
      brandName,
      businessArea,
      level: result?.level,
      classes: result?.classes || [],
      classDescriptions: result?.classDescriptions || [],
    }));
    window.scrollTo({ top: 0, behavior: 'instant' });
    navigate('/registrar');
  };

  const getRegistrarResultConfig = (level: ViabilityResult["level"]) => {
    switch (level) {
      case "high": return { icon: CheckCircle, gradient: "from-emerald-500/10 to-emerald-600/5", border: "border-emerald-500/30", iconColor: "text-emerald-500", badgeBg: "bg-emerald-500/10", badgeText: "text-emerald-600 dark:text-emerald-400", badgeLabel: "ALTA VIABILIDADE", glow: "shadow-emerald-500/10" };
      case "medium": return { icon: AlertTriangle, gradient: "from-amber-500/10 to-amber-600/5", border: "border-amber-500/30", iconColor: "text-amber-500", badgeBg: "bg-amber-500/10", badgeText: "text-amber-600 dark:text-amber-400", badgeLabel: "VIABILIDADE MÉDIA", glow: "shadow-amber-500/10" };
      case "low": return { icon: AlertCircle, gradient: "from-red-500/10 to-red-600/5", border: "border-red-500/30", iconColor: "text-red-500", badgeBg: "bg-red-500/10", badgeText: "text-red-600 dark:text-red-400", badgeLabel: "BAIXA VIABILIDADE", glow: "shadow-red-500/10" };
      case "blocked": return { icon: ShieldX, gradient: "from-red-600/15 to-red-700/10", border: "border-red-600/40", iconColor: "text-red-600", badgeBg: "bg-red-600/10", badgeText: "text-red-700 dark:text-red-300", badgeLabel: "MARCA BLOQUEADA", glow: "shadow-red-600/10" };
      default: return { icon: Search, gradient: "", border: "", iconColor: "", badgeBg: "", badgeText: "", badgeLabel: "", glow: "" };
    }
  };

  const renderRegistrarStyleResult = (resultData: ViabilityResult) => {
    const config = getRegistrarResultConfig(resultData.level);
    const Icon = config.icon;

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-foreground">
        <div className="text-center">
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn("inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider border", config.badgeBg, config.badgeText, config.border)}
          >
            <Icon className="w-3.5 h-3.5" />
            {config.badgeLabel}
          </motion.span>
        </div>

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className={cn("relative overflow-hidden rounded-2xl border p-6 bg-gradient-to-br shadow-lg", config.gradient, config.border, config.glow)}
        >
          <div className="flex items-start gap-4">
            <div className={cn("p-3 rounded-xl bg-background/80 shadow-sm", config.border, "border")}>
              <Icon className={cn("w-8 h-8", config.iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold mb-2">{resultData.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{resultData.description}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border/30 grid grid-cols-2 gap-3">
            <div className="text-xs"><span className="text-muted-foreground block">Marca consultada</span><span className="font-semibold">{brandName}</span></div>
            <div className="text-xs"><span className="text-muted-foreground block">Ramo de atividade</span><span className="font-semibold">{businessArea}</span></div>
          </div>
        </motion.div>

        {resultData.level !== 'blocked' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <Button
              size="lg"
              onClick={handleRegisterClick}
              className="w-full h-14 text-base font-bold rounded-xl text-white bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-600 hover:via-green-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/40 hover:shadow-emerald-500/60 transition-all duration-300 hover:-translate-y-0.5 ring-2 ring-emerald-400/30 hover:ring-emerald-400/60 animate-pulse"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              REGISTRE AGORA SUA MARCA
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        )}

        {resultData.inpiData && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border border-border/40 p-4">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              Resultado INPI ({resultData.inpiData.totalResultados})
            </h4>
            {resultData.inpiData.totalResultados > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50"><tr><th className="px-2 py-1.5 text-left">Marca</th><th className="px-2 py-1.5 text-left">Processo</th><th className="px-2 py-1.5 text-left">Situação</th></tr></thead>
                  <tbody>{resultData.inpiData.resultados.map((r, i) => (
                    <tr key={i} className="border-t border-border/30"><td className="px-2 py-1.5 font-medium">{r.marca}</td><td className="px-2 py-1.5 text-muted-foreground">{r.processo || '-'}</td><td className="px-2 py-1.5">{r.situacao}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">✅ Nenhuma marca idêntica encontrada.</p>
            )}
          </motion.div>
        )}

        {(resultData.cnpjData || resultData.internetData) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {resultData.cnpjData && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="rounded-xl border border-border/40 p-4">
                <h4 className="font-semibold text-xs mb-2 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-primary" />Colidência CNPJ</h4>
                {resultData.cnpjData.total > 0 ? resultData.cnpjData.matches.map((m, i) => (
                  <div key={i} className="text-xs bg-muted/30 rounded p-2 mb-1"><p className="font-medium">{m.nome}</p>{m.cnpj && <p className="text-muted-foreground">{m.cnpj}</p>}</div>
                )) : <p className="text-xs text-muted-foreground">✅ Nenhuma empresa encontrada</p>}
              </motion.div>
            )}
            {resultData.internetData && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="rounded-xl border border-border/40 p-4">
                <h4 className="font-semibold text-xs mb-2 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-primary" />Presença Internet</h4>
                <div className="space-y-1">{resultData.internetData.socialMatches.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs"><span>{s.plataforma}</span><span className={s.encontrado ? 'text-yellow-600' : 'text-emerald-600'}>{s.encontrado ? '⚠️ Encontrado' : '✅ Livre'}</span></div>
                ))}</div>
              </motion.div>
            )}
          </div>
        )}

        {resultData.laudo && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Laudo Técnico Completo</h4>
              <Button variant="ghost" size="sm" onClick={printLaudo} className="h-8 text-xs"><Printer className="w-3.5 h-3.5 mr-1.5" />Imprimir</Button>
            </div>
            <div className="bg-muted/40 border border-border rounded-xl p-4 max-h-52 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-sans leading-relaxed">{resultData.laudo}</pre>
            </div>
          </motion.div>
        )}

        {resultData.level !== 'blocked' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed"><strong className="text-foreground">Aja rápido!</strong> O dono da marca é quem registra primeiro.</p>
          </motion.div>
        )}

        {resultData.level !== 'blocked' && (
          <CommercialIntelligenceModule
            inpiTotal={resultData.inpiData?.totalResultados || 0}
            cnpjMatches={resultData.cnpjData?.matches || []}
            socialMatches={resultData.internetData?.socialMatches || []}
            classes={resultData.classes}
            businessArea={businessArea}
          />
        )}

        <div className="space-y-3">
          {resultData.level !== 'blocked' && (
            <Button
              size="lg"
              onClick={handleRegisterClick}
              className="w-full h-14 text-base font-bold rounded-xl text-white bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-600 hover:via-green-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/40 hover:shadow-emerald-500/60 transition-all duration-300 hover:-translate-y-0.5 ring-2 ring-emerald-400/30 hover:ring-emerald-400/60 animate-pulse"
            >
              <Sparkles className="w-5 h-5 mr-2" />REGISTRE AGORA SUA MARCA<ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          )}
          <Button variant="outline" className="w-full h-11 rounded-xl" onClick={resetSearch}>Fazer nova consulta</Button>
        </div>
      </motion.div>
    );
  };

  if (compact) {
    return (
      <div id="consultar" className="w-full">
        <AnimatePresence mode="wait">
        {!result ? (
          isSearching ? (
            <INPISearchAnimation key="searching" brandName={brandName} />
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {/* Orange pill badge */}
              <div className="flex justify-center mb-4">
                <span className="badge-consulta">
                  <Zap className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Consulta Gratuita
                </span>
              </div>

              {/* Title — Fraunces chunky */}
              <h2 className="font-display text-[1.9rem] sm:text-[2.15rem] leading-[1.05] font-bold text-center text-[hsl(222_47%_11%)] mb-8">
                Consulte a viabilidade da sua{" "}
                <span className="text-[hsl(222_92%_54%)]">marca</span>
              </h2>

              {/* Form */}
              <form onSubmit={handleSearch} className="space-y-5">
                <div>
                  <label htmlFor="brandNameCompact" className="form-label-caps">Nome da Marca</label>
                  <input
                    id="brandNameCompact"
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Como sua marca se chama?"
                    className="form-pill-input"
                    disabled={isSearching}
                  />
                </div>

                <div>
                  <label htmlFor="businessAreaCompact" className="form-label-caps">Ramo de Atividade</label>
                  <input
                    id="businessAreaCompact"
                    type="text"
                    value={businessArea}
                    onChange={(e) => setBusinessArea(e.target.value)}
                    placeholder="Ex: Serviços Jurídicos, Alimentação, Tecnologia..."
                    className="form-pill-input"
                    disabled={isSearching}
                  />
                </div>

                <button type="submit" disabled={isSearching} className="btn-cta-solid mt-2">
                  Consultar Viabilidade
                  <ArrowRight className="w-5 h-5" />
                </button>

                <div className="flex items-center justify-center gap-2 pt-1 text-xs text-[hsl(215_16%_47%)]">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-semibold text-[hsl(222_47%_11%)]">100% Seguro</span>
                  <span className="opacity-40">·</span>
                  <a href="/politica-privacidade" className="underline hover:text-[hsl(222_92%_54%)]">Política de privacidade</a>
                </div>
              </form>
            </motion.div>
          )
        ) : (
          <motion.div
            key="result-compact"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 md:p-8 max-h-[70vh] overflow-y-auto"
          >
            {renderRegistrarStyleResult(result)}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <section id="consultar" className="py-12 md:py-16 lg:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-hero-gradient opacity-30" />
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/3 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-10"
        >
          <span className="badge-premium mb-4 inline-flex">Pesquisa Real no INPI</span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Consulte a viabilidade da sua{" "}
            <span className="gradient-text">marca</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Pesquisa automática na base oficial do INPI em tempo real.
          </p>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          {/* Feature Cards */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="grid grid-cols-3 gap-4 mb-6"
          >
            {FEATURE_CARDS.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: 0.15 + i * 0.07 }}
                className="flex flex-col items-center gap-2.5 rounded-2xl border border-border/50 bg-card/70 backdrop-blur-sm px-3 py-5 text-center shadow-sm"
              >
                <item.icon className="w-7 h-7 text-primary" strokeWidth={1.5} />
                <p className="font-semibold text-foreground text-sm leading-tight">{item.label}</p>
                <p className="text-xs text-muted-foreground leading-snug">{item.sub}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Search Form / Animation / Result */}
          <AnimatePresence mode="wait">
          {!result ? (
            isSearching ? (
              <INPISearchAnimation key="searching" brandName={brandName} />
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSearch}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm shadow-md p-8"
              >
                <div className="space-y-6">
                  <div>
                    <label htmlFor="brandName" className="block text-sm font-bold text-foreground mb-2.5">
                      Nome da Marca <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="brandName"
                      type="text"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="Ex: WebMarcas, TechFlow, BioVida..."
                      className="w-full h-14 rounded-xl border border-border/60 bg-muted/30 px-4 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all disabled:opacity-50"
                      disabled={isSearching}
                    />
                  </div>

                  <div>
                    <label htmlFor="businessArea" className="block text-sm font-bold text-foreground mb-2.5">
                      Ramo de Atividade <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="businessArea"
                      type="text"
                      value={businessArea}
                      onChange={(e) => setBusinessArea(e.target.value)}
                      placeholder="Ex: Serviços Jurídicos, Alimentação, Tecnologia..."
                      className="w-full h-14 rounded-xl border border-border/60 bg-muted/30 px-4 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all disabled:opacity-50"
                      disabled={isSearching}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSearching}
                    className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2.5 hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Search className="w-5 h-5" />
                    Consultar Viabilidade
                  </button>
                </div>

                <p className="mt-5 text-center text-xs text-muted-foreground">
                  🔒 Consulta gratuita • Resultado em segundos • Sem cadastro necessário
                </p>
              </motion.form>
            )
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm shadow-md p-8"
            >
              {renderRegistrarStyleResult(result)}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default ViabilitySearchSection;
