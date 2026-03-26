-- Adicionar coluna created_by na tabela contracts
-- Registra qual admin criou o contrato para atribuição automática de responsável
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice para performance nas queries de atribuição
CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON public.contracts(created_by);
