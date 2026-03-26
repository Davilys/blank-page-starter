-- Add pipeline_stage column to brand_processes to track Kanban stages
ALTER TABLE public.brand_processes 
ADD COLUMN IF NOT EXISTS pipeline_stage text DEFAULT 'protocolado';

-- Add priority and origin columns for client management
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS origin text DEFAULT 'site',
ADD COLUMN IF NOT EXISTS contract_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_contact timestamp with time zone;

-- Create client_notes table for internal notes
CREATE TABLE IF NOT EXISTS public.client_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    admin_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create client_activities table for tracking changes
CREATE TABLE IF NOT EXISTS public.client_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    admin_id uuid,
    activity_type text NOT NULL,
    description text NOT NULL,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

-- Create client_appointments table for scheduling
CREATE TABLE IF NOT EXISTS public.client_appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    admin_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    scheduled_at timestamp with time zone NOT NULL,
    completed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_notes (admin only)
CREATE POLICY "Admins can view all client notes" ON public.client_notes
    FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert client notes" ON public.client_notes
    FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update client notes" ON public.client_notes
    FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete client notes" ON public.client_notes
    FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for client_activities (admin only)
CREATE POLICY "Admins can view all client activities" ON public.client_activities
    FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert client activities" ON public.client_activities
    FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for client_appointments (admin only)
CREATE POLICY "Admins can view all client appointments" ON public.client_appointments
    FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert client appointments" ON public.client_appointments
    FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update client appointments" ON public.client_appointments
    FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete client appointments" ON public.client_appointments
    FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add policy for admins to update profiles
CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));