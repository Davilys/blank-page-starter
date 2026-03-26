import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Loader2, Eye, EyeOff } from 'lucide-react';
import { CRM_SECTIONS, type PermissionKey } from '@/hooks/useAdminPermissions';

interface CreateAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  fullAccess: boolean;
  viewOwnClientsOnly: boolean;
  permissions: {
    [key: string]: {
      can_view: boolean;
      can_edit: boolean;
      can_delete: boolean;
    };
  };
}

const initialPermissions = () => {
  const perms: FormData['permissions'] = {};
  CRM_SECTIONS.forEach(section => {
    perms[section.key] = { can_view: true, can_edit: true, can_delete: true };
  });
  return perms;
};

export function CreateAdminDialog({ open, onOpenChange }: CreateAdminDialogProps) {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    fullAccess: true,
    viewOwnClientsOnly: false,
    permissions: initialPermissions(),
  });

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      fullAccess: true,
      viewOwnClientsOnly: false,
      permissions: initialPermissions(),
    });
  };

  const createAdminMutation = useMutation({
    mutationFn: async () => {
      if (formData.password !== formData.confirmPassword) {
        throw new Error('As senhas não coincidem');
      }
      if (formData.password.length < 8) {
        throw new Error('A senha deve ter pelo menos 8 caracteres');
      }

      // Create admin user via Edge Function
      const { data, error } = await supabase.functions.invoke('create-admin-user', {
        body: {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          fullAccess: formData.fullAccess,
          permissions: formData.fullAccess ? null : formData.permissions,
          viewOwnClientsOnly: formData.viewOwnClientsOnly,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // If not full access, save permissions
      if (!formData.fullAccess && data?.userId) {
        const permissionsToInsert = Object.entries(formData.permissions)
          .filter(([_, perms]) => perms.can_view || perms.can_edit || perms.can_delete)
          .map(([key, perms]) => ({
            user_id: data.userId,
            permission_key: key,
            can_view: perms.can_view,
            can_edit: perms.can_edit,
            can_delete: perms.can_delete,
          }));

        if (permissionsToInsert.length > 0) {
          const { error: permError } = await supabase
            .from('admin_permissions')
            .insert(permissionsToInsert);

          if (permError) throw permError;
        }
      }

      // Save clients_own_only permission
      if (formData.viewOwnClientsOnly && data?.userId) {
        const { error: ownError } = await supabase
          .from('admin_permissions')
          .insert({
            user_id: data.userId,
            permission_key: 'clients_own_only',
            can_view: true,
            can_edit: false,
            can_delete: false,
          });
        if (ownError) console.error('Error saving clients_own_only:', ownError);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Administrador criado com sucesso!');
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar administrador');
    },
  });

  const handlePermissionChange = (key: PermissionKey, action: 'can_view' | 'can_edit' | 'can_delete', value: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: {
          ...prev.permissions[key],
          [action]: value,
          // If disabling view, also disable edit and delete
          ...(action === 'can_view' && !value ? { can_edit: false, can_delete: false } : {}),
        },
      },
    }));
  };

  const toggleAllPermissions = (checked: boolean) => {
    const newPerms: FormData['permissions'] = {};
    CRM_SECTIONS.forEach(section => {
      newPerms[section.key] = { can_view: checked, can_edit: checked, can_delete: checked };
    });
    setFormData(prev => ({ ...prev, permissions: newPerms }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Criar Novo Administrador
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para criar um novo usuário administrador do CRM
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                placeholder="Nome do administrador"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="admin@empresa.com"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Mínimo 8 caracteres"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Repita a senha"
              />
            </div>
          </div>

          {/* Full Access Toggle */}
          <div className="flex items-center space-x-2 p-4 rounded-lg bg-muted/50">
            <Checkbox
              id="fullAccess"
              checked={formData.fullAccess}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, fullAccess: !!checked }))}
            />
            <Label htmlFor="fullAccess" className="text-sm font-medium cursor-pointer">
              Conceder acesso total a todas as seções do CRM
            </Label>
          </div>

          {/* View Own Clients Only Toggle */}
          <div className="flex items-center space-x-2 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <Checkbox
              id="viewOwnClientsOnly"
              checked={formData.viewOwnClientsOnly}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, viewOwnClientsOnly: !!checked }))}
            />
            <div>
              <Label htmlFor="viewOwnClientsOnly" className="text-sm font-medium cursor-pointer">
                Ver apenas clientes próprios
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Este usuário só verá clientes criados por ele ou atribuídos a ele
              </p>
            </div>
          </div>

          {/* Permissions Grid */}
          {!formData.fullAccess && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Definir Permissões</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAllPermissions(true)}
                >
                  Marcar Todos
                </Button>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr,80px,80px,80px] gap-2 p-3 bg-muted/50 font-medium text-sm">
                  <span>Seção</span>
                  <span className="text-center">Ver</span>
                  <span className="text-center">Editar</span>
                  <span className="text-center">Excluir</span>
                </div>
                <div className="divide-y max-h-[300px] overflow-y-auto">
                  {CRM_SECTIONS.map((section) => (
                    <div key={section.key} className="grid grid-cols-[1fr,80px,80px,80px] gap-2 p-3 items-center hover:bg-muted/30">
                      <div>
                        <p className="font-medium text-sm">{section.label}</p>
                        <p className="text-xs text-muted-foreground">{section.description}</p>
                      </div>
                      <div className="flex justify-center">
                        <Checkbox
                          checked={formData.permissions[section.key]?.can_view ?? false}
                          onCheckedChange={(checked) => handlePermissionChange(section.key, 'can_view', !!checked)}
                        />
                      </div>
                      <div className="flex justify-center">
                        <Checkbox
                          checked={formData.permissions[section.key]?.can_edit ?? false}
                          onCheckedChange={(checked) => handlePermissionChange(section.key, 'can_edit', !!checked)}
                          disabled={!formData.permissions[section.key]?.can_view}
                        />
                      </div>
                      <div className="flex justify-center">
                        <Checkbox
                          checked={formData.permissions[section.key]?.can_delete ?? false}
                          onCheckedChange={(checked) => handlePermissionChange(section.key, 'can_delete', !!checked)}
                          disabled={!formData.permissions[section.key]?.can_view}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createAdminMutation.mutate()}
            disabled={!formData.fullName || !formData.email || !formData.password || createAdminMutation.isPending}
          >
            {createAdminMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Criar Administrador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
