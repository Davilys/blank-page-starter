import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// The master admin email - this user always has full access to everything including financial values
const MASTER_ADMIN_EMAIL = 'davillys@gmail.com';

/**
 * Returns true for the "master admin" (identified by email).
 * The master admin always has access to financial values.
 * Secondary admins never see financial values regardless of their permissions.
 */
export function useCanViewFinancialValues() {
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['current-user-fin'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    staleTime: 60000,
  });

  const isMaster = currentUser?.email === MASTER_ADMIN_EMAIL;

  return {
    // While loading we keep previous value (undefined/null treated as loading, not restricted)
    canViewFinancialValues: isMaster,
    isLoading,
    isMasterAdmin: isMaster,
  };
}
