import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import logo from '@/assets/webmarcas-logo.png';

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    const canonicalResetUrl = 'https://www.webmarcas.net/cliente/redefinir-senha';
    const isCanonicalHost = window.location.hostname === 'www.webmarcas.net' || window.location.hostname === 'webmarcas.net';
    const recoveryPayload = `${window.location.search}${window.location.hash}`;
    const isRecoveryNavigation = recoveryPayload.includes('type=recovery') || recoveryPayload.includes('access_token=') || recoveryPayload.includes('code=');

    // If recovery opens on Lovable domain, forward to official domain preserving token/hash
    if (isRecoveryNavigation && !isCanonicalHost) {
      window.location.replace(`${canonicalResetUrl}${window.location.search}${window.location.hash}`);
      return;
    }

    let settled = false;

    // Listen for PASSWORD_RECOVERY event FIRST (before checking session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        settled = true;
        setIsValidSession(true);
      } else if (event === 'SIGNED_IN' && !settled) {
        // Recovery link may fire SIGNED_IN instead of PASSWORD_RECOVERY in some flows
        settled = true;
        setIsValidSession(true);
      }
    });

    // Check if user already has a valid session (e.g., page reload after recovery)
    const checkSession = async () => {
      // Give auth state change a moment to process hash fragments
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (settled) return; // Already handled by onAuthStateChange

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        settled = true;
        setIsValidSession(true);
      } else {
        // Wait a bit more for slower connections
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (settled) return;
        
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (retrySession) {
          settled = true;
          setIsValidSession(true);
        } else {
          setIsValidSession(false);
        }
      }
    };

    checkSession();

    return () => subscription.unsubscribe();
  }, []);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'A senha deve ter pelo menos 8 caracteres';
    if (!/[A-Z]/.test(pwd)) return 'A senha deve conter pelo menos uma letra maiúscula';
    if (!/[a-z]/.test(pwd)) return 'A senha deve conter pelo menos uma letra minúscula';
    if (!/[0-9]/.test(pwd)) return 'A senha deve conter pelo menos um número';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validatePassword(password);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast.error('Erro ao redefinir senha: ' + error.message);
        return;
      }

      setSuccess(true);
      toast.success('Senha redefinida com sucesso!');
      
      setTimeout(() => {
        navigate('/cliente/login');
      }, 3000);
    } catch (error) {
      toast.error('Erro ao processar solicitação');
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isValidSession === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Verificando link de recuperação...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid or expired link
  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Link to="/">
              <img src={logo} alt="WebMarcas" className="h-12 mx-auto mb-4" />
            </Link>
            <CardTitle className="text-2xl text-destructive">Link Inválido</CardTitle>
            <CardDescription>
              O link de recuperação expirou ou é inválido.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Solicite um novo link de recuperação de senha.
            </p>
            <Link to="/cliente/recuperar-senha" className="block">
              <Button className="w-full">Solicitar Novo Link</Button>
            </Link>
            <Link to="/cliente/login" className="block">
              <Button variant="outline" className="w-full">Voltar ao Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Link to="/">
              <img src={logo} alt="WebMarcas" className="h-12 mx-auto mb-4" />
            </Link>
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Senha Redefinida!</CardTitle>
            <CardDescription>Sua senha foi alterada com sucesso.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Você será redirecionado para o login em instantes...
            </p>
            <Link to="/cliente/login">
              <Button className="w-full">Ir para o Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Password reset form
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/">
            <img src={logo} alt="WebMarcas" className="h-12 mx-auto mb-4" />
          </Link>
          <CardTitle className="text-2xl">Redefinir Senha</CardTitle>
          <CardDescription>Escolha uma nova senha para sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="bg-muted/50 border rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">A senha deve conter:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li className={password.length >= 8 ? 'text-green-600' : ''}>Mínimo de 8 caracteres</li>
                <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>Uma letra maiúscula</li>
                <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>Uma letra minúscula</li>
                <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>Um número</li>
              </ul>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redefinindo...
                </>
              ) : (
                'Redefinir Senha'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
