import { supabase } from '@/integrations/supabase/client';
import type { ClientWithProcess } from '@/components/admin/clients/ClientKanbanBoard';

/**
 * Carrega o objeto ClientWithProcess usado pelo ClientDetailSheet em qualquer aba do admin
 * (Clientes, Publicações, Financeiro, Devedores). Garante que o ficheiro do cliente seja
 * idêntico independentemente da origem.
 */
export async function loadClientForSheet(clientId: string): Promise<ClientWithProcess | null> {
  if (!clientId) return null;

  const [profileRes, processesRes, contractsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, cpf_cnpj, company_name, priority, origin, contract_value, created_at, last_contact, client_funnel_type, created_by, assigned_to')
      .eq('id', clientId)
      .single(),
    supabase
      .from('brand_processes')
      .select('id, user_id, brand_name, business_area, pipeline_stage, status, process_number')
      .eq('user_id', clientId),
    supabase
      .from('contracts')
      .select('user_id, contract_value, payment_method')
      .eq('user_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  const profile: any = profileRes.data;
  if (!profile) return null;

  const userProcesses = processesRes.data || [];
  const latestContract = contractsRes.data?.[0];

  const adminIds = [profile.created_by, profile.assigned_to].filter(Boolean) as string[];
  const adminNameMap: Record<string, string> = {};
  if (adminIds.length > 0) {
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', adminIds);
    for (const a of adminProfiles || []) adminNameMap[a.id] = a.full_name || a.email;
  }

  const defaultStage = profile.client_funnel_type === 'comercial' ? 'assinou_contrato' : 'protocolado';
  const mainProcess = userProcesses[0] || null;
  const brands = userProcesses.map((p: any) => ({
    id: p.id,
    brand_name: p.brand_name,
    pipeline_stage: p.pipeline_stage || defaultStage,
    process_number: p.process_number || undefined,
  }));

  return {
    id: profile.id,
    full_name: profile.full_name || '',
    email: profile.email || '',
    phone: profile.phone || null,
    company_name: profile.company_name || null,
    priority: profile.priority || 'medium',
    origin: profile.origin || 'site',
    contract_value: latestContract?.contract_value ? Number(latestContract.contract_value) : (profile.contract_value || 0),
    process_id: mainProcess?.id || null,
    brand_name: mainProcess?.brand_name || null,
    business_area: mainProcess?.business_area || null,
    pipeline_stage: mainProcess?.pipeline_stage || defaultStage,
    process_status: mainProcess?.status || null,
    process_number: mainProcess?.process_number || undefined,
    created_at: profile.created_at || undefined,
    cpf_cnpj: profile.cpf_cnpj || undefined,
    client_funnel_type: profile.client_funnel_type || 'juridico',
    created_by: profile.created_by || null,
    assigned_to: profile.assigned_to || null,
    created_by_name: profile.created_by ? adminNameMap[profile.created_by] || null : null,
    assigned_to_name: profile.assigned_to ? adminNameMap[profile.assigned_to] || null : null,
    brands,
  } as ClientWithProcess;
}