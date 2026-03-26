-- Corrigir policy permissiva de INSERT
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;

-- Criar policy que permite inserção apenas para o próprio usuário ou via trigger
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);