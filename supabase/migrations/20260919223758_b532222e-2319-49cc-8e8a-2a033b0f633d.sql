CREATE TABLE public.lembrete_fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid,
  asaas_payment_id text,
  tipo text NOT NULL DEFAULT 'd0',
  cliente_nome text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pendente',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  batch_id uuid,
  interval_minutes integer NOT NULL DEFAULT 5,
  created_by uuid,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lembrete_fila_status_check CHECK (status IN ('pendente','processando','enviado','pulado','falha','cancelado')),
  CONSTRAINT lembrete_fila_tipo_check CHECK (tipo IN ('d0','d3'))
);

GRANT SELECT, INSERT, UPDATE ON public.lembrete_fila TO authenticated;
GRANT ALL ON public.lembrete_fila TO service_role;

ALTER TABLE public.lembrete_fila ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam fila de lembretes"
ON public.lembrete_fila FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX lembrete_fila_pendentes_idx ON public.lembrete_fila (status, scheduled_at);
CREATE UNIQUE INDEX lembrete_fila_invoice_pendente_idx ON public.lembrete_fila (invoice_id) WHERE status IN ('pendente','processando') AND invoice_id IS NOT NULL;
CREATE UNIQUE INDEX lembrete_fila_asaas_pendente_idx ON public.lembrete_fila (asaas_payment_id) WHERE status IN ('pendente','processando') AND invoice_id IS NULL AND asaas_payment_id IS NOT NULL;

CREATE TRIGGER lembrete_fila_updated_at
BEFORE UPDATE ON public.lembrete_fila
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();