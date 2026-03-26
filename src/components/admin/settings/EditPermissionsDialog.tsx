import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, Loader2, Save } from 'lucide-react';
import { CRM_SECTIONS, useUserPermissions, type PermissionKey, type UserPermissions } from '@/hooks/useAdminPermissions';

interface EditPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    email: string;
    fullName: string;
  } | null;
}

export function EditPermissionsDialog({ open, onOpenChange, user }: EditPermissionsDialogProps) {
  const queryClient = useQueryClient();
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [fullAccess, setFullAccess] = useState(true);
  const [viewOwnClientsOnly, setViewOwnClientsOnly] = useState(false);
  
  const { data: userPermsData, isLoading } = useUserPermissions(user?.id || '');

  useEffect(() => {
    if (userPermsData) {
      setPermissions(userPermsData.permissionsMap);
      setFullAccess(!userPermsData.hasAnyPermission);
      // Check if clients_own_only permission exists
      const hasOwnOnly = userPermsData.rawPermissions?.some(
        (p: any) => p.permission_key === 'clients_own_only' && p.can_view
      );
      setViewOwnClientsOnly(!!hasOwnOnly);
    }
  }, [userPermsData]);

  const savePermissionsMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;

      // Delete existing permissions
      await supabase
        .from('admin_permissions')
        .delete()
        .eq('user_id', user.id);

      // If full access, don't insert section permissions
      if (!fullAccess) {

      // Insert new permissions
      const permissionsToInsert = Object.entries(permissions)
        .filter(([_, perms]) => perms.can_view || perms.can_edit || perms.can_delete)
        .map(([key, perms]) => ({
          user_id: user.id,
          permission_key: key,
          can_view: perms.can_view,
          can_edit: perms.can_edit,
          can_delete: perms.can_delete,
        }));

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from('admin_permissions')
          .insert(permissionsToInsert);

        if (error) throw error;
      }
      }

      // Save clients_own_only permission
      if (viewOwnClientsOnly) {
        await supabase
          .from('admin_permissions')
          .insert({
            user_id: user.id,
            permission_key: 'clients_own_only',
            can_view: true,
            can_edit: false,
            can_delete: false,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-permissions'] });
      toast.success('Permissões atualizadas com sucesso!');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao salvar permissões');
    },
  });

  const handlePermissionChange = (key: PermissionKey, action: 'can_view' | 'can_edit' | 'can_delete', value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [action]: value,
        // If disabling view, also disable edit and delete
        ...(action === 'can_view' && !value ? { can_edit: false, can_delete: false } : {}),
      },
    }));
  };

  const toggleAllPermissions = (checked: boolean) => {
    const newPerms: UserPermissions = {};
    CRM_SECTIONS.forEach(section => {
      newPerms[section.key] = { can_view: checked, can_edit: checked, can_delete: checked };
    });
    setPermissions(newPerms);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Editar Permissões
          </DialogTitle>
          <DialogDescription>
            Gerenciar permissões de acesso para <strong>{user.fullName || user.email}</strong>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Full Access Toggle */}
            <div className="flex items-center space-x-2 p-4 rounded-lg bg-muted/50">
              <Checkbox
                id="fullAccessEdit"
                checked={fullAccess}
                onCheckedChange={(checked) => {
                  setFullAccess(!!checked);
                  if (checked) {
                    toggleAllPermissions(true);
                  }
                }}
              />
              <Label htmlFor="fullAccessEdit" className="text-sm font-medium cursor-pointer">
                Conceder acesso total a todas as seções do CRM
              </Label>
            </div>

            {/* View Own Clients Only Toggle */}
            <div className="flex items-center space-x-2 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <Checkbox
                id="viewOwnClientsOnlyEdit"
                checked={viewOwnClientsOnly}
                onCheckedChange={(checked) => setViewOwnClientsOnly(!!checked)}
              />
              <div>
                <Label htmlFor="viewOwnClientsOnlyEdit" className="text-sm font-medium cursor-pointer">
                  Ver apenas clientes próprios
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Este usuário só verá clientes criados por ele ou atribuídos a ele
                </p>
              </div>
            </div>

            {/* Permissions Grid */}
            {!fullAccess && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Definir Permissões</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAllPermissions(false)}
                    >
                      Desmarcar Todos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAllPermissions(true)}
                    >
                      Marcar Todos
                    </Button>
                  </div>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[1fr,80px,80px,80px] gap-2 p-3 bg-muted/50 font-medium text-sm">
                    <span>Seção</span>
                    <span className="text-center">Ver</span>
                    <span className="text-center">Editar</span>
                    <span className="text-center">Excluir</span>
                  </div>
                  <div className="divide-y max-h-[350px] overflow-y-auto">
                    {CRM_SECTIONS.map((section) => (
                      <div key={section.key} className="grid grid-cols-[1fr,80px,80px,80px] gap-2 p-3 items-center hover:bg-muted/30">
                        <div>
                          <p className="font-medium text-sm">{section.label}</p>
                          <p className="text-xs text-muted-foreground">{section.description}</p>
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={permissions[section.key]?.can_view ?? false}
                            onCheckedChange={(checked) => handlePermissionChange(section.key, 'can_view', !!checked)}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={permissions[section.key]?.can_edit ?? false}
                            onCheckedChange={(checked) => handlePermissionChange(section.key, 'can_edit', !!checked)}
                            disabled={!permissions[section.key]?.can_view}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={permissions[section.key]?.can_delete ?? false}
                            onCheckedChange={(checked) => handlePermissionChange(section.key, 'can_delete', !!checked)}
                            disabled={!permissions[section.key]?.can_view}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => savePermissionsMutation.mutate()}
            disabled={savePermissionsMutation.isPending || isLoading}
          >
            {savePermissionsMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Permissões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
