
-- Fix BROKEN conversations RLS policies
-- The bug: conversation_participants.conversation_id = conversation_participants.id (wrong!)
-- Should be: conversation_participants.conversation_id = conversations.id

DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;

CREATE POLICY "Users can view conversations they participate in"
ON public.conversations
FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = conversations.id
      AND conversation_participants.user_id = auth.uid()
  )) OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Participants can update conversations"
ON public.conversations
FOR UPDATE
USING (
  (EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = conversations.id
      AND conversation_participants.user_id = auth.uid()
  )) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Also add DELETE policy for admins
CREATE POLICY "Admins can delete conversations"
ON public.conversations
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for conversations table
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
