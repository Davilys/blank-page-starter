
-- Table for award entries (registro de marca, publicação, cobrança)
CREATE TABLE public.award_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('registro_marca', 'publicacao', 'cobranca')),
  client_name TEXT NOT NULL,
  brand_name TEXT,
  responsible_user_id UUID NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  observations TEXT,
  
  -- Registro de Marca fields
  brand_quantity INTEGER DEFAULT 1,
  payment_type TEXT CHECK (payment_type IN ('avista', 'parcelado', 'promocao')),
  
  -- Publicação fields
  publication_type TEXT,
  pub_quantity INTEGER DEFAULT 1,
  
  -- Cobrança fields
  installments_paid INTEGER,
  total_resolved_value NUMERIC,
  
  payment_date DATE,
  payment_form TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.award_entries ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage award entries"
ON public.award_entries
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Regular users can view their own entries
CREATE POLICY "Users can view own award entries"
ON public.award_entries
FOR SELECT
USING (responsible_user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_award_entries_updated_at
BEFORE UPDATE ON public.award_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add permission key for the new tab
INSERT INTO public.admin_permissions (user_id, permission_key, can_view, can_edit, can_delete)
SELECT ur.user_id, 'awards', true, true, true
FROM public.user_roles ur
WHERE ur.role = 'admin'
ON CONFLICT DO NOTHING;
