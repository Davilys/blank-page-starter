import { Shield, FileSignature, UserCheck, CalendarCheck, Star, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { TrademarkSearch } from "@/modules/trademark-search/components/TrademarkSearch";
import { useTrademarkSearch } from "@/modules/trademark-search/useTrademarkSearch";
import { cn } from "@/lib/utils";
import Seal48h from "@/components/decorative/Seal48h";
import consultant1 from "@/assets/consultants/consultant-1.jpg";
import consultant2 from "@/assets/consultants/consultant-2.jpg";
import consultant3 from "@/assets/consultants/consultant-3.jpg";
import heroPhoto from "@/assets/hero-mulher-r.jpg";

const HeroSection = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { state } = useTrademarkSearch();
  const showingResult = state.phase === 'completed' && Boolean(state.job);

  const trustPills = [
    { icon: Shield, label: "Protocolo em 48h" },
    { icon: FileSignature, label: "Contrato digital" },
    { icon: UserCheck, label: "Especialista dedicado" },
    { icon: CalendarCheck, label: "10 anos de vigência" },
  ];

  return (
    <section id="home" className={cn("relative hero4 overflow-x-clip overflow-y-visible", showingResult && "search-result-active max-md:text-foreground")}>

      <div className={cn("container mx-auto px-4 sm:px-6 lg:px-8 pt-24 md:pt-32 relative z-10 max-w-7xl", showingResult && "max-md:px-3 max-md:pb-10 max-md:pt-20")}>

        {/* Photo panel */}
        <div className={cn("hero4-panel", showingResult && "max-md:hidden")}>
          <img src={heroPhoto} alt="" className="hero4-photo" />
          <div className="hero4-overlay" />
          <div className={cn("hero4-content text-center lg:text-left", showingResult && "max-md:hidden")}>
            {/* Badge */}
            <div className="hero4-badge inline-flex items-center gap-2 rounded-full px-5 py-2.5 mb-6 mx-auto lg:mx-0">
              <Zap className="w-4 h-4 fill-[#06cb66] text-[#06cb66]" />
              <span className="text-[11px] md:text-xs font-black uppercase tracking-[0.18em]">
                Registro de marcas · INPI
              </span>
            </div>

            {/* Heading */}
            <h1 className="font-display text-[2.75rem] sm:text-[3.25rem] xl:text-[4.25rem] font-black leading-[1.05] tracking-tight mb-6 text-white">
              {t("hero.title")}
              <br />
              <span className="hero4-hl">faça o registro agora!</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-lg text-white/85 max-w-lg mx-auto lg:mx-0 mb-8">
              {t("hero.subtitle")}
            </p>

            {/* Rating + social proof */}
            <div className="flex flex-wrap items-center gap-4 justify-center lg:justify-start mb-8">
              <div className="flex items-center -space-x-3">
                <img src={consultant1} alt="" className="w-11 h-11 rounded-full border-2 border-white object-cover" />
                <img src={consultant2} alt="" className="w-11 h-11 rounded-full border-2 border-white object-cover" />
                <img src={consultant3} alt="" className="w-11 h-11 rounded-full border-2 border-white object-cover" />
                <div className="w-11 h-11 rounded-full border-2 border-white bg-[hsl(20_100%_55%)] flex items-center justify-center text-white font-black text-sm">
                  +
                </div>
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-[hsl(38_100%_55%)] text-[hsl(38_100%_55%)]" />
                    ))}
                  </div>
                  <span className="font-display font-black text-white text-lg leading-none">4,9/5</span>
                </div>
                <p className="text-xs md:text-sm text-white/85 mt-1">
                  Mais de <span className="font-bold text-white">11.000 marcas</span> protegidas
                </p>
              </div>
            </div>

            {/* Trust pills — desktop only (mobile version below search) */}
            <div className="hidden lg:flex flex-wrap gap-2.5 justify-center lg:justify-start">
              {trustPills.map((p, i) => (
                <span
                  key={i}
                  className="hero4-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs md:text-sm font-semibold"
                >
                  <span className="hero4-pill-icon w-5 h-5 rounded-full flex items-center justify-center">
                    <p.icon className="w-3 h-3 text-white" strokeWidth={2.5} />
                  </span>
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Overlapping viability search card */}
        <div className={cn("hero4-cardwrap relative w-full max-w-3xl mx-auto", showingResult && "max-md:max-w-none")}>
          {/* 48h floating seal */}
          {!showingResult && <Seal48h
            size={144}
            className="absolute -top-16 -right-4 sm:-top-16 sm:-right-4 md:-top-16 md:-right-8 z-20 scale-[0.7] lg:scale-[0.85] origin-top-right"
          />}
          <div className={cn("relative rounded-[2rem] bg-card p-6 md:p-8 shadow-[0_28px_70px_-16px_hsl(var(--foreground)/0.4)]", showingResult && "max-md:rounded-none max-md:bg-transparent max-md:p-0 max-md:shadow-none")}>
            <TrademarkSearch
              variant="landing"
              continueLabel="Continuar o registro"
              onContinue={() => navigate("/consultar", { state: { continueSearch: true } })}
            />
          </div>

          {/* Trust pills — mobile only, below viability search */}
          <div className={cn("flex lg:hidden flex-wrap gap-2.5 justify-center mt-8", showingResult && "max-md:hidden")}>
            {trustPills.map((p, i) => (
              <span
                key={i}
                className="hero4-pill hero4-pill-light inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold"
              >
                <span className="hero4-pill-icon w-5 h-5 rounded-full flex items-center justify-center">
                  <p.icon className="w-3 h-3 text-white" strokeWidth={2.5} />
                </span>
                {p.label}
              </span>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};

export default HeroSection;
