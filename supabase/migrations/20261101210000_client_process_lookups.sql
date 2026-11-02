-- Leitura do cache oficial do INPI pelo próprio cliente, com verificação de
-- titularidade. NÃO altera a policy admin-only existente em rpi_process_lookups:
-- o acesso do cliente passa por estas funções SECURITY DEFINER, que só retornam
-- linhas de processos que constam em brand_processes do próprio usuário.

CREATE OR REPLACE FUNCTION public.get_client_process_lookup(p_process_number text)
RETURNS SETOF public.rpi_process_lookups
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.*
  FROM public.rpi_process_lookups l
  WHERE l.process_number = p_process_number
    AND EXISTS (
      SELECT 1
      FROM public.brand_processes bp
      WHERE bp.process_number = p_process_number
        AND bp.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.get_client_process_lookups()
RETURNS SETOF public.rpi_process_lookups
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.*
  FROM public.rpi_process_lookups l
  WHERE EXISTS (
    SELECT 1
    FROM public.brand_processes bp
    WHERE bp.process_number = l.process_number
      AND bp.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.get_client_process_lookup(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_client_process_lookups() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_process_lookup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_process_lookups() TO authenticated;
