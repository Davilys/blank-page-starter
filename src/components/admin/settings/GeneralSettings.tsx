import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, Phone, Mail, MapPin, Clock, Save, Loader2, 
  User, KeyRound, Shield, Eye, EyeOff, Crown,
  Globe, Instagram, Facebook, Linkedin, Youtube, Twitter
} from 'lucide-react';

interface CompanySettings {
  name: string;
  phone: string;
  email: string;
  cnpj: string;
  address: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  youtube?: string;
  twitter?: string;
}

interface BusinessHours {
  weekdays: string;
  saturday: string;
  sunday: string;
}

export function GeneralSettings() {
  const queryClient = useQueryClient();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-settings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch profile
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['admin-profile', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.id,
  });

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
  });

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  const { data: companyData, isLoading: loadingCompany } = useQuery({
    queryKey: ['system-settings', 'company'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'company')
        .single();
      if (error) throw error;
      return data?.value as unknown as CompanySettings;
    },
  });

  const { data: hoursData, isLoading: loadingHours } = useQuery({
    queryKey: ['system-settings', 'business_hours'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'business_hours')
        .single();
      if (error) throw error;
      return data?.value as unknown as BusinessHours;
    },
  });

  const [company, setCompany] = useState<CompanySettings>({
    name: '', phone: '', email: '', cnpj: '', address: '',
    website: '', instagram: '', facebook: '', linkedin: '', youtube: '', twitter: '',
  });

  const [hours, setHours] = useState<BusinessHours>({
    weekdays: '09:00-18:00', saturday: '09:00-13:00', sunday: 'Fechado',
  });

  useEffect(() => {
    if (companyData) setCompany(companyData);
  }, [companyData]);

  useEffect(() => {
    if (hoursData) setHours(hoursData);
  }, [hoursData]);

  // Save profile mutation
  const saveProfileMutation = useMutation({
    mutationFn: async (data: { full_name: string; phone: string }) => {
      if (!currentUser?.id) throw new Error('Usuário não encontrado');
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: data.full_name, phone: data.phone })
        .eq('id', currentUser.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profile'] });
      toast.success('Dados pessoais salvos com sucesso!');
    },
    onError: () => toast.error('Erro ao salvar dados pessoais'),
  });

  const saveCompanyMutation = useMutation({
    mutationFn: async (data: CompanySettings) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: JSON.parse(JSON.stringify(data)), updated_at: new Date().toISOString() })
        .eq('key', 'company');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings', 'company'] });
      toast.success('Dados da empresa salvos com sucesso!');
    },
    onError: () => toast.error('Erro ao salvar dados da empresa'),
  });

  const saveHoursMutation = useMutation({
    mutationFn: async (data: BusinessHours) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: JSON.parse(JSON.stringify(data)), updated_at: new Date().toISOString() })
        .eq('key', 'business_hours');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings', 'business_hours'] });
      toast.success('Horários salvos com sucesso!');
    },
    onError: () => toast.error('Erro ao salvar horários'),
  });

  const handleChangePassword = async () => {
    if (!passwordData.new || !passwordData.confirm) {
      toast.error('Preencha todos os campos de senha');
      return;
    }
    if (passwordData.new.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (passwordData.new !== passwordData.confirm) {
      toast.error('As senhas não coincidem');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.new });
      if (error) throw error;
      toast.success('Senha alterada com sucesso!');
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar senha');
    } finally {
      setChangingPassword(false);
    }
  };

  const isLoading = loadingCompany || loadingHours || loadingProfile;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initials = (profile?.full_name || 'A')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* CEO / Admin Master Profile */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-14 w-14 border-2 border-primary/30">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">{initials}</AvatarFallback>
              </Avatar>
              <Crown className="absolute -top-1 -right-1 h-5 w-5 text-yellow-500 fill-yellow-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Dados do Gestor
                </CardTitle>
                <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-600">
                  Administrador Master
                </Badge>
              </div>
              <CardDescription>
                Seus dados pessoais como administrador principal da plataforma
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admin-name">Nome Completo</Label>
              <Input
                id="admin-name"
                value={profileForm.full_name}
                onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Seu nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email de Acesso
              </Label>
              <Input
                id="admin-email"
                value={currentUser?.email || ''}
                disabled
                className="opacity-70"
              />
              <p className="text-[11px] text-muted-foreground">O email de acesso não pode ser alterado</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admin-phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Telefone Pessoal
              </Label>
              <Input
                id="admin-phone"
                value={profileForm.phone}
                onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Nível de Acesso
              </Label>
              <Input value="Acesso Total — CEO / Master" disabled className="opacity-70" />
            </div>
          </div>

          <Button
            onClick={() => saveProfileMutation.mutate(profileForm)}
            disabled={saveProfileMutation.isPending}
          >
            {saveProfileMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Dados Pessoais
          </Button>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Alterar Senha de Acesso
          </CardTitle>
          <CardDescription>Defina uma nova senha para sua conta de administrador</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.new}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, new: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordData.confirm}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirm: e.target.value }))}
                placeholder="Repita a nova senha"
              />
            </div>
          </div>

          {passwordData.new && passwordData.confirm && passwordData.new !== passwordData.confirm && (
            <p className="text-sm text-destructive">As senhas não coincidem</p>
          )}

          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !passwordData.new || !passwordData.confirm}
            variant="outline"
          >
            {changingPassword ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4 mr-2" />
            )}
            Alterar Senha
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Informações da Empresa
          </CardTitle>
          <CardDescription>Dados da empresa gestora da plataforma</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company-name">Nome da Empresa</Label>
              <Input
                id="company-name"
                value={company.name}
                onChange={(e) => setCompany(prev => ({ ...prev, name: e.target.value }))}
                placeholder="WebMarcas"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={company.cnpj}
                onChange={(e) => setCompany(prev => ({ ...prev, cnpj: e.target.value }))}
                placeholder="00.000.000/0001-00"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Telefone
              </Label>
              <Input
                id="phone"
                value={company.phone}
                onChange={(e) => setCompany(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Principal
              </Label>
              <Input
                id="email"
                type="email"
                value={company.email}
                onChange={(e) => setCompany(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contato@webmarcas.net"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço Completo
            </Label>
            <Textarea
              id="address"
              value={company.address}
              onChange={(e) => setCompany(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Rua, Número, Bairro, Cidade - Estado, CEP"
              rows={2}
            />
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Redes Sociais e Site
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="website" className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4" />
                  Website
                </Label>
                <Input
                  id="website"
                  value={company.website || ''}
                  onChange={(e) => setCompany(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://seusite.com.br"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram" className="flex items-center gap-1.5">
                  <Instagram className="h-4 w-4" />
                  Instagram
                </Label>
                <Input
                  id="instagram"
                  value={company.instagram || ''}
                  onChange={(e) => setCompany(prev => ({ ...prev, instagram: e.target.value }))}
                  placeholder="@suaempresa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facebook" className="flex items-center gap-1.5">
                  <Facebook className="h-4 w-4" />
                  Facebook
                </Label>
                <Input
                  id="facebook"
                  value={company.facebook || ''}
                  onChange={(e) => setCompany(prev => ({ ...prev, facebook: e.target.value }))}
                  placeholder="https://facebook.com/suaempresa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin" className="flex items-center gap-1.5">
                  <Linkedin className="h-4 w-4" />
                  LinkedIn
                </Label>
                <Input
                  id="linkedin"
                  value={company.linkedin || ''}
                  onChange={(e) => setCompany(prev => ({ ...prev, linkedin: e.target.value }))}
                  placeholder="https://linkedin.com/company/suaempresa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="youtube" className="flex items-center gap-1.5">
                  <Youtube className="h-4 w-4" />
                  YouTube
                </Label>
                <Input
                  id="youtube"
                  value={company.youtube || ''}
                  onChange={(e) => setCompany(prev => ({ ...prev, youtube: e.target.value }))}
                  placeholder="https://youtube.com/@suaempresa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitter" className="flex items-center gap-1.5">
                  <Twitter className="h-4 w-4" />
                  X (Twitter)
                </Label>
                <Input
                  id="twitter"
                  value={company.twitter || ''}
                  onChange={(e) => setCompany(prev => ({ ...prev, twitter: e.target.value }))}
                  placeholder="@suaempresa"
                />
              </div>
            </div>
          </div>

          <Button
            onClick={() => saveCompanyMutation.mutate(company)}
            disabled={saveCompanyMutation.isPending}
          >
            {saveCompanyMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Dados da Empresa
          </Button>
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horário de Funcionamento
          </CardTitle>
          <CardDescription>Configure os horários de atendimento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="weekdays">Segunda a Sexta</Label>
              <Input
                id="weekdays"
                value={hours.weekdays}
                onChange={(e) => setHours(prev => ({ ...prev, weekdays: e.target.value }))}
                placeholder="09:00-18:00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saturday">Sábado</Label>
              <Input
                id="saturday"
                value={hours.saturday}
                onChange={(e) => setHours(prev => ({ ...prev, saturday: e.target.value }))}
                placeholder="09:00-13:00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sunday">Domingo</Label>
              <Input
                id="sunday"
                value={hours.sunday}
                onChange={(e) => setHours(prev => ({ ...prev, sunday: e.target.value }))}
                placeholder="Fechado"
              />
            </div>
          </div>

          <Button
            onClick={() => saveHoursMutation.mutate(hours)}
            disabled={saveHoursMutation.isPending}
          >
            {saveHoursMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Horários
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
