
-- Fix mojibake in email_inbox: bytes are UTF-8 but were decoded as Latin-1.
-- Re-encode by writing the text bytes as Latin-1 and reading them as UTF-8.
DO $$
DECLARE
  r record;
  fixed_text text;
  fixed_html text;
  fixed_subj text;
  fixed_snippet text;
BEGIN
  FOR r IN SELECT id, body_text, body_html, subject, snippet
           FROM email_inbox
           WHERE body_text ~ '[ÃÂ][\u0080-\u00BF]'
              OR body_html ~ '[ÃÂ][\u0080-\u00BF]'
              OR subject  ~ '[ÃÂ][\u0080-\u00BF]'
              OR snippet  ~ '[ÃÂ][\u0080-\u00BF]'
  LOOP
    BEGIN
      fixed_text := CASE WHEN r.body_text IS NOT NULL
        THEN convert_from(convert_to(r.body_text, 'LATIN1'), 'UTF8') ELSE NULL END;
    EXCEPTION WHEN others THEN fixed_text := r.body_text; END;
    BEGIN
      fixed_html := CASE WHEN r.body_html IS NOT NULL
        THEN convert_from(convert_to(r.body_html, 'LATIN1'), 'UTF8') ELSE NULL END;
    EXCEPTION WHEN others THEN fixed_html := r.body_html; END;
    BEGIN
      fixed_subj := CASE WHEN r.subject IS NOT NULL
        THEN convert_from(convert_to(r.subject, 'LATIN1'), 'UTF8') ELSE NULL END;
    EXCEPTION WHEN others THEN fixed_subj := r.subject; END;
    BEGIN
      fixed_snippet := CASE WHEN r.snippet IS NOT NULL
        THEN convert_from(convert_to(r.snippet, 'LATIN1'), 'UTF8') ELSE NULL END;
    EXCEPTION WHEN others THEN fixed_snippet := r.snippet; END;

    UPDATE email_inbox
       SET body_text = fixed_text,
           body_html = fixed_html,
           subject   = fixed_subj,
           snippet   = fixed_snippet
     WHERE id = r.id;
  END LOOP;
END $$;
