-- Offline-reviewed state primitives for the continuous Fernanda agent.
-- This migration creates no scheduler, HTTP route, provider or external side effect.

CREATE OR REPLACE FUNCTION public.schedule_webmarcas_agent_followups(
  p_conversation_id text,
  p_anchor timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.webmarcas_agent_conversations WHERE conversation_id = p_conversation_id) THEN
    RAISE EXCEPTION 'conversation_not_found';
  END IF;

  INSERT INTO public.webmarcas_agent_followups(conversation_id, step, due_at, status)
  VALUES
    (p_conversation_id, 1, p_anchor + interval '10 minutes', 'pending'),
    (p_conversation_id, 2, p_anchor + interval '24 hours', 'pending'),
    (p_conversation_id, 3, p_anchor + interval '5 days', 'pending')
  ON CONFLICT (conversation_id, step) DO UPDATE
    SET due_at = EXCLUDED.due_at, status = 'pending', attempt_count = 0,
        sent_at = NULL, cancelled_at = NULL, error_code = NULL, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.ingest_webmarcas_agent_event(
  p_event_id text,
  p_conversation_id text,
  p_subscriber_id text,
  p_phone text,
  p_message_type text,
  p_message text,
  p_occurred_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted_count integer;
BEGIN
  IF p_message_type NOT IN ('text', 'audio_transcript') THEN
    RAISE EXCEPTION 'invalid_message_type';
  END IF;
  IF length(trim(p_event_id)) < 8 OR length(trim(p_conversation_id)) < 1 OR length(trim(p_subscriber_id)) < 1 THEN
    RAISE EXCEPTION 'invalid_event_identity';
  END IF;

  INSERT INTO public.webmarcas_agent_conversations(conversation_id, subscriber_id, phone, updated_at)
  VALUES (p_conversation_id, p_subscriber_id, p_phone, p_occurred_at)
  ON CONFLICT (conversation_id) DO UPDATE
    SET subscriber_id = EXCLUDED.subscriber_id, phone = EXCLUDED.phone, updated_at = EXCLUDED.updated_at;

  INSERT INTO public.webmarcas_agent_inbox(
    event_id, conversation_id, subscriber_id, phone, message_type, message, occurred_at
  ) VALUES (
    p_event_id, p_conversation_id, p_subscriber_id, p_phone, p_message_type, p_message, p_occurred_at
  ) ON CONFLICT (event_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  -- Any genuine inbound reply cancels every unsent follow-up. A duplicated
  -- webhook is a no-op and cannot cancel/reschedule work a second time.
  IF inserted_count = 1 THEN
    PERFORM public.cancel_webmarcas_agent_followups(p_conversation_id);
    INSERT INTO public.webmarcas_agent_messages(conversation_id, event_id, role, content, created_at)
    VALUES (p_conversation_id, p_event_id, 'user', p_message, p_occurred_at)
    ON CONFLICT (event_id) DO NOTHING;
  END IF;
  RETURN inserted_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_webmarcas_agent_followups(text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ingest_webmarcas_agent_event(text,text,text,text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_webmarcas_agent_followups(text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.ingest_webmarcas_agent_event(text,text,text,text,text,text,timestamptz) TO service_role;
