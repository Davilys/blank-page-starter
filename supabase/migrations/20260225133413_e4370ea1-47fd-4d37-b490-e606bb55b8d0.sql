
-- Add Google Meet columns to client_appointments
ALTER TABLE public.client_appointments ADD COLUMN IF NOT EXISTS google_meet_link TEXT;
ALTER TABLE public.client_appointments ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- Add Google Meet columns to meetings
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS google_meet_link TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS google_event_id TEXT;
