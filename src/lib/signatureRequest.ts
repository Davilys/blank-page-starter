import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type ChannelResult = { channel: string; success: boolean; error?: string };

export function productionBaseUrl() {
  const origin = window.location.origin;
  const isPreview = origin.includes('lovableproject.com') || origin.includes('lovable.app') || origin.includes('localhost');
  return isPreview ? 'https://webmarcas.net' : origin;
}

const LABEL: Record<string, string> = { email: 'E-mail', whatsapp: 'WhatsApp' };

/** Mostra o resultado de cada canal separadamente. Retorna true se algum canal funcionou. */
export function reportChannelResults(results: ChannelResult[] | undefined): boolean {
  const list = results || [];
  if (!list.length) { toast.error('Nenhum canal foi enviado (cliente sem e-mail e telefone)'); return false; }
  const ok = list.filter(r => r.success).map(r => `${LABEL[r.channel] || r.channel} enviado`);
  const fail = list.filter(r => !r.success).map(r => `${LABEL[r.channel] || r.channel}: ${r.error || 'falhou'}`);
  if (ok.length && !fail.length) toast.success(ok.join(' · '));
  else if (ok.length) toast.warning(`${ok.join(' · ')} — ${fail.join(' · ')}`);
  else toast.error(fail.join(' · '));
  return ok.length > 0;
}

/** Gera o link (se necessário) e envia a solicitação de assinatura por e-mail + WhatsApp. */
export async function sendSignatureRequestManual(contractId: string, hasToken: boolean) {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!hasToken) {
    const gen = await fetch(`${base}/functions/v1/generate-signature-link`, {
      method: 'POST', headers, body: JSON.stringify({ contractId, baseUrl: productionBaseUrl() }),
    });
    if (!gen.ok) throw new Error((await gen.json().catch(() => ({})))?.error || 'Erro ao gerar link de assinatura');
  }
  const res = await fetch(`${base}/functions/v1/send-signature-request`, {
    method: 'POST', headers, body: JSON.stringify({ contractId, channels: ['email', 'whatsapp'], baseUrl: productionBaseUrl() }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Erro ao enviar solicitação');
  return reportChannelResults(body?.data?.results);
}
