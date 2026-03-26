-- Cria uma função SECURITY DEFINER para verificar se o perfil acessado é o consultor atribuído ao usuário atual
-- Isso evita recursão infinita na RLS ao consultar a própria tabela profiles
CREATE OR REPLACE FUNCTION public.is_assigned_admin_of_current_user(_admin_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (
        (assigned_to = _admin_id AND assigned_to IS NOT NULL)
        OR
        (created_by = _admin_id AND created_by IS NOT NULL)
      )
  )
$$;

-- Adiciona política que permite ao cliente visualizar o perfil do admin atribuído a ele
CREATE POLICY "Clients can view their assigned admin profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.is_assigned_admin_of_current_user(id)
);