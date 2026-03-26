import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PricingData {
  avista: {
    value: number;
    label: string;
  };
  cartao: {
    value: number;
    installments: number;
    installmentValue: number;
  };
  boleto: {
    value: number;
    installments: number;
    installmentValue: number;
  };
}

const DEFAULT_PRICING: PricingData = {
  avista: {
    value: 698.97,
    label: 'R$699',
  },
  cartao: {
    value: 1194,
    installments: 6,
    installmentValue: 199,
  },
  boleto: {
    value: 1197,
    installments: 3,
    installmentValue: 399,
  },
};

export function usePricing() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['pricing-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'pricing')
        .maybeSingle();

      if (error) {
        console.error('Error fetching pricing:', error);
        return DEFAULT_PRICING;
      }

      if (!data) {
        return DEFAULT_PRICING;
      }

      // Cast through unknown to handle JSON type
      const pricingValue = data.value as unknown as PricingData;
      return pricingValue;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const pricing = data || DEFAULT_PRICING;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pricing-settings'] });
  };

  // Formatted helpers
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return {
    pricing,
    isLoading,
    error,
    invalidate,
    // Convenience getters
    avista: pricing.avista,
    cartao: pricing.cartao,
    boleto: pricing.boleto,
    // Formatted values
    getAvistaLabel: () => pricing.avista.label,
    getAvistaFormatted: () => formatCurrency(pricing.avista.value),
    getCartaoParcelaText: () => `${pricing.cartao.installments}x de ${formatCurrency(pricing.cartao.installmentValue)}`,
    getCartaoTotalFormatted: () => formatCurrency(pricing.cartao.value),
    getBoletoParcelaText: () => `${pricing.boleto.installments}x de ${formatCurrency(pricing.boleto.installmentValue)}`,
    getBoletoTotalFormatted: () => formatCurrency(pricing.boleto.value),
    // Get payment value by method
    getPaymentValue: (method: string) => {
      switch (method) {
        case 'avista':
          return pricing.avista.value;
        case 'cartao6x':
        case 'cartao':
          return pricing.cartao.value;
        case 'boleto3x':
        case 'boleto':
          return pricing.boleto.value;
        default:
          return pricing.avista.value;
      }
    },
  };
}
