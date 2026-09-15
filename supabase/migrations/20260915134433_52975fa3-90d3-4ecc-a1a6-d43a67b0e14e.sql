CREATE OR REPLACE FUNCTION public.nome_ordenavel(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(btrim(translate(COALESCE(p, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')));
$$;

REVOKE ALL ON FUNCTION public.admin_invoices_list(text, text, date, date, uuid, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_invoices_list(text, text, date, date, uuid, text, text, integer, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_invoices_totals(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_invoices_totals(date, date, uuid) TO authenticated, service_role;