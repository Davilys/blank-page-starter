import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, UserPlus, Trash2, Loader2, Clock, User, Monitor, Settings2, RefreshCw, Eye, EyeOff, Mail, Phone, Key, Copy } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CreateAdminDialog } from './CreateAdminDialog';
import { EditPermissionsDialog } from './EditPermissionsDialog';
import { useCanViewFinancialValues } from '@/hooks/useCanViewFinancialValues';

// Master admin that cannot be deleted or have permissions revoked
export const MASTER_ADMIN_EMAIL = 'davillys@gmail.com';

export function SecuritySettings() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<{ id: string; email: string; fullName: string } | null>(null);
  const { isMasterAdmin } = useCanViewFinancialValues();

  // Fetch admin users with permissions info
  const { data: adminUsers, isLoading: loadingAdmins } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          id,
          user_id,
          role,
          created_at
        `)
        .eq('role', 'admin');
      
      if (error) throw error;

      // Fetch profiles for each admin
      const userIds = data.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone')
        .in('id', userIds);

      // Fetch permissions for each admin (full detail)
      const { data: permissions } = await supabase
        .from('admin_permissions')
        .select('user_id, permission_key, can_view, can_edit, can_delete')
        .in('user_id', userIds);

      const permissionsByUser: Record<string, { count: number; keys: string[] }> = {};
      permissions?.forEach(p => {
        if (!permissionsByUser[p.user_id]) {
          permissionsByUser[p.user_id] = { count: 0, keys: [] };
        }
        permissionsByUser[p.user_id].count++;
        if (p.can_view) permissionsByUser[p.user_id].keys.push(p.permission_key);
      });

      return data.map(role => ({
        ...role,
        profile: profiles?.find(p => p.id === role.user_id),
        hasCustomPermissions: (permissionsByUser[role.user_id]?.count || 0) > 0,
        permissionKeys: permissionsByUser[role.user_id]?.keys || [],
      }));
    },
  });

  // Fetch login history
  const { data: loginHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ['login-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('login_history')
        .select(`
          id,
          user_id,
          ip_address,
          user_agent,
          login_at
        `)
        .order('login_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;

      // Fetch profiles
      const userIds = [...new Set(data.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      return data.map(log => ({
        ...log,
        profile: profiles?.find(p => p.id === log.user_id),
      }));
    },
  });

  const removeAdminMutation = useMutation({
    mutationFn: async ({ roleId, userId, email }: { roleId: string; userId: string; email?: string }) => {
      // Protect master admin
      if (email === MASTER_ADMIN_EMAIL) {
        throw new Error('O administrador master não pode ser removido.');
      }
      
      // Check if user also has a 'user' (client) role
      const { data: clientRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', 'user')
        .maybeSingle();

      // Delete permissions
      await supabase
        .from('admin_permissions')
        .delete()
        .eq('user_id', userId);

      // Delete admin role
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);
      
      if (error) throw error;

      // If user has NO client role, delete profile and auth user entirely
      if (!clientRole) {
        await supabase.from('profiles').delete().eq('id', userId);
        await supabase.functions.invoke('delete-auth-user', { body: { userId } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Acesso de administrador removido!');
    },
    onError: () => {
      toast.error('Erro ao remover administrador');
    },
  });

  const refetchAdmins = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const formatUserAgent = (ua: string | null) => {
    if (!ua) return 'Desconhecido';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Navegador';
  };

  return (
    <div className="space-y-6">
      {/* Create Admin Dialog */}
      <CreateAdminDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
      
      {/* Edit Permissions Dialog */}
      <EditPermissionsDialog 
        open={!!editingUser} 
        onOpenChange={(open) => !open && setEditingUser(null)}
        user={editingUser}
      />

      {/* Admin Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-violet-500" />
              <CardTitle>Usuários Administradores</CardTitle>
            </div>
             <Button size="sm" variant="outline" onClick={refetchAdmins}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Criar Novo Admin
              </Button>
          </div>
          <CardDescription>
            Crie e gerencie usuários com acesso ao CRM. Defina permissões granulares por seção.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAdmins ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : adminUsers && adminUsers.length > 0 ? (
            <div className="space-y-3">
              {adminUsers.map((admin) => {
                const isMasterAdminUser = admin.profile?.email === MASTER_ADMIN_EMAIL;
                
                return (
                  <div
                    key={admin.id}
                    className={`flex flex-col gap-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors ${isMasterAdminUser ? 'border-primary/50 bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${isMasterAdminUser ? 'bg-primary/20' : 'bg-primary/10'}`}>
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{admin.profile?.full_name || 'Sem nome'}</p>
                            {isMasterAdminUser && (
                              <Badge variant="default" className="bg-primary text-primary-foreground">
                                <Shield className="h-3 w-3 mr-1" />
                                Master
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{admin.profile?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {admin.hasCustomPermissions ? (
                          <Badge variant="secondary">Permissões Personalizadas</Badge>
                        ) : (
                          <Badge>Acesso Total</Badge>
                        )}
                        {!isMasterAdminUser && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingUser({
                                id: admin.user_id,
                                email: admin.profile?.email || '',
                                fullName: admin.profile?.full_name || '',
                              })}
                              title="Editar Permissões"
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('Remover acesso de administrador deste usuário? As permissões também serão removidas.')) {
                                  removeAdminMutation.mutate({ roleId: admin.id, userId: admin.user_id });
                                }
                              }}
                              disabled={removeAdminMutation.isPending}
                              title="Remover Admin"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expanded details visible only to master admin */}
                    {isMasterAdmin && !isMasterAdminUser && (
                      <div className="ml-13 pl-3 border-l-2 border-primary/20 space-y-1.5 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{admin.profile?.email}</span>
                        </div>
                        {(admin.profile as any)?.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{(admin.profile as any).phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Key className="h-3.5 w-3.5" />
                          <span className="text-xs">Senha definida na criação (não é possível recuperar)</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-xs">Criado em: {admin.created_at ? format(new Date(admin.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}</span>
                        </div>
                        {admin.hasCustomPermissions && admin.permissionKeys && admin.permissionKeys.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {admin.permissionKeys.map((key: string) => (
                              <Badge key={key} variant="outline" className="text-[10px] py-0">{key}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum administrador cadastrado</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Criar Primeiro Admin
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Login History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            <CardTitle>Histórico de Logins</CardTitle>
          </div>
          <CardDescription>
            Últimos acessos ao sistema para monitoramento de segurança
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : loginHistory && loginHistory.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Navegador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loginHistory.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{log.profile?.full_name || 'Usuário'}</p>
                          <p className="text-xs text-muted-foreground">{log.profile?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.login_at ? format(new Date(log.login_at), "dd/MM/yy HH:mm", { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {log.ip_address || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Monitor className="h-3 w-3" />
                          {formatUserAgent(log.user_agent)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum registro de login encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
