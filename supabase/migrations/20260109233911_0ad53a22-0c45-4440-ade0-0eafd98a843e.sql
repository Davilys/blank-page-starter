-- Corrigir políticas RLS muito permissivas removendo as anteriores
DROP POLICY IF EXISTS "Public can view contracts by valid token" ON public.contracts;
DROP POLICY IF EXISTS "Public can sign contracts with valid token" ON public.contracts;

-- Nota: O acesso público via token será feito através de edge functions com service role
-- que validam o token e retornam apenas os dados necessários para assinatura