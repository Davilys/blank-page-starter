CREATE OR REPLACE FUNCTION public.profiles_by_doc_digits(p_doc text)
RETURNS TABLE(id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.profiles p
  WHERE regexp_replace(COALESCE(p.cpf_cnpj, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(p_doc, ''), '[^0-9]', '', 'g')
    AND regexp_replace(COALESCE(p_doc, ''), '[^0-9]', '', 'g') <> ''
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.profiles_by_doc_digits(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profiles_by_doc_digits(text) TO service_role;