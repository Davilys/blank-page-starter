import { Shield, FileSignature, UserCheck, CalendarCheck, Star, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import LeadFormCard from "@/components/sections/LeadFormCard";
import ScribbleUnderline from "@/components/decorative/ScribbleUnderline";
import WaveDivider from "@/components/decorative/WaveDivider";
import seal48h from "@/assets/rebrand/seal-48h.png";
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
          <div className="text-center lg:text-left">
            {/* Subtle badge — matches reference */}
            <span className="hero-pill-badge mb-6">Registro de marcas · INPI</span>

            {/* Heading */}
            <h1 className="font-display text-[2.75rem] sm:text-5xl xl:text-[4rem] font-black leading-[1.05] tracking-tight mb-6 mt-4 text-white">
              Proteja sua marca,
              <br />
              faça o <span className="relative inline-block">
                registro
                <ScribbleUnderline />
              </span>{" "}
              agora!
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-lg text-white/85 max-w-lg mx-auto lg:mx-0 mb-8 leading-relaxed">
              Evite plágios e o uso indevido do seu nome. Protocolo oficial no{" "}
              <strong className="text-white font-bold">INPI em até 48h</strong> com acompanhamento humano do início ao fim.
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
                      <Star key={i} className="w-4 h-4 fill-[hsl(20_100%_55%)] text-[hsl(20_100%_55%)]" />
                    ))}
                  </div>
                  <span className="font-display font-black text-white text-lg leading-none">4,9/5</span>
                </div>
                <p className="text-xs md:text-sm text-white/85 mt-1">
                  Mais de <span className="font-bold text-white">11.000 marcas</span> protegidas
                </p>
              </div>
            </div>

            {/* Trust pills — white pills with green check like reference */}
            <div className="flex flex-wrap gap-2.5 justify-center lg:justify-start">
              {trustPills.map((p, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.25 + i * 0.06 }}
                  className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-[hsl(222_47%_16%)] text-xs md:text-sm font-semibold shadow-sm"
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </span>
                  {p.label}
                </motion.span>
              ))}
            </div>
          </div>

          {/* Right — Lead capture form (matches reference) */}
          <div className="relative w-full max-w-md mx-auto lg:max-w-none">
            {/* 48h floating seal */}
            <img
              src={seal48h}
              alt="Registro no INPI em 48h"
              className="pointer-events-none absolute -top-8 -right-4 sm:-right-6 md:-right-8 w-24 sm:w-28 md:w-32 z-20 drop-shadow-xl animate-[spin_28s_linear_infinite]"
              style={{ animationDirection: "reverse" as any }}
            />
            <div className="relative rounded-[2rem] bg-white p-7 md:p-9 shadow-[0_28px_70px_-16px_rgba(11,22,60,0.4)]">
              <LeadFormCard />
            </div>
          </div>
        </div>

      </div>
      <WaveDivider className="absolute bottom-0 left-0 right-0 z-10" fill="hsl(var(--background))" />
    </section>
  );
};

export default HeroSection;
