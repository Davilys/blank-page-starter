import { Search, FileText, CreditCard, FileSignature, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const HowItWorksSection = () => {
  const { t } = useLanguage();

  const steps = [
    {
      icon: Search,
      step: "01",
      title: t("howItWorks.step1.title"),
      description: t("howItWorks.step1.desc"),
    },
    {
      icon: FileText,
      step: "02",
      title: t("howItWorks.step2.title"),
      description: t("howItWorks.step2.desc"),
    },
    {
      icon: CreditCard,
      step: "03",
      title: t("howItWorks.step3.title"),
      description: t("howItWorks.step3.desc"),
    },
    {
      icon: FileSignature,
      step: "04",
      title: t("howItWorks.step4.title"),
      description: t("howItWorks.step4.desc"),
    },
    {
      icon: CheckCircle,
      step: "05",
      title: t("howItWorks.step5.title"),
      description: t("howItWorks.step5.desc"),
    },
  ];

  return (
    <section id="como-funciona" className="section-padding relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-hero-gradient opacity-50" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="badge-premium mb-4 inline-flex">{t("howItWorks.badge")}</span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t("howItWorks.title")}{" "}
            <span className="gradient-text">{t("howItWorks.titleHighlight")}</span>?
          </h2>
          <p className="text-muted-foreground text-lg">
            {t("howItWorks.subtitle")}
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative flex gap-6 mb-8 last:mb-0"
            >
              {/* Line connector */}
              {index < steps.length - 1 && (
                <div className="absolute left-6 top-16 w-0.5 h-full bg-gradient-to-b from-primary/50 to-transparent" />
              )}

              {/* Icon */}
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center shadow-lg shadow-primary/25">
                  <step.icon className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>

              {/* Content */}
              <div className="glass-card flex-1 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
                    {t("howItWorks.step")} {step.step}
                  </span>
                  <h3 className="font-display text-xl font-semibold">{step.title}</h3>
                </div>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
