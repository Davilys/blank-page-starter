DROP INDEX IF EXISTS public.cobranca_tratamentos_evento_uidx;
CREATE UNIQUE INDEX cobranca_tratamentos_evento_uidx
  ON public.cobranca_tratamentos (asaas_payment_id_original, crm_action_id);