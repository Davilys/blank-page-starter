import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { ClientLayout } from "@/components/cliente/ClientLayout";
import { CheckoutProgress } from "@/components/cliente/checkout/CheckoutProgress";
import { ViabilityStep } from "@/components/cliente/checkout/ViabilityStep";
import { PersonalDataStep, type PersonalData } from "@/components/cliente/checkout/PersonalDataStep";
import { BrandDataStep, type BrandData } from "@/components/cliente/checkout/BrandDataStep";
import { PlanSelectionStep } from "@/components/cliente/checkout/PlanSelectionStep";
import { PaymentStep } from "@/components/cliente/checkout/PaymentStep";
import { ContractStep } from "@/components/cliente/checkout/ContractStep";
import { toast } from "sonner";
import type { ViabilityResult } from "@/lib/api/viability";
import { generateAndUploadContractPdf } from "@/hooks/useContractPdfUpload";
import { Shield, Award, Clock, Star } from "lucide-react";
import type { PlanType } from "@/hooks/useContractTemplate";

const STEP_TITLES = [
  { title: "Consulta de Viabilidade", sub: "Verificando no banco do INPI" },
  { title: "Dados do Titular", sub: "Informações para o contrato" },
  { title: "Dados da Marca", sub: "Detalhes do registro e classes NCL" },
  { title: "Escolha do Plano", sub: "Selecione o plano ideal" },
  { title: "Forma de Pagamento", sub: "Escolha como pagar" },
  { title: "Contrato Digital", sub: "Revise e assine" },
];

const PLAN_LABELS: Record<PlanType, string> = {
  essencial: 'Plano Essencial',
  premium: 'Plano Premium',
  corporativo: 'Plano Corporativo',
};

