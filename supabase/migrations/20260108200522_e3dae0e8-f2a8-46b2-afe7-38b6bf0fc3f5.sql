-- Create table for RPI uploads
CREATE TABLE public.rpi_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  rpi_date DATE,
  rpi_number TEXT,
  total_processes_found INTEGER DEFAULT 0,
  total_clients_matched INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  summary TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id)
);

-- Create table for extracted RPI entries
CREATE TABLE public.rpi_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rpi_upload_id UUID NOT NULL REFERENCES public.rpi_uploads(id) ON DELETE CASCADE,
  process_number TEXT NOT NULL,
  brand_name TEXT,
  ncl_classes TEXT[],
  dispatch_type TEXT,
  dispatch_code TEXT,
  dispatch_text TEXT,
  publication_date DATE,
  holder_name TEXT,
  attorney_name TEXT,
  matched_client_id UUID,
  matched_process_id UUID,
  update_status TEXT DEFAULT 'pending',
  updated_at TIMESTAMP WITH TIME ZONE,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rpi_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpi_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rpi_uploads (admin only)
CREATE POLICY "Admins can view all RPI uploads"
  ON public.rpi_uploads FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert RPI uploads"
  ON public.rpi_uploads FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update RPI uploads"
  ON public.rpi_uploads FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete RPI uploads"
  ON public.rpi_uploads FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for rpi_entries (admin only)
CREATE POLICY "Admins can view all RPI entries"
  ON public.rpi_entries FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert RPI entries"
  ON public.rpi_entries FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update RPI entries"
  ON public.rpi_entries FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete RPI entries"
  ON public.rpi_entries FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_rpi_entries_process_number ON public.rpi_entries(process_number);
CREATE INDEX idx_rpi_entries_matched_client ON public.rpi_entries(matched_client_id);
CREATE INDEX idx_rpi_uploads_status ON public.rpi_uploads(status);