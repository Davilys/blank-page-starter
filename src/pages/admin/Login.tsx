import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, Lock, Loader2, Shield } from 'lucide-react';
import logo from '@/assets/webmarcas-logo.png';

import {
  resilientCall,
  getConnectivityErrorMessage,
  withTimeout,
} from '@/lib/networkResilience';

const MAX_NETWORK_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 800;
const REQUEST_TIMEOUT_MS = 15000;

export default function AdminLogin() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    let mounted = true;

    const redirectIfSessionExists = async () => {
      const { data } = await withTimeout(supabase.auth.getSession(), REQUEST_TIMEOUT_MS);
      if (!mounted) return;

      if (data.session) {
        navigate('/admin/dashboard', { replace: true });
      }
    };

    redirectIfSessionExists().catch(() => {
      // Silent: if session check fails, user can still login manually
    });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const { data: signInResult, error, wasConnectivityError } = await resilientCall(
        () =>
          supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          }),
        {
          maxRetries: MAX_NETWORK_RETRIES,
          baseDelay: BASE_RETRY_DELAY_MS,
          timeoutMs: REQUEST_TIMEOUT_MS,
        }
      );

      const authError = error ?? signInResult?.error ?? null;

      if (authError || !signInResult?.data?.user) {
        if (authError?.message?.includes('Invalid login credentials')) {
          toast.error('Email ou senha incorretos');
        } else if (wasConnectivityError) {
          toast.error(getConnectivityErrorMessage(authError));
        } else {
          toast.error(authError?.message || 'Não foi possível realizar login.');
        }
        return;
      }

      // Pre-cache admin status so AdminLayout skips verification
      sessionStorage.setItem('admin_verified', 'true');
      sessionStorage.setItem('admin_user_id', signInResult.data.user.id);
      toast.success('Login realizado!');
      navigate('/admin/dashboard', { replace: true });
    } catch (error) {
      toast.error(getConnectivityErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/20">
        <CardHeader className="text-center">
          <Link to="/">
            <img src={logo} alt="WebMarcas" className="h-12 mx-auto mb-4" />
          </Link>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-2xl">Painel Administrativo</CardTitle>
          </div>
          <CardDescription>
            Acesso restrito a administradores do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@webmarcas.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Acessar Painel
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              <Link to="/cliente/login" className="text-primary hover:underline">
                Área do Cliente →
              </Link>
            </p>
            <p className="mt-2">
              <Link to="/" className="hover:underline">
                ← Voltar ao site
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
