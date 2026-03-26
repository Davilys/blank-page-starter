import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { connectivityRetry, connectivityRetryDelay } from '@/lib/networkResilience';

// Available CRM sections with their permission keys
export const CRM_SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', description: 'Métricas e relatórios' },
  { key: 'leads', label: 'Leads', description: 'Gestão de leads' },
  { key: 'clients', label: 'Clientes', description: 'Base de clientes' },
  { key: 'contracts', label: 'Contratos', description: 'Gestão de contratos' },
  { key: 'contract_templates', label: 'Modelos de Contrato', description: 'Templates e modelos' },
  { key: 'documents', label: 'Documentos', description: 'Arquivos e anexos' },
  { key: 'financial', label: 'Financeiro', description: 'Pagamentos e faturas' },
  { key: 'emails', label: 'Emails', description: 'Comunicação e templates' },
  { key: 'live_chat', label: 'Chat ao Vivo', description: 'Atendimento em tempo real' },
  { key: 'notifications', label: 'Notificações', description: 'Alertas e avisos' },
  { key: 'inpi_magazine', label: 'Revista INPI', description: 'Publicações oficiais' },
  { key: 'inpi_resources', label: 'Recursos INPI', description: 'Recursos e petições' },
  { key: 'perfex_integration', label: 'Integração Perfex', description: 'Sincronização CRM' },
  { key: 'awards', label: 'Premiação', description: 'Metas e bonificações' },
  { key: 'publications', label: 'Publicação', description: 'Prazos e publicações de marcas' },
  { key: 'marketing_intelligence', label: 'Marketing Intelligence', description: 'Campanhas e ROI' },
  { key: 'settings', label: 'Configurações', description: 'Preferências do sistema' },
] as const;

export type PermissionKey = typeof CRM_SECTIONS[number]['key'];
export type PermissionAction = 'can_view' | 'can_edit' | 'can_delete';

export interface Permission {
  id: string;
  user_id: string;
  permission_key: PermissionKey;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface UserPermissions {
  [key: string]: {
    can_view: boolean;
    can_edit: boolean;
    can_delete: boolean;
  };
}

// Map URL paths to permission keys
const PATH_TO_PERMISSION_KEY: Record<string, PermissionKey> = {
  '/admin/dashboard': 'dashboard',
  '/admin/leads': 'leads',
  '/admin/clientes': 'clients',
  '/admin/contratos': 'contracts',
  '/admin/modelos-contrato': 'contract_templates',
  '/admin/documentos': 'documents',
  '/admin/financeiro': 'financial',
  '/admin/emails': 'emails',
  '/admin/chat-ao-vivo': 'live_chat',
  '/admin/notificacoes': 'notifications',
  '/admin/revista-inpi': 'inpi_magazine',
  '/admin/recursos-inpi': 'inpi_resources',
  '/admin/integracao-perfex': 'perfex_integration',
  '/admin/premiacao': 'awards',
  '/admin/publicacao': 'publications',
  '/admin/marketing': 'marketing_intelligence',
  '/admin/configuracoes': 'settings',
};

export function getPermissionKeyFromPath(path: string): PermissionKey | null {
  return PATH_TO_PERMISSION_KEY[path] || null;
}

// Master admin email - always has full access, bypasses all permission checks
const MASTER_ADMIN_EMAIL = 'davillys@gmail.com';

// Build a full-access permissions map (all true)
const FULL_ACCESS_MAP: UserPermissions = Object.fromEntries(
  CRM_SECTIONS.map(s => [s.key, { can_view: true, can_edit: true, can_delete: true }])
);

export function useAdminPermissions(userId?: string) {
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    enabled: !userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const targetUserId = userId || currentUser?.id;
  const isMasterAdmin = !userId && currentUser?.email === MASTER_ADMIN_EMAIL;

  const { data: permissions, isLoading, refetch } = useQuery({
    queryKey: ['admin-permissions', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;

      // Master admin always gets full access — skip DB lookup for self
      if (!userId && currentUser?.email === MASTER_ADMIN_EMAIL) {
        return FULL_ACCESS_MAP;
      }

      const { data, error } = await supabase
        .from('admin_permissions')
        .select('*')
        .eq('user_id', targetUserId);

      if (error) throw error;

      // Convert to map for easy access
      const permissionsMap: UserPermissions = {};
      
      // Initialize with defaults — deny all by default for non-master admins
      CRM_SECTIONS.forEach(section => {
        permissionsMap[section.key] = {
          can_view: false,
          can_edit: false,
          can_delete: false,
        };
      });

      // Apply explicit permissions from the database
      if (data && data.length > 0) {
        data.forEach((perm) => {
          const key = perm.permission_key as PermissionKey;
          permissionsMap[key] = {
            can_view: perm.can_view === true,
            can_edit: perm.can_edit === true,
            can_delete: perm.can_delete === true,
          };
        });
      }

      return permissionsMap;
    },
    enabled: !!targetUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes - avoid constant refetching on navigation
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    retry: connectivityRetry,
    retryDelay: connectivityRetryDelay,
  });

  const hasPermission = (key: PermissionKey, action: PermissionAction): boolean => {
    if (!permissions) return false; // Default to false while loading
    return permissions[key]?.[action] === true;
  };

  const canAccessPath = (path: string): boolean => {
    const permKey = getPermissionKeyFromPath(path);
    if (!permKey) return true;
    return hasPermission(permKey, 'can_view');
  };

  return {
    permissions,
    isLoading,
    hasPermission,
    canAccessPath,
    refetch,
    userId: targetUserId,
    isMasterAdmin,
  };
}

export function useUserPermissions(userId: string) {
  return useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_permissions')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      // Convert to map
      const permissionsMap: UserPermissions = {};
      
      // Initialize all sections
      CRM_SECTIONS.forEach(section => {
        permissionsMap[section.key] = {
          can_view: false,
          can_edit: false,
          can_delete: false,
        };
      });

      // Apply saved permissions
      if (data) {
        data.forEach((perm) => {
          const key = perm.permission_key as PermissionKey;
          permissionsMap[key] = {
            can_view: perm.can_view,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete,
          };
        });
      }

      // Check if has any permissions (if not, grant full access)
      const hasAnyPermission = data && data.length > 0;
      
      return { permissionsMap, hasAnyPermission, rawPermissions: data };
    },
    enabled: !!userId,
  });
}