export default function RegistrarMarca() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Read plan from URL as initial suggestion
  const planParam = (searchParams.get('plano') || 'essencial') as PlanType;
  const initialPlan: PlanType = ['premium', 'corporativo'].includes(planParam) ? planParam : 'essencial';

  const [plan, setPlan] = useState<PlanType>(initialPlan);

  const [viabilityResult, setViabilityResult] = useState<ViabilityResult | null>(null);
  const [personalData, setPersonalData] = useState<PersonalData>({
    fullName: "", email: "", phone: "", cpf: "",
    cep: "", address: "", addressNumber: "", neighborhood: "", city: "", state: "",
  });
  const [brandData, setBrandData] = useState<BrandData>({
    brandName: "", businessArea: "", hasCNPJ: false, cnpj: "", companyName: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentValue, setPaymentValue] = useState(0);

  // NCL classes state
  const [suggestedClasses, setSuggestedClasses] = useState<number[]>([]);
  const [suggestedClassDescriptions, setSuggestedClassDescriptions] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);

  // Pre-fill user data if logged in
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (profile) {
          setPersonalData(prev => ({
            ...prev,
            fullName: profile.full_name || prev.fullName,
            email: profile.email || prev.email,
            phone: profile.phone || prev.phone,
            cpf: profile.cpf_cnpj || prev.cpf,
            cep: profile.zip_code || prev.cep,
            address: profile.address || prev.address,
            city: profile.city || prev.city,
            state: profile.state || prev.state,
          }));
        }
      }
    });
  }, []);

  const handleViabilityNext = (brand: string, area: string, result: ViabilityResult) => {
    setBrandData(prev => ({ ...prev, brandName: brand, businessArea: area }));
    setViabilityResult(result);
    if (Array.isArray(result.classes) && result.classes.length > 0) {
      setSuggestedClasses(result.classes);
      setSuggestedClassDescriptions(result.classDescriptions || []);
    } else {
      setSuggestedClasses([]);
      setSuggestedClassDescriptions([]);
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
    setIsSubmitting(true);

    const selectedClassDescriptions = selectedClasses.map(cls => {
      const idx = suggestedClasses.indexOf(cls);
      return idx >= 0 ? suggestedClassDescriptions[idx] : `Classe ${cls}`;
    });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id || null;

      const { data, error } = await supabase.functions.invoke('create-asaas-payment', {
        body: {
          personalData,
          brandData,
          paymentMethod,
          paymentValue,
          contractHtml,
          userId,
          selectedClasses,
          classDescriptions: selectedClassDescriptions,
          suggestedClasses,
          suggestedClassDescriptions,
          plan,
        },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Erro ao criar cobrança');

      if (data.contractId && contractHtml) {
        generateAndUploadContractPdf({
          contractId: data.contractId,
          contractHtml,
          brandName: brandData.brandName,
          documentType: 'contrato',
          userId: userId || undefined,
        }).then(result => {
          if (result.success) console.log('Contract PDF uploaded:', result.publicUrl);
          else console.error('Failed to upload contract PDF:', result.error);
        }).catch(err => console.error('Error uploading contract PDF:', err));
      }

      const orderData = {
        personalData, brandData, paymentMethod, paymentValue,
        selectedClasses, plan,
        acceptedAt: new Date().toISOString(),
        leadId: data.leadId,
        contractId: data.contractId,
        asaas: { paymentId: data.paymentId, invoiceUrl: data.invoiceUrl, pixQrCode: data.pixQrCode },
      };

      sessionStorage.setItem("orderData", JSON.stringify(orderData));
      toast.success("Pedido realizado com sucesso!");
      navigate("/cliente/status-pedido");
    } catch (err) {
      console.error('Submit error:', err);
      toast.error(err instanceof Error ? err.message : "Erro ao processar. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStepInfo = STEP_TITLES[step - 1];
  const classCount = selectedClasses.length > 0 ? selectedClasses.length : 1;

  return (
    <ClientLayout>
      <div className="max-w-2xl mx-auto px-2 sm:px-0">

        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Registrar Nova Marca</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Processo 100% online • Aprovado pelo INPI • Resultado garantido
              </p>
              {plan !== 'essencial' && (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
                  {plan === 'premium' ? '👑' : '♾️'} {PLAN_LABELS[plan]}
                </div>
              )}
            </div>
          </div>

          {/* Trust row */}
          <div className="mt-4 flex items-center gap-4 flex-wrap">
            {[
              { icon: Shield, label: "Seguro e oficial" },
              { icon: Award, label: "Garantia incluída" },
              { icon: Clock, label: "+10 anos de experiência" },
              { icon: Star, label: "4.9 ★ (2.400+ clientes)" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <item.icon className="w-3.5 h-3.5 text-primary" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Progress */}
        <CheckoutProgress currentStep={step} />

        {/* Step indicator */}
        <motion.div
          key={step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between mb-4 px-1"
        >
          <div>
            <p className="text-xs text-muted-foreground">Etapa {step} de 6</p>
            <p className="text-sm font-semibold">{currentStepInfo.title}</p>
          </div>
          <span className="text-xs text-muted-foreground">{currentStepInfo.sub}</span>
        </motion.div>

        {/* Card */}
        <motion.div
          className="relative rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden"
        >
          <div className="h-1 w-full bg-gradient-to-r from-primary to-primary/60" />

          <div className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <ViabilityStep onNext={handleViabilityNext} />
                </motion.div>
              )}
              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <PersonalDataStep
                    initialData={personalData}
                    onNext={handlePersonalDataNext}
                    onBack={() => setStep(1)}
                  />
                </motion.div>
              )}
              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <BrandDataStep
                    initialData={brandData}
                    onNext={handleBrandDataNext}
                    onBack={() => setStep(2)}
                    suggestedClasses={suggestedClasses}
                    suggestedClassDescriptions={suggestedClassDescriptions}
                    selectedClasses={selectedClasses}
                    onSelectedClassesChange={setSelectedClasses}
                  />
                </motion.div>
              )}
              {step === 4 && (
                <motion.div key="step4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <PlanSelectionStep
                    selectedPlan={plan}
                    onNext={handlePlanNext}
                    onBack={() => setStep(3)}
                  />
                </motion.div>
              )}
              {step === 5 && (
                <motion.div key="step5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <PaymentStep
                    selectedMethod={paymentMethod}
                    onNext={handlePaymentNext}
                    onBack={() => setStep(4)}
                    classCount={classCount}
                    plan={plan}
                  />
                </motion.div>
              )}
              {step === 6 && (
                <motion.div key="step6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <ContractStep
                    personalData={personalData}
                    brandData={brandData}
                    paymentMethod={paymentMethod}
                    paymentValue={paymentValue}
                    onSubmit={(html) => handleSubmit(html)}
                    onBack={() => setStep(5)}
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="px-6 pb-5 flex items-center justify-center gap-2">
            <Shield className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Dados protegidos com criptografia SSL • WebMarcas Intelligence PI © {new Date().getFullYear()}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Dúvidas? Fale com nossa equipe.{" "}
            <a
              href="/cliente/chat-suporte"
              className="text-primary font-medium hover:underline"
            >
              Chat de Suporte →
            </a>
          </p>
        </motion.div>
      </div>
    </ClientLayout>
  );
}
