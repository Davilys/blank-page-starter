/**
 * Meta Pixel (Facebook Ads) tracking utility
 * Pixel ID: 257440690498371
 * 
 * APENAS TRACKING - não altera lógica de negócio
 */

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * Track Lead event - quando cliente envia dados pessoais
 */
export function trackLead(): void {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Lead');
    console.log('[Meta Pixel] Lead event tracked');
  }
}

/**
 * Track InitiateCheckout event - quando entra na tela de pagamento
 */
export function trackInitiateCheckout(): void {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'InitiateCheckout');
    console.log('[Meta Pixel] InitiateCheckout event tracked');
  }
}

/**
 * Track Purchase event - quando pagamento é confirmado
 */
export function trackPurchase(value: number = 699.00, currency: string = 'BRL'): void {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Purchase', { value, currency });
    console.log('[Meta Pixel] Purchase event tracked:', { value, currency });
  }
  // Google Ads conversion
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'conversion', { 'send_to': 'AW-1017056174/6qgsCMHB74MaEK6X_OQD' });
    console.log('[Google Ads] Conversion event tracked');
  }
}
