import { ReactNode, useState, useEffect, useMemo, useCallback } from 'react';
import { AdminErrorBoundary } from '@/components/admin/ErrorBoundary';
import { MobileBottomNav } from '@/components/admin/MobileBottomNav';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChatModeProvider, useChatMode } from '@/contexts/ChatModeContext';
import { supabase } from '@/integrations/supabase/client';
import { usePresence } from '@/hooks/usePresence';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  Users,
  FileText,
  FolderOpen,
  CreditCard,
  Bell,
  Settings,
  LogOut,
  Shield,
  Scale,
  Newspaper,
  BookOpen,
  UserPlus,
  FileSignature,
  FileStack,
  MessageCircle,
  Mail,
  ChevronRight,
  Trophy,
  Moon,
  Sun,
  ArrowLeft,
  BarChart3,
} from 'lucide-react';
import logo from '@/assets/webmarcas-logo.png';
import logoIcon from '@/assets/webmarcas-icon.png';
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  SidebarGroup,
  SidebarGroupContent,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { useAdminPermissions, type PermissionKey } from '@/hooks/useAdminPermissions';
import { withTimeout, isConnectivityError } from '@/lib/networkResilience';

interface AdminLayoutProps {
  children: ReactNode;
}

interface MenuItem {
  icon: React.ElementType;
  label: string;
  subtitle: string;
  href: string;
  iconColor: string;
  iconBg: string;
  permissionKey: PermissionKey;
}

const menuItems: MenuItem[] = [
  { 
    icon: LayoutDashboard, 
    label: 'Dashboard', 
    subtitle: 'Inteligência executiva',
    href: '/admin/dashboard',
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    permissionKey: 'dashboard'
  },
  { 
    icon: UserPlus, 
    label: 'Leads', 
    subtitle: 'Gestão de leads',
    href: '/admin/leads',
    iconColor: 'text-green-500',
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    permissionKey: 'leads'
  },
  { 
    icon: Users, 
    label: 'Clientes', 
    subtitle: 'Base de clientes',
    href: '/admin/clientes',
    iconColor: 'text-indigo-500',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    permissionKey: 'clients'
  },
  { 
    icon: FileSignature, 
    label: 'Contratos', 
    subtitle: 'Gestão de contratos',
    href: '/admin/contratos',
    iconColor: 'text-violet-500',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30',
    permissionKey: 'contracts'
  },
  { 
    icon: FileStack, 
    label: 'Modelos de Contrato', 
    subtitle: 'Templates e modelos',
    href: '/admin/modelos-contrato',
    iconColor: 'text-pink-500',
    iconBg: 'bg-pink-100 dark:bg-pink-900/30',
    permissionKey: 'contract_templates'
  },
  { 
    icon: FolderOpen, 
    label: 'Documentos', 
    subtitle: 'Arquivos e anexos',
    href: '/admin/documentos',
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    permissionKey: 'documents'
  },
  { 
    icon: CreditCard, 
    label: 'Financeiro', 
    subtitle: 'Pagamentos e faturas',
    href: '/admin/financeiro',
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    permissionKey: 'financial'
  },
  { 
    icon: Mail, 
    label: 'Emails', 
    subtitle: 'Comunicação e templates',
    href: '/admin/emails',
    iconColor: 'text-sky-500',
    iconBg: 'bg-sky-100 dark:bg-sky-900/30',
    permissionKey: 'emails'
  },
  { 
    icon: MessageCircle, 
    label: 'Chat ao Vivo', 
    subtitle: 'Atendimento em tempo real',
    href: '/admin/chat-ao-vivo',
    iconColor: 'text-teal-500',
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
    permissionKey: 'live_chat'
  },
  { 
    icon: Bell, 
    label: 'Notificações', 
    subtitle: 'Alertas e avisos',
    href: '/admin/notificacoes',
    iconColor: 'text-orange-500',
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    permissionKey: 'notifications'
  },
  { 
    icon: BookOpen, 
    label: 'Revista INPI', 
    subtitle: 'Publicações oficiais',
    href: '/admin/revista-inpi',
    iconColor: 'text-cyan-500',
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    permissionKey: 'inpi_magazine'
  },
  { 
    icon: Newspaper, 
    label: 'Publicação', 
    subtitle: 'Prazos e gestão de marcas',
    href: '/admin/publicacao',
    iconColor: 'text-rose-500',
    iconBg: 'bg-rose-100 dark:bg-rose-900/30',
    permissionKey: 'publications'
  },
  { 
    icon: Scale, 
    label: 'Recursos INPI', 
    subtitle: 'Recursos e petições',
    href: '/admin/recursos-inpi',
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    permissionKey: 'inpi_resources'
  },
  { 
    icon: Trophy, 
    label: 'Premiação', 
    subtitle: 'Metas e bonificações',
    href: '/admin/premiacao',
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    permissionKey: 'awards'
  },
  { 
    icon: BarChart3, 
    label: 'Marketing Intelligence', 
    subtitle: 'Campanhas e ROI',
    href: '/admin/marketing',
    iconColor: 'text-fuchsia-500',
    iconBg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30',
    permissionKey: 'marketing_intelligence'
  },
  { 
    icon: Settings, 
    label: 'Configurações', 
    subtitle: 'Preferências do sistema',
    href: '/admin/configuracoes',
    iconColor: 'text-zinc-500',
    iconBg: 'bg-zinc-100 dark:bg-zinc-900/30',
    permissionKey: 'settings'
  },
];

