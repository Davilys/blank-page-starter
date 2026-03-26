-- Add folder column to email_inbox to distinguish inbox vs sent emails synced from IMAP
ALTER TABLE public.email_inbox ADD COLUMN IF NOT EXISTS folder text NOT NULL DEFAULT 'inbox';

-- Add index for faster filtering by folder
CREATE INDEX IF NOT EXISTS idx_email_inbox_folder ON public.email_inbox (folder);

-- Add To header field support for sent emails
ALTER TABLE public.email_inbox ADD COLUMN IF NOT EXISTS to_name text;