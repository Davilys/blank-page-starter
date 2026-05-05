
CREATE TABLE IF NOT EXISTS public.email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'onboarding',
  trigger_event text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  trigger_count integer NOT NULL DEFAULT 0,
  success_rate integer NOT NULL DEFAULT 0,
  last_triggered_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage email automations" ON public.email_automations;
CREATE POLICY "Admins manage email automations"
ON public.email_automations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS email_automations_updated_at ON public.email_automations;
CREATE TRIGGER email_automations_updated_at
BEFORE UPDATE ON public.email_automations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_automations (name, description, category, trigger_event, steps, is_active, trigger_count, success_rate)
SELECT 'Cobrança Automática', 'Lembrete de cobrança para faturas próximas do vencimento', 'financeiro', 'invoice_due_soon',
  '[{"type":"trigger","label":"Fatura Vencendo (3 dias)","detail":"invoice_due_soon"},{"type":"action","label":"Email: Lembrete de Pagamento","detail":"Cobrança Amigável"}]'::jsonb,
  false, 89, 71
WHERE NOT EXISTS (SELECT 1 FROM public.email_automations);
