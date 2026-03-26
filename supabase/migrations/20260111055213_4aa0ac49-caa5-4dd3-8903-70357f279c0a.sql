-- 1. Remover política insegura de leads
DROP POLICY IF EXISTS "Anyone can create leads from form" ON leads;

-- 2. Nova política: INSERT público mas com campos obrigatórios e validação
CREATE POLICY "Public can create leads with required fields"
ON leads FOR INSERT
WITH CHECK (
  full_name IS NOT NULL AND 
  email IS NOT NULL AND 
  phone IS NOT NULL AND
  LENGTH(full_name) >= 2 AND
  LENGTH(email) >= 5
);

-- 3. Remover política pública de contract_types
DROP POLICY IF EXISTS "Anyone can read contract types" ON contract_types;

-- 4. Nova política: apenas usuários autenticados podem ler contract_types
CREATE POLICY "Authenticated users can read contract types"
ON contract_types FOR SELECT
TO authenticated
USING (true);

-- 5. Adicionar política DELETE para profiles - apenas admins
CREATE POLICY "Admins can delete profiles"
ON profiles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. Criar função segura que usa auth.uid() internamente (evita privilege escalation)
CREATE OR REPLACE FUNCTION public.has_current_user_role(_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = _role
  )
$$;