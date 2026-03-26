
-- Create security definer function to check participation without triggering RLS
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_meeting_participant(_meeting_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meeting_participants
    WHERE meeting_id = _meeting_id
      AND user_id = _user_id
  )
$$;

-- Fix conversation_participants SELECT policy (infinite recursion)
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants FOR SELECT
USING (
  public.is_conversation_participant(conversation_id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix conversations SELECT policy
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
CREATE POLICY "Users can view conversations they participate in"
ON public.conversations FOR SELECT
USING (
  public.is_conversation_participant(id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix conversations UPDATE policy
DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
CREATE POLICY "Participants can update conversations"
ON public.conversations FOR UPDATE
USING (
  public.is_conversation_participant(id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix conversation_messages SELECT policy
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.conversation_messages;
CREATE POLICY "Users can view messages in their conversations"
ON public.conversation_messages FOR SELECT
USING (
  public.is_conversation_participant(conversation_id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix conversation_messages INSERT policy
DROP POLICY IF EXISTS "Participants can send messages" ON public.conversation_messages;
CREATE POLICY "Participants can send messages"
ON public.conversation_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_conversation_participant(conversation_id, auth.uid())
);

-- Fix meeting_participants SELECT policy
DROP POLICY IF EXISTS "Users can view meeting participants" ON public.meeting_participants;
CREATE POLICY "Users can view meeting participants"
ON public.meeting_participants FOR SELECT
USING (
  public.is_meeting_participant(meeting_id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);
