import { Shield, FileSignature, UserCheck, CalendarCheck, Star, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import ViabilitySearchSection from "@/components/sections/ViabilitySearchSection";
import ScribbleUnderline from "@/components/decorative/ScribbleUnderline";
import WaveDivider from "@/components/decorative/WaveDivider";
import Seal48h from "@/components/decorative/Seal48h";
import consultant1 from "@/assets/consultants/consultant-1.jpg";
import consultant2 from "@/assets/consultants/consultant-2.jpg";
import consultant3 from "@/assets/consultants/consultant-3.jpg";

const HeroSection = () => {
  const { t } = useLanguage();

  const trustPills = [
    { icon: Shield, label: "Protocolo em 48h" },
    { icon: FileSignature, label: "Contrato digital" },
    { icon: UserCheck, label: "Especialista dedicado" },
    { icon: CalendarCheck, label: "10 anos de vigência" },
  ];

  return (
    <section id="home" className="relative hero-blue-bg overflow-x-clip overflow-y-visible">

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 relative z-10 max-w-7xl">
        {/* Two-column hero */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Left — Text */}
          <div className="text-center lg:text-left order-1 lg:order-none">
            {/* Orange badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[hsl(20_100%_55%)] to-[hsl(14_100%_48%)] px-5 py-2.5 text-white shadow-[0_10px_24px_-8px_hsla(20,100%,45%,0.55)] mb-6 mx-auto lg:mx-0">
              <Zap className="w-4 h-4 fill-white" />
              <span className="text-[11px] md:text-xs font-black uppercase tracking-[0.18em]">
                Registro de marcas · INPI
              </span>
            </div>

            {/* Heading */}
            <h1 className="font-display text-[2.75rem] sm:text-[3.25rem] xl:text-[4.25rem] font-black leading-[1.05] tracking-tight mb-6 text-white">
              {t("hero.title")}
              <br />
              faça o <span className="relative inline-block">
                registro
                <ScribbleUnderline />
              </span>{" "}
              agora!
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
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur border border-white/25 px-4 py-2 text-white text-xs md:text-sm font-semibold"
                >
                  <span className="w-5 h-5 rounded-full bg-[hsl(20_100%_55%)] flex items-center justify-center">
                    <p.icon className="w-3 h-3 text-white" strokeWidth={2.5} />
                  </span>
                  {p.label}
                </span>
              ))}
            </div>
          </div>

          {/* Right — Viability Search */}
          <div className="relative w-full max-w-md mx-auto lg:max-w-none order-2 lg:order-none">
            {/* 48h floating seal */}
            <Seal48h
              size={144}
              className="absolute -top-20 -right-4 sm:-top-24 sm:-right-6 md:-top-28 md:-right-10 z-20"
            />
            <div className="relative rounded-[2rem] bg-white p-6 md:p-8 shadow-[0_28px_70px_-16px_rgba(11,22,60,0.4)]">
              <ViabilitySearchSection compact />
            </div>
          </div>

          {/* Trust pills — mobile only, below viability search */}
          <div className="flex lg:hidden flex-wrap gap-2.5 justify-center order-3">
            {trustPills.map((p, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur border border-white/25 px-4 py-2 text-white text-xs font-semibold"
              >
                <span className="w-5 h-5 rounded-full bg-[hsl(20_100%_55%)] flex items-center justify-center">
                  <p.icon className="w-3 h-3 text-white" strokeWidth={2.5} />
                </span>
                {p.label}
              </span>
            ))}
          </div>
        </div>

      </div>
      <WaveDivider className="absolute bottom-0 left-0 right-0 z-10" fill="hsl(var(--background))" />
    </section>
  );
};

export default HeroSection;
