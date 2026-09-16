REVOKE EXECUTE ON FUNCTION public.is_master_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_master_user() TO authenticated, service_role;