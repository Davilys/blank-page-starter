import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, MessageCircle, FileText, Clock, Shield, PartyPopper } from "lucide-react";
import { trackPurchase } from "@/lib/metaPixel";
import { Button } from "@/components/ui/button";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";

const Obrigado = () => {
  const navigate = useNavigate();
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [showConfetti, setShowConfetti] = useState(true);
  const purchaseTracked = useRef(false);

  useEffect(() => {
    const data = sessionStorage.getItem("registrationComplete");
    if (data) {
      try {
        const parsedData = JSON.parse(data);
        setRegistrationData(parsedData);
        
        // Track Purchase event only once
        if (!purchaseTracked.current) {
          trackPurchase(parsedData.paymentValue || 698.97, 'BRL');
          purchaseTracked.current = true;
        }
      } catch {
        navigate("/registro");
      }
    } else {
      navigate("/registro");
    }
    
    // Hide confetti after animation
    setTimeout(() => setShowConfetti(false), 3000);
  }, [navigate]);

  const handleWhatsApp = () => {
    const message = encodeURIComponent(
      `Olá! Acabei de finalizar meu pedido de registro da marca "${registrationData?.brandData?.brandName}". Gostaria de falar com um especialista.`
    );
    window.open(`https://wa.me/5511911120225?text=${message}`, "_blank");
  };

  if (!registrationData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        <section className="section-padding relative overflow-hidden">
          {/* Background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/10 rounded-full blur-3xl animate-pulse" />

          {/* Confetti Animation */}
          {showConfetti && (
            <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute animate-bounce"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `-20px`,
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${2 + Math.random() * 2}s`,
                  }}
                >
                  <PartyPopper className="w-6 h-6 text-accent" />
                </div>
              ))}
            </div>
          )}

          <div className="container mx-auto px-4 relative z-10">
            {/* Success Icon with Animation */}
            <div className="text-center mb-8 animate-scale-in">
              <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-accent to-emerald-600 mb-6 shadow-lg animate-pulse-glow">
                <CheckCircle className="w-14 h-14 text-white animate-bounce" style={{ animationDuration: '2s' }} />
              </div>
              
              <span className="badge-premium mb-4 inline-flex bg-accent/10 text-accent border-accent/30">
                ✅ {registrationData.paymentConfirmed ? "Pagamento Identificado" : "Aguardando Pagamento"}
              </span>
              
              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4 animate-fade-in-up">
                🎉 Parabéns! Sua marca está em{" "}
                <span className="gradient-text-accent">boas mãos.</span>
              </h1>
              
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                Seu pedido foi recebido com sucesso. Nossa equipe jurídica iniciará imediatamente 
                o processo de registro junto ao INPI.
              </p>
            </div>

            {/* Registration Details Card */}
            <div className="max-w-2xl mx-auto mb-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="glass-card p-8">
                <h2 className="font-display text-xl font-semibold mb-6 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Resumo do Pedido
                </h2>

                <div className="space-y-4">
                  <div className="flex items-start justify-between py-3 border-b border-border">
                    <span className="text-muted-foreground">Cliente</span>
                    <span className="font-medium text-right">{registrationData.personalData?.fullName}</span>
                  </div>
                  
                  <div className="flex items-start justify-between py-3 border-b border-border">
                    <span className="text-muted-foreground">CPF</span>
                    <span className="font-medium">{registrationData.personalData?.cpf}</span>
                  </div>
                  
                  <div className="flex items-start justify-between py-3 border-b border-border">
                    <span className="text-muted-foreground">Marca</span>
                    <span className="font-medium text-primary">{registrationData.brandData?.brandName}</span>
                  </div>
                  
                  <div className="flex items-start justify-between py-3 border-b border-border">
                    <span className="text-muted-foreground">Ramo de Atividade</span>
                    <span className="font-medium text-right">{registrationData.brandData?.businessArea}</span>
                  </div>
                  
                  <div className="flex items-start justify-between py-3 border-b border-border">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-medium text-accent">R$ 698,97</span>
                  </div>
                  
                  <div className="flex items-start justify-between py-3">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Status
                    </span>
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 text-accent text-sm font-medium">
                      <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                      Processo iniciado
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="max-w-2xl mx-auto text-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className="glass-card p-8 mb-8">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-semibold">Próximos Passos</h3>
                </div>
                
                <div className="text-left space-y-3 text-muted-foreground mb-6">
                  <p>✅ Protocolo do pedido será enviado por e-mail</p>
                  <p>✅ Prazo médio de análise do INPI: 8-12 meses</p>
                  <p>✅ Acompanhamento completo via portal do cliente</p>
                  <p>✅ Suporte por WhatsApp durante todo o processo</p>
                </div>

                <Button
                  variant="hero"
                  size="lg"
                  onClick={handleWhatsApp}
                  className="group w-full sm:w-auto"
                >
                  <MessageCircle className="w-5 h-5" />
                  Falar com especialista no WhatsApp
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Contrato aceito em: {new Date(registrationData.acceptedAt).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Obrigado;
