import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Check, FileText, Clock, CreditCard, ChevronDown, ChevronUp, QrCode, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CreditCardForm from "@/components/payment/CreditCardForm";
import { CheckoutProgress } from "@/components/cliente/checkout/CheckoutProgress";

interface AsaasData {
  customerId: string;
  asaasCustomerId?: string;
  paymentId: string;
  status: string;
  billingType: string;
  dueDate: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCode?: {
    encodedImage: string;
    payload: string;
    expirationDate?: string;
  } | null;
}

interface OrderData {
  personalData: {
    fullName: string;
    cpf: string;
    email: string;
    phone: string;
    cep: string;
    address: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  brandData: {
    brandName: string;
    businessArea: string;
    hasCNPJ: boolean;
    cnpj: string;
    companyName: string;
  };
  paymentValue: number;
  paymentMethod: string;
  contractHtml?: string;
  acceptedAt: string;
  leadId?: string;
  contractId?: string;
  contractNumber?: string;
  invoiceId?: string;
  asaas?: AsaasData;
}

const StatusPedido = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [copied, setCopied] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [showValueDetails, setShowValueDetails] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Get PIX code from Asaas data
  const pixCode = orderData?.asaas?.pixQrCode?.payload || "";
  const pixQrCodeImage = orderData?.asaas?.pixQrCode?.encodedImage || "";
  
  // Due date from Asaas or fallback to 3 days from now
  const dueDate = orderData?.asaas?.dueDate 
    ? new Date(orderData.asaas.dueDate) 
    : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  useEffect(() => {
    const data = sessionStorage.getItem("orderData");
    if (data) {
      try {
        setOrderData(JSON.parse(data));
      } catch {
        navigate("/registro");
      }
    } else {
      navigate("/registro");
    }
  }, [navigate]);

