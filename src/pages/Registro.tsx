import { useEffect } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import RegistrationFormSection from "@/components/sections/RegistrationFormSection";

const Registro = () => {
  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        <RegistrationFormSection />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Registro;
