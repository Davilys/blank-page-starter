import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { StepDashes } from "@/components/formulario/QuickStepsForm";
import { TrademarkSearch } from "@/modules/trademark-search/components/TrademarkSearch";
import { useTrademarkSearch, toViabilityResult } from "@/modules/trademark-search/useTrademarkSearch";
import { PersonalDataStep, type PersonalData } from "@/components/cliente/checkout/PersonalDataStep";
import { BrandDataStep, type BrandData } from "@/components/cliente/checkout/BrandDataStep";
import { PlanSelectionStep } from "@/components/cliente/checkout/PlanSelectionStep";
import { PaymentStep } from "@/components/cliente/checkout/PaymentStep";
import { ContractStep } from "@/components/cliente/checkout/ContractStep";
import { toast } from "sonner";
import { Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import SocialProofNotification from "@/components/SocialProofNotification";
import type { ViabilityResult } from "@/lib/api/viability";
import type { PlanType } from "@/hooks/useContractTemplate";
import Header from "@/components/layout/Header";
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

export default function Registrar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: searchState } = useTrademarkSearch();
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

    // Veio da home clicando em "Continuar o registro": a consulta já concluída fica no Provider.
    const s = searchState;
    if ((location.state as { continueSearch?: boolean } | null)?.continueSearch && s.phase === 'completed' && s.job) {
      setViabilityData({ brandName: s.brandName, businessArea: s.businessArea, result: toViabilityResult(s.job) });
      setStep(2);
      navigate(location.pathname, { replace: true, state: null });
    }
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

  const handlePlanNext = (selectedPlan: PlanType) => {
    setPlan(selectedPlan);
    setStep(5); // Payment
  };

  const handlePaymentNext = (method: string, value: number) => {
    setPaymentMethod(method);
    setPaymentValue(value);
    setStep(6); // Contract
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
        <title>Registrar Marca no INPI Online — Protocolo em 48h | WebMarcas</title>
        <meta name="description" content="Registre sua marca no INPI em 48h. Consulta de viabilidade gratuita, contrato digital, pagamento facilitado e acompanhamento completo. A partir de R$699." />
        <link rel="canonical" href="https://webmarcas.net/registrar" />
        <meta property="og:url" content="https://webmarcas.net/registrar" />
        <meta property="og:title" content="Registrar Marca no INPI Online — Protocolo em 48h | WebMarcas" />
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

      {/* Public Header — desktop only */}
      <div className="hidden md:block">
        <Header />
      </div>

      {/* Main content */}
      <main className="relative z-10 w-full max-w-2xl mx-auto px-4 pt-4 md:pt-36 pb-10">
        {/* Badge */}
        <div className="flex justify-center mb-5 animate-fade-in">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-extrabold tracking-[0.18em] uppercase text-white shadow-[0_10px_20px_-6px_hsla(20,100%,50%,0.55)]"
            style={{ background: "linear-gradient(180deg, hsl(20 100% 55%), hsl(14 100% 50%))" }}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Registro de Marcas · INPI</span>
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
            <span className="block">Apenas 5 minutos.</span>
            <span className="block">
              <span className="relative inline-block">
                Registre
                <ScribbleUnderline />
              </span>{" "}
              sua marca!
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-base md:text-lg text-white/85 max-w-xl mx-auto"
          >
            Consulta de viabilidade gratuita no INPI + análise técnica em minutos. Processo 100% online conduzido por especialistas.
          </motion.p>
        </div>

        {/* Form card */}
        <Card
          className="border border-white/60 bg-white"
          style={{ boxShadow: "var(--shadow-card-hero)" }}
        >
          <CardContent className="p-6 md:p-8">
            <StepDashes total={6} current={step} />
            {step === 1 && (
              <TrademarkSearch
                variant="checkout"
                continueLabel="Continuar o registro"
                onContinue={(brand, area, job) => handleViabilityNext(brand, area, toViabilityResult(job))}
              />
            )}

            {step === 2 && personalData !== null && (
              <PersonalDataStep
                initialData={personalData}
                onNext={handlePersonalDataNext}
                onBack={() => setStep(1)}
              />
            )}

            {step === 2 && personalData === null && (
              <PersonalDataStep
                initialData={{
                  fullName: '', email: '', phone: '', cpf: '',
                  cep: '', address: '', addressNumber: '', city: '', state: '', neighborhood: '',
                }}
                onNext={handlePersonalDataNext}
                onBack={() => setStep(1)}
              />
            )}

            {step === 3 && (
              <BrandDataStep
                initialData={{
                  brandName: viabilityData?.brandName || '',
                  businessArea: viabilityData?.businessArea || '',
                  hasCNPJ: false, cnpj: '', companyName: '',
                }}
                onNext={handleBrandDataNext}
                onBack={() => setStep(2)}
                suggestedClasses={suggestedClasses}
                suggestedClassDescriptions={suggestedClassDescriptions}
                selectedClasses={selectedClasses}
                onSelectedClassesChange={setSelectedClasses}
              />
            )}

            {step === 4 && (
              <PlanSelectionStep
                selectedPlan={plan}
                onNext={handlePlanNext}
                onBack={() => setStep(3)}
              />
            )}

            {step === 5 && (
              <PaymentStep
                selectedMethod={paymentMethod}
                onNext={handlePaymentNext}
                onBack={() => setStep(4)}
                classCount={selectedClasses.length > 0 ? selectedClasses.length : 1}
                plan={plan}
              />
            )}

            {step === 6 && personalData && brandData && (
              <ContractStep
                personalData={personalData}
                brandData={{
                  ...brandData,
                  businessArea: viabilityData?.businessArea || brandData.businessArea,
                }}
                paymentMethod={paymentMethod}
                paymentValue={paymentValue}
                onBack={() => setStep(5)}
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
