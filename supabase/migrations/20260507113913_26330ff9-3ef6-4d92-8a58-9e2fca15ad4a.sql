CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- remove jobs com mesmo nome para idempotência
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('asaas-daily-sync-10h','cobranca-reentry-daily');

SELECT cron.schedule(
  'asaas-daily-sync-10h',
  '0 13 * * 1-5',
  $$
  SELECT net.http_post(
    url:='https://scpbqsvwojhbxihyqbdz.supabase.co/functions/v1/sync-asaas-invoices',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcGJxc3Z3b2poYnhpaHlxYmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjcyNTUsImV4cCI6MjA5MDA0MzI1NX0.FTZt4yiL6dVsYT9cQnqrABgS0sMXYl23wf4ZtzP-GAE"}'::jsonb,
    body:='{}'::jsonb
  );
  SELECT net.http_post(
    url:='https://scpbqsvwojhbxihyqbdz.supabase.co/functions/v1/asaas-debtors-api?action=sync-overdue-30',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcGJxc3Z3b2poYnhpaHlxYmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjcyNTUsImV4cCI6MjA5MDA0MzI1NX0.FTZt4yiL6dVsYT9cQnqrABgS0sMXYl23wf4ZtzP-GAE"}'::jsonb,
    body:='{"action":"sync-overdue-30"}'::jsonb
  );
  SELECT net.http_post(
    url:='https://scpbqsvwojhbxihyqbdz.supabase.co/functions/v1/asaas-debtors-api?action=sync-overdue',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcGJxc3Z3b2poYnhpaHlxYmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjcyNTUsImV4cCI6MjA5MDA0MzI1NX0.FTZt4yiL6dVsYT9cQnqrABgS0sMXYl23wf4ZtzP-GAE"}'::jsonb,
    body:='{"action":"sync-overdue"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'cobranca-reentry-daily',
  '15 13 * * *',
  $$ SELECT public.recheck_cobranca_reentry(); $$
);