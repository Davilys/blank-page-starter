
ALTER TABLE public.publicacoes_marcas
  ADD COLUMN IF NOT EXISTS cumprimento_status text;

ALTER TABLE public.publicacoes_marcas
  DROP CONSTRAINT IF EXISTS publicacoes_marcas_cumprimento_status_check;

ALTER TABLE public.publicacoes_marcas
  ADD CONSTRAINT publicacoes_marcas_cumprimento_status_check
  CHECK (cumprimento_status IS NULL OR cumprimento_status IN ('cumprido','contato_agendado','aguardando_pagamento'));

CREATE OR REPLACE FUNCTION public.sync_cumprimento_ok_from_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cumprimento_status = 'cumprido' THEN
    NEW.cumprimento_ok := true;
    IF NEW.cumprimento_at IS NULL THEN
      NEW.cumprimento_at := now();
    END IF;
  ELSIF NEW.cumprimento_status IS DISTINCT FROM 'cumprido' THEN
    -- Não força false aqui se já estava true por outro caminho? Sim, vamos sincronizar.
    IF NEW.cumprimento_status IS NULL THEN
      NEW.cumprimento_ok := false;
      NEW.cumprimento_at := NULL;
      NEW.cumprimento_by := NULL;
    ELSE
      -- contato_agendado / aguardando_pagamento => não some da lista
      NEW.cumprimento_ok := false;
      NEW.cumprimento_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cumprimento_status ON public.publicacoes_marcas;
CREATE TRIGGER trg_sync_cumprimento_status
  BEFORE INSERT OR UPDATE OF cumprimento_status ON public.publicacoes_marcas
  FOR EACH ROW EXECUTE FUNCTION public.sync_cumprimento_ok_from_status();
