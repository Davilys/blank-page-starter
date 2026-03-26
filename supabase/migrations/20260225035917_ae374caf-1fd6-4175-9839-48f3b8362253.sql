ALTER TABLE rpi_entries
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz;