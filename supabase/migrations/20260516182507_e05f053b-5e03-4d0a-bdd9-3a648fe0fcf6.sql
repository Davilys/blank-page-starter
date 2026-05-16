-- Remove emails corrompidos (cabeçalhos DKIM/MIME interpretados como assunto)
-- e reseta o watermark IMAP das pastas afetadas para reimportar corretamente.

WITH corrupted AS (
  SELECT DISTINCT account_id, folder, MIN(imap_uid) AS min_uid
  FROM public.email_inbox
  WHERE subject ~* '^(date:|mime-version|subject:|to:|cc:|from:|message-id:|references:|reply-to:|content-type:|b=|bh=|h=)'
  GROUP BY account_id, folder
)
UPDATE public.email_sync_state s
SET last_uid = GREATEST(0, COALESCE(c.min_uid, 1) - 1),
    last_error = NULL,
    consecutive_errors = 0
FROM corrupted c
WHERE s.account_id = c.account_id AND s.folder = c.folder;

DELETE FROM public.email_inbox
WHERE subject ~* '^(date:|mime-version|subject:|to:|cc:|from:|message-id:|references:|reply-to:|content-type:|b=|bh=|h=)';