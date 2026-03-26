import { Check, Star, ArrowRight, Flame, Loader2, CreditCard, FileText, Shield, Crown, Info, Infinity, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNextFridayFormatted } from "@/lib/dateUtils";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePricing } from "@/hooks/usePricing";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const PricingSection = () => {
  const { t } = useLanguage();
  const { pricing, isLoading, getCartaoParcelaText, getBoletoParcelaText } = usePricing();
  const navigate = useNavigate();

  const scrollToForm = () => {
    document.getElementById("consultar")?.scrollIntoView({ behavior: "smooth" });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
  } as const;

  const cardVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 100, damping: 15 } },
  };

  const essentialFeatures = [
    "Consulta de viabilidade com IA",
    "Depósito do pedido no INPI",
    "Acompanhamento até deferimento",
    "Laudo técnico completo",
    "Suporte por chat e WhatsApp",
    "Protocolo em até 48h",
  ];

  const premiumFeatures = [
    "Tudo do Plano Essencial",
    "Resposta a oposições inclusa",
    "Cumprimento de exigências incluso",
    "Recursos contra indeferimento inclusos",
    "Acompanhamento até o certificado",
    "Monitoramento contínuo da RPI",
    "Garantia: refazemos sem custo extra",
  ];

  const corporateFeatures = [
    "Tudo do Plano Premium",
    "Registro de marcas ilimitado",
    "Gerente de conta dedicado",
    "Prioridade máxima no atendimento",
    "Relatórios mensais personalizados",
    "Consultoria estratégica de portfólio",
    "Monitoramento ilimitado de marcas",
    "Suporte jurídico prioritário",
  ];

  if (isLoading) {
    return (
      <section id="precos" className="section-padding bg-gradient-to-b from-background to-muted/30 relative overflow-hidden">
        <div className="container mx-auto px-4 flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  return (
    <section id="precos" className="section-padding bg-gradient-to-b from-background to-muted/30 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-48 md:w-72 h-48 md:h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-64 md:w-96 h-64 md:h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        className="container mx-auto px-4 relative z-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={containerVariants}
      >
        {/* Header */}
        <motion.div className="text-center max-w-2xl mx-auto mb-8 md:mb-12" variants={cardVariants}>
          <span className="badge-premium mb-4 inline-flex">{t("pricing.badge")}</span>
          <h2 className="text-display mb-4">
            {t("pricing.title")}{" "}
            <span className="gradient-text">{t("pricing.titleHighlight")}</span>
          </h2>
          <p className="text-muted-foreground text-base md:text-lg">
            Escolha o plano ideal para proteger sua marca com segurança.
          </p>
        </motion.div>

        {/* Three Cards */}
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
          {/* Essencial */}
          <motion.div
            className="bg-card rounded-3xl shadow-lg border border-border/50 overflow-hidden relative flex flex-col"
            variants={cardVariants}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
          >
            <div className="p-6 md:p-8 flex flex-col flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-5 h-5 text-primary" />
                <h3 className="font-display text-xl font-bold text-foreground">Plano Essencial</h3>
              </div>
              <p className="text-muted-foreground text-sm mb-6">Registro + acompanhamento básico</p>

              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-lg text-muted-foreground line-through">R$1.194</span>
                  <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">-43%</span>
                </div>
                <div className="text-4xl md:text-5xl font-display font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent mb-1">
                  R$699
                </div>
                <span className="text-muted-foreground text-sm">à vista no PIX</span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-6">
                <div className="bg-muted/50 rounded-xl p-3 text-center border border-border/50">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <CreditCard className="w-3.5 h-3.5 text-primary" />
                    <span className="font-semibold text-foreground text-sm">{getCartaoParcelaText()}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">no cartão</span>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center border border-border/50">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span className="font-semibold text-foreground text-sm">{getBoletoParcelaText()}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">no boleto</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6 flex-1">
                {essentialFeatures.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-accent" />
                    </div>
                    <span className="text-foreground text-sm">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                size="lg"
                className="w-full rounded-2xl"
                onClick={scrollToForm}
              >
                Registrar por R$699
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <p className="text-[10px] text-muted-foreground text-center mt-3">
                Taxas do INPI não incluídas. Recursos cobrados separadamente.
              </p>
            </div>
          </motion.div>

          {/* Premium */}
          <motion.div
            className="bg-card rounded-3xl shadow-2xl border-2 border-primary/30 overflow-hidden relative flex flex-col"
            variants={cardVariants}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            {/* Badge */}
            <div className="absolute top-0 right-0">
              <div className="bg-gradient-to-r from-primary to-blue-500 text-primary-foreground text-xs font-bold px-4 py-2 rounded-bl-2xl flex items-center gap-1.5 shadow-lg">
                <Crown className="w-3.5 h-3.5 fill-current" />
                Recomendado
              </div>
            </div>

            <div className="p-6 md:p-8 flex flex-col flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-primary" />
                <h3 className="font-display text-xl font-bold text-foreground">Plano Premium</h3>
              </div>
              <p className="text-muted-foreground text-sm mb-6">Proteção total até o certificado</p>

              <div className="text-center mb-6">
                <div className="text-4xl md:text-5xl font-display font-bold bg-gradient-to-r from-primary via-blue-500 to-primary bg-clip-text text-transparent mb-1">
                  R$398<span className="text-lg">/mês</span>
                </div>
                <span className="text-muted-foreground text-sm">assinatura mensal · tudo incluso</span>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-6 text-center">
                <span className="text-xs font-semibold text-primary">✨ Recursos + Oposições + Exigências = INCLUSO</span>
              </div>

              <ul className="space-y-3 mb-6 flex-1">
                {premiumFeatures.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-accent" />
                    </div>
                    <span className="text-foreground text-sm font-medium">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant="hero"
                size="lg"
                className="w-full rounded-2xl shadow-xl shadow-primary/25 hover:shadow-primary/40"
                onClick={scrollToForm}
              >
                Começar Plano Premium
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <div className="mt-3 bg-destructive/10 border border-destructive/20 rounded-xl p-2 flex items-center justify-center gap-2">
                <Flame className="w-4 h-4 text-destructive animate-pulse" />
                <p className="text-xs font-semibold text-destructive">
                  Oferta válida até <span className="font-bold">{getNextFridayFormatted()}</span>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Corporativo */}
          <motion.div
            className="bg-gradient-to-b from-card to-muted/20 rounded-3xl shadow-lg border border-border/50 overflow-hidden relative flex flex-col"
            variants={cardVariants}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
          >
            {/* Badge */}
            <div className="absolute top-0 right-0">
              <div className="bg-gradient-to-r from-foreground to-foreground/80 text-background text-xs font-bold px-4 py-2 rounded-bl-2xl flex items-center gap-1.5 shadow-lg">
                <Zap className="w-3.5 h-3.5 fill-current" />
                Ilimitado
              </div>
            </div>

            <div className="p-6 md:p-8 flex flex-col flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Infinity className="w-5 h-5 text-primary" />
                <h3 className="font-display text-xl font-bold text-foreground">Plano Corporativo</h3>
              </div>
              <p className="text-muted-foreground text-sm mb-6">Marcas ilimitadas para sua empresa</p>

              <div className="text-center mb-6">
                <div className="text-4xl md:text-5xl font-display font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent mb-1">
                  R$1.621<span className="text-lg">/mês</span>
                </div>
                <span className="text-muted-foreground text-sm">assinatura mensal · marcas ilimitadas</span>
              </div>

              <div className="bg-foreground/5 border border-foreground/10 rounded-xl p-3 mb-6 text-center">
                <span className="text-xs font-semibold text-foreground">♾️ Registros ilimitados + Tudo do Premium</span>
              </div>

              <ul className="space-y-3 mb-6 flex-1">
                {corporateFeatures.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-accent" />
                    </div>
                    <span className="text-foreground text-sm">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant="default"
                size="lg"
                className="w-full rounded-2xl"
                onClick={scrollToForm}
              >
                Começar Plano Corporativo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <p className="text-[10px] text-muted-foreground text-center mt-3">
                Ideal para escritórios e empresas com múltiplas marcas.
              </p>
            </div>
          </motion.div>
        </div>

        {/* INPI Taxes Transparency */}
        <motion.div
          className="max-w-6xl mx-auto mt-8"
          variants={cardVariants}
        >
          <div className="bg-muted/40 border border-border/50 rounded-2xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-primary" />
              <h4 className="font-display font-bold text-sm text-foreground">Taxas Governamentais do INPI (2026)</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Além dos honorários, o INPI cobra taxas oficiais para o pedido de registro.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-xl p-4 border border-border/50 text-center">
                <p className="text-xs text-muted-foreground mb-1">Pessoa Jurídica (LTDA)</p>
                <p className="font-display font-bold text-lg text-foreground">R$ 840,00</p>
              </div>
              <div className="bg-card rounded-xl p-4 border border-border/50 text-center">
                <p className="text-xs text-muted-foreground mb-1">PF / MEI / Simples Nacional</p>
                <p className="font-display font-bold text-lg text-foreground">R$ 440,00</p>
              </div>
            </div>
          </div>
        </motion.div>

        <p className="text-[10px] text-muted-foreground text-center mt-4 max-w-md mx-auto">
          {t("pricing.disclaimer")}
        </p>
      </motion.div>
    </section>
  );
};

export default PricingSection;
