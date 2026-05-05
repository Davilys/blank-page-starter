INSERT INTO public.email_accounts (user_id, provider, email_address, display_name, is_default)
SELECT 'e42ee787-e405-4be4-8f86-f1b4596243fb'::uuid, 'smtp', 'noreply@webmarcas.net', 'WebMarcas (Notificações)', false
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_accounts WHERE email_address = 'noreply@webmarcas.net'
);