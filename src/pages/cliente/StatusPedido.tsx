import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ClientLayout } from "@/components/cliente/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Copy, Check, ExternalLink, QrCode, Clock, CreditCard, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { CheckoutProgress } from "@/components/cliente/checkout/CheckoutProgress";
import CreditCardForm from "@/components/payment/CreditCardForm";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AsaasData {
  paymentId: string;
  customerId?: string;
  asaasCustomerId?: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
  dueDate?: string;
  pixQrCode?: {
    encodedImage?: string;
    payload?: string;
  } | null;
}

interface OrderData {
  personalData: {
    fullName: string;
    email: string;
    phone: string;
    cpf: string;
    cep?: string;
  };
  brandData: {
    brandName: string;
    businessArea: string;
  };
  paymentMethod: string;
  paymentValue: number;
  acceptedAt: string;
  leadId: string;
  contractId: string;
  invoiceId?: string;
  asaas: AsaasData;
}

export default function ClienteStatusPedido() {
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [pixCode, setPixCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [showValueDetails, setShowValueDetails] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Validate required payment data for credit card
  const hasValidPaymentData = useMemo(() => {
    if (!orderData) return false;
    const customerId = orderData.asaas?.asaasCustomerId || orderData.asaas?.customerId;
    const invoiceId = orderData.invoiceId;
    return Boolean(customerId && invoiceId);
  }, [orderData]);

  useEffect(() => {
    const savedData = sessionStorage.getItem("orderData");
    if (savedData) {
      const parsed = JSON.parse(savedData) as OrderData;
      setOrderData(parsed);
      if (parsed.asaas?.pixQrCode?.payload) {
        setPixCode(parsed.asaas.pixQrCode.payload);
      }
    } else {
      navigate("/cliente/registrar-marca");
    }
  }, [navigate]);

  const handleCopyPix = () => {
    if (pixCode) {
      navigator.clipboard.writeText(pixCode);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handlePaymentConfirmed = async () => {
    if (!orderData) return;
    
    setIsConfirming(true);
    try {
      const { data, error } = await supabase.functions.invoke('confirm-payment', {
        body: {
          leadId: orderData.leadId,
          contractId: orderData.contractId,
          personalData: orderData.personalData,
          brandData: orderData.brandData,
          paymentMethod: orderData.paymentMethod,
          paymentValue: orderData.paymentValue,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro ao confirmar pagamento');

      sessionStorage.setItem("confirmationData", JSON.stringify({
        ...orderData,
        confirmedAt: new Date().toISOString(),
        userId: data.userId,
        processId: data.processId,
      }));

      toast.success("Pagamento confirmado!");
      navigate("/cliente/pedido-confirmado");
    } catch (err) {
      console.error('Confirm error:', err);
      toast.error(err instanceof Error ? err.message : "Erro ao confirmar. Tente novamente.");
    } finally {
      setIsConfirming(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getPaymentDescription = () => {
    if (!orderData) return '';
    switch (orderData.paymentMethod) {
      case 'avista': return 'À Vista (PIX)';
      case 'cartao6x': return 'Cartão 6x sem juros';
      case 'boleto3x': return 'Boleto 3x';
      default: return orderData.paymentMethod;
    }
  };

  if (!orderData) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Complete seu Pagamento</h1>
          <p className="text-muted-foreground">
            Finalize o pagamento para dar início ao registro da sua marca.
          </p>
        </div>

        {/* Progress indicator - show step 5 as current */}
        <CheckoutProgress currentStep={5} />

        {/* Payment Card */}
        <Card className="mb-6">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Pagamento via {orderData.paymentMethod === 'pix' ? 'PIX' : getPaymentDescription()}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Value Section */}
            <div className="text-center border-b pb-6">
              <p className="text-sm text-muted-foreground mb-1">Valor do Registro</p>
              <p className="text-4xl font-bold text-primary">
                {orderData.paymentMethod === 'cartao6x' 
                  ? `6x de ${formatCurrency(Math.round((orderData.paymentValue / 6) * 100) / 100)}`
                  : orderData.paymentMethod === 'boleto3x'
                  ? `3x de ${formatCurrency(Math.round((orderData.paymentValue / 3) * 100) / 100)}`
                  : formatCurrency(orderData.paymentValue)
                }
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {orderData.paymentMethod === 'cartao6x' 
                  ? '6x sem juros' 
                  : orderData.paymentMethod === 'boleto3x'
                  ? '3x no boleto'
                  : 'PIX à vista'
                }
              </p>
              {(orderData.paymentMethod === 'cartao6x' || orderData.paymentMethod === 'boleto3x') && (
                <p className="text-xs text-muted-foreground mt-1">
                  Total: {formatCurrency(orderData.paymentValue)}
                </p>
              )}
            </div>

            {/* PIX Payment - Show QR Code */}
            {orderData.paymentMethod === 'avista' && orderData.asaas?.pixQrCode && (
              <div className="flex flex-col items-center space-y-4">
                <div className="bg-white p-4 rounded-lg border">
                  {orderData.asaas.pixQrCode.encodedImage ? (
                    <img 
                      src={`data:image/png;base64,${orderData.asaas.pixQrCode.encodedImage}`}
                      alt="QR Code PIX"
                      className="w-48 h-48"
                    />
                  ) : orderData.asaas.pixQrCode.payload ? (
                    <QRCodeSVG value={orderData.asaas.pixQrCode.payload} size={192} />
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Escaneie o QR Code com o app do seu banco
                </p>
              </div>
            )}

            {/* PIX Copy and Paste - Only for PIX payments */}
            {orderData.paymentMethod === 'avista' && pixCode && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <QrCode className="w-4 h-4" />
                  PIX Copia e Cola
                </label>
                <div className="flex gap-2">
                  <Input 
                    value={pixCode} 
                    readOnly 
                    className="font-mono text-xs bg-muted"
                  />
                  <Button 
                    variant="outline" 
                    onClick={handleCopyPix}
                    className="shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Credit Card Payment - Embedded Form */}
            {orderData.paymentMethod === 'cartao6x' && (
              hasValidPaymentData ? (
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
                  holderPostalCode={orderData.personalData.cep || ''}
                  holderPhone={orderData.personalData.phone}
                  holderAddressNumber={(orderData.personalData as any).addressNumber || 'S/N'}
                  onSuccess={async () => {
                    await handlePaymentConfirmed();
                  }}
                  onError={(error) => {
                    toast.error(error);
                  }}
                />
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex flex-col gap-2">
                    <span>Dados de pagamento incompletos. Por favor, reinicie o processo de cadastro.</span>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto justify-start text-destructive-foreground underline"
                      onClick={() => navigate('/cliente/registrar-marca')}
                    >
                      Reiniciar Cadastro
                    </Button>
                  </AlertDescription>
                </Alert>
              )
            )}

            {/* Boleto Payment - Show Link to PDF */}
            {orderData.paymentMethod === 'boleto3x' && (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    Clique no botão abaixo para acessar o boleto. Serão gerados 3 boletos mensais.
                  </p>
                </div>
                <Button 
                  className="w-full"
                  size="lg"
                  onClick={() => window.open(orderData.asaas?.invoiceUrl, '_blank')}
                  disabled={!orderData.asaas?.invoiceUrl}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  VER BOLETO
                </Button>
              </div>
            )}

            {/* Invoice Link - Only for PIX */}
            {orderData.paymentMethod === 'avista' && orderData.asaas?.invoiceUrl && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open(orderData.asaas.invoiceUrl, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Ver Fatura Completa
              </Button>
            )}

            {/* Collapsible Details */}
            <Collapsible open={showInvoiceDetails} onOpenChange={setShowInvoiceDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full text-sm">
                  {showInvoiceDetails ? 'Ocultar' : 'Ver'} Detalhes da Fatura
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 p-4 bg-muted rounded-lg text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Marca:</span>
                  <span className="font-medium">{orderData.brandData.brandName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Titular:</span>
                  <span className="font-medium">{orderData.personalData.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPF/CNPJ:</span>
                  <span className="font-medium">{orderData.personalData.cpf}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{orderData.personalData.email}</span>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={showValueDetails} onOpenChange={setShowValueDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full text-sm">
                  {showValueDetails ? 'Ocultar' : 'Ver'} Detalhamento do Valor
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 p-4 bg-muted rounded-lg text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serviço de registro:</span>
                  <span className="font-medium">R$ 499,00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxa INPI:</span>
                  <span className="font-medium">R$ 199,97</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="font-medium">Total:</span>
                  <span className="font-bold text-primary">{formatCurrency(orderData.paymentValue)}</span>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Confirmation Button - Hide for credit card since form has its own button */}
        {orderData.paymentMethod !== 'cartao6x' && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <Clock className="w-5 h-5 text-amber-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Após realizar o pagamento</p>
                  <p className="text-muted-foreground">
                    Clique no botão abaixo para confirmar e dar início ao processo de registro.
                  </p>
                </div>
              </div>
              <Button 
                className="w-full" 
                size="lg"
                onClick={handlePaymentConfirmed}
                disabled={isConfirming}
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  "CONCLUIR O REGISTRO"
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </ClientLayout>
  );
}
