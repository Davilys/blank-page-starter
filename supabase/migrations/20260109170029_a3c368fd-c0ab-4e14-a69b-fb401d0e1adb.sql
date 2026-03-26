-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  cpf_cnpj TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  origin TEXT DEFAULT 'site',
  estimated_value NUMERIC(12,2),
  assigned_to UUID,
  notes TEXT,
  converted_at TIMESTAMPTZ,
  converted_to_client_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create contract_types table
CREATE TABLE public.contract_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default contract types
INSERT INTO public.contract_types (name, description) VALUES
  ('REGISTRO DE MARCA', 'Contrato para registro de marca no INPI'),
  ('DISTRATO SEM MULTA', 'Contrato de distrato sem aplicação de multa'),
  ('DISTRATO COM MULTA', 'Contrato de distrato com aplicação de multa'),
  ('RENOVAÇÃO', 'Contrato de renovação de marca');

-- Create contract_templates table
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contract_type_id UUID REFERENCES public.contract_types(id),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expand contracts table with new columns
ALTER TABLE public.contracts 
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS contract_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS contract_type_id UUID REFERENCES public.contract_types(id),
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.contract_templates(id),
  ADD COLUMN IF NOT EXISTS signature_status TEXT DEFAULT 'not_signed',
  ADD COLUMN IF NOT EXISTS signature_ip TEXT,
  ADD COLUMN IF NOT EXISTS signature_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS visible_to_client BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT;

-- Create contract_comments table
CREATE TABLE public.contract_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create contract_attachments table
CREATE TABLE public.contract_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create contract_tasks table
CREATE TABLE public.contract_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  assigned_to UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create contract_notes table
CREATE TABLE public.contract_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create contract_renewal_history table
CREATE TABLE public.contract_renewal_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  previous_end_date DATE,
  new_end_date DATE,
  previous_value NUMERIC(12,2),
  new_value NUMERIC(12,2),
  notes TEXT,
  renewed_by UUID,
  renewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create import_logs table
CREATE TABLE public.import_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_type TEXT NOT NULL,
  file_name TEXT,
  total_records INTEGER,
  imported_records INTEGER,
  failed_records INTEGER,
  errors JSONB,
  imported_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_renewal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leads (admin only)
CREATE POLICY "Admins can manage leads" ON public.leads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contract_types (read all, write admin)
CREATE POLICY "Anyone can read contract types" ON public.contract_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage contract types" ON public.contract_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contract_templates (admin only)
CREATE POLICY "Admins can manage contract templates" ON public.contract_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contract_comments
CREATE POLICY "Users can view their contract comments" ON public.contract_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c 
      WHERE c.id = contract_id AND c.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage contract comments" ON public.contract_comments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contract_attachments
CREATE POLICY "Users can view their contract attachments" ON public.contract_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c 
      WHERE c.id = contract_id AND c.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage contract attachments" ON public.contract_attachments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contract_tasks (admin only)
CREATE POLICY "Admins can manage contract tasks" ON public.contract_tasks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contract_notes (admin only)
CREATE POLICY "Admins can manage contract notes" ON public.contract_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contract_renewal_history
CREATE POLICY "Users can view their renewal history" ON public.contract_renewal_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c 
      WHERE c.id = contract_id AND c.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage renewal history" ON public.contract_renewal_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for import_logs (admin only)
CREATE POLICY "Admins can manage import logs" ON public.import_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contract_templates_updated_at BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contract_notes_updated_at BEFORE UPDATE ON public.contract_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();