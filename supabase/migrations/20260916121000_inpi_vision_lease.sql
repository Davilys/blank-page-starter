-- A start timestamp must never masquerade as successful OCR completion.
ALTER TABLE public.inpi_case_documents
  ADD COLUMN IF NOT EXISTS vision_read_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS vision_read_token uuid;
