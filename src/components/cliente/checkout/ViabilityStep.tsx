import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CheckCircle, AlertTriangle, AlertCircle, ShieldX, Printer, ArrowRight, Sparkles, Shield, TrendingUp, Zap, Database, Cpu, Globe, Lock, FileSearch, ScanLine, Building2, Brain, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkViability, type ViabilityResult } from "@/lib/api/viability";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import webmarcasIcon from "@/assets/webmarcas-icon.png";
import { cn } from "@/lib/utils";

interface ViabilityStepProps {
  onNext: (brandName: string, businessArea: string, result: ViabilityResult) => void;
}

// Futuristic Search Animation Component
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
      const p = Math.min((elapsed / totalDuration) * 100, 98);
      setProgress(p);
      setCurrentPhase(Math.min(Math.floor(elapsed / phaseInterval), phases.length - 1));
      if (elapsed >= totalDuration) clearInterval(timer);
    }, 60);

    return () => clearInterval(timer);
  }, []);

  const CurrentIcon = phases[currentPhase].icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="py-6 space-y-8"
    >
      {/* Central HUD Ring */}
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex items-center justify-center w-36 h-36">
          <motion.div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30" animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} />
          <motion.div className="absolute inset-3 rounded-full border border-primary/50" animate={{ rotate: -360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 144 144">
            <circle cx="72" cy="72" r="64" fill="none" stroke="hsl(var(--primary)/0.1)" strokeWidth="4" />
            <motion.circle cx="72" cy="72" r="64" fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 64}`}
              style={{ strokeDashoffset: `${2 * Math.PI * 64 * (1 - progress / 100)}`, filter: "drop-shadow(0 0 6px hsl(var(--primary)/0.8))" }}
            />
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

      {/* Phase steps */}
      <div className="space-y-2">
        {phases.map((phase, i) => {
          const PhaseIcon = phase.icon;
          const isDone = i < currentPhase;
          const isActive = i === currentPhase;
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: i <= currentPhase ? 1 : 0.3, x: 0 }} transition={{ delay: i * 0.1, duration: 0.3 }}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-500",
                isActive ? "bg-primary/10 border-primary/30" : isDone ? "bg-muted/30 border-border/30" : "bg-muted/10 border-border/10"
              )}
            >
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

// ─── Commercial Intelligence Module (dual-score) ─────────────────────
function CommercialIntelligenceModule({ inpiTotal = 0, cnpjMatches = [], socialMatches = [] }: {
  inpiTotal?: number;
  cnpjMatches?: { nome: string; cnpj: string; situacao: string }[];
  socialMatches?: { plataforma: string; encontrado: boolean; url?: string }[];
}) {
  const hasInpiConflict = inpiTotal > 0;
  const deferimentScore = hasInpiConflict ? Math.max(15, 90 - (inpiTotal * 18)) : 92;

  const activeCnpjs = cnpjMatches.filter(m => m.situacao?.toLowerCase() === 'ativa').length;
  const socialPresence = socialMatches.filter(s => s.encontrado).length;
  const competitorSignals = activeCnpjs + socialPresence;
  let competitorRiskScore: number;
  if (competitorSignals === 0) competitorRiskScore = 15;
  else if (competitorSignals === 1) competitorRiskScore = 73;
  else if (competitorSignals <= 3) competitorRiskScore = 73 + Math.round((competitorSignals - 1) * 6);
  else competitorRiskScore = 91;

  const d = deferimentScore;
  const dLabel = d >= 80 ? 'Alto' : d >= 60 ? 'Médio' : 'Baixo';
  const dColor = d >= 80 ? 'text-emerald-500' : d >= 60 ? 'text-amber-500' : 'text-red-500';
  const dBarColor = d >= 80 ? 'from-emerald-500 to-green-400' : d >= 60 ? 'from-amber-500 to-orange-400' : 'from-red-500 to-rose-400';

  const c = competitorRiskScore;
  const cLabel = c >= 70 ? 'Alto' : c >= 40 ? 'Médio' : 'Baixo';
  const cColor = c >= 70 ? 'text-red-500' : c >= 40 ? 'text-amber-500' : 'text-emerald-500';
  const cBarColor = c >= 70 ? 'from-red-500 to-rose-400' : c >= 40 ? 'from-amber-500 to-orange-400' : 'from-emerald-500 to-green-400';

  const worstScore = Math.min(d, 100 - c);
  const borderColor = worstScore >= 60 ? 'border-emerald-500/30' : worstScore >= 30 ? 'border-amber-500/30' : 'border-red-500/30';
  const bgGlow = worstScore >= 60 ? 'bg-emerald-500/5' : worstScore >= 30 ? 'bg-amber-500/5' : 'bg-red-500/5';

  const deferimentMessage = d >= 80
    ? 'Alto potencial de deferimento. Recomendamos protocolar imediatamente.'
    : d >= 60
    ? 'Marca viável, porém o registro imediato reduz riscos futuros.'
    : 'Foram encontradas marcas similares no INPI. Recomendamos avaliação estratégica do nome antes do protocolo.';

  const competitorMessage = c >= 70
    ? `⚠️ Alto risco de outra empresa registrar! ${activeCnpjs > 0 ? `${activeCnpjs} empresa(s) ativa(s) com nome similar.` : ''} ${socialPresence > 0 ? `Presença em ${socialPresence} rede(s) social(is).` : ''} Registre primeiro!`
    : c >= 40
    ? 'Existem sinais de uso por terceiros. O registro antecipado é recomendado.'
    : 'Baixo risco concorrencial detectado. Momento ideal para garantir a marca.';

  const ScoreGauge = ({ value, color, label, sublabel }: { value: number; color: string; label: string; sublabel: string }) => (
    <div className="flex items-center gap-3">
      <div className="relative w-16 h-16">
        <svg width="64" height="64" className="-rotate-90">
          <circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
          <motion.circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
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
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
      className={`rounded-2xl border ${borderColor} ${bgGlow} p-5 space-y-5`}>
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md">
          <Brain className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <h4 className="font-semibold text-base">🧠 Análise Inteligente da Marca</h4>
          <p className="text-[11px] text-muted-foreground">Motor preditivo WebMarcas Intelligence PI™</p>
        </div>
      </div>

      {/* Score 1: Potencial de Deferimento */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Potencial de Deferimento</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <ScoreGauge value={d} color={d >= 80 ? '#10b981' : d >= 60 ? '#f59e0b' : '#ef4444'} label="Score de Deferimento" sublabel={`Potencial ${dLabel}`} />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-muted-foreground">Potencial</span>
              <span className={`text-xs font-bold ${dColor}`}>{d}/100</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted/40 overflow-hidden">
              <motion.div className={`h-full rounded-full bg-gradient-to-r ${dBarColor}`} initial={{ width: 0 }} animate={{ width: `${d}%` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }} />
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

      {/* Score 2: Risco de Concorrente Registrar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Risco de Concorrente Registrar</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <ScoreGauge value={c} color={c >= 70 ? '#ef4444' : c >= 40 ? '#f59e0b' : '#10b981'} label="Risco Concorrencial" sublabel={`Risco ${cLabel}`} />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-muted-foreground">Nível de risco</span>
              <span className={`text-xs font-bold ${cColor}`}>{c}/100</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted/40 overflow-hidden">
              <motion.div className={`h-full rounded-full bg-gradient-to-r ${cBarColor}`} initial={{ width: 0 }} animate={{ width: `${c}%` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }} />
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

      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
        Indicador baseado em dados históricos internos e públicos. Não representa garantia de resultado.
      </p>
    </motion.div>
  );
}

export function ViabilityStep({ onNext }: ViabilityStepProps) {
  const [brandName, setBrandName] = useState("");
  const [businessArea, setBusinessArea] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<ViabilityResult | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim() || !businessArea.trim()) {
      toast.error("Por favor, preencha o nome da marca e o ramo de atividade.");
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
      toast.error("Não foi possível realizar a consulta. Tente novamente.");
    } finally {
      setIsSearching(false);
    }
  };

  const resetSearch = () => {
    setResult(null);
    setBrandName("");
    setBusinessArea("");
  };

  const getResultConfig = (level: string) => {
    switch (level) {
      case "high": return { icon: CheckCircle, gradient: "from-emerald-500/10 to-emerald-600/5", border: "border-emerald-500/30", iconColor: "text-emerald-500", badgeBg: "bg-emerald-500/10", badgeText: "text-emerald-600 dark:text-emerald-400", badgeLabel: "ALTA VIABILIDADE", glow: "shadow-emerald-500/10" };
      case "medium": return { icon: AlertTriangle, gradient: "from-amber-500/10 to-amber-600/5", border: "border-amber-500/30", iconColor: "text-amber-500", badgeBg: "bg-amber-500/10", badgeText: "text-amber-600 dark:text-amber-400", badgeLabel: "VIABILIDADE MÉDIA", glow: "shadow-amber-500/10" };
      case "low": return { icon: AlertCircle, gradient: "from-red-500/10 to-red-600/5", border: "border-red-500/30", iconColor: "text-red-500", badgeBg: "bg-red-500/10", badgeText: "text-red-600 dark:text-red-400", badgeLabel: "BAIXA VIABILIDADE", glow: "shadow-red-500/10" };
      case "blocked": return { icon: ShieldX, gradient: "from-red-600/15 to-red-700/10", border: "border-red-600/40", iconColor: "text-red-600", badgeBg: "bg-red-600/10", badgeText: "text-red-700 dark:text-red-300", badgeLabel: "MARCA BLOQUEADA", glow: "shadow-red-600/10" };
      default: return { icon: Search, gradient: "", border: "", iconColor: "", badgeBg: "", badgeText: "", badgeLabel: "", glow: "" };
    }
  };

  const printLaudo = () => {
    const currentDate = new Date().toLocaleString('pt-BR');
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error("Não foi possível abrir a janela de impressão."); return; }

    const inpiRows = (result?.inpiData?.resultados || []).map((r, i) =>
      `<tr><td>${i + 1}</td><td>${r.marca}</td><td>${r.processo}</td><td>${r.situacao}</td><td>${r.classe}</td></tr>`
    ).join('');

    const cnpjRows = (result?.cnpjData?.matches || []).map((m, i) =>
      `<tr><td>${i + 1}</td><td>${m.nome}</td><td>${m.cnpj}</td><td>${m.situacao}</td></tr>`
    ).join('');

    const socialRows = (result?.internetData?.socialMatches || []).map(s =>
      `<tr><td>${s.plataforma}</td><td>${s.encontrado ? '✅ Encontrado' : '❌ Não encontrado'}</td><td>${s.url || '-'}</td></tr>`
    ).join('');

    printWindow.document.write(`
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Laudo Técnico de Viabilidade - WebMarcas</title>
      <style>@page{size:A4;margin:20mm}body{font-family:'Segoe UI',sans-serif;line-height:1.6;color:#1a1a2e;padding:40px}.header{display:flex;align-items:center;gap:20px;border-bottom:3px solid #0ea5e9;padding-bottom:20px;margin-bottom:30px}.logo{width:80px;height:80px}.company-info h1{font-size:28px;color:#0ea5e9;margin:0}.title{text-align:center;font-size:24px;margin-bottom:30px;padding:15px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:8px}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:25px}.info-item{background:#f8fafc;padding:12px 16px;border-radius:6px;border-left:3px solid #0ea5e9}.info-item label{display:block;font-size:12px;color:#64748b;margin-bottom:4px}.info-item span{font-size:16px;font-weight:600}.result-box{padding:20px;border-radius:8px;margin-bottom:25px;text-align:center;font-size:20px;font-weight:bold}.result-high{background:#dcfce7;color:#166534;border:2px solid #22c55e}.result-medium{background:#fef9c3;color:#854d0e;border:2px solid #eab308}.result-low,.result-blocked{background:#fee2e2;color:#991b1b;border:2px solid #ef4444}table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}th,td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left}th{background:#f0f9ff;color:#0369a1;font-weight:600}.section{margin-bottom:25px}.section h3{font-size:16px;color:#0ea5e9;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px}.laudo-content{background:#f8fafc;padding:20px;border-radius:8px;border:1px solid #e2e8f0;white-space:pre-wrap;font-size:14px;line-height:1.8}.footer{margin-top:40px;text-align:center;color:#64748b;font-size:12px}</style>
      </head><body>
      <div class="header"><img src="${webmarcasIcon}" alt="WebMarcas" class="logo"><div class="company-info"><h1>WebMarcas</h1><p>Registro de Marcas</p></div></div>
      <div class="title">📋 Laudo Técnico de Viabilidade de Marca</div>
      <div class="info-grid"><div class="info-item"><label>Marca</label><span>${brandName}</span></div><div class="info-item"><label>Ramo</label><span>${businessArea}</span></div><div class="info-item"><label>Data</label><span>${result?.searchDate || currentDate}</span></div><div class="info-item"><label>Tipo</label><span>Completa (INPI+CNPJ+Web)</span></div></div>
      <div class="result-box result-${result?.level}">${result?.title}</div>
      ${(result?.inpiData?.totalResultados ?? 0) > 0 ? `<div class="section"><h3>🔍 Resultado INPI</h3><table><thead><tr><th>#</th><th>Marca</th><th>Processo</th><th>Situação</th><th>Classe</th></tr></thead><tbody>${inpiRows}</tbody></table></div>` : '<div class="section"><h3>🔍 Resultado INPI</h3><p>✅ Nenhuma marca idêntica encontrada.</p></div>'}
      ${(result?.cnpjData?.total ?? 0) > 0 ? `<div class="section"><h3>🏢 Colidência CNPJ</h3><table><thead><tr><th>#</th><th>Empresa</th><th>CNPJ</th><th>Situação</th></tr></thead><tbody>${cnpjRows}</tbody></table></div>` : '<div class="section"><h3>🏢 Colidência CNPJ</h3><p>✅ Nenhuma empresa encontrada.</p></div>'}
      ${socialRows ? `<div class="section"><h3>🌐 Presença Internet</h3><table><thead><tr><th>Plataforma</th><th>Status</th><th>URL</th></tr></thead><tbody>${socialRows}</tbody></table></div>` : ''}
      ${result?.classDescriptions ? `<div class="section"><h3>🏷️ Classes NCL</h3><ul style="list-style:none;padding:0">${result.classDescriptions.map(d => `<li style="background:#f8fafc;padding:10px;border-radius:6px;border-left:3px solid #0ea5e9;margin-bottom:8px">${d}</li>`).join('')}</ul></div>` : ''}
      <div class="section"><h3>⚖️ Parecer Completo</h3><div class="laudo-content">${result?.laudo || result?.description}</div></div>
      <div class="footer"><p>WebMarcas - www.webmarcas.net</p><p>Gerado em: ${currentDate}</p><p style="margin-top:10px;background:#dcfce7;padding:8px;border-radius:6px;color:#166534">✅ Pesquisa real na base oficial do INPI + análise de mercado</p></div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
  };

  if (!result) {
    return (
      <AnimatePresence mode="wait">
        {isSearching ? (
          <INPISearchAnimation key="searching" brandName={brandName} />
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
            <form onSubmit={handleSearch} className="space-y-8">
              <div className="text-center space-y-3">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, type: "spring" }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  Consulta Real no INPI
                </motion.div>
                <h2 className="text-3xl font-bold tracking-tight">Verifique a Viabilidade</h2>
                <p className="text-muted-foreground max-w-sm mx-auto">Consultamos a base do INPI em tempo real para verificar se sua marca pode ser registrada.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Shield, label: "100% Seguro", sub: "Dados protegidos" },
                  { icon: Zap, label: "Tempo Real", sub: "Base oficial INPI" },
                  { icon: TrendingUp, label: "Laudo Técnico", sub: "IA especializada" },
                ].map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50 border border-border/50 text-center">
                    <item.icon className="w-5 h-5 text-primary" />
                    <span className="text-xs font-semibold">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground">{item.sub}</span>
                  </motion.div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="brandName" className="text-sm font-semibold">Nome da Marca <span className="text-destructive">*</span></Label>
                  <Input id="brandName" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Ex: WebMarcas, TechFlow, BioVida..." disabled={isSearching} className="h-12 text-base" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessArea" className="text-sm font-semibold">Ramo de Atividade <span className="text-destructive">*</span></Label>
                  <Input id="businessArea" value={businessArea} onChange={(e) => setBusinessArea(e.target.value)} placeholder="Ex: Serviços Jurídicos, Alimentação, Tecnologia..." disabled={isSearching} className="h-12 text-base" />
                </div>
              </div>

              <Button type="submit" className="w-full h-14 text-base font-semibold rounded-xl shadow-[var(--shadow-button)]" disabled={isSearching} size="lg">
                <Search className="w-5 h-5 mr-2" />
                Gerar Laudo Técnico Gratuito
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">Consulta gratuita • Sem compromisso • Resultado em segundos</p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  const config = getResultConfig(result.level);
  const Icon = config.icon;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Result Badge */}
      <div className="text-center">
        <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className={cn("inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider border", config.badgeBg, config.badgeText, config.border)}>
          <Icon className="w-3.5 h-3.5" />
          {config.badgeLabel}
        </motion.span>
      </div>

      {/* Main Result Card */}
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
        className={cn("relative overflow-hidden rounded-2xl border p-6 bg-gradient-to-br shadow-lg", config.gradient, config.border, config.glow)}>
        <div className="flex items-start gap-4">
          <div className={cn("p-3 rounded-xl bg-background/80 shadow-sm", config.border, "border")}>
            <Icon className={cn("w-8 h-8", config.iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold mb-2">{result.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{result.description}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-border/30 grid grid-cols-2 gap-3">
          <div className="text-xs"><span className="text-muted-foreground block">Marca consultada</span><span className="font-semibold">{brandName}</span></div>
          <div className="text-xs"><span className="text-muted-foreground block">Ramo de atividade</span><span className="font-semibold">{businessArea}</span></div>
        </div>
      </motion.div>

      {/* INPI Results */}
      {result.inpiData && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border border-border/40 p-4">
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            Resultado INPI ({result.inpiData.totalResultados})
          </h4>
          {result.inpiData.totalResultados > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50"><tr><th className="px-2 py-1.5 text-left">Marca</th><th className="px-2 py-1.5 text-left">Processo</th><th className="px-2 py-1.5 text-left">Situação</th></tr></thead>
                <tbody>{result.inpiData.resultados.map((r, i) => (
                  <tr key={i} className="border-t border-border/30"><td className="px-2 py-1.5 font-medium">{r.marca}</td><td className="px-2 py-1.5 text-muted-foreground">{r.processo || '-'}</td><td className="px-2 py-1.5">{r.situacao}</td></tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">✅ Nenhuma marca idêntica encontrada.</p>
          )}
        </motion.div>
      )}

      {/* CNPJ + Internet */}
      {(result.cnpjData || result.internetData) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {result.cnpjData && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="rounded-xl border border-border/40 p-4">
              <h4 className="font-semibold text-xs mb-2 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-primary" />Colidência CNPJ</h4>
              {result.cnpjData.total > 0 ? result.cnpjData.matches.map((m, i) => (
                <div key={i} className="text-xs bg-muted/30 rounded p-2 mb-1"><p className="font-medium">{m.nome}</p>{m.cnpj && <p className="text-muted-foreground">{m.cnpj}</p>}</div>
              )) : <p className="text-xs text-muted-foreground">✅ Nenhuma empresa encontrada</p>}
            </motion.div>
          )}
          {result.internetData && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="rounded-xl border border-border/40 p-4">
              <h4 className="font-semibold text-xs mb-2 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-primary" />Presença Internet</h4>
              <div className="space-y-1">{result.internetData.socialMatches.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs"><span>{s.plataforma}</span><span className={s.encontrado ? 'text-yellow-600' : 'text-emerald-600'}>{s.encontrado ? '⚠️ Encontrado' : '✅ Livre'}</span></div>
              ))}</div>
            </motion.div>
          )}
        </div>
      )}

      {/* Laudo Técnico */}
      {result.laudo && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Laudo Técnico Completo</h4>
            <Button variant="ghost" size="sm" onClick={printLaudo} className="h-8 text-xs"><Printer className="w-3.5 h-3.5 mr-1.5" />Imprimir</Button>
          </div>
          <div className="bg-muted/40 border border-border rounded-xl p-4 max-h-52 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-sans leading-relaxed">{result.laudo}</pre>
          </div>
        </motion.div>
      )}

      {/* Warning */}
      {result.level !== 'blocked' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20">
          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed"><strong className="text-foreground">Aja rápido!</strong> O dono da marca é quem registra primeiro.</p>
        </motion.div>
      )}

      {/* Commercial Intelligence Module */}
      {result.level !== 'blocked' && (
        <CommercialIntelligenceModule
          inpiTotal={result.inpiData?.totalResultados || 0}
          cnpjMatches={result.cnpjData?.matches || []}
          socialMatches={result.internetData?.socialMatches || []}
        />
      )}

      {/* Actions */}
      <div className="space-y-3">
        {result.level !== 'blocked' && (
          <Button className="w-full h-14 text-base font-semibold rounded-xl shadow-[var(--shadow-button)]" size="lg" onClick={() => onNext(brandName, businessArea, result)}>
            <Sparkles className="w-5 h-5 mr-2" />Continuar com o Registro<ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        )}
        <Button variant="outline" className="w-full h-11 rounded-xl" onClick={resetSearch}>Fazer nova consulta</Button>
      </div>
    </motion.div>
  );
}
