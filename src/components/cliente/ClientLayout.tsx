import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

import { toast } from 'sonner';
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  CreditCard,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  Bell,
  ChevronRight,
  PlusCircle,
  Shield,
  BarChart3,
} from 'lucide-react';
import logo from '@/assets/webmarcas-logo.png';
import { cn } from '@/lib/utils';
import { usePresence } from '@/hooks/usePresence';

interface ClientLayoutProps {
  children: ReactNode;
}

interface MenuItem {
  icon: typeof LayoutDashboard;
  label: string;
  subtitle: string;
  href: string;
  iconColor: string;
  iconBg: string;
}

const menuItems: MenuItem[] = [
  { 
    icon: LayoutDashboard, 
    label: 'Dashboard', 
    subtitle: 'Visão geral',
    href: '/cliente/dashboard',
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30'
  },
  { 
    icon: PlusCircle, 
    label: 'Registrar Marca', 
    subtitle: 'Novo registro',
    href: '/cliente/registrar-marca',
    iconColor: 'text-orange-500',
    iconBg: 'bg-orange-100 dark:bg-orange-900/30'
  },
  { 
    icon: FileText, 
    label: 'Meus Processos', 
    subtitle: 'Acompanhe suas marcas',
    href: '/cliente/processos',
    iconColor: 'text-violet-500',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30'
  },
  { 
    icon: FolderOpen, 
    label: 'Documentos', 
    subtitle: 'Arquivos e certificados',
    href: '/cliente/documentos',
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30'
  },
  { 
    icon: CreditCard, 
    label: 'Financeiro', 
    subtitle: 'Faturas e pagamentos',
    href: '/cliente/financeiro',
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30'
  },
  { 
    icon: BarChart3, 
    label: 'Análise Inteligente', 
    subtitle: 'Score dos seus processos',
    href: '/cliente/analise-inteligente',
    iconColor: 'text-violet-500',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30'
  },
  { 
    icon: MessageSquare, 
    label: 'Chat Suporte', 
    subtitle: 'Fale com seu consultor',
    href: '/cliente/suporte',
    iconColor: 'text-pink-500',
    iconBg: 'bg-pink-100 dark:bg-pink-900/30'
  },
  { 
    icon: Settings, 
    label: 'Configurações', 
    subtitle: 'Preferências da conta',
    href: '/cliente/configuracoes',
    iconColor: 'text-slate-500',
    iconBg: 'bg-slate-100 dark:bg-slate-900/30'
  },
];

export function ClientLayout({ children }: ClientLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdminMaster, setIsAdminMaster] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        navigate('/cliente/login');
        setAuthChecked(true);
        return;
      }
      
      setUserId(session.user.id);
      setIsAdminMaster(session.user.email === 'davillys@gmail.com');
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('role', 'user')
        .maybeSingle();

      if (!userRole) {
        // No client role — check if admin
        const { data: adminRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (adminRole) {
          navigate('/admin/dashboard');
        } else {
          // No roles at all — account was deleted, sign out
          await supabase.auth.signOut();
          toast.error('Sua conta não está mais ativa.');
          navigate('/cliente/login');
        }
        setAuthChecked(true);
        return;
      }
      
      setAuthChecked(true);
    });
  }, [navigate]);

  usePresence(userId);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logout realizado com sucesso');
    navigate('/cliente/login');
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border/50">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="WebMarcas" className="h-10" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-1.5">
          {menuItems.map((item, index) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 shadow-sm'
                    : 'hover:bg-muted/50 hover:shadow-sm'
                )}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                  item.iconBg,
                  isActive && "scale-110 shadow-md",
                  !isActive && "group-hover:scale-105"
                )}>
                  <item.icon className={cn("h-5 w-5", item.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "block text-sm font-medium truncate transition-colors",
                    isActive ? "text-primary" : "text-foreground"
                  )}>
                    {item.label}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {item.subtitle}
                  </span>
                </div>
                <ChevronRight className={cn(
                  "h-4 w-4 text-muted-foreground/50 transition-all duration-200",
                  isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                )} />
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-3 border-t border-border/50 space-y-1.5">
        {isAdminMaster && (
          <Link
            to="/admin/dashboard"
            onClick={() => setMobileOpen(false)}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-muted/50 hover:shadow-sm"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 transition-all duration-200 group-hover:scale-105">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-foreground">Painel Admin</span>
              <span className="block text-xs text-muted-foreground truncate">Acessar CRM</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
          </Link>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
          onClick={handleLogout}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30">
            <LogOut className="h-5 w-5 text-red-500" />
          </div>
          <div className="flex-1 text-left">
            <span className="block text-sm font-medium">Sair</span>
            <span className="block text-xs text-muted-foreground">Encerrar sessão</span>
          </div>
        </Button>
      </div>
    </div>
  );

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-bottom">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col border-r border-border/50 bg-card/50 backdrop-blur-sm">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-50 flex items-center justify-between h-14 md:h-16 px-3 md:px-4 border-b border-border/50 bg-card/80 backdrop-blur-sm safe-area-top">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl touch-target">
              <Menu className="h-5 w-5 md:h-6 md:w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px] sm:w-72">
            <NavContent />
          </SheetContent>
        </Sheet>

        <Link to="/">
          <img src={logo} alt="WebMarcas" className="h-7 md:h-8" />
        </Link>

        <Button variant="ghost" size="icon" className="rounded-xl touch-target">
          <Bell className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
      </header>

      {/* Main Content */}
      <main className="lg:pl-72">
        <div className="p-4 sm:p-6 lg:p-8 animate-page-enter">{children}</div>
      </main>
    </div>
  );
}