function SidebarMenuItemCustom({ item, isActive, isCollapsed }: { 
  item: MenuItem; 
  isActive: boolean;
  isCollapsed: boolean;
}) {
  const IconComponent = item.icon;
  
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={isCollapsed ? `${item.label} - ${item.subtitle}` : undefined}
        className={cn(
          "group/item h-auto py-2.5 px-3 transition-all duration-200",
          "hover:bg-accent/60 hover:shadow-sm",
          isActive && "bg-accent shadow-md"
        )}
      >
        <Link to={item.href} className="flex items-center gap-3">
          {/* Icon Container */}
          <div className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200",
            item.iconBg,
            "group-hover/item:scale-110 group-hover/item:shadow-sm",
            isActive && "scale-105 shadow-md"
          )}>
            <IconComponent className={cn(
              "w-5 h-5 transition-transform duration-200",
              item.iconColor
            )} />
          </div>
          
          {/* Text Content */}
          <div className="flex-1 min-w-0">
            <p className={cn(
              "font-medium text-sm leading-tight",
              isActive ? "text-foreground" : "text-foreground/80"
            )}>
              {item.label}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {item.subtitle}
            </p>
          </div>
          
          {/* Active Indicator */}
          {isActive && (
            <ChevronRight className="w-4 h-4 text-primary animate-fade-in" />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const { permissions, isLoading: loadingPermissions } = useAdminPermissions();

  // Find first permitted route for logo link
  const firstPermittedRoute = useMemo(() => {
    if (!permissions) return '/admin/configuracoes';
    const first = menuItems.find(item => permissions[item.permissionKey]?.can_view === true);
    return first?.href || '/admin/configuracoes';
  }, [permissions]);

  // Keep a ref of the last valid menu items to prevent flash during refetch
  const [cachedMenuItems, setCachedMenuItems] = useState<MenuItem[]>(menuItems);

  // Filter menu items based on user permissions
  const filteredMenuItems = useMemo(() => {
    if (!permissions) return cachedMenuItems; // Show cached items while loading/refetching
    return menuItems.filter(item => permissions[item.permissionKey]?.can_view === true);
  }, [permissions, cachedMenuItems]);

  // Update cache when permissions are loaded
  useEffect(() => {
    if (permissions) {
      const filtered = menuItems.filter(item => permissions[item.permissionKey]?.can_view === true);
      if (filtered.length > 0) {
        setCachedMenuItems(filtered);
      }
    }
  }, [permissions]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logout realizado com sucesso');
    navigate('/cliente/login');
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="border-b border-border/50 p-4">
        <Link to={firstPermittedRoute} className="flex items-center gap-2 group">
          {isCollapsed ? (
            <img 
              src={logoIcon} 
              alt="WebMarcas" 
              className="h-8 w-8 transition-transform duration-200 group-hover:scale-110" 
            />
          ) : (
            <img 
              src={logo} 
              alt="WebMarcas" 
              className="h-10 transition-transform duration-200 group-hover:scale-105" 
            />
          )}
        </Link>
        {!isCollapsed && (
          <div className="mt-3 flex items-center gap-2 text-xs animate-fade-in">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10">
              <Shield className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-medium text-muted-foreground">WebMarcas Intelligence PI</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {filteredMenuItems.map((item) => (
                <SidebarMenuItemCustom
                  key={item.href}
                  item={item}
                  isActive={location.pathname === item.href}
                  isCollapsed={isCollapsed}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-2">
        <SidebarMenu className="space-y-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip={isCollapsed ? "Sair do sistema" : undefined}
              className="h-auto py-2.5 px-3 hover:bg-destructive/10 transition-all duration-200 group/logout"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 transition-transform duration-200 group-hover/logout:scale-110">
                <LogOut className="w-5 h-5 text-red-500" />
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-muted-foreground group-hover/logout:text-destructive transition-colors">Sair</p>
                  <p className="text-xs text-muted-foreground">Encerrar sessão</p>
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function AdminLayoutInner({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { chatMode, setChatMode } = useChatMode();

  // Use sessionStorage to cache admin status across navigations/tab switches
  const cachedAdmin = sessionStorage.getItem('admin_verified');
  const cachedUserId = sessionStorage.getItem('admin_user_id');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(cachedAdmin === 'true' ? true : null);
  const [adminUserId, setAdminUserId] = useState<string | null>(cachedUserId || null);
  const { permissions, isLoading: loadingPermissions, canAccessPath, isMasterAdmin } = useAdminPermissions();

  // Broadcast admin presence
  usePresence(adminUserId);

  // Helper: find first permitted route
  const getFirstPermittedRoute = useMemo(() => {
    if (!permissions) return '/admin/configuracoes';
    const first = menuItems.find(item => permissions[item.permissionKey]?.can_view === true);
    return first?.href || '/admin/configuracoes';
  }, [permissions]);

  const [authError, setAuthError] = useState<string | null>(null);

  const checkAdmin = useCallback(async () => {
    setAuthError(null);
    try {
      // Fast path: if sessionStorage already has verified admin for current session, skip network
      const ssAdmin = sessionStorage.getItem('admin_verified');
      const ssUserId = sessionStorage.getItem('admin_user_id');
      if (ssAdmin === 'true' && ssUserId) {
        setIsAdmin(true);
        setAdminUserId(ssUserId);
        return;
      }

      const { data: { user } } = await withTimeout(supabase.auth.getUser(), 12000);
      
      if (!user) {
        sessionStorage.removeItem('admin_verified');
        sessionStorage.removeItem('admin_user_id');
        setIsAdmin(null);
        navigate('/cliente/login');
        return;
      }

      const { data: isAdminRole, error } = await withTimeout(
        supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
        12000,
      );

      if (error) {
        if (isConnectivityError(error)) {
          // If we have a cached admin status, trust it instead of showing error
          if (ssAdmin === 'true' && ssUserId === user.id) {
            setIsAdmin(true);
            setAdminUserId(user.id);
            return;
          }
          setAuthError('Falha de conexão ao verificar permissões. Tente novamente.');
          return;
        }
        toast.error('Acesso negado. Você não tem permissão de administrador.');
        navigate('/cliente/dashboard');
        return;
      }

      if (!isAdminRole) {
        sessionStorage.removeItem('admin_verified');
        sessionStorage.removeItem('admin_user_id');
        toast.error('Acesso negado. Você não tem permissão de administrador.');
        navigate('/cliente/dashboard');
        return;
      }

      sessionStorage.setItem('admin_verified', 'true');
      sessionStorage.setItem('admin_user_id', user.id);
      setIsAdmin(true);
      setAdminUserId(user.id);
    } catch (err) {
      if (isConnectivityError(err)) {
        const ssAdmin = sessionStorage.getItem('admin_verified');
        const ssUserId = sessionStorage.getItem('admin_user_id');
        if (ssAdmin === 'true' && ssUserId) {
          setIsAdmin(true);
          setAdminUserId(ssUserId);
          return;
        }
        setAuthError('Falha de conexão com o servidor. Tente novamente.');
      } else {
        toast.error('Erro ao verificar permissões.');
        navigate('/cliente/login');
      }
    }
  }, [navigate]);

  useEffect(() => {
    checkAdmin();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('admin_verified');
        sessionStorage.removeItem('admin_user_id');
        setIsAdmin(null);
        setAdminUserId(null);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Keep cache in sync after token refresh
        sessionStorage.setItem('admin_user_id', session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkAdmin]);

  // Centralized permission guard: redirect if user can't access current route
  useEffect(() => {
    if (isAdmin && !loadingPermissions && permissions) {
      if (!canAccessPath(location.pathname)) {
        navigate(getFirstPermittedRoute, { replace: true });
      }
    }
  }, [isAdmin, loadingPermissions, permissions, location.pathname, canAccessPath, navigate, getFirstPermittedRoute]);

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <Shield className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Erro de Conexão</h2>
          <p className="text-sm text-muted-foreground">{authError}</p>
          <Button onClick={() => checkAdmin()} className="gap-2">
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  // Only show full loading screen if we have NO cached data at all
  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // If no permissions at all and not master admin, show restricted
  if (!isMasterAdmin && permissions && !menuItems.some(item => permissions[item.permissionKey]?.can_view === true)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <Shield className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Acesso Restrito</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Você não tem permissão para acessar nenhuma seção. Entre em contato com o administrador master.
          </p>
        </div>
      </div>
    );
  }

  const isChatActive = chatMode && chatMode !== 'selector';

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background safe-area-top safe-area-bottom overflow-x-hidden">
        {/* Sidebar — hidden on mobile, visible md+ */}
        <div className="hidden md:block flex-shrink-0">
          <AdminSidebar />
        </div>
        
        <SidebarInset className="flex-1 flex flex-col min-h-0 min-w-0 overflow-x-hidden">
          {/* Header */}
          <header className="sticky top-0 z-50 flex items-center gap-2 md:gap-4 h-12 md:h-14 px-3 md:px-4 border-b border-border/50 header-frosted flex-shrink-0">
            {/* Sidebar trigger only on desktop */}
            <div className="hidden md:block">
              <SidebarTrigger className="-ml-1 hover:bg-accent/60 transition-colors touch-target" />
            </div>

            {/* Botão Voltar — aparece quando está em modo chat ativo */}
            {isChatActive && (
              <button
                onClick={() => setChatMode('selector')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/60 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-150"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </button>
            )}

            {/* Brand identity — HUD style */}
            <Link to={getFirstPermittedRoute} className="flex items-center gap-2 group select-none">
              {/* Icon orb */}
              <div className="relative flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-[0_0_12px_hsl(var(--primary)/0.35)] group-hover:shadow-[0_0_18px_hsl(var(--primary)/0.5)] transition-shadow duration-300">
                <Shield className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary-foreground drop-shadow-sm" />
                {/* Pulse ring */}
                <span className="absolute inset-0 rounded-xl ring-1 ring-primary/40 group-hover:ring-primary/70 transition-all duration-300" />
              </div>

              {/* Text stack */}
              <div className="flex flex-col leading-none">
                <span
                  className="font-black text-[11px] md:text-[13px] tracking-widest uppercase"
                  style={{
                    background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary)/0.7))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Intelligence PI
                </span>
                <span className="text-[8px] md:text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground/60">
                  WebMarcas · v2026
                </span>
              </div>

              {/* Live dot */}
              <div className="hidden md:flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <span className="text-[8px] font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400">live</span>
              </div>
            </Link>

            {/* Botões extras quando BotConversa ativo */}
            {chatMode === 'botconversa' && (
              <div className="flex items-center gap-1.5 ml-1">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('botconversa-reload'))}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/60 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-150"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Recarregar
                </button>
                <button
                  onClick={() => window.open('https://app.botconversa.com.br/8572/live-chat/all', '_blank')}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/60 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-150"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Nova Aba
                </button>
              </div>
            )}

            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="w-8 h-8 rounded-xl hover:bg-accent/60 transition-all duration-300"
              aria-label="Alternar tema"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-500" />
              )}
            </Button>
          </header>
          
          {/* Main content */}
          <main className={cn(
            "flex-1 animate-page-enter mobile-page-content",
            isChatActive
              ? "overflow-hidden p-0 flex flex-col min-h-0"
              : "overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-8"
          )}
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <AdminErrorBoundary>
              {children}
            </AdminErrorBoundary>
          </main>
        </SidebarInset>

        {/* Mobile Bottom Navigation — only on mobile */}
        <MobileBottomNav />

      </div>
    </SidebarProvider>
  );
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <ChatModeProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </ChatModeProvider>
  );
}