  const handleCopyPix = () => {
    if (!pixCode) {
      toast({
        title: "Código PIX não disponível",
        description: "Aguarde a geração do código PIX.",
        variant: "destructive",
      });
      return;
    }
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    toast({
      title: "Código copiado!",
      description: "O código PIX foi copiado para sua área de transferência.",
    });
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePaymentConfirmed = async () => {
    if (!orderData) return;

    setIsConfirming(true);

    try {
      // Call confirm-payment to convert lead to client
      const { data, error } = await supabase.functions.invoke('confirm-payment', {
        body: {
          leadId: orderData.leadId,
          contractId: orderData.contractId,
          paymentId: orderData.asaas?.paymentId,
          asaasCustomerId: orderData.asaas?.asaasCustomerId || orderData.asaas?.customerId,
          personalData: orderData.personalData,
          brandData: orderData.brandData,
          paymentValue: orderData.paymentValue,
          paymentMethod: orderData.paymentMethod,
          contractHtml: orderData.contractHtml,
          signatureData: {
            ip: '', // Could be fetched from an IP API
            userAgent: navigator.userAgent,
            signedAt: orderData.acceptedAt,
          },
        },
      });

      if (error) {
        console.error('Confirm payment error:', error);
        throw new Error(error.message || 'Erro ao confirmar pagamento');
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao processar confirmação');
      }

      console.log('Payment confirmed, client created:', data);

      // Save complete order data for thank you page
      sessionStorage.setItem("registrationComplete", JSON.stringify({
        ...orderData,
        paymentConfirmed: true,
        confirmedAt: new Date().toISOString(),
        userId: data.userId,
        processId: data.processId,
        invoiceId: data.invoiceId,
      }));

      toast({
        title: "Pagamento confirmado!",
        description: "Sua conta foi criada. Você receberá um e-mail com os dados de acesso.",
      });

      navigate("/obrigado");
    } catch (err) {
      console.error('Confirm error:', err);
      toast({
        title: "Erro ao confirmar",
        description: err instanceof Error ? err.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  if (!orderData || !orderData.personalData || !orderData.brandData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Validate credit card required data
  const isCreditCard = orderData.paymentMethod === 'cartao6x';
  const hasCreditCardData = isCreditCard && orderData.asaas?.asaasCustomerId && orderData.invoiceId;
  
  // If credit card but missing required data, show error with restart option
  if (isCreditCard && !hasCreditCardData) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20 pb-12">
          <div className="container mx-auto px-4">
            <div className="max-w-md mx-auto text-center">
              <div className="glass-card p-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                  <CreditCard className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-xl font-bold mb-2">Dados de Pagamento Incompletos</h2>
                <p className="text-muted-foreground mb-6">
                  Houve um problema ao processar seus dados de pagamento. 
                  Por favor, reinicie o processo de cadastro.
                </p>
                <Button
                  variant="hero"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    sessionStorage.removeItem('orderData');
                    navigate('/registrar');
                  }}
                >
                  Reiniciar Cadastro
                </Button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20 pb-12">
        <section className="py-12 md:py-20 relative overflow-hidden">
          {/* Background */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />

          <div className="container mx-auto px-4 relative z-10">
            {/* Progress Bar with Icons */}
            <div className="max-w-xl mx-auto mb-8">
              <CheckoutProgress currentStep={4} />
            </div>

            {/* Header */}
            <div className="text-center max-w-2xl mx-auto mb-8">
              <h1 className="font-display text-2xl md:text-3xl font-bold mb-2">
                Falta pouco para você registrar sua{" "}
                <span className="gradient-text">marca</span>
              </h1>
              <p className="text-muted-foreground">
                Complete o pagamento para finalizar seu registro. Após a confirmação, você receberá acesso ao painel do cliente.
              </p>
            </div>

            {/* Payment Card */}
            <div className="max-w-md mx-auto">
              <div className="glass-card p-6 mb-6">
                {/* Value Display */}
                <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-primary/30 bg-primary/5 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">
                      {orderData.paymentMethod === 'cartao6x' 
                        ? `6x de R$ ${(Math.round((orderData.paymentValue / 6) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : orderData.paymentMethod === 'boleto3x'
                        ? `3x de R$ ${(Math.round((orderData.paymentValue / 3) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : `R$ ${orderData.paymentValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      }
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CreditCard className="w-4 h-4" />
                      <span>
                        {orderData.paymentMethod === 'cartao6x' 
                          ? '6x sem juros' 
                          : orderData.paymentMethod === 'boleto3x'
                          ? '3x no boleto'
                          : 'PIX à vista'
                        }
                      </span>
                      <span className="mx-1">•</span>
                      <Clock className="w-4 h-4" />
                      <span>Vence em {dueDate.toLocaleDateString("pt-BR")}</span>
                    </div>
                    {(orderData.paymentMethod === 'cartao6x' || orderData.paymentMethod === 'boleto3x') && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Total: R$ {orderData.paymentValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Contract Number */}
                {orderData.contractNumber && (
                  <div className="mb-4 p-3 bg-secondary/50 rounded-lg text-sm">
                    <span className="text-muted-foreground">Contrato: </span>
                    <span className="font-mono font-medium">{orderData.contractNumber}</span>
                  </div>
                )}

              {/* Payment Method Specific Content */}
                {orderData.paymentMethod === 'avista' && (
                  <>
                    {/* QR Code Section - PIX */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <QrCode className="w-5 h-5 text-primary" />
                        <span className="font-medium">QrCode PIX</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Abra o app do seu banco e aponte a câmera para o QrCode abaixo
                      </p>
                      
                      <div className="flex justify-center mb-6">
                        <div className="w-48 h-48 bg-white p-3 rounded-xl border border-border overflow-hidden">
                          {pixQrCodeImage ? (
                            <img 
                              src={`data:image/png;base64,${pixQrCodeImage}`} 
                              alt="QR Code PIX" 
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm text-center">
                              QR Code não disponível
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* PIX Copy and Paste */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">Pix Copia e Cola</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Você pode copiar e colar esse código no app
                      </p>
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={pixCode ? (pixCode.length > 40 ? pixCode.substring(0, 40) + "..." : pixCode) : "Aguardando geração..."}
                          className="input-styled flex-1 text-sm font-mono"
                        />
                      </div>
                      
                      <Button
                        variant="hero"
                        size="lg"
                        className="w-full mt-4"
                        onClick={handleCopyPix}
                        disabled={!pixCode}
                      >
                        {copied ? (
                          <>
                            <Check className="w-5 h-5" />
                            Código Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="w-5 h-5" />
                            COPIAR CÓDIGO
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}

                {/* Credit Card - Embedded Form */}
                {orderData.paymentMethod === 'cartao6x' && (
                  <div className="mb-6">
                    <CreditCardForm
                      value={orderData.paymentValue}
                      installmentCount={6}
                      installmentValue={Math.round((orderData.paymentValue / 6) * 100) / 100}
                      dueDate={orderData.asaas?.dueDate || new Date().toISOString().split('T')[0]}
                      customerId={orderData.asaas?.asaasCustomerId || orderData.asaas?.customerId || ''}
                      invoiceId={orderData.invoiceId || ''}
                      contractId={orderData.contractId || ''}
                      holderName={orderData.personalData.fullName}
                      holderEmail={orderData.personalData.email}
                      holderCpfCnpj={orderData.personalData.cpf}
                      holderPostalCode={orderData.personalData.cep}
                      holderPhone={orderData.personalData.phone}
                      onSuccess={async () => {
                        // Call confirm-payment after successful card payment
                        await handlePaymentConfirmed();
                      }}
                      onError={(error) => {
                        toast({
                          title: "Erro no pagamento",
                          description: error,
                          variant: "destructive",
                        });
                      }}
                    />
                  </div>
                )}

                {/* Boleto - Show Link to PDF */}
                {orderData.paymentMethod === 'boleto3x' && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="font-medium">Pagamento via Boleto Parcelado</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Clique no botão abaixo para acessar o boleto. Serão gerados 3 boletos mensais.
                    </p>
                    
                    <Button
                      variant="hero"
                      size="lg"
                      className="w-full"
                      onClick={() => window.open(orderData.asaas?.bankSlipUrl || orderData.asaas?.invoiceUrl, '_blank')}
                      disabled={!orderData.asaas?.bankSlipUrl && !orderData.asaas?.invoiceUrl}
                    >
                      <FileText className="w-5 h-5 mr-2" />
                      VER BOLETO
                    </Button>
                  </div>
                )}

                {/* Link to invoice if available - for all methods */}
                {orderData.asaas?.invoiceUrl && orderData.paymentMethod === 'avista' && (
                  <div className="mb-6">
                    <a 
                      href={orderData.asaas.invoiceUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center justify-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Ver fatura completa
                    </a>
                  </div>
                )}

                {/* Collapsible Sections */}
                <div className="space-y-3">
                  <button
                    onClick={() => setShowInvoiceDetails(!showInvoiceDetails)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-border hover:bg-secondary/50 transition-colors"
                  >
                    <span className="text-sm font-medium">⊙ SOBRE A FATURA</span>
                    {showInvoiceDetails ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  
                  {showInvoiceDetails && (
                    <div className="p-4 bg-secondary/30 rounded-xl text-sm space-y-2">
                      <p><strong>Cliente:</strong> {orderData.personalData.fullName}</p>
                      <p><strong>CPF:</strong> {orderData.personalData.cpf}</p>
                      <p><strong>E-mail:</strong> {orderData.personalData.email}</p>
                      <p><strong>Marca:</strong> {orderData.brandData.brandName}</p>
                      {orderData.contractNumber && (
                        <p><strong>Contrato:</strong> {orderData.contractNumber}</p>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => setShowValueDetails(!showValueDetails)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-border hover:bg-secondary/50 transition-colors"
                  >
                    <span className="text-sm font-medium">+ DETALHAMENTO DO VALOR</span>
                    {showValueDetails ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  
                  {showValueDetails && (
                    <div className="p-4 bg-secondary/30 rounded-xl text-sm space-y-2">
                      <div className="flex justify-between">
                        <span>Honorários de preparo e registro</span>
                        <span>R$ {orderData.paymentValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Desconto à vista (43%)</span>
                        <span className="text-accent">-R$ 495,03</span>
                      </div>
                      <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold">
                        <span>Total</span>
                        <span className="text-primary">R$ {orderData.paymentValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        * Taxas do INPI (GRU) cobradas à parte pelo órgão federal.
                      </p>
                      {orderData.asaas?.paymentId && (
                        <p className="text-xs text-muted-foreground">
                          ID da cobrança: {orderData.asaas.paymentId}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Confirmation Button - Hide for credit card since form has its own button */}
              {orderData.paymentMethod !== 'cartao6x' && (
                <>
                  <Button
                    variant="default"
                    size="lg"
                    className="w-full"
                    onClick={handlePaymentConfirmed}
                    disabled={isConfirming}
                  >
                    {isConfirming ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      "CONCLUIR O REGISTRO"
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Ao confirmar, sua conta será criada e você receberá um e-mail com os dados de acesso ao painel do cliente.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default StatusPedido;
