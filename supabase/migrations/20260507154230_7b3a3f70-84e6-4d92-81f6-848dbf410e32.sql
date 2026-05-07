
-- Trigger: ao definir/alterar contracts.user_id, propaga para documents e invoices vinculados ao contrato
CREATE OR REPLACE FUNCTION public.propagate_contract_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    UPDATE public.documents SET user_id = NEW.user_id
      WHERE contract_id = NEW.id AND (user_id IS DISTINCT FROM NEW.user_id);
    UPDATE public.invoices SET user_id = NEW.user_id
      WHERE contract_id = NEW.id AND (user_id IS DISTINCT FROM NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_contract_user_id ON public.contracts;
CREATE TRIGGER trg_propagate_contract_user_id
  AFTER UPDATE OF user_id ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_contract_user_id();

-- Backfill: corrige documentos/faturas que já estão com contract_id mas sem user_id
UPDATE public.documents d
SET user_id = c.user_id
FROM public.contracts c
WHERE d.contract_id = c.id
  AND c.user_id IS NOT NULL
  AND (d.user_id IS NULL OR d.user_id IS DISTINCT FROM c.user_id);

UPDATE public.invoices i
SET user_id = c.user_id
FROM public.contracts c
WHERE i.contract_id = c.id
  AND c.user_id IS NOT NULL
  AND (i.user_id IS NULL OR i.user_id IS DISTINCT FROM c.user_id);
