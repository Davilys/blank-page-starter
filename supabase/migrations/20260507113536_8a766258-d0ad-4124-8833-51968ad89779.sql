CREATE TABLE IF NOT EXISTS public.cobranca_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID,
  cliente_nome TEXT,
  cliente_email TEXT,
  cliente_phone TEXT,
  enviada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  canais TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'enviada',
  proxima_acao_em TIMESTAMPTZ,
  message_whatsapp TEXT,
  message_email_html TEXT,
  message_email_subject TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobranca_historico_invoice ON public.cobranca_historico(invoice_id);
CREATE INDEX IF NOT EXISTS idx_cobranca_historico_status ON public.cobranca_historico(status);
CREATE INDEX IF NOT EXISTS idx_cobranca_historico_enviada_em ON public.cobranca_historico(enviada_em DESC);

ALTER TABLE public.cobranca_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cobranca_historico"
  ON public.cobranca_historico
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_cobranca_historico_updated_at
  BEFORE UPDATE ON public.cobranca_historico
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: when invoice is paid, mark related cobrancas as confirmada_paga
CREATE OR REPLACE FUNCTION public.mark_cobranca_paid_on_invoice_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('paid','confirmed','received','RECEIVED','CONFIRMED')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('paid','confirmed','received','RECEIVED','CONFIRMED')) THEN
    UPDATE public.cobranca_historico
    SET status = 'confirmada_paga', updated_at = now()
    WHERE invoice_id = NEW.id
      AND status <> 'confirmada_paga';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_cobranca_paid ON public.invoices;
CREATE TRIGGER trg_mark_cobranca_paid
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_cobranca_paid_on_invoice_paid();

-- Function to mark cobrancas as reentrada_fila after 7 days without payment
CREATE OR REPLACE FUNCTION public.recheck_cobranca_reentry()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER := 0;
BEGIN
  UPDATE public.cobranca_historico
  SET status = 'reentrada_fila', updated_at = now()
  WHERE status = 'enviada'
    AND proxima_acao_em IS NOT NULL
    AND proxima_acao_em < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;