ALTER TABLE public.cobranca_historico
  ADD COLUMN IF NOT EXISTS situacao TEXT NOT NULL DEFAULT 'aguardando',
  ADD COLUMN IF NOT EXISTS pago_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pago_manual BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pago_obs TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS negativado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS negativado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS negativado_total NUMERIC;

UPDATE public.cobranca_historico
SET situacao = 'recebida', pago_em = COALESCE(pago_em, updated_at)
WHERE status = 'confirmada_paga' AND situacao <> 'recebida';