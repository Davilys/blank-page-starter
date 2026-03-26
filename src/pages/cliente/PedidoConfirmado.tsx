import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ClientLayout } from "@/components/cliente/ClientLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileText, CreditCard, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { trackPurchase } from "@/lib/metaPixel";

interface ConfirmationData {
  personalData: {
    fullName: string;
    email: string;
  };
  brandData: {
    brandName: string;
    businessArea: string;
  };
  paymentMethod: string;
  paymentValue: number;
  confirmedAt: string;
  contractId: string;
}

export default function ClientePedidoConfirmado() {
  const navigate = useNavigate();
  const [confirmationData, setConfirmationData] = useState<ConfirmationData | null>(null);
  const purchaseTracked = useRef(false);

  useEffect(() => {
    const savedData = sessionStorage.getItem("confirmationData");
    if (savedData) {
      const parsedData = JSON.parse(savedData) as ConfirmationData;
      setConfirmationData(parsedData);
      
      // Track Purchase event only once when payment is confirmed
      if (!purchaseTracked.current) {
        trackPurchase(parsedData.paymentValue || 699.00, 'BRL');
        purchaseTracked.current = true;
      }
      
      // Clean up session storage
      sessionStorage.removeItem("orderData");
      sessionStorage.removeItem("confirmationData");
    } else {
      // Check if there's orderData (user might have refreshed)
      const orderData = sessionStorage.getItem("orderData");
      if (!orderData) {
        navigate("/cliente/registrar-marca");
      }
    }
  }, [navigate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getPaymentDescription = () => {
    if (!confirmationData) return '';
    switch (confirmationData.paymentMethod) {
      case 'pix': return 'À Vista (PIX)';
      case 'credit_6x': return 'Cartão 6x';
      case 'boleto_3x': return 'Boleto 3x';
      default: return confirmationData.paymentMethod;
    }
  };

  if (!confirmationData) {
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
        {/* Success Header */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6"
          >
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight text-green-600 mb-2">
            Pagamento Confirmado!
          </h1>
          <p className="text-muted-foreground">
            Seu registro de marca foi iniciado com sucesso.
          </p>
        </motion.div>

        {/* Order Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Card className="mb-6">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">Resumo do Pedido</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Marca</span>
                  <span className="font-medium">{confirmationData.brandData.brandName}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Segmento</span>
                  <span className="font-medium">{confirmationData.brandData.businessArea}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Titular</span>
                  <span className="font-medium">{confirmationData.personalData.fullName}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Forma de Pagamento</span>
                  <span className="font-medium">{getPaymentDescription()}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Valor Total</span>
                  <span className="font-bold text-lg text-primary">
                    {formatCurrency(confirmationData.paymentValue)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Next Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <Card className="mb-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">Próximos Passos</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Análise Documental</p>
                    <p className="text-sm text-muted-foreground">
                      Nossa equipe irá revisar seus documentos e preparar o pedido.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Protocolo INPI</p>
                    <p className="text-sm text-muted-foreground">
                      Realizaremos o depósito do seu pedido junto ao INPI.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Acompanhamento</p>
                    <p className="text-sm text-muted-foreground">
                      Você poderá acompanhar todo o processo pela sua área do cliente.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="grid sm:grid-cols-2 gap-4"
        >
          <Button asChild size="lg" className="w-full">
            <Link to="/cliente/processos">
              <FileText className="w-4 h-4 mr-2" />
              Ver Meus Processos
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link to="/cliente/financeiro">
              <CreditCard className="w-4 h-4 mr-2" />
              Ver Minhas Faturas
            </Link>
          </Button>
        </motion.div>

        {/* Email Confirmation */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-center text-sm text-muted-foreground mt-8"
        >
          Um email de confirmação foi enviado para{" "}
          <span className="font-medium">{confirmationData.personalData.email}</span>
        </motion.p>
      </div>
    </ClientLayout>
  );
}
