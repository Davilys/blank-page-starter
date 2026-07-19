import { Search, FileText, CreditCard, FileSignature, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

const BLUE = "hsl(226 95% 40%)";
const BLUE_SOFT = "hsl(222 92% 96%)";

const HowItWorksSection = () => {
  const { t } = useLanguage();

  const steps = [
    { icon: Search, step: "01", title: t("howItWorks.step1.title"), description: t("howItWorks.step1.desc") },
    { icon: FileText, step: "02", title: t("howItWorks.step2.title"), description: t("howItWorks.step2.desc") },
    { icon: CreditCard, step: "03", title: t("howItWorks.step3.title"), description: t("howItWorks.step3.desc") },
    { icon: FileSignature, step: "04", title: t("howItWorks.step4.title"), description: t("howItWorks.step4.desc") },
    { icon: CheckCircle, step: "05", title: t("howItWorks.step5.title"), description: t("howItWorks.step5.desc") },
  ];

  return (
    <section id="como-funciona" className="relative py-20 md:py-28 bg-[hsl(220_33%_98%)]">
      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span
            className="inline-flex items-center rounded-full px-5 py-2 text-sm font-bold mb-6"
            style={{ background: BLUE_SOFT, color: BLUE }}
          >
            {t("howItWorks.badge")}
          </span>
          <h2
            className="font-display font-black leading-[1.05] tracking-[-0.03em] text-4xl md:text-6xl mb-5"
            style={{ color: "hsl(226 60% 10%)" }}
          >
            {t("howItWorks.title")}{" "}
            <span style={{ color: BLUE }}>{t("howItWorks.titleHighlight")}</span>?
          </h2>
          <p className="text-lg text-muted-foreground">{t("howItWorks.subtitle")}</p>
        </div>

        {/* Steps */}
        <div className="relative max-w-4xl mx-auto pl-4 md:pl-6">
          {steps.map((s, index) => {
            const Icon = s.icon;
            const isLast = index === steps.length - 1;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, delay: index * 0.06 }}
                className="relative flex gap-5 md:gap-8 pb-10 last:pb-0"
              >
                {/* Connector line */}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="absolute top-14 left-[26px] md:left-[30px] w-[2px] h-full"
                    style={{
                      backgroundImage:
                        "linear-gradient(to bottom, hsl(222 92% 54% / 0.5) 0 6px, transparent 6px 12px)",
                      backgroundSize: "2px 12px",
                    }}
                  />
                )}

                {/* Icon bubble */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-[52px] h-[52px] md:w-[60px] md:h-[60px] rounded-2xl flex items-center justify-center shadow-[0_14px_28px_-10px_hsla(222,92%,40%,0.5)]"
                    style={{
                      background: `linear-gradient(180deg, hsl(222 92% 54%), ${BLUE})`,
                    }}
                  >
                    <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" strokeWidth={2.25} />
                  </div>
                </div>

                {/* Card */}
                <div
                  className="flex-1 rounded-2xl bg-white px-6 py-6 md:px-8 md:py-7 border"
                  style={{
                    borderColor: "hsl(220 25% 92%)",
                    boxShadow: "0 4px 20px -8px hsla(226,60%,15%,0.08)",
                  }}
                >
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span
                      className="text-[11px] font-black tracking-[0.15em] px-3 py-1 rounded-full"
                      style={{ background: BLUE_SOFT, color: BLUE }}
                    >
                      {t("howItWorks.step")} {s.step}
                    </span>
                    <h3
                      className="font-display text-xl md:text-2xl font-black tracking-[-0.02em]"
                      style={{ color: "hsl(226 60% 10%)" }}
                    >
                      {s.title}
                    </h3>
                  </div>
                  <p className="text-muted-foreground text-[15px] md:text-base leading-relaxed">
                    {s.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
