import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
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
      <Helmet>
        <title>Registro de Marca no INPI — WebMarcas</title>
        <meta name="description" content="Inicie o registro da sua marca no INPI de forma 100% online. Protocolo em 48h, contrato digital e acompanhamento completo." />
        <link rel="canonical" href="https://webmarcas.net/registro" />
        <meta property="og:url" content="https://webmarcas.net/registro" />
        <meta property="og:title" content="Registro de Marca no INPI — WebMarcas" />
      </Helmet>
      <Header />
      <main className="pt-20">
        <h1 className="sr-only">Inicie o Registro da sua Marca no INPI</h1>
        <RegistrationFormSection />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Registro;
