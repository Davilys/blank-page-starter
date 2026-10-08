CREATE TABLE public.annuity_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercicio integer NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  start_date date NOT NULL,
  amount_cents integer NOT NULL DEFAULT 39800,
  daily_limit integer NOT NULL DEFAULT 200,
  daily_hour integer NOT NULL DEFAULT 9,
  period_label text NOT NULL,
  contract_reference_date date,
  scan_cursor integer NOT NULL DEFAULT 0,
  scan_done boolean NOT NULL DEFAULT false,
  scan_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_scan_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.annuity_campaigns TO authenticated;
GRANT ALL ON public.annuity_campaigns TO service_role;
ALTER TABLE public.annuity_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "annuity_campaigns_fin_read" ON public.annuity_campaigns FOR SELECT TO authenticated USING (public.has_financial_permission(auth.uid()));

CREATE TABLE public.annuity_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.annuity_campaigns(id) ON DELETE CASCADE,
  exercicio integer NOT NULL,
  client_id uuid NOT NULL,
  client_name text,
  client_email text,
  doc_digits text,
  contract_id uuid,
  brands text[] NOT NULL DEFAULT '{}',
  amount_cents integer NOT NULL,
  eligibility text NOT NULL DEFAULT 'eligible',
  reason text,
  generation_status text NOT NULL DEFAULT 'scheduled',
  email_status text NOT NULL DEFAULT 'not_sent',
  financial_status text NOT NULL DEFAULT 'none',
  invoice_id uuid,
  asaas_payment_id text UNIQUE,
  boleto_url text,
  emitted_at date,
  due_date date,
  contract_ref_date date,
  last_error text,
  attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  manual_by uuid,
  manual_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exercicio, client_id)
);
CREATE INDEX annuity_items_campaign_idx ON public.annuity_items(campaign_id, generation_status);
CREATE INDEX annuity_items_invoice_idx ON public.annuity_items(invoice_id);
GRANT SELECT ON public.annuity_items TO authenticated;
GRANT ALL ON public.annuity_items TO service_role;
ALTER TABLE public.annuity_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "annuity_items_fin_read" ON public.annuity_items FOR SELECT TO authenticated USING (public.has_financial_permission(auth.uid()));

CREATE TABLE public.annuity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.annuity_campaigns(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.annuity_items(id) ON DELETE CASCADE,
  actor uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX annuity_events_item_idx ON public.annuity_events(item_id, created_at);
GRANT SELECT ON public.annuity_events TO authenticated;
GRANT ALL ON public.annuity_events TO service_role;
ALTER TABLE public.annuity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "annuity_events_fin_read" ON public.annuity_events FOR SELECT TO authenticated USING (public.has_financial_permission(auth.uid()));

CREATE TABLE public.annuity_daily_quota (
  day date PRIMARY KEY,
  clients_used integer NOT NULL DEFAULT 0,
  emails_used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.annuity_daily_quota TO authenticated;
GRANT ALL ON public.annuity_daily_quota TO service_role;
ALTER TABLE public.annuity_daily_quota ENABLE ROW LEVEL SECURITY;
CREATE POLICY "annuity_quota_fin_read" ON public.annuity_daily_quota FOR SELECT TO authenticated USING (public.has_financial_permission(auth.uid()));

CREATE TRIGGER annuity_campaigns_updated BEFORE UPDATE ON public.annuity_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER annuity_items_updated BEFORE UPDATE ON public.annuity_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reserva atômica: cota diária de clientes + itens com lease
CREATE OR REPLACE FUNCTION public.annuity_claim_items(p_campaign uuid, p_limit integer)
RETURNS SETOF public.annuity_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_used integer;
  v_take integer;
BEGIN
  INSERT INTO annuity_daily_quota(day) VALUES (v_day) ON CONFLICT (day) DO NOTHING;
  SELECT clients_used INTO v_used FROM annuity_daily_quota WHERE day = v_day FOR UPDATE;
  v_take := LEAST(p_limit, GREATEST(0, 200 - v_used));
  IF v_take <= 0 THEN RETURN; END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM annuity_items
    WHERE campaign_id = p_campaign AND eligibility = 'eligible'
      AND generation_status = 'scheduled'
      AND (lease_until IS NULL OR lease_until < now())
    ORDER BY client_name NULLS LAST, id
    LIMIT v_take
    FOR UPDATE SKIP LOCKED
  )
  UPDATE annuity_items a SET generation_status = 'processing', lease_until = now() + interval '10 minutes', attempts = a.attempts + 1
  FROM picked WHERE a.id = picked.id
  RETURNING a.*;
  GET DIAGNOSTICS v_take = ROW_COUNT;
  UPDATE annuity_daily_quota SET clients_used = clients_used + v_take, updated_at = now() WHERE day = v_day;
END $$;
REVOKE ALL ON FUNCTION public.annuity_claim_items(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.annuity_claim_items(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.annuity_reserve_email()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_day date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; v_ok boolean;
BEGIN
  INSERT INTO annuity_daily_quota(day) VALUES (v_day) ON CONFLICT (day) DO NOTHING;
  UPDATE annuity_daily_quota SET emails_used = emails_used + 1, updated_at = now()
   WHERE day = v_day AND emails_used < 200 RETURNING true INTO v_ok;
  RETURN COALESCE(v_ok, false);
END $$;
REVOKE ALL ON FUNCTION public.annuity_reserve_email() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.annuity_reserve_email() TO service_role;

-- Situação financeira acompanha a fatura vinculada
CREATE OR REPLACE FUNCTION public.annuity_sync_financial()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s text := upper(coalesce(NEW.status, ''));
BEGIN
  UPDATE annuity_items SET financial_status = CASE
    WHEN s IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH','PAID','PAGO','RECEBIDO') THEN 'paid'
    WHEN s IN ('OVERDUE','VENCIDO') THEN 'overdue'
    WHEN s IN ('REFUNDED','REFUND_REQUESTED','CHARGEBACK_REQUESTED','ESTORNADO') THEN 'refunded'
    WHEN s IN ('CANCELLED','CANCELED','DELETED','CANCELADO') THEN 'cancelled'
    ELSE 'pending' END
  WHERE invoice_id = NEW.id;
  RETURN NEW;
END $$;
CREATE TRIGGER invoices_annuity_sync AFTER UPDATE OF status ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.annuity_sync_financial();

ALTER PUBLICATION supabase_realtime ADD TABLE public.annuity_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.annuity_campaigns;