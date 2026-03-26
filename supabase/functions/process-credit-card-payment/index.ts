import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!ASAAS_API_KEY) {
      throw new Error("ASAAS_API_KEY não configurada");
    }

    const {
      invoiceId, // Internal invoice ID from our DB
      customerId, // Asaas customer ID
      value,
      installmentCount,
      installmentValue,
      creditCard,
      creditCardHolderInfo,
      dueDate,
      contractId, // For updating contract with payment ID
    } = await req.json();

    console.log("=== CREDIT CARD PAYMENT START ===");
    console.log("Invoice ID:", invoiceId);
    console.log("Customer ID:", customerId);
    console.log("Value:", value);
    console.log("Installments:", installmentCount, "x", installmentValue);
    console.log("Contract ID:", contractId);
    console.log("Holder:", creditCardHolderInfo?.name);
    console.log("CEP:", creditCardHolderInfo?.postalCode);
    console.log("Address Number:", creditCardHolderInfo?.addressNumber);

    // Get client IP for fraud prevention
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || 
                     req.headers.get("x-real-ip") || 
                     "unknown";

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create payment with credit card data directly in Asaas
    // This is a SINGLE installment payment (parcelamento), NOT recurring
    const paymentPayload: Record<string, unknown> = {
      customer: customerId,
      billingType: "CREDIT_CARD",
      dueDate: dueDate || new Date().toISOString().split("T")[0],
      description: "Registro de Marca - WebMarcas",
      creditCard: {
        holderName: creditCard.holderName,
        number: creditCard.number.replace(/\s/g, ""),
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv,
      },
      creditCardHolderInfo: {
        name: creditCardHolderInfo.name,
        email: creditCardHolderInfo.email,
        cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ""),
        postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ""),
        addressNumber: creditCardHolderInfo.addressNumber || "S/N",
        phone: creditCardHolderInfo.phone?.replace(/\D/g, "") || "",
      },
      remoteIp: clientIp,
    };

    // Add installment info if applicable (parcelamento único, não recorrência)
    // Use ONLY installmentCount and installmentValue - Asaas calculates total
    if (installmentCount && installmentCount > 1) {
      paymentPayload.installmentCount = installmentCount;
      paymentPayload.installmentValue = installmentValue;
      // Do NOT send 'value' when using installments - Asaas calculates it
    } else {
      paymentPayload.value = value;
    }

    console.log("Sending payment to Asaas (card details masked)");

    const paymentResponse = await fetch("https://api.asaas.com/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify(paymentPayload),
    });

    const paymentData = await paymentResponse.json();
    console.log("=== ASAAS RESPONSE ===");
    console.log("Status:", paymentData.status);
    console.log("Payment ID:", paymentData.id);
    console.log("Full response:", JSON.stringify(paymentData, null, 2));

    if (!paymentResponse.ok) {
      console.error("Asaas payment error:", paymentData);
      
      // Map Asaas error messages to user-friendly messages
      let errorMessage = "Erro ao processar pagamento";
      
      if (paymentData.errors && paymentData.errors.length > 0) {
        const error = paymentData.errors[0];
        if (error.code === "invalid_creditCard") {
          errorMessage = "Dados do cartão inválidos. Verifique o número, validade e CVV.";
        } else if (error.code === "invalid_creditCardHolderInfo") {
          errorMessage = "Dados do titular inválidos. Verifique CPF e CEP.";
        } else if (error.description) {
          errorMessage = error.description;
        }
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          details: paymentData.errors 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check if payment was authorized
    const isAuthorized = paymentData.status === "CONFIRMED" || 
                         paymentData.status === "RECEIVED" ||
                         paymentData.status === "PENDING";

    if (!isAuthorized && paymentData.status === "REFUSED") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Pagamento recusado pela operadora do cartão. Tente outro cartão.",
          status: paymentData.status
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Update invoice in database using INTERNAL invoiceId
    // Set asaas_invoice_id NOW that we have it, and ensure NO boleto/pix codes
    if (paymentData.id && invoiceId) {
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          asaas_invoice_id: paymentData.id,
          invoice_url: paymentData.invoiceUrl || null,
          // CRITICAL: Do NOT set boleto_code or pix_code for card payments
          boleto_code: null,
          pix_code: null,
          payment_method: 'credit_card',
          status: paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED" 
            ? "paid" 
            : "pending",
          payment_date: paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED" 
            ? new Date().toISOString() 
            : null,
        })
        .eq("id", invoiceId);

      if (updateError) {
        console.error("Error updating invoice:", updateError);
      } else {
        console.log("Updated invoice:", invoiceId, "with Asaas ID:", paymentData.id);
      }
    }

    // Update contract with Asaas payment ID if provided
    if (paymentData.id && contractId) {
      const { error: contractError } = await supabase
        .from("contracts")
        .update({
          asaas_payment_id: paymentData.id,
        })
        .eq("id", contractId);

      if (contractError) {
        console.error("Error updating contract:", contractError);
      } else {
        console.log("Updated contract:", contractId, "with Asaas payment ID:", paymentData.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentId: paymentData.id,
        status: paymentData.status,
        invoiceUrl: paymentData.invoiceUrl,
        transactionReceiptUrl: paymentData.transactionReceiptUrl,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Error processing credit card payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno ao processar pagamento";
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
