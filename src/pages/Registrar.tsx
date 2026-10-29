import ConsultationShell from "@/components/consultar/ConsultationShell";
import ConsultationEntry from "@/components/consultar/ConsultationEntry";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { TrademarkSearch } from "@/modules/trademark-search/components/TrademarkSearch";
import { useTrademarkSearch, toViabilityResult } from "@/modules/trademark-search/useTrademarkSearch";
import { PersonalDataStep, type PersonalData } from "@/components/cliente/checkout/PersonalDataStep";
import { BrandDataStep, type BrandData } from "@/components/cliente/checkout/BrandDataStep";
import { PlanSelectionStep } from "@/components/cliente/checkout/PlanSelectionStep";
import { PaymentStep } from "@/components/cliente/checkout/PaymentStep";
import { ContractStep } from "@/components/cliente/checkout/ContractStep";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ViabilityResult } from "@/lib/api/viability";
import type { PlanType } from "@/hooks/useContractTemplate";

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
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState(false);
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
      handleViabilityNext(s.brandName, s.businessArea, toViabilityResult(s.job));
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleViabilityNext = async (brandName: string, businessArea: string, result: ViabilityResult) => {
    setViabilityData({ brandName, businessArea, result });
    setSuggestedClasses([]); setSuggestedClassDescriptions([]); setSelectedClasses([]);
    setClassesLoading(true); setClassesError(false); setStep(2);
    try {
      const { data, error } = await supabase.functions.invoke('inpi-viability-check', {
        body: { brandName, businessArea, classesOnly: true },
      });
      if (error) throw error;
      const classes: number[] = Array.isArray(data?.classes) ? data.classes : [];
      const descriptions: string[] = Array.isArray(data?.classDescriptions) ? data.classDescriptions : [];
      if (!classes.length || classes.length !== descriptions.length || new Set(classes).size !== classes.length ||
          classes.some(c => !Number.isInteger(c) || c < 1 || c > 45) || descriptions.some(d => typeof d !== 'string' || !d.trim())) {
        throw new Error('Resposta de classes incompleta');
      }
      const primary = Number.isInteger(data.primaryClass) && classes.includes(data.primaryClass)
        ? data.primaryClass : classes[descriptions.findIndex(d => /classe principal/i.test(d))];
      if (!primary) throw new Error('Classe principal não informada');
      setSuggestedClasses(classes); setSuggestedClassDescriptions(descriptions); setSelectedClasses([primary]);
    } catch {
      setClassesError(true);
      toast.error('Não foi possível carregar as classes sugeridas. Tente novamente antes de continuar.');
    } finally { setClassesLoading(false); }
  };

  const handlePersonalDataNext = (data: PersonalData) => {
    setPersonalData(data);
    setStep(3);
  };

  const handleBrandDataNext = (data: BrandData) => {
    if (classesLoading || classesError || !suggestedClasses.length) { toast.error("Aguarde as classes sugeridas ou tente carregar novamente."); return; }
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
          contractHtml,
          selectedClasses,
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

  if (location.pathname === "/consultar" && step === 1 && searchState.phase === "idle") {
    return <ConsultationEntry onContinue={(brand, area, job) => handleViabilityNext(brand, area, toViabilityResult(job))} />;
  }

  return <>      <Helmet>
        <title>Registrar Marca no INPI Online — Protocolo em 48h | WebMarcas</title>
        <meta name="description" content="Registre sua marca no INPI em 48h. Consulta de viabilidade gratuita, contrato digital, pagamento facilitado e acompanhamento completo. A partir de R$699." />
        <link rel="canonical" href="https://webmarcas.net/consultar" />
        <meta property="og:url" content="https://webmarcas.net/consultar" />
        <meta property="og:title" content="Registrar Marca no INPI Online — Protocolo em 48h | WebMarcas" />
        <meta property="og:description" content="Consulta grátis, protocolo em 48h, contrato digital e acompanhamento completo." />
      </Helmet><ConsultationShell step={step === 1 ? undefined : step}>
            {classesLoading && <p role="status" className="text-sm mb-4">Carregando classes sugeridas para sua atividade...</p>}
            {classesError && <div role="alert" className="mb-4"><p>As classes sugeridas não foram carregadas. Tente novamente para continuar.</p><button type="button" onClick={() => viabilityData && void handleViabilityNext(viabilityData.brandName, viabilityData.businessArea, viabilityData.result)}>Carregar classes novamente</button></div>}
            {step === 1 && (
              <TrademarkSearch consultationVisual
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
                submitLabel="ASSINAR AGORA"
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

  </ConsultationShell></>;
}
