CREATE TABLE public.email_repair_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'preview',
  status text NOT NULL DEFAULT 'running',
  limit_count integer NOT NULL DEFAULT 30,
  examined integer NOT NULL DEFAULT 0,
  repaired integer NOT NULL DEFAULT 0,
  unchanged integer NOT NULL DEFAULT 0,
  not_found integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  started_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_repair_runs TO authenticated;
GRANT ALL ON public.email_repair_runs TO service_role;

ALTER TABLE public.email_repair_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email repair runs"
ON public.email_repair_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX email_repair_runs_single_running
ON public.email_repair_runs ((status)) WHERE status = 'running';

CREATE TRIGGER update_email_repair_runs_updated_at
BEFORE UPDATE ON public.email_repair_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();