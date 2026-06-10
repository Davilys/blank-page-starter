
CREATE TABLE IF NOT EXISTS public.publicacao_cobranca_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacao_id uuid NOT NULL UNIQUE REFERENCES public.publicacoes_marcas(id) ON DELETE CASCADE,
  client_id uuid,
  data_inicio date NOT NULL DEFAULT (now()::date),
  notif_1_at timestamptz,
  notif_2_at timestamptz,
  notif_3_at timestamptz,
  notif_1_channel text,
  notif_2_channel text,
  notif_3_channel text,
  status text NOT NULL DEFAULT 'ativo',
  client_responded_at timestamptz,
  responsavel_admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publicacao_cobranca_schedule TO authenticated;
GRANT ALL ON public.publicacao_cobranca_schedule TO service_role;

ALTER TABLE public.publicacao_cobranca_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cobranca schedule"
  ON public.publicacao_cobranca_schedule
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients read own schedule"
  ON public.publicacao_cobranca_schedule
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_pcs_status_data ON public.publicacao_cobranca_schedule (status, data_inicio);
CREATE INDEX IF NOT EXISTS idx_pcs_client ON public.publicacao_cobranca_schedule (client_id);

CREATE TRIGGER update_pcs_updated_at
  BEFORE UPDATE ON public.publicacao_cobranca_schedule
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: pause schedule when client sends a chat message
CREATE OR REPLACE FUNCTION public.pause_cobranca_on_client_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE public.publicacao_cobranca_schedule
       SET status = 'pausado_resposta',
           client_responded_at = COALESCE(client_responded_at, now()),
           updated_at = now()
     WHERE client_id = NEW.user_id
       AND status = 'ativo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_pause_cobranca ON public.chat_messages;
CREATE TRIGGER chat_messages_pause_cobranca
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.pause_cobranca_on_client_message();
