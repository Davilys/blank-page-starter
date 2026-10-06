import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { toast } from 'sonner';
import {
  ArrowLeft,
  BadgeCheck,
  FileCheck2,
  Fingerprint,
  Loader2,
  Lock,
  Mail,
  Radar,
  ShieldCheck,
} from 'lucide-react';
import logo from '@/assets/webmarcas-logo.png';

export default function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Email ou senha incorretos');
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.user) {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .eq('role', 'user')
          .maybeSingle();

        if (!userRole) {
          await supabase.auth.signOut();
          toast.error('Esta área é exclusiva para clientes. Administradores devem acessar pelo painel admin.');
          return;
        }

        toast.success('Login realizado com sucesso!');
        navigate('/cliente/dashboard');
      }
    } catch (error) {
      toast.error('Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <main className="relative flex min-h-screen w-full overflow-hidden bg-background font-sans">
      <section className="relative hidden min-h-screen w-[54%] flex-col overflow-hidden bg-primary px-10 py-9 text-primary-foreground lg:flex xl:px-16 xl:py-12">
        <div className="absolute inset-0 opacity-15" aria-hidden="true">
          <div className="absolute left-[10%] top-[15%] h-px w-[78%] bg-primary-foreground" />
          <div className="absolute left-[18%] top-[15%] h-[68%] w-px bg-primary-foreground" />
          <div className="absolute bottom-[17%] left-[18%] h-px w-[70%] bg-primary-foreground" />
          <div className="absolute right-[12%] top-[15%] h-[68%] w-px bg-primary-foreground" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-foreground shadow-lg">
            <img src={logo} alt="" className="h-8 w-8 object-contain" />
          </span>
          <div>
            <p className="text-xl font-extrabold">WebMarcas</p>
            <p className="text-xs font-semibold uppercase text-primary-foreground/65">Propriedade intelectual</p>
          </div>
        </div>

        <div className="relative z-10 mt-12 max-w-xl xl:mt-16">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-primary-foreground/75">
            <ShieldCheck className="h-4 w-4" />
            Portal seguro do cliente
          </p>
          <h1 className="max-w-lg text-4xl font-black leading-tight xl:text-5xl">
            Sua marca protegida. Seu processo sempre por perto.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-primary-foreground/75 xl:text-lg">
            Acompanhe cada etapa do registro, consulte documentos e mantenha sua propriedade intelectual sob controle.
          </p>
        </div>

        <div className="relative z-10 mt-auto flex min-h-[300px] items-end pb-5 pt-10 xl:min-h-[360px]">
          <div className="relative ml-5 w-full max-w-[510px]">
            <div className="relative border border-primary-foreground/20 bg-primary-foreground/10 p-5 shadow-2xl backdrop-blur-md sm:p-6">
              <div className="mb-6 flex items-center justify-between border-b border-primary-foreground/15 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center bg-primary-foreground/15">
                    <Fingerprint className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase text-primary-foreground/55">Ativo protegido</p>
                    <p className="font-bold">Registro de marca</p>
                  </div>
                </div>
                <BadgeCheck className="h-7 w-7 text-accent" />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <FileCheck2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                      <span>Análise documental</span>
                      <span>Concluída</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-primary-foreground/15">
                      <div className="h-full w-full rounded-full bg-accent" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
                    <Radar className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                      <span>Monitoramento INPI</span>
                      <span>Ativo</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-primary-foreground/15">
                      <div className="h-full w-3/4 rounded-full bg-primary-foreground/70" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -right-6 -top-7 flex items-center gap-2 border border-primary-foreground/20 bg-primary px-4 py-3 shadow-xl xl:-right-12">
              <ShieldCheck className="h-5 w-5 text-accent" />
              <div>
                <p className="text-xs font-bold">Ambiente protegido</p>
                <p className="text-xs text-primary-foreground/60">Dados sob sigilo</p>
              </div>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/50">
          WebMarcas · Inteligência em marcas e patentes
        </p>
      </section>

      <section className="relative flex min-h-screen w-full items-center justify-center px-5 py-10 sm:px-10 lg:w-[46%] lg:px-12 xl:px-20">
      <Link
        to="/admin/login"
        title="Área do administrador"
        aria-label="Área do administrador"
        className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-all hover:border-primary/40 hover:text-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-6 sm:top-6"
      >
        <Lock className="h-5 w-5" />
      </Link>

        <div className="w-full max-w-[430px] animate-fade-in">
          <Link to="/" className="mb-9 inline-flex items-center gap-3 lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-sm">
              <img src={logo} alt="" className="h-8 w-8 object-contain" />
            </span>
            <span className="text-xl font-extrabold text-foreground">WebMarcas</span>
          </Link>

          <div className="mb-8">
            <p className="mb-3 text-sm font-bold uppercase text-primary">Portal do cliente</p>
            <h2 className="text-3xl font-black leading-tight text-foreground sm:text-4xl">Bem-vindo de volta</h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Entre para acompanhar seus processos e documentos.
            </p>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-semibold">Email</Label>
              <div className="group relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-13 rounded-lg bg-muted/40 pl-12 text-base transition-all focus-visible:bg-background"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="password" className="font-semibold">Senha</Label>
                <Link to="/cliente/recuperar-senha" className="text-sm font-semibold text-primary hover:underline">
                  Esqueceu sua senha?
                </Link>
              </div>
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
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <div className="mt-6 border border-border bg-muted/35 p-4 text-center">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Primeiro acesso? Use a senha inicial{' '}
              <code className="rounded bg-background px-2 py-1 font-bold text-foreground shadow-sm">123Mudar@</code>
            </p>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-6 text-sm">
            <Link to="/" className="inline-flex items-center gap-2 font-medium text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao site
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
