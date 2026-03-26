import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Shield, Lock, FileCheck, ArrowRight, Blocks, Globe,
  Fingerprint, ExternalLink, Zap, Award, BadgeCheck, Bitcoin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: "easeOut" as const },
});

const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.12 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const RegistroBlockchain = () => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const features = [
    {
      icon: Lock,
      title: "Imutabilidade Total",
      description: "Uma vez registrado, o hash do documento não pode ser alterado ou falsificado por ninguém.",
      gradient: "from-blue-500/20 to-cyan-500/20",
    },
    {
      icon: Fingerprint,
      title: "Prova de Autenticidade",
      description: "Cada documento recebe um hash SHA-256 único, vinculado ao conteúdo e à assinatura.",
      gradient: "from-violet-500/20 to-purple-500/20",
    },
    {
      icon: Globe,
      title: "Verificação Pública",
      description: "Qualquer pessoa pode verificar a autenticidade do documento a qualquer momento via QR Code.",
      gradient: "from-emerald-500/20 to-teal-500/20",
    },
    {
      icon: FileCheck,
      title: "Validade Jurídica",
      description: "Registro conforme Lei 14.063/2020, com carimbo de tempo OpenTimestamps na rede Bitcoin.",
      gradient: "from-amber-500/20 to-orange-500/20",
    },
  ];

  const steps = [
    { icon: Zap, title: "Envie seu documento", description: "Upload do contrato, procuração ou qualquer documento que deseja registrar." },
    { icon: Fingerprint, title: "Geração do Hash", description: "Nosso sistema gera automaticamente um hash SHA-256 único do conteúdo." },
    { icon: Bitcoin, title: "Registro em Blockchain", description: "O hash é registrado na rede Bitcoin via OpenTimestamps com prova criptográfica." },
    { icon: BadgeCheck, title: "Certificado Emitido", description: "Você recebe o certificado com QR Code de verificação e arquivo .ots de prova." },
  ];

  const trustItems = [
    { label: "Rede Bitcoin", icon: Bitcoin },
    { label: "SHA-256", icon: Lock },
    { label: "Lei 14.063", icon: FileCheck },
    { label: "OpenTimestamps", icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        {/* ===== HERO ===== */}
        <section className="relative overflow-hidden py-20 md:py-32">
          {/* Animated background orbs */}
          <motion.div
            className="absolute top-10 left-[10%] w-80 h-80 bg-primary/8 rounded-full blur-[100px]"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-0 right-[5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_75%)]" />

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <motion.div {...fadeUp(0)}>
                <motion.span
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-semibold mb-8"
                  whileHover={{ scale: 1.05 }}
                >
                  <Blocks className="w-4 h-4" />
                  Tecnologia Blockchain
                </motion.span>
              </motion.div>

              <motion.h1
                {...fadeUp(0.1)}
                className="font-display text-4xl md:text-5xl lg:text-[3.5rem] xl:text-6xl font-bold mb-6 leading-[1.1] tracking-tight"
              >
                Registro de Documentos
                <br />
                em <span className="gradient-text">Blockchain</span>
              </motion.h1>

              <motion.p
                {...fadeUp(0.2)}
                className="text-muted-foreground text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed"
              >
                Garanta a autenticidade e integridade dos seus documentos com registro imutável na rede Bitcoin. Prova de existência com validade jurídica.
              </motion.p>

              <motion.div {...fadeUp(0.3)} className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
                <motion.a
                  href="https://registro.webmarcas.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative group"
                >
                  {/* Glow behind button */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary/40 to-primary/20 rounded-2xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                  <Button size="lg" className="relative w-full sm:w-auto gap-3 text-base font-semibold px-10 h-14 rounded-xl shadow-xl shadow-primary/25 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary">
                    <Blocks className="w-5 h-5" />
                    Registrar Agora
                    <ExternalLink className="w-4 h-4 opacity-70" />
                  </Button>
                </motion.a>
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" variant="outline" className="gap-3 text-base font-semibold h-14 px-8 rounded-xl border-2 border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all duration-300" asChild>
                    <a href="#como-funciona">
                      Como Funciona
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </a>
                  </Button>
                </motion.div>
              </motion.div>

              {/* Trust bar */}
              <motion.div
                {...fadeUp(0.4)}
                className="flex flex-wrap items-center justify-center gap-3 md:gap-5 mb-14"
              >
                {trustItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50 text-xs font-medium text-muted-foreground"
                  >
                    <item.icon className="w-3.5 h-3.5 text-primary" />
                    {item.label}
                  </div>
                ))}
              </motion.div>

              {/* Pricing Card */}
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card className="max-w-sm mx-auto border-primary/20 bg-gradient-to-b from-card to-card/80 backdrop-blur-xl shadow-xl shadow-primary/5 overflow-hidden relative">
                  {/* Glow effect */}
                  <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-primary/15 rounded-full blur-[60px]" />
                  <CardContent className="p-8 text-center relative">
                    <motion.div
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-5"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Award className="w-3.5 h-3.5" />
                      Oferta Especial
                    </motion.div>
                    <p className="text-2xl md:text-3xl font-bold mb-2">
                      1º Registro <span className="gradient-text">Grátis</span>
                    </p>
                    <div className="w-12 h-px bg-border mx-auto my-4" />
                    <p className="text-muted-foreground text-sm mb-2">
                      A partir do 2º registro
                    </p>
                    <p className="text-5xl font-extrabold text-foreground tracking-tight">
                      R$ 49
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">por documento</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ===== FEATURES ===== */}
        <section className="py-20 md:py-28 bg-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              className="text-center max-w-2xl mx-auto mb-16"
              {...fadeUp()}
              viewport={{ once: true }}
              whileInView="animate"
              initial="initial"
            >
              <span className="text-primary text-sm font-bold uppercase tracking-widest mb-3 block">Vantagens</span>
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                Por que usar <span className="gradient-text">Blockchain</span>?
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                A tecnologia que garante segurança absoluta para seus documentos mais importantes.
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
            >
              {features.map((feature, i) => (
                <motion.div key={i} variants={staggerItem}>
                  <motion.div
                    whileHover={{ y: -6, scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Card className="h-full border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group">
                      <CardContent className="p-6 md:p-7">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                          <feature.icon className="w-7 h-7 text-primary" />
                        </div>
                        <h3 className="font-display text-lg font-bold mb-2">{feature.title}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ===== HOW IT WORKS ===== */}
        <section id="como-funciona" className="py-20 md:py-28 relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              className="text-center max-w-2xl mx-auto mb-16"
              {...fadeUp()}
              whileInView="animate"
              initial="initial"
              viewport={{ once: true }}
            >
              <span className="text-primary text-sm font-bold uppercase tracking-widest mb-3 block">Passo a Passo</span>
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                Como <span className="gradient-text">Funciona</span>
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Processo simples e rápido em 4 etapas.
              </p>
            </motion.div>

            <div className="max-w-4xl mx-auto">
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8"
                variants={staggerContainer}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true }}
              >
                {steps.map((step, i) => (
                  <motion.div key={i} variants={staggerItem}>
                    <motion.div
                      className="relative flex items-start gap-5 p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/20 transition-all duration-300 group"
                      whileHover={{ x: 4 }}
                    >
                      {/* Step number */}
                      <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-lg shadow-primary/30">
                        {i + 1}
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                        <step.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-base font-bold mb-1">{step.title}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                      </div>
                    </motion.div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section className="py-20 md:py-28 bg-card relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/3 to-transparent" />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              className="max-w-2xl mx-auto text-center"
              {...fadeUp()}
              whileInView="animate"
              initial="initial"
              viewport={{ once: true }}
            >
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Shield className="w-4 h-4" />
                Comece Gratuitamente
              </motion.div>
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-5">
                Proteja seus documentos{" "}
                <span className="gradient-text">agora</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
                Seu primeiro registro em blockchain é por nossa conta. Garanta a autenticidade e integridade dos seus documentos mais importantes.
              </p>
              <motion.a
                href="https://registro.webmarcas.net"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
              >
                <Button size="lg" className="gap-2 text-base px-10 h-14 shadow-xl shadow-primary/20 text-lg font-semibold">
                  Acessar Plataforma de Registro
                  <ExternalLink className="w-5 h-5" />
                </Button>
              </motion.a>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default RegistroBlockchain;
