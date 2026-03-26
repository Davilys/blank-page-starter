import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Mail, Server, Check, Loader2, AlertCircle, Wifi, User } from 'lucide-react';
import { toast } from 'sonner';

const MASTER_EMAIL = 'davillys@gmail.com';

interface EmailAccount {
  id: string;
  email_address: string;
  display_name: string | null;
  provider: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
  imap_host: string | null;
  imap_port: number | null;
  is_default: boolean;
  assigned_to: string | null;
}

interface AdminProfile {
  id: string;
  email: string;
  full_name: string | null;
}

export function EmailSettings() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [form, setForm] = useState({
    email_address: '',
    display_name: '',
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    assigned_to: '',
  });

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const isMaster = currentUser?.email === MASTER_EMAIL;

  // Fetch admin users
  const { data: admins } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [] as AdminProfile[];

      const adminIds = roles.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', adminIds);
      if (profilesError) throw profilesError;
      return (profiles || []) as AdminProfile[];
    },
  });

  // Fetch email accounts (filtered by permission)
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['email-accounts', currentUser?.id, isMaster],
    queryFn: async () => {
      let query = supabase
        .from('email_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      // Non-master admins only see their assigned accounts
      if (!isMaster && currentUser?.id) {
        query = query.eq('assigned_to', currentUser.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmailAccount[];
    },
    enabled: !!currentUser,
  });

  const addAccount = useMutation({
    mutationFn: async () => {
      if (!currentUser) throw new Error('Usuário não autenticado');
      if (!form.assigned_to) throw new Error('Selecione um administrador');
      if (!form.smtp_host || !form.smtp_user || !form.smtp_password) {
        throw new Error('Preencha todos os campos SMTP obrigatórios');
      }

      // Test SMTP connection before saving
      const { data: testResult, error: testError } = await supabase.functions.invoke('test-smtp-connection', {
        body: {
          smtp_host: form.smtp_host,
          smtp_port: form.smtp_port,
          smtp_user: form.smtp_user,
          smtp_password: form.smtp_password,
        },
      });

      if (testError) throw new Error('Erro ao testar conexão: ' + testError.message);
      if (!testResult?.success) {
        throw new Error(testResult?.error || 'Falha na validação das credenciais SMTP');
      }

      const { error } = await supabase.from('email_accounts').insert({
        user_id: currentUser.id,
        email_address: form.email_address,
        display_name: form.display_name || null,
        provider: 'smtp',
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port,
        smtp_user: form.smtp_user,
        smtp_password: form.smtp_password,
        imap_host: form.imap_host || null,
        imap_port: form.imap_port || 993,
        is_default: !accounts || accounts.length === 0,
        assigned_to: form.assigned_to,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('✅ Conta de email verificada e adicionada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      setIsAdding(false);
      setForm({
        email_address: '',
        display_name: '',
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        smtp_user: '',
        smtp_password: '',
        imap_host: 'imap.gmail.com',
        imap_port: 993,
        assigned_to: '',
      });
    },
    onError: (err: any) => {
      toast.error('❌ ' + (err.message || 'Erro ao adicionar conta'));
    },
  });

  const setDefault = useMutation({
    mutationFn: async (accountId: string) => {
      await supabase
        .from('email_accounts')
        .update({ is_default: false })
        .neq('id', accountId);
      const { error } = await supabase
        .from('email_accounts')
        .update({ is_default: true })
        .eq('id', accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Conta padrão atualizada!');
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
    },
    onError: () => toast.error('Erro ao definir conta padrão'),
  });

  const deleteAccount = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase.from('email_accounts').delete().eq('id', accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Conta removida!');
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
    },
    onError: () => toast.error('Erro ao remover conta'),
  });

  const testConnection = async (config: { smtp_host: string; smtp_port: number; smtp_user: string; smtp_password: string; email_address: string }, id: string) => {
    setTestingConnection(id);
    try {
      const { data, error } = await supabase.functions.invoke('test-smtp-connection', {
        body: {
          smtp_host: config.smtp_host,
          smtp_port: config.smtp_port,
          smtp_user: config.smtp_user,
          smtp_password: config.smtp_password,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha na conexão');
      toast.success('✅ Conexão SMTP verificada com sucesso! Credenciais válidas.');
    } catch (err: any) {
      toast.error('❌ ' + (err.message || 'Erro desconhecido'));
    } finally {
      setTestingConnection(null);
    }
  };

  const testFormConnection = () => {
    if (!form.smtp_host || !form.smtp_user || !form.email_address) {
      toast.error('Preencha os campos de SMTP e email antes de testar');
      return;
    }
    testConnection(form, 'form');
  };

  const testAccountConnection = (account: EmailAccount) => {
    testConnection({
      smtp_host: account.smtp_host || '',
      smtp_port: account.smtp_port || 587,
      smtp_user: account.smtp_user || '',
      smtp_password: account.smtp_password || '',
      email_address: account.email_address,
    }, account.id);
  };

  const getAdminName = (adminId: string | null) => {
    if (!adminId || !admins) return null;
    const admin = admins.find(a => a.id === adminId);
    return admin ? (admin.full_name || admin.email) : null;
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-1">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Contas de E-mail dos Administradores
            </CardTitle>
            <CardDescription>
              Configure contas SMTP/IMAP para cada administrador enviar e receber e-mails de trabalho
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Importante</p>
                <p className="text-muted-foreground">
                  Para usar o Gmail, você precisa criar uma "Senha de App" nas configurações de segurança da sua conta Google.
                  Para Outlook/Microsoft, use suas credenciais normais com autenticação SMTP habilitada.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Contas Configuradas</CardTitle>
              {isMaster && (
                <Button
                  variant={isAdding ? "secondary" : "default"}
                  size="sm"
                  onClick={() => setIsAdding(!isAdding)}
                >
                  {isAdding ? 'Cancelar' : 'Adicionar Conta'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdding && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={form.email_address}
                      onChange={(e) => setForm(f => ({ ...f, email_address: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome de Exibição</Label>
                    <Input
                      placeholder="WebMarcas"
                      value={form.display_name}
                      onChange={(e) => setForm(f => ({ ...f, display_name: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Admin selector */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    Administrador Vinculado
                  </Label>
                  <Select
                    value={form.assigned_to}
                    onValueChange={(value) => setForm(f => ({ ...f, assigned_to: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o administrador..." />
                    </SelectTrigger>
                    <SelectContent>
                      {admins?.map((admin) => (
                        <SelectItem key={admin.id} value={admin.id}>
                          {admin.full_name || admin.email} ({admin.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Este administrador terá acesso exclusivo a essa conta de e-mail no painel
                  </p>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Servidor SMTP</Label>
                    <Input
                      placeholder="smtp.gmail.com"
                      value={form.smtp_host}
                      onChange={(e) => setForm(f => ({ ...f, smtp_host: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Porta SMTP</Label>
                    <Input
                      type="number"
                      placeholder="587"
                      value={form.smtp_port}
                      onChange={(e) => setForm(f => ({ ...f, smtp_port: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Usuário SMTP</Label>
                    <Input
                      placeholder="seu@email.com"
                      value={form.smtp_user}
                      onChange={(e) => setForm(f => ({ ...f, smtp_user: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha / App Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={form.smtp_password}
                      onChange={(e) => setForm(f => ({ ...f, smtp_password: e.target.value }))}
                    />
                  </div>
                </div>

                <Separator />
                <p className="text-sm font-medium text-muted-foreground">Configurações IMAP (Recebimento)</p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Servidor IMAP</Label>
                    <Input
                      placeholder="imap.gmail.com"
                      value={form.imap_host}
                      onChange={(e) => setForm(f => ({ ...f, imap_host: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Porta IMAP</Label>
                    <Input
                      type="number"
                      placeholder="993"
                      value={form.imap_port}
                      onChange={(e) => setForm(f => ({ ...f, imap_port: parseInt(e.target.value) || 993 }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={testFormConnection} disabled={testingConnection === 'form'}>
                    {testingConnection === 'form' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
                    Testar Conexão
                  </Button>
                  <Button onClick={() => addAccount.mutate()} disabled={addAccount.isPending}>
                    {addAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                    Salvar Conta
                  </Button>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando contas...</div>
            ) : accounts && accounts.length > 0 ? (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{account.email_address}</p>
                          {account.is_default && <Badge variant="secondary">Padrão</Badge>}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {account.assigned_to && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Atribuído a: <span className="font-medium">{getAdminName(account.assigned_to)}</span>
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Server className="h-3 w-3" />
                            SMTP: {account.smtp_host}:{account.smtp_port}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            IMAP: {account.imap_host ? `${account.imap_host}:${account.imap_port}` : <span className="text-destructive">Não configurado</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => testAccountConnection(account)} disabled={testingConnection === account.id}>
                        {testingConnection === account.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wifi className="h-4 w-4 mr-1" />}
                        Testar
                      </Button>
                      {!account.is_default && isMaster && (
                        <Button variant="outline" size="sm" onClick={() => setDefault.mutate(account.id)}>
                          Definir Padrão
                        </Button>
                      )}
                      {isMaster && (
                        <Button variant="destructive" size="sm" onClick={() => deleteAccount.mutate(account.id)}>
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma conta configurada</p>
                <p className="text-sm">
                  {isMaster ? 'Adicione uma conta para começar a enviar emails' : 'Nenhuma conta atribuída a você'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
