-- Régua de cobrança automática: fila, flags (tudo DESLIGADO e em dry-run) e agendamentos.
-- A régua só ENVIA mensagens e cria acordos pelo fluxo manual existente. Não rescinde nem cancela contrato.

CREATE TABLE IF NOT EXISTS public.cobranca_fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('vencido_d1','vencido_d3','vencido_d5','acordo_auto')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','processando','enviado','erro','cancelado')),
  agendado_para timestamptz NOT NULL DEFAULT now(),
  tentativas int NOT NULL DEFAULT 0,
  claimed_at timestamptz,
  processado_em timestamptz,
  resultado jsonb,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, tipo)
);
CREATE INDEX IF NOT EXISTS cobranca_fila_pendentes_idx ON public.cobranca_fila (agendado_para) WHERE status = 'pendente';
ALTER TABLE public.cobranca_fila ENABLE ROW LEVEL SECURITY;  -- sem policies: só service_role

INSERT INTO public.system_settings (key, value)
VALUES ('regua_cobranca', '{"lembretes_ativo":false,"acordo_auto_ativo":false,"dry_run":true,"acordo_corte_data":null,"ativado_em":null,"incluir_dunning":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Texto normalizado (sem acento, minúsculo) para classificar o serviço da cobrança.
CREATE OR REPLACE FUNCTION public.regua_norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT translate(lower(coalesce(t,'')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
$$;

CREATE OR REPLACE FUNCTION public.enfileirar_regua_cobranca(p_hoje date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg jsonb;
  v_hoje date := coalesce(p_hoje, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_extra int := CASE WHEN extract(dow FROM v_hoje) = 1 THEN 1 ELSE 0 END; -- segunda recupera o domingo
  v_corte date;
  v_dry boolean;
  v_lemb boolean; v_acordo boolean; v_dun boolean;
  r jsonb := '{}'::jsonb;
  n int;
BEGIN
  SELECT value INTO cfg FROM system_settings WHERE key = 'regua_cobranca';
  IF cfg IS NULL THEN RETURN jsonb_build_object('erro','sem configuração'); END IF;
  v_dry   := coalesce((cfg->>'dry_run')::boolean, true);
  v_lemb  := coalesce((cfg->>'lembretes_ativo')::boolean, false);
  v_acordo:= coalesce((cfg->>'acordo_auto_ativo')::boolean, false);
  v_dun   := coalesce((cfg->>'incluir_dunning')::boolean, false);
  v_corte := coalesce(nullif(cfg->>'acordo_corte_data','')::date, nullif(cfg->>'ativado_em','')::date);

  PERFORM pg_advisory_xact_lock(hashtext('regua_cobranca_enfileirar'));

  CREATE TEMP TABLE IF NOT EXISTS _regua_cand (invoice_id uuid, tipo text) ON COMMIT DROP;
  DELETE FROM _regua_cand WHERE true;

  -- Lembretes D1/D3/D5 de faturas vencidas (fonte: classificador da tela Financeiro > Vencidas).
  INSERT INTO _regua_cand
  SELECT i.id, t.tipo
  FROM invoices i
  JOIN (VALUES ('vencido_d1',1),('vencido_d3',3),('vencido_d5',5)) AS t(tipo,d)
    ON i.due_date BETWEEN v_hoje - t.d - v_extra AND v_hoje - t.d
  WHERE v_lemb
    AND classificar_situacao_cobranca(i.status, i.due_date, i.sync_status) = 'vencidas'
    AND (v_dun OR lower(coalesce(i.status,'')) <> 'dunning_requested')
    AND NOT EXISTS (SELECT 1 FROM acordos_cliente a WHERE a.invoice_original_id = i.id AND a.status IN ('processando','ativo','falha_pendente'));

  -- Acordo automático aos 30 dias: só registro R$699 (3x/10%) e exigência R$1.621 (5x/10%),
  -- só faturas novas (vencimento >= corte). Sem corte configurado, fica desativado.
  INSERT INTO _regua_cand
  SELECT i.id, 'acordo_auto'
  FROM invoices i
  WHERE v_acordo AND v_corte IS NOT NULL
    AND i.due_date >= greatest(v_corte, v_hoje - 35) AND i.due_date <= v_hoje - 30
    AND i.acordo_id IS NULL AND i.asaas_invoice_id IS NOT NULL
    AND classificar_situacao_cobranca(i.status, i.due_date, i.sync_status) = 'vencidas'
    AND lower(coalesce(i.status,'')) <> 'dunning_requested'
    AND NOT EXISTS (SELECT 1 FROM acordos_cliente a WHERE a.invoice_original_id = i.id AND a.status IN ('processando','ativo','falha_pendente'))
    AND (
      ( round(i.amount*100) = 162100 AND regua_norm(i.description) LIKE '%exigencia%' AND regua_norm(i.description) LIKE '%inpi%'
        AND regua_norm(i.description) !~ 'parcela|acordo' )
      OR
      ( round(i.amount*100) = 69900 AND regua_norm(i.description) LIKE '%registro%' AND regua_norm(i.description) LIKE '%marca%'
        AND regua_norm(i.description) !~ 'parcela|acordo|exig'
        AND NOT EXISTS (
          SELECT 1 FROM invoices o
          WHERE o.user_id = i.user_id AND o.id <> i.id AND round(o.amount*100) = 69900
            AND regua_norm(o.description) LIKE '%registro%' AND regua_norm(o.description) LIKE '%marca%'
            AND regua_norm(o.description) !~ 'parcela|acordo|exig'
            AND (o.created_at, o.id) < (i.created_at, i.id)) )
    );

  SELECT coalesce(jsonb_object_agg(tipo, c), '{}'::jsonb) INTO r
  FROM (SELECT tipo, count(*) c FROM _regua_cand GROUP BY tipo) s;

  IF v_dry THEN
    RETURN jsonb_build_object('dry_run', true, 'hoje', v_hoje, 'candidatos', r);
  END IF;

  INSERT INTO cobranca_fila (invoice_id, tipo)
  SELECT invoice_id, tipo FROM _regua_cand
  ON CONFLICT (invoice_id, tipo) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('dry_run', false, 'hoje', v_hoje, 'candidatos', r, 'enfileirados', n);
END $$;
REVOKE ALL ON FUNCTION public.enfileirar_regua_cobranca(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enfileirar_regua_cobranca(date) TO service_role;

-- Pega 1 item por vez; intervalo global mínimo de ~3 min entre envios (ritmo de 3 min).
CREATE OR REPLACE FUNCTION public.claim_cobranca_fila()
RETURNS SETOF public.cobranca_fila
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.cobranca_fila;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('regua_cobranca_claim'));
  -- Item preso em 'processando' >10 min vira erro (nunca reenvia sozinho: evita duplicar).
  UPDATE cobranca_fila SET status='erro', erro='timeout em processando' WHERE status='processando' AND claimed_at < now() - interval '10 minutes';
  IF EXISTS (SELECT 1 FROM cobranca_fila WHERE claimed_at > now() - interval '170 seconds') THEN RETURN; END IF;
  SELECT * INTO r FROM cobranca_fila
   WHERE status='pendente' AND agendado_para <= now()
   ORDER BY agendado_para, created_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE cobranca_fila SET status='processando', claimed_at=now(), tentativas=tentativas+1 WHERE id=r.id RETURNING * INTO r;
  RETURN NEXT r;
END $$;
REVOKE ALL ON FUNCTION public.claim_cobranca_fila() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_cobranca_fila() TO service_role;

-- Agendamentos. O segredo vem do Vault (nome 'cron_secret'); sem ele as funções respondem 401 (falha fechada).
DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('regua-cobranca-enfileirar','regua-cobranca-processar');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('regua-cobranca-enfileirar', '5 11 * * 1-6', $job$
  SELECT net.http_post(
    url := 'https://scpbqsvwojhbxihyqbdz.supabase.co/functions/v1/regua-cobranca-enfileirar',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_secret' LIMIT 1),'')),
    body := '{}'::jsonb);
$job$);
SELECT cron.schedule('regua-cobranca-processar', '*/3 * * * *', $job$
  SELECT net.http_post(
    url := 'https://scpbqsvwojhbxihyqbdz.supabase.co/functions/v1/regua-cobranca-processar',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_secret' LIMIT 1),'')),
    body := '{}'::jsonb);
$job$);
