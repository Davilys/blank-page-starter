import { Shield, Clock, CheckCircle, Award, Star } from "lucide-react";
import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedCounter } from "@/components/admin/dashboard/AnimatedCounter";
import ViabilitySearchSection from "@/components/sections/ViabilitySearchSection";
import ClientLogosMarquee from "@/components/sections/ClientLogosSection";
import consultant1 from "@/assets/consultants/consultant-1.jpg";
import consultant2 from "@/assets/consultants/consultant-2.jpg";
import consultant3 from "@/assets/consultants/consultant-3.jpg";

const HeroSection = () => {
  const { t } = useLanguage();
  const [phraseIndex, setPhraseIndex] = useState(0);

  const phrases = [t("hero.phrase1"), t("hero.phrase2"), t("hero.phrase3")];

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [phrases.length]);

  const trustBadges = [
    { icon: Shield, label: t("hero.trust.inpi"), color: "text-blue-600", bgColor: "bg-blue-500/10" },
    { icon: Clock, label: t("hero.trust.protocol"), color: "text-emerald-600", bgColor: "bg-emerald-500/10" },
    { icon: CheckCircle, label: t("hero.trust.guarantee"), color: "text-violet-600", bgColor: "bg-violet-500/10" },
    { icon: Award, label: t("hero.trust.online"), color: "text-amber-600", bgColor: "bg-amber-500/10" },
  ];

  const stats = [
    { value: 11000, suffix: "+", label: t("hero.stats.brands") },
    { value: 98, suffix: "%", label: t("hero.stats.success") },
    { value: 48, suffix: "h", label: t("hero.stats.time") },
    { value: 15, suffix: "+", label: t("hero.stats.experience") },
  ];

  return (
    <section id="home" className="relative hero-glow overflow-x-clip overflow-y-visible">
      <div className="absolute inset-0 bg-hero-gradient" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-14 relative z-10 max-w-7xl">
        {/* Two-column hero */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          
          {/* Left — Text */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 badge-premium mb-6 w-fit mx-auto lg:mx-0">
              <Award className="w-4 h-4" />
              <span>{t("hero.badge")}</span>
            </div>

            {/* Heading */}
            <h1 className="font-display text-[2.5rem] sm:text-5xl xl:text-[3.5rem] font-bold leading-[1.15] mb-6">
              {t("hero.title")}{" "}
              <span className="inline-block overflow-hidden h-[1.15em] align-bottom relative">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={phraseIndex}
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '-100%', opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="inline-block gradient-text"
                  >
                    {phrases[phraseIndex]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 mb-10">
              {t("hero.subtitle")}
            </p>

            {/* Social Proof */}
            <div className="hidden sm:inline-flex flex-col sm:flex-row items-center lg:items-start gap-4 rounded-2xl bg-primary px-5 py-4 mx-auto lg:mx-0">
              <div className="flex items-center -space-x-3 shrink-0">
                <img src={consultant1} alt="Consultora" className="w-11 h-11 rounded-full border-2 border-primary-foreground/30 object-cover" />
                <img src={consultant2} alt="Consultor" className="w-11 h-11 rounded-full border-2 border-primary-foreground/30 object-cover" />
                <img src={consultant3} alt="Consultora" className="w-11 h-11 rounded-full border-2 border-primary-foreground/30 object-cover" />
              </div>
              <div className="text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-0.5 mb-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-xs text-primary-foreground/90 leading-snug max-w-[220px]">
                  Consultores disponíveis durante todo processo do registro via WhatsApp.
                </p>
              </div>
            </div>
          </div>

          {/* Right — Viability Search */}
          <div className="w-full max-w-md mx-auto lg:max-w-none">
            <ViabilitySearchSection compact />
          </div>
        </div>

        {/* Client Logos Marquee */}
        <div className="mt-14">
          <ClientLogosMarquee embedded />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto mt-16">
          {trustBadges.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-card/60 backdrop-blur-sm text-center"
            >
              <div className={`p-3 rounded-xl ${item.bgColor}`}>
                <item.icon className={`w-6 h-6 ${item.color}`} />
              </div>
              <span className="text-sm font-medium text-foreground leading-tight">{item.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 max-w-4xl mx-auto">
          {stats.map((stat, index) => (
            <motion.div 
              key={index} 
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
            >
              <div className="font-display text-3xl sm:text-4xl md:text-5xl font-bold gradient-text mb-2">
                <AnimatedCounter 
                  value={stat.value} 
                  suffix={stat.suffix}
                  duration={2.5}
                />
              </div>
              <div className="text-sm md:text-base text-muted-foreground font-medium">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
