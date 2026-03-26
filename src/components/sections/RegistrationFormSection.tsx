import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckoutProgress } from "@/components/cliente/checkout/CheckoutProgress";
import { ViabilityStep } from "@/components/cliente/checkout/ViabilityStep";
import { PersonalDataStep, type PersonalData } from "@/components/cliente/checkout/PersonalDataStep";
import { BrandDataStep, type BrandData } from "@/components/cliente/checkout/BrandDataStep";
import { PlanSelectionStep } from "@/components/cliente/checkout/PlanSelectionStep";
import { PaymentStep } from "@/components/cliente/checkout/PaymentStep";
import { ContractStep } from "@/components/cliente/checkout/ContractStep";
import type { ViabilityResult } from "@/lib/api/viability";
import type { PlanType } from "@/hooks/useContractTemplate";

interface ViabilityData {
  brandName: string;
  businessArea: string;
  result: ViabilityResult;
}

const RegistrationFormSection = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data states
  const [viabilityData, setViabilityData] = useState<ViabilityData | null>(null);
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [brandData, setBrandData] = useState<BrandData | null>(null);
  const [plan, setPlan] = useState<PlanType>("essencial");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentValue, setPaymentValue] = useState(0);

  // NCL classes state
  const [suggestedClasses, setSuggestedClasses] = useState<number[]>([]);
  const [suggestedClassDescriptions, setSuggestedClassDescriptions] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);

  // Track if form_started email was already triggered
  const [formStartedTriggered, setFormStartedTriggered] = useState(false);

  // Check for pre-filled viability data from ViabilitySearchSection
  useEffect(() => {
    const storedData = sessionStorage.getItem('viabilityData');
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        if (parsed.brandName && parsed.businessArea && parsed.level) {
          const viabilityResult: ViabilityResult = {
            success: true,
            level: parsed.level,
            title: parsed.level === 'high' ? 'Alta Viabilidade' : 
                   parsed.level === 'medium' ? 'Viabilidade Média' : 
                   parsed.level === 'low' ? 'Baixa Viabilidade' : 'Marca Bloqueada',
            description: 'Viabilidade já verificada anteriormente.',
            classes: parsed.classes,
            classDescriptions: parsed.classDescriptions,
          };
          setViabilityData({
            brandName: parsed.brandName,
            businessArea: parsed.businessArea,
            result: viabilityResult,
          });
          if (Array.isArray(parsed.classes)) {
            setSuggestedClasses(parsed.classes);
            setSuggestedClassDescriptions(parsed.classDescriptions || []);
          }
          setStep(2);
          sessionStorage.removeItem('viabilityData');
        }
      } catch (e) {
        console.error('Error parsing viability data:', e);
      }
    }
  }, []);

  // Handlers
  const handleViabilityNext = useCallback((brandName: string, businessArea: string, result: ViabilityResult) => {
    setViabilityData({ brandName, businessArea, result });
    if (Array.isArray(result.classes) && result.classes.length > 0) {
      setSuggestedClasses(result.classes);
      setSuggestedClassDescriptions(result.classDescriptions || []);
    } else {
      setSuggestedClasses([]);
      setSuggestedClassDescriptions([]);
    }
    setStep(2);
    scrollToForm();
  }, []);

  const handlePersonalDataNext = useCallback(async (data: PersonalData) => {
    setPersonalData(data);
    setStep(3);
    scrollToForm();

    if (!formStartedTriggered && data.email) {
      setFormStartedTriggered(true);
      try {
        await supabase.functions.invoke('trigger-email-automation', {
          body: {
            trigger_event: 'form_started',
            create_lead: true,
            data: {
              nome: data.fullName,
              email: data.email,
              phone: data.phone || null,
              marca: viabilityData?.brandName || 'Sua Marca',
              base_url: 'https://webmarcas.net',
            },
          },
        });
      } catch (error) {
        console.error('Error triggering form_started:', error);
      }
    }
  }, [formStartedTriggered, viabilityData?.brandName]);

  const handleBrandDataNext = useCallback((data: BrandData) => {
    setBrandData(data);
    setStep(4); // Plan selection
    scrollToForm();
  }, []);

  const handlePlanNext = useCallback((selectedPlan: PlanType) => {
    setPlan(selectedPlan);
    setStep(5); // Payment
    scrollToForm();
  }, []);

  const handlePaymentNext = useCallback((method: string, value: number) => {
    setPaymentMethod(method);
    setPaymentValue(value);
    setStep(6); // Contract
    scrollToForm();
  }, []);

  const handleContractSubmit = useCallback(async (contractHtml: string) => {
    if (!personalData || !brandData) {
      toast({
        title: "Erro",
        description: "Dados incompletos. Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const selectedClassDescriptions = selectedClasses.map(cls => {
      const idx = suggestedClasses.indexOf(cls);
      return idx >= 0 ? suggestedClassDescriptions[idx] : `Classe ${cls}`;
    });

    try {
      const { data, error } = await supabase.functions.invoke('create-asaas-payment', {
        body: {
          personalData: {
            fullName: personalData.fullName,
            email: personalData.email,
            phone: personalData.phone,
            cpf: personalData.cpf,
            cep: personalData.cep,
            address: personalData.address,
            addressNumber: personalData.addressNumber,
            neighborhood: personalData.neighborhood,
            city: personalData.city,
            state: personalData.state,
          },
          brandData: {
            brandName: brandData.brandName,
            businessArea: brandData.businessArea,
            hasCNPJ: brandData.hasCNPJ,
            cnpj: brandData.cnpj,
            companyName: brandData.companyName,
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

      if (error) {
        console.error('Asaas payment error:', error);
        throw new Error(error.message || 'Erro ao processar pagamento');
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao criar cobrança');
      }

      console.log('Asaas payment created:', data);

      const orderData = {
        personalData: {
          fullName: personalData.fullName,
          email: personalData.email,
          phone: personalData.phone,
          cpf: personalData.cpf,
          cep: personalData.cep,
          address: personalData.address,
          addressNumber: personalData.addressNumber,
          neighborhood: personalData.neighborhood,
          city: personalData.city,
          state: personalData.state,
        },
        brandData: {
          brandName: brandData.brandName,
          businessArea: brandData.businessArea,
          hasCNPJ: brandData.hasCNPJ,
          cnpj: brandData.cnpj,
          companyName: brandData.companyName,
        },
        paymentMethod,
        paymentValue,
        contractHtml,
        selectedClasses,
        plan,
        acceptedAt: new Date().toISOString(),
        leadId: data.leadId,
        contractId: data.contractId,
        contractNumber: data.contractNumber,
        invoiceId: data.invoiceId,
        asaas: {
          customerId: data.customerId,
          asaasCustomerId: data.asaasCustomerId,
          paymentId: data.paymentId,
          status: data.status,
          billingType: data.billingType,
          dueDate: data.dueDate,
          invoiceUrl: data.invoiceUrl,
          bankSlipUrl: data.bankSlipUrl,
          pixQrCode: data.pixQrCode,
        },
      };

      sessionStorage.setItem("orderData", JSON.stringify(orderData));

      toast({
        title: "Cobrança criada com sucesso!",
        description: "Você será redirecionado para a página de pagamento.",
      });

      navigate("/status-pedido");
    } catch (err) {
      console.error('Submit error:', err);
      toast({
        title: "Erro ao processar",
        description: err instanceof Error ? err.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [personalData, brandData, paymentMethod, paymentValue, selectedClasses, suggestedClasses, suggestedClassDescriptions, plan, navigate, toast]);

  const scrollToForm = () => {
    document.getElementById('registro')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleBack = (targetStep: number) => {
    setStep(targetStep);
    scrollToForm();
  };

  const getInitialPersonalData = (): PersonalData => ({
    fullName: "", email: "", phone: "", cpf: "",
    cep: "", address: "", addressNumber: "", neighborhood: "", city: "", state: "",
  });

  const getInitialBrandData = (): BrandData => ({
    brandName: viabilityData?.brandName || "",
    businessArea: viabilityData?.businessArea || "",
    hasCNPJ: false, cnpj: "", companyName: "",
  });

  const classCount = selectedClasses.length > 0 ? selectedClasses.length : 1;

  return (
    <section id="registro" className="section-padding bg-card relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="badge-premium mb-4 inline-flex">Formulário de Registro</span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Registre sua{" "}
            <span className="gradient-text">marca agora</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Preencha o formulário abaixo para iniciar o processo de registro.
          </p>
        </div>

        <div className="max-w-2xl mx-auto mb-12">
          <CheckoutProgress currentStep={step} />
        </div>

        <div className="max-w-xl mx-auto">
          <div className="glass-card p-8">
            {step === 1 && (
              <ViabilityStep onNext={handleViabilityNext} />
            )}
            {step === 2 && (
              <PersonalDataStep
                initialData={personalData || getInitialPersonalData()}
                onNext={handlePersonalDataNext}
                onBack={() => handleBack(1)}
              />
            )}
            {step === 3 && (
              <BrandDataStep
                initialData={brandData || getInitialBrandData()}
                onNext={handleBrandDataNext}
                onBack={() => handleBack(2)}
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
                onBack={() => handleBack(3)}
              />
            )}
            {step === 5 && (
              <PaymentStep
                selectedMethod={paymentMethod}
                onNext={handlePaymentNext}
                onBack={() => handleBack(4)}
                classCount={classCount}
                plan={plan}
              />
            )}
            {step === 6 && personalData && brandData && (
              <ContractStep
                personalData={personalData}
                brandData={brandData}
                paymentMethod={paymentMethod}
                paymentValue={paymentValue}
                onSubmit={handleContractSubmit}
                onBack={() => handleBack(5)}
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
          </div>
        </div>
      </div>
    </section>
  );
};

export default RegistrationFormSection;
