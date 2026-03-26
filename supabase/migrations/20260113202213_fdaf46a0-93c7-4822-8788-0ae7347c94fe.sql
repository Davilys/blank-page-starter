-- Add tag column to rpi_entries table for tracking status
ALTER TABLE public.rpi_entries ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT 'pending';

-- Add index for faster filtering by tag
CREATE INDEX IF NOT EXISTS idx_rpi_entries_tag ON public.rpi_entries(tag);