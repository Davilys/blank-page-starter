import { Helmet } from "react-helmet-async";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import SocialProofNotification from "@/components/SocialProofNotification";
import HeroSection from "@/components/sections/HeroSection";
import SegmentsStrip from "@/components/sections/SegmentsStrip";
import StatsBandSection from "@/components/sections/StatsBandSection";
import BenefitsSection from "@/components/sections/BenefitsSection";
import ClientLogosMarquee from "@/components/sections/ClientLogosSection";
import HowItWorksSection from "@/components/sections/HowItWorksSection";
import PricingSection from "@/components/sections/PricingSection";
import BlockchainBanner from "@/components/sections/BlockchainBanner";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import FAQSection from "@/components/sections/FAQSection";
import CTASection from "@/components/sections/CTASection";
import BlogPreviewSection from "@/components/sections/BlogPreviewSection";

const Index = () => {
  return (
    <div className="brand-public min-h-screen bg-background">
      <Helmet>
        <title>WebMarcas Intelligence PI — Registro de Marca no INPI em 48h</title>
        <meta name="description" content="Registre sua marca no INPI 100% online. Protocolo em 48h, contrato digital, acompanhamento completo e garantia. A partir de R$699." />
        <link rel="canonical" href="https://webmarcas.net/" />
        <meta property="og:url" content="https://webmarcas.net/" />
        <meta property="og:title" content="WebMarcas Intelligence PI — Registro de Marca no INPI em 48h" />
        <meta property="og:description" content="Registre sua marca no INPI 100% online. Protocolo em 48h, contrato digital e garantia." />
      </Helmet>
      <Header />
      <main className="mobile-compact">
        <HeroSection />
        <SegmentsStrip />
        <StatsBandSection />
        <BenefitsSection />
        <HowItWorksSection />
        <ClientLogosMarquee />
        <PricingSection />
        <BlockchainBanner />
        <TestimonialsSection />
        <BlogPreviewSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
      <WhatsAppButton />
      <SocialProofNotification />
    </div>
  );
};

export default Index;
