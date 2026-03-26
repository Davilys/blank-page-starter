import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Tracks the current user's online presence via Supabase Realtime Presence.
 * Call this hook in any layout component to broadcast that the user is online.
 */
export function usePresence(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('online-users', {
      config: { presence: { key: userId } },
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: userId, online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
