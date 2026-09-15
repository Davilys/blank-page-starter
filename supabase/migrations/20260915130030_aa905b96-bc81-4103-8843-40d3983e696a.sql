
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'ativa',
  ADD COLUMN IF NOT EXISTS removida_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_sincronizacao_asaas timestamptz,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'interna',
  ADD COLUMN IF NOT EXISTS asaas_status_raw text;

CREATE INDEX IF NOT EXISTS invoices_user_sync_idx ON public.invoices (user_id, sync_status);

CREATE TABLE IF NOT EXISTS public.asaas_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  executed_by uuid,
  sync_run_id uuid NOT NULL,
  customer_ids text[] NOT NULL DEFAULT '{}',
  ambiguous_customer_ids text[] NOT NULL DEFAULT '{}',
  total_encontradas integer NOT NULL DEFAULT 0,
  total_criadas integer NOT NULL DEFAULT 0,
  total_atualizadas integer NOT NULL DEFAULT 0,
  total_removidas integer NOT NULL DEFAULT 0,
  totais_antes jsonb,
  totais_depois jsonb,
  sucesso boolean NOT NULL DEFAULT false,
  incompleta boolean NOT NULL DEFAULT false,
  erro text,
  duracao_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.asaas_sync_logs TO authenticated;
GRANT ALL ON public.asaas_sync_logs TO service_role;

ALTER TABLE public.asaas_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view asaas sync logs"
ON public.asaas_sync_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS asaas_sync_logs_client_idx ON public.asaas_sync_logs (client_id, created_at DESC);
