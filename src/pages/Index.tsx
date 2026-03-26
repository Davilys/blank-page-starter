import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import SocialProofNotification from "@/components/SocialProofNotification";
import HeroSection from "@/components/sections/HeroSection";
import BenefitsSection from "@/components/sections/BenefitsSection";
import HowItWorksSection from "@/components/sections/HowItWorksSection";
import PricingSection from "@/components/sections/PricingSection";
import BlockchainBanner from "@/components/sections/BlockchainBanner";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import FAQSection from "@/components/sections/FAQSection";
import CTASection from "@/components/sections/CTASection";
import BlogPreviewSection from "@/components/sections/BlogPreviewSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mobile-compact">
        <HeroSection />
        <BenefitsSection />
        <HowItWorksSection />
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
