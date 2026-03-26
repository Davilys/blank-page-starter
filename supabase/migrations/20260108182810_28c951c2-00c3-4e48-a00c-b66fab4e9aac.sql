-- Create table for INPI administrative resources
CREATE TABLE public.inpi_resources (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('indeferimento', 'exigencia_merito', 'oposicao')),
    process_number TEXT,
    brand_name TEXT,
    ncl_class TEXT,
    holder TEXT,
    examiner_or_opponent TEXT,
    legal_basis TEXT,
    draft_content TEXT,
    final_content TEXT,
    adjustments_history JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'finalized')),
    original_pdf_path TEXT,
    final_pdf_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    approved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.inpi_resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only admins can access
CREATE POLICY "Admins can view all INPI resources"
ON public.inpi_resources
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert INPI resources"
ON public.inpi_resources
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update INPI resources"
ON public.inpi_resources
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete INPI resources"
ON public.inpi_resources
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_inpi_resources_updated_at
BEFORE UPDATE ON public.inpi_resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();