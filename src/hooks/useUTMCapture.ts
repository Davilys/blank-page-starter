import { useEffect } from 'react';

const UTM_STORAGE_KEY = 'webmarcas_utm_params';

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  captured_at?: string;
  landing_page?: string;
  referrer?: string;
}

export function captureUTMParams(): UTMParams | null {
  if (typeof window === 'undefined') return null;
  
  const params = new URLSearchParams(window.location.search);
  const utm: UTMParams = {};
  let hasAny = false;

  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'] as const;
  for (const key of keys) {
    const val = params.get(key);
    if (val) {
      (utm as any)[key] = val;
      hasAny = true;
    }
  }

  // Auto-detect platform from click IDs
  if (utm.fbclid && !utm.utm_source) {
    utm.utm_source = 'facebook';
    hasAny = true;
  }

  if (hasAny) {
    utm.captured_at = new Date().toISOString();
    utm.landing_page = window.location.pathname;
    utm.referrer = document.referrer || undefined;
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
    return utm;
  }
  return null;
}

export function getStoredUTMParams(): UTMParams | null {
  try {
    const stored = localStorage.getItem(UTM_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function clearStoredUTMParams(): void {
  localStorage.removeItem(UTM_STORAGE_KEY);
}

export function detectPlatform(params: UTMParams | null): string {
  if (!params) return 'Direto';
  if (params.fbclid || params.utm_source?.toLowerCase().includes('facebook') || params.utm_source?.toLowerCase().includes('instagram') || params.utm_source?.toLowerCase().includes('meta')) return 'Meta Ads';
  if (params.utm_source) return params.utm_source;
  if (params.referrer) {
    if (params.referrer.includes('google')) return 'Google Orgânico';
    if (params.referrer.includes('facebook') || params.referrer.includes('instagram')) return 'Social Orgânico';
    return 'Referral';
  }
  return 'Direto';
}

export function useUTMCapture() {
  useEffect(() => {
    captureUTMParams();
  }, []);

  return { getStoredUTMParams, clearStoredUTMParams, detectPlatform };
}
