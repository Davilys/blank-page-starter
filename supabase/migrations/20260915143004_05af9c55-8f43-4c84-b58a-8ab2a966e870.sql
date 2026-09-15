CREATE OR REPLACE FUNCTION public.admin_asaas_accounts(p_owner uuid DEFAULT NULL)
RETURNS TABLE(asaas_customer_id text, cliente_nome text, cobrancas bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  RETURN QUERY
  SELECT i.asaas_customer_id,
         COALESCE(max(p.full_name), max(p.email), i.asaas_customer_id) AS cliente_nome,
         count(*)::bigint AS cobrancas
  FROM public.invoices i
  LEFT JOIN public.profiles p ON p.id = i.user_id
  WHERE i.asaas_customer_id IS NOT NULL
    AND trim(i.asaas_customer_id) <> ''
    AND (p_owner IS NULL OR p.assigned_to = p_owner OR p.created_by = p_owner)
  GROUP BY i.asaas_customer_id
  ORDER BY public.nome_ordenavel(COALESCE(max(p.full_name), max(p.email), i.asaas_customer_id));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_asaas_accounts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_asaas_accounts(uuid) TO authenticated, service_role;