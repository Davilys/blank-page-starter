import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { StepDashes, QuickLeadStep, ComplementStep, type QuickData } from "@/components/formulario/QuickStepsForm";
import { type PersonalData } from "@/components/cliente/checkout/PersonalDataStep";
import { type BrandData } from "@/components/cliente/checkout/BrandDataStep";
import { PlanSelectionStep } from "@/components/cliente/checkout/PlanSelectionStep";
import { PaymentStep } from "@/components/cliente/checkout/PaymentStep";
import { ContractStep } from "@/components/cliente/checkout/ContractStep";
import { toast } from "sonner";
import { Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import SocialProofNotification from "@/components/SocialProofNotification";
import type { ViabilityResult } from "@/lib/api/viability";
import type { PlanType } from "@/hooks/useContractTemplate";
import ScribbleUnderline from "@/components/decorative/ScribbleUnderline";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import Footer from "@/components/layout/Footer";
import RegistrationTrustFooter from "@/components/layout/RegistrationTrustFooter";

// Dynamic text options for typing effect
const dynamicTexts = [
  "seja exclusivo",
  "proteja seu negócio", 
  "garanta seu futuro",
  "destaque-se",
  "cresça com segurança",
];

export default function Formulario() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Phrase animation state
  const [phraseIndex, setPhraseIndex] = useState(0);
  
  const [viabilityData, setViabilityData] = useState<{
    brandName: string;
    businessArea: string;
    result: ViabilityResult;
  } | null>(null);
  
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [brandData, setBrandData] = useState<BrandData | null>(null);
  const [plan, setPlan] = useState<PlanType>("essencial");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentValue, setPaymentValue] = useState<number>(0);

  // NCL classes state
  const [suggestedClasses, setSuggestedClasses] = useState<number[]>([]);
  const [suggestedClassDescriptions, setSuggestedClassDescriptions] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);

  // Phrase rotation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % dynamicTexts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Pre-fill personal data if user is logged in and check for viability data
  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (profile) {
          setPersonalData({
            fullName: profile.full_name || '',
            email: profile.email || '',
            phone: profile.phone || '',
            cpf: profile.cpf_cnpj || '',
            cep: profile.zip_code || '',
            address: profile.address || '',
            addressNumber: '',
            city: profile.city || '',
            state: profile.state || '',
            neighborhood: profile.neighborhood || '',
          });
        }
      }
    };
    fetchUserData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleViabilityNext = (brandName: string, businessArea: string, result: ViabilityResult) => {
    setViabilityData({ brandName, businessArea, result });
    if (Array.isArray(result.classes) && result.classes.length > 0) {
      setSuggestedClasses(result.classes);
      setSuggestedClassDescriptions(result.classDescriptions || []);
    }
    setStep(2);
  };

  const handlePersonalDataNext = (data: PersonalData) => {
    setPersonalData(data);
    setStep(3);
  };

  const handleBrandDataNext = (data: BrandData) => {
    setBrandData(data);
    setStep(4); // Plan selection
  };

  const [quick, setQuick] = useState<QuickData>({ brandName: '', businessArea: '', fullName: '', email: '', phone: '' });
  const emptyPersonal = (q: QuickData): PersonalData => ({ fullName: q.fullName, email: q.email, phone: q.phone, cpf: '', cep: '', address: '', addressNumber: '', city: '', state: '', neighborhood: '' });
  const handleQuickNext = (q: QuickData) => {
    setQuick(q);
    setViabilityData({ brandName: q.brandName, businessArea: q.businessArea, result: { success: true, level: 'medium', title: '', description: '' } });
    setPersonalData((prev) => ({ ...(prev ?? emptyPersonal(q)), fullName: q.fullName, email: q.email, phone: q.phone }));
    setBrandData((prev) => ({ ...(prev ?? { hasCNPJ: false, cnpj: '', companyName: '' }), brandName: q.brandName, businessArea: q.businessArea }));
    setStep(2);
  };

  const handlePlanNext = (selectedPlan: PlanType) => {
    setPlan(selectedPlan);
    setStep(4); // Payment
  };

  const handlePaymentNext = (method: string, value: number) => {
    setPaymentMethod(method);
    setPaymentValue(value);
    setStep(5); // Contract
  };

  const handleSubmit = async (contractHtml: string) => {
    if (!personalData || !brandData || !viabilityData) {
      toast.error("Dados incompletos. Por favor, revise as etapas anteriores.");
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedClassDescriptions = selectedClasses.map(cls => {
        const idx = suggestedClasses.indexOf(cls);
        return idx >= 0 ? suggestedClassDescriptions[idx] : `Classe ${cls}`;
      });

      const { data, error } = await supabase.functions.invoke('create-asaas-payment', {
        body: {
          personalData: {
            ...personalData,
            neighborhood: personalData.neighborhood || '',
          },
          brandData: {
            ...brandData,
            businessArea: viabilityData.businessArea,
          },
          paymentMethod,
          paymentValue,
          contractHtml,
          selectedClasses,
          classDescriptions: selectedClassDescriptions,
          suggestedClasses,
          suggestedClassDescriptions,
          plan,
        },
      });

      if (error) throw error;

      if (data?.success) {
        const orderData = {
          personalData: {
            ...personalData,
            neighborhood: personalData.neighborhood || '',
          },
          brandData: {
            ...brandData,
            businessArea: viabilityData.businessArea,
          },
          paymentMethod,
          paymentValue,
          acceptedAt: new Date().toISOString(),
          leadId: data.leadId,
          contractId: data.contractId,
          invoiceId: data.invoiceId,
          contractNumber: data.contractNumber,
          plan,
          asaas: {
            customerId: data.customerId,
            asaasCustomerId: data.asaasCustomerId || data.customerId,
            paymentId: data.paymentId,
            status: data.status || 'PENDING',
            billingType: data.billingType,
            dueDate: data.dueDate,
            invoiceUrl: data.invoiceUrl,
            bankSlipUrl: data.bankSlipUrl,
            pixQrCode: data.pixQrCode,
          },
        };
        
        sessionStorage.setItem('orderData', JSON.stringify(orderData));
        toast.success("Pedido realizado com sucesso!");
        navigate('/status-pedido');
      } else {
        throw new Error(data?.error || 'Erro ao processar pagamento');
      }
    } catch (error: any) {
      console.error('Error submitting order:', error);
      toast.error(error.message || "Erro ao processar o pedido. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="brand-public min-h-screen relative overflow-hidden bg-[hsl(220_33%_98%)]">
      <Helmet>
        <title>Proposta de Registro de Marca no INPI | WebMarcas</title>
        <meta name="description" content="Registre sua marca no INPI em 48h. Consulta de viabilidade gratuita, contrato digital, pagamento facilitado e acompanhamento completo. A partir de R$699." />
        <link rel="canonical" href="https://webmarcas.net/formulario" />
        <meta property="og:url" content="https://webmarcas.net/formulario" />
        <meta property="og:title" content="Proposta de Registro de Marca no INPI | WebMarcas" />
        <meta property="og:description" content="Consulta grátis, protocolo em 48h, contrato digital e acompanhamento completo." />
      </Helmet>
      {/* Blue hero band (top) */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[420px] md:h-[520px] hero-blue-bg"
        style={{ background: "var(--gradient-hero-blue)" }}
      />
      <div aria-hidden className="absolute top-24 -left-20 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
      <div aria-hidden className="absolute top-40 right-0 w-80 h-80 rounded-full bg-[hsl(20_100%_55%)]/10 blur-3xl" />

      {/* Social Proof Notifications */}
      <SocialProofNotification />


      {/* Main content */}
      <main className="relative z-10 w-full max-w-2xl mx-auto px-4 pt-10 md:pt-14 pb-10">
        {/* Badge */}
        <div className="flex justify-center mb-5 animate-fade-in">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-extrabold tracking-[0.18em] uppercase text-white shadow-[0_10px_20px_-6px_hsla(20,100%,50%,0.55)]"
            style={{ background: "linear-gradient(180deg, hsl(20 100% 55%), hsl(14 100% 50%))" }}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Proposta de Registro de Marcas · INPI</span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-display text-3xl sm:text-4xl md:text-5xl font-black leading-[1.05] mb-4 text-center mx-auto max-w-3xl text-white"
          >
            <span className="block">Em apenas 1 minuto,</span>
            <span className="block">
              <span className="relative inline-block">
                receba
                <ScribbleUnderline />
              </span>{" "}
              sua proposta de registro de marca!
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-base md:text-lg text-white/85 max-w-xl mx-auto"
          >
            Preencha seus dados para gerar sua proposta. Após sua aprovação, iniciamos imediatamente o processo de registro da sua marca junto ao INPI.
          </motion.p>
        </div>

        {/* Form card */}
        <Card
          className="border border-white/60 bg-white"
          style={{ boxShadow: "var(--shadow-card-hero)" }}
        >
          <CardContent className="p-6 md:p-8">
            <StepDashes total={5} current={step} />
            {step === 1 && (
              <QuickLeadStep initial={quick} onNext={handleQuickNext} />
            )}

            {step === 2 && (
              <ComplementStep
                personal={personalData ?? emptyPersonal(quick)}
                brand={brandData ?? { brandName: quick.brandName, businessArea: quick.businessArea, hasCNPJ: false, cnpj: '', companyName: '' }}
                onNext={(p, b) => { setPersonalData(p); setBrandData(b); setStep(3); }}
                onBack={() => setStep(1)}
              />
            )}

            {step === 3 && (
              <PlanSelectionStep
                selectedPlan={plan}
                onNext={handlePlanNext}
                onBack={() => setStep(2)}
              />
            )}

            {step === 4 && (
              <PaymentStep
                selectedMethod={paymentMethod}
                onNext={handlePaymentNext}
                onBack={() => setStep(3)}
                classCount={selectedClasses.length > 0 ? selectedClasses.length : 1}
                plan={plan}
              />
            )}

            {step === 5 && personalData && brandData && (
              <ContractStep
                personalData={personalData}
                brandData={{
                  ...brandData,
                  businessArea: viabilityData?.businessArea || brandData.businessArea,
                }}
                paymentMethod={paymentMethod}
                paymentValue={paymentValue}
                onBack={() => setStep(4)}
                onSubmit={(html) => handleSubmit(html)}
                isSubmitting={isSubmitting}
                selectedClasses={selectedClasses}
                classDescriptions={selectedClasses.map(cls => {
                  const idx = suggestedClasses.indexOf(cls);
                  return idx >= 0 ? suggestedClassDescriptions[idx] : `Classe ${cls}`;
                })}
                suggestedClasses={suggestedClasses}
                suggestedClassDescriptions={suggestedClassDescriptions}
                onSelectedClassesChange={setSelectedClasses}
                onPaymentValueChange={setPaymentValue}
                plan={plan}
              />
            )}
          </CardContent>
        </Card>

        <RegistrationTrustFooter />
      </main>

      {/* WhatsApp Floating Button */}
      <WhatsAppButton />
      <Footer />
    </div>
  );
}
