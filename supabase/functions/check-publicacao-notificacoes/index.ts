import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEMPLATES = [
  {
    id: 1, dueDays: 15,
    subject: (m: string) => `Lembrete: prazo de 60 dias junto ao INPI — ${m || 'sua marca'}`,
    whatsapp: (n: string) => `Olá, ${n}. Tudo bem?\n\nEstamos entrando em contato para lembrar que a publicação do seu processo possui um prazo legal de 60 dias junto ao INPI para cumprimento.\n\nAté o momento, não recebemos seu posicionamento referente à continuidade desta etapa.\n\nCaso tenha alguma dúvida, estamos à disposição para esclarecê-la e evitar qualquer prejuízo ao andamento do seu processo.\n\nQual é o melhor horário para conversarmos?`,
    email: (n: string, m: string) => `<p>Olá, <strong>${n}</strong>. Tudo bem?</p><p>Estamos entrando em contato para lembrar que a publicação do seu processo da marca <strong>${m}</strong> possui um prazo legal de <strong>60 dias</strong> junto ao INPI para cumprimento.</p><p>Até o momento, não recebemos seu posicionamento referente à continuidade desta etapa.</p><p><strong>Qual é o melhor horário para conversarmos?</strong></p>`,
  },
  {
    id: 2, dueDays: 30,
    subject: (m: string) => `Atenção: prazo do INPI próximo de vencer — ${m || 'sua marca'}`,
    whatsapp: (n: string) => `Olá, ${n}.\n\nJá se passaram 39 dias desde a publicação da exigência do seu processo e ainda não recebemos seu posicionamento.\n\nO prazo concedido pelo INPI é de 60 dias e, sem o cumprimento desta etapa, o processo poderá ser arquivado automaticamente pelo órgão.\n\nPor favor, informe ainda hoje se deseja dar continuidade ao processo.`,
    email: (n: string, m: string) => `<p>Olá, <strong>${n}</strong>.</p><p>Já se passaram <strong>39 dias</strong> desde a publicação da exigência do processo da marca <strong>${m}</strong>. O prazo do INPI é de 60 dias e o processo poderá ser <strong>arquivado automaticamente</strong>.</p><p><strong>Por favor, informe ainda hoje se deseja dar continuidade.</strong></p>`,
  },
  {
    id: 3, dueDays: 50,
    subject: (m: string) => `Notificação formal: cumprimento de exigência INPI — ${m || 'sua marca'}`,
    whatsapp: (n: string) => `Olá, ${n}.\n\nInformamos que já realizamos diversos contatos por telefone, WhatsApp e e-mail, sem sucesso.\n\nO prazo da publicação está próximo do encerramento e o INPI poderá arquivar o processo por ausência de cumprimento da exigência.\n\nEsclarecemos que o débito de R$ 1.621,00 permanece devido, conforme o contrato assinado.\n\nQual é o melhor horário para uma reunião?\n\nCaso não haja resposta ainda hoje, considere esta mensagem como notificação formal.`,
    email: (n: string, m: string) => `<p>Olá, <strong>${n}</strong>.</p><p>Já realizamos diversos contatos sem sucesso na obtenção de um posicionamento sobre o processo da marca <strong>${m}</strong>. O prazo está próximo do encerramento e o INPI poderá <strong>arquivar o processo</strong>.</p><p>O <strong>débito de R$ 1.621,00</strong> permanece devido conforme contrato.</p><p><em>Caso não haja resposta ainda hoje, considere esta mensagem como notificação formal.</em></p>`,
  },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: schedules, error } = await supabase
    .from('publicacao_cobranca_schedule')
    .select('*, publicacoes_marcas!inner(id, brand_name_rpi, process_id, status, cumprimento_ok, data_publicacao_rpi, proximo_prazo_critico)')
    .eq('status', 'ativo');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let sent = 0;
  const today = new Date();

  for (const s of (schedules || []) as any[]) {
    const pub = s.publicacoes_marcas;
    if (!pub || pub.cumprimento_ok || pub.status === 'arquivado' || pub.status === 'certificado') continue;
    const start = new Date(s.data_inicio);
    const days = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    let tpl: typeof TEMPLATES[number] | null = null;
    if (days >= 15 && !s.notif_1_at) tpl = TEMPLATES[0];
    else if (days >= 30 && !s.notif_2_at) tpl = TEMPLATES[1];
    else if (days >= 50 && !s.notif_3_at) tpl = TEMPLATES[2];
    if (!tpl) continue;

    // Get client info
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, phone, whatsapp')
      .eq('id', s.client_id)
      .maybeSingle();
    if (!profile) continue;

    const nome = profile.full_name || profile.email || 'Cliente';
    const marca = pub.brand_name_rpi || 'sua marca';
    const channels: string[] = [];
    if (profile.email) channels.push('email');
    if (profile.phone || profile.whatsapp) channels.push('whatsapp');
    if (channels.length === 0) continue;

    await supabase.functions.invoke('send-multichannel-notification', {
      body: {
        event_type: 'publicacao_cobranca_auto',
        channels,
        recipient: {
          nome,
          email: profile.email,
          phone: profile.phone || profile.whatsapp,
          user_id: s.client_id,
        },
        user_id: s.client_id,
        custom_message: tpl.whatsapp(nome),
        custom_html: tpl.email(nome, marca),
        custom_subject: tpl.subject(marca),
        data: { marca, titulo: tpl.subject(marca) },
      },
    });

    const channel = channels.length === 2 ? 'ambos' : channels[0];
    const now = new Date().toISOString();
    // Compute current bucket based on deadline
    let bucket = 'no_prazo';
    const deadlineStr = pub.proximo_prazo_critico || (pub.data_publicacao_rpi ? new Date(new Date(pub.data_publicacao_rpi).getTime() + 60 * 86400000).toISOString() : null);
    if (deadlineStr) {
      const d = Math.floor((new Date(deadlineStr).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      bucket = d < 0 ? 'vencidos' : d <= 7 ? 'ultima_semana' : d <= 30 ? '30dias' : 'no_prazo';
    }
    const update: any = {};
    if (tpl.id === 1) { update.notif_1_at = now; update.notif_1_channel = channel; }
    if (tpl.id === 2) { update.notif_2_at = now; update.notif_2_channel = channel; }
    if (tpl.id === 3) { update.notif_3_at = now; update.notif_3_channel = channel; }
    update.last_notif_at = now;
    update.last_notif_bucket = bucket;
    await supabase.from('publicacao_cobranca_schedule').update(update).eq('id', s.id);
    sent++;
  }

  return new Response(JSON.stringify({ processed: schedules?.length || 0, sent }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});