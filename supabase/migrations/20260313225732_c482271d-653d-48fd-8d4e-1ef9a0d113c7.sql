
-- Add new columns to email_inbox for full content support
ALTER TABLE email_inbox ADD COLUMN IF NOT EXISTS imap_uid integer;
ALTER TABLE email_inbox ADD COLUMN IF NOT EXISTS snippet text;
ALTER TABLE email_inbox ADD COLUMN IF NOT EXISTS has_attachments boolean DEFAULT false;
ALTER TABLE email_inbox ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE email_inbox ADD COLUMN IF NOT EXISTS body_fetched_at timestamptz;

-- Performance index
CREATE INDEX IF NOT EXISTS idx_email_inbox_account_folder_received ON email_inbox(account_id, folder, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_inbox_needs_hydration ON email_inbox(body_fetched_at) WHERE body_fetched_at IS NULL;

-- Storage bucket for email attachments (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('email-attachments', 'email-attachments', false) ON CONFLICT DO NOTHING;

-- RLS policies for email-attachments bucket
CREATE POLICY "Authenticated users can upload email attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'email-attachments');
CREATE POLICY "Authenticated users can read email attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'email-attachments');
