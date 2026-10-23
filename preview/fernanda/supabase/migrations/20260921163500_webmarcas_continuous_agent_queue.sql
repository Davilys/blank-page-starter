CREATE TABLE IF NOT EXISTS public.webmarcas_agent_inbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id text UNIQUE NOT NULL,
 conversation_id text NOT NULL, subscriber_id text NOT NULL, phone text NOT NULL,
 message_type text NOT NULL CHECK(message_type IN('text','audio_transcript')),
 message text NOT NULL, occurred_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','processing','completed','failed')),
 attempt_count integer NOT NULL DEFAULT 0, error_code text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.webmarcas_agent_conversations (
 conversation_id text PRIMARY KEY, subscriber_id text NOT NULL, phone text NOT NULL,
 stage text NOT NULL DEFAULT 'discovery', summary text NOT NULL DEFAULT '',
 collected_data jsonb NOT NULL DEFAULT '{}'::jsonb, pending_action jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.webmarcas_agent_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id text NOT NULL REFERENCES public.webmarcas_agent_conversations(conversation_id) ON DELETE CASCADE,
 event_id text UNIQUE, role text NOT NULL CHECK(role IN('user','assistant','tool')),
 content text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.webmarcas_agent_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webmarcas_agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webmarcas_agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view WebMarcas agent inbox" ON public.webmarcas_agent_inbox FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins view WebMarcas conversations" ON public.webmarcas_agent_conversations FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins view WebMarcas messages" ON public.webmarcas_agent_messages FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.claim_webmarcas_agent_event() RETURNS SETOF public.webmarcas_agent_inbox LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.webmarcas_agent_inbox i SET status='processing',attempt_count=i.attempt_count+1,updated_at=now(),error_code=NULL
 WHERE i.id=(SELECT id FROM public.webmarcas_agent_inbox WHERE attempt_count<5 AND (status IN('pending','failed') OR (status='processing' AND updated_at<now()-interval '2 minutes')) ORDER BY occurred_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING i.*;
$$;
REVOKE ALL ON FUNCTION public.claim_webmarcas_agent_event() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.claim_webmarcas_agent_event() TO service_role;
CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net;
-- PREVIEW-SANITIZED: continuous-agent cron intentionally disabled.

CREATE TABLE IF NOT EXISTS public.webmarcas_agent_followups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id text NOT NULL REFERENCES public.webmarcas_agent_conversations(conversation_id) ON DELETE CASCADE,
 step smallint NOT NULL CHECK(step IN(1,2,3)), due_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','processing','sent','cancelled','failed')),
 attempt_count integer NOT NULL DEFAULT 0, sent_at timestamptz, cancelled_at timestamptz, error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(conversation_id,step)
);
ALTER TABLE public.webmarcas_agent_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view WebMarcas followups" ON public.webmarcas_agent_followups FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.cancel_webmarcas_agent_followups(p_conversation_id text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.webmarcas_agent_followups SET status='cancelled',cancelled_at=now(),updated_at=now() WHERE conversation_id=p_conversation_id AND status IN('pending','processing','failed');
$$;
CREATE OR REPLACE FUNCTION public.claim_webmarcas_agent_followup() RETURNS SETOF public.webmarcas_agent_followups LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.webmarcas_agent_followups f SET status='processing',attempt_count=f.attempt_count+1,updated_at=now(),error_code=NULL
 WHERE f.id=(SELECT id FROM public.webmarcas_agent_followups WHERE due_at<=now() AND attempt_count<5 AND (status IN('pending','failed') OR (status='processing' AND updated_at<now()-interval '2 minutes')) ORDER BY due_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING f.*;
$$;
REVOKE ALL ON FUNCTION public.cancel_webmarcas_agent_followups(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_webmarcas_agent_followup() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_webmarcas_agent_followups(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_webmarcas_agent_followup() TO service_role;
CREATE TABLE IF NOT EXISTS public.webmarcas_agent_tool_calls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), idempotency_key text NOT NULL UNIQUE, conversation_id text NOT NULL REFERENCES public.webmarcas_agent_conversations(conversation_id) ON DELETE CASCADE,
 tool text NOT NULL CHECK(tool IN('deliver_inpi_pdf','deliver_documents','calendar_freebusy','calendar_create','payment_prepare','payment_create','react_message')),
 request jsonb NOT NULL DEFAULT '{}'::jsonb, result jsonb, status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','succeeded','failed','blocked')),
 consent_at timestamptz, error_code text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.webmarcas_agent_tool_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view WebMarcas tool calls" ON public.webmarcas_agent_tool_calls FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
