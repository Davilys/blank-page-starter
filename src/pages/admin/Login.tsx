import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  Landmark,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
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
    <main className="brand-admin relative flex min-h-screen w-full overflow-hidden bg-background font-sans">
      <section className="relative hidden min-h-screen w-[56%] flex-col overflow-hidden bg-primary px-10 py-9 text-primary-foreground lg:flex xl:px-16 xl:py-12">
        <div className="absolute inset-0 opacity-15" aria-hidden="true">
          <div className="absolute left-[9%] top-[14%] h-px w-[82%] bg-primary-foreground" />
          <div className="absolute left-[17%] top-[14%] h-[72%] w-px bg-primary-foreground" />
          <div className="absolute bottom-[14%] left-[17%] h-px w-[74%] bg-primary-foreground" />
          <div className="absolute right-[9%] top-[14%] h-[72%] w-px bg-primary-foreground" />
        </div>

        <Link to="/" className="relative z-10 flex w-fit items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-foreground shadow-lg">
            <img src={logo} alt="" className="h-8 w-8 object-contain" />
          </span>
          <div>
            <p className="text-xl font-extrabold">WebMarcas</p>
            <p className="text-xs font-semibold uppercase text-primary-foreground/65">Gestão administrativa</p>
          </div>
        </Link>

        <div className="relative z-10 mt-12 max-w-xl xl:mt-16">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-primary-foreground/75">
            <ShieldCheck className="h-4 w-4" />
            Ambiente interno protegido
          </p>
          <h1 className="max-w-xl text-4xl font-black leading-tight xl:text-5xl">
            Toda a operação WebMarcas em um só lugar.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-primary-foreground/75 xl:text-lg">
            Organize clientes, acompanhe processos e conduza a operação financeira com clareza.
          </p>
        </div>

        <div className="relative z-10 mt-auto w-full max-w-2xl pb-6 pt-10">
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-primary-foreground/20 bg-primary-foreground/10 p-4 backdrop-blur-md xl:p-5">
              <span className="mb-7 flex h-10 w-10 items-center justify-center bg-primary-foreground/15">
                <UsersRound className="h-5 w-5" />
              </span>
              <p className="text-sm font-extrabold">Clientes</p>
              <p className="mt-1 text-xs leading-relaxed text-primary-foreground/60">Relacionamento e histórico centralizados</p>
            </div>
            <div className="border border-primary-foreground/20 bg-primary-foreground/10 p-4 backdrop-blur-md xl:p-5">
              <span className="mb-7 flex h-10 w-10 items-center justify-center bg-primary-foreground/15">
                <BriefcaseBusiness className="h-5 w-5" />
              </span>
              <p className="text-sm font-extrabold">Processos</p>
              <p className="mt-1 text-xs leading-relaxed text-primary-foreground/60">Prazos e atividades sob controle</p>
            </div>
            <div className="border border-primary-foreground/20 bg-primary-foreground/10 p-4 backdrop-blur-md xl:p-5">
              <span className="mb-7 flex h-10 w-10 items-center justify-center bg-accent text-accent-foreground">
                <Landmark className="h-5 w-5" />
              </span>
              <p className="text-sm font-extrabold">Financeiro</p>
              <p className="mt-1 text-xs leading-relaxed text-primary-foreground/60">Cobranças e recebimentos organizados</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-primary-foreground/60">
            <BadgeCheck className="h-4 w-4 text-accent" />
            Acesso exclusivo para a equipe autorizada
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen w-full items-center justify-center px-5 py-10 sm:px-10 lg:w-[44%] lg:px-12 xl:px-20">
        <div className="w-full max-w-[430px] animate-fade-in">
          <Link to="/" className="mb-9 inline-flex items-center gap-3 lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-sm">
              <img src={logo} alt="" className="h-8 w-8 object-contain" />
            </span>
            <span>
              <span className="block text-xl font-extrabold text-foreground">WebMarcas</span>
              <span className="block text-xs font-semibold uppercase text-muted-foreground">Gestão administrativa</span>
            </span>
          </Link>

          <div className="mb-8">
            <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <p className="mb-2 text-sm font-bold uppercase text-primary">CRM WebMarcas</p>
            <h2 className="text-3xl font-black leading-tight text-foreground sm:text-4xl">Acesso administrativo</h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Entre com suas credenciais para gerenciar a operação.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-semibold">Email corporativo</Label>
              <div className="group relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@webmarcas.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-13 rounded-lg bg-muted/40 pl-12 text-base transition-all focus-visible:bg-background"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-semibold">Senha</Label>
              <div className="group relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-13 rounded-lg bg-muted/40 pl-12 text-base transition-all focus-visible:bg-background"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="h-13 w-full rounded-lg text-base font-bold shadow-lg transition-transform active:scale-[0.99]" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Entrar no CRM
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-6 text-sm">
            <Link to="/cliente/login" className="inline-flex items-center gap-2 font-medium text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Área do cliente
            </Link>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Acesso seguro
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
