import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useCallback } from 'react';
import {
  LayoutDashboard,
  MessageCircle,
  Users,
  FileSignature,
  Mail,
  MoreHorizontal,
  UserPlus,
  FolderOpen,
  CreditCard,
  Bell,
  Settings,
  BookOpen,
  Newspaper,
  Scale,
  Trophy,
  FileStack,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAdminPermissions, type PermissionKey } from '@/hooks/useAdminPermissions';

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  permissionKey: PermissionKey;
  color: string;
  activeGradient: string;
}

interface MoreItem {
  icon: React.ElementType;
  label: string;
  href: string;
  color: string;
  permissionKey: PermissionKey;
}

const primaryNavItems: NavItem[] = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    href: '/admin/dashboard',
    permissionKey: 'dashboard',
    color: 'text-blue-500',
    activeGradient: 'from-blue-500/20 to-blue-600/10',
  },
  {
    icon: MessageCircle,
    label: 'Chat',
    href: '/admin/chat-ao-vivo',
    permissionKey: 'live_chat',
    color: 'text-teal-500',
    activeGradient: 'from-teal-500/20 to-teal-600/10',
  },
  {
    icon: Users,
    label: 'Clientes',
    href: '/admin/clientes',
    permissionKey: 'clients',
    color: 'text-indigo-500',
    activeGradient: 'from-indigo-500/20 to-indigo-600/10',
  },
  {
    icon: FileSignature,
    label: 'Contratos',
    href: '/admin/contratos',
    permissionKey: 'contracts',
    color: 'text-violet-500',
    activeGradient: 'from-violet-500/20 to-violet-600/10',
  },
  {
    icon: Mail,
    label: 'Emails',
    href: '/admin/emails',
    permissionKey: 'emails',
    color: 'text-sky-500',
    activeGradient: 'from-sky-500/20 to-sky-600/10',
  },
];

const moreItems: MoreItem[] = [
  { icon: UserPlus, label: 'Leads', href: '/admin/leads', color: 'text-green-500', permissionKey: 'leads' },
  { icon: FileStack, label: 'Modelos', href: '/admin/modelos-contrato', color: 'text-pink-500', permissionKey: 'contract_templates' },
  { icon: FolderOpen, label: 'Documentos', href: '/admin/documentos', color: 'text-amber-500', permissionKey: 'documents' },
  { icon: CreditCard, label: 'Financeiro', href: '/admin/financeiro', color: 'text-emerald-500', permissionKey: 'financial' },
  { icon: Bell, label: 'Notificações', href: '/admin/notificacoes', color: 'text-orange-500', permissionKey: 'notifications' },
  { icon: BookOpen, label: 'Rev. INPI', href: '/admin/revista-inpi', color: 'text-cyan-500', permissionKey: 'inpi_magazine' },
  { icon: Newspaper, label: 'Publicação', href: '/admin/publicacao', color: 'text-rose-500', permissionKey: 'publications' },
  { icon: Scale, label: 'Rec. INPI', href: '/admin/recursos-inpi', color: 'text-purple-500', permissionKey: 'inpi_resources' },
  { icon: Trophy, label: 'Premiação', href: '/admin/premiacao', color: 'text-amber-500', permissionKey: 'awards' },
  { icon: Settings, label: 'Config.', href: '/admin/configuracoes', color: 'text-zinc-500', permissionKey: 'settings' },
  
];

function NavButton({ item, isActive, onClick }: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const [popped, setPopped] = useState(false);

  const handleClick = () => {
    setPopped(true);
    setTimeout(() => setPopped(false), 300);
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 min-h-[56px]',
        'transition-all duration-200 ease-out',
        '-webkit-tap-highlight-color: transparent',
      )}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Active background pill */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            layoutId="nav-pill"
            className={cn(
              'absolute top-1 inset-x-1 h-10 rounded-2xl bg-gradient-to-b',
              item.activeGradient,
            )}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
      </AnimatePresence>

      {/* Icon */}
      <motion.div
        animate={popped ? { scale: [1, 1.25, 1] } : { scale: 1 }}
        transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative z-10"
      >
        <Icon
          className={cn(
            'w-5 h-5 transition-all duration-200',
            isActive ? item.color : 'text-muted-foreground',
          )}
          strokeWidth={isActive ? 2.5 : 1.8}
        />
      </motion.div>

      {/* Label */}
      <span className={cn(
        'relative z-10 text-[10px] font-medium transition-all duration-200 leading-none',
        isActive ? 'text-foreground' : 'text-muted-foreground/70',
      )}>
        {item.label}
      </span>

      {/* Active dot indicator */}
      {isActive && (
        <motion.div
          className={cn('absolute bottom-1 w-1 h-1 rounded-full', item.color.replace('text-', 'bg-'))}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.1 }}
        />
      )}
    </button>
  );
}

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const { permissions } = useAdminPermissions();

  const filteredPrimary = primaryNavItems.filter(
    item => !permissions || permissions[item.permissionKey]?.can_view !== false,
  );

  const filteredMore = moreItems.filter(
    item => !permissions || permissions[item.permissionKey]?.can_view !== false,
  );

  const isMoreActive = moreItems.some(i => i.href === location.pathname);

  const handleNav = useCallback((href: string) => {
    navigate(href);
    setMoreOpen(false);
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logout realizado');
    navigate('/cliente/login');
  };

  return (
    <>
      {/* More Drawer (Bottom Sheet) */}
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              className="fixed inset-x-0 bottom-[64px] z-50 mx-3 mb-1 rounded-3xl overflow-hidden glass-mobile border border-border/50 shadow-2xl"
              initial={{ opacity: 0, y: 60, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 60, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/40">
                <span className="text-sm font-semibold text-foreground">Mais módulos</span>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Grid of items */}
              <div className="grid grid-cols-3 gap-2 p-4">
                {filteredMore.map((item, i) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <motion.button
                      key={item.href}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 28 }}
                      onClick={() => handleNav(item.href)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-200 card-touch',
                        isActive ? 'bg-primary/10 border border-primary/20' : 'bg-muted/40 border border-transparent',
                      )}
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        isActive ? 'bg-primary/15' : 'bg-background/80',
                      )}>
                        <Icon className={cn('w-5 h-5', item.color)} strokeWidth={1.8} />
                      </div>
                      <span className={cn(
                        'text-[10px] font-medium leading-tight text-center',
                        isActive ? 'text-foreground' : 'text-muted-foreground',
                      )}>
                        {item.label}
                      </span>
                    </motion.button>
                  );
                })}

                {/* Logout */}
                <motion.button
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: filteredMore.length * 0.04, type: 'spring', stiffness: 400, damping: 28 }}
                  onClick={handleLogout}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-destructive/10 border border-destructive/20 card-touch"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-destructive/10">
                    <LogOut className="w-5 h-5 text-destructive" strokeWidth={1.8} />
                  </div>
                  <span className="text-[10px] font-medium text-destructive">Sair</span>
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Nav Bar */}
      <nav className="mobile-bottom-nav md:hidden">
        <div className="flex items-stretch">
          {filteredPrimary.map(item => (
            <NavButton
              key={item.href}
              item={item}
              isActive={location.pathname === item.href}
              onClick={() => handleNav(item.href)}
            />
          ))}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(prev => !prev)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 min-h-[56px]',
              'transition-all duration-200',
            )}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <AnimatePresence>
              {(moreOpen || isMoreActive) && (
                <motion.div
                  className="absolute top-1 inset-x-1 h-10 rounded-2xl bg-gradient-to-b from-zinc-500/20 to-zinc-600/10"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </AnimatePresence>
            <motion.div
              animate={{ rotate: moreOpen ? 90 : 0 }}
              transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
              className="relative z-10"
            >
              <MoreHorizontal
                className={cn('w-5 h-5 transition-colors duration-200',
                  (moreOpen || isMoreActive) ? 'text-foreground' : 'text-muted-foreground')}
                strokeWidth={1.8}
              />
            </motion.div>
            <span className={cn(
              'relative z-10 text-[10px] font-medium transition-colors duration-200 leading-none',
              (moreOpen || isMoreActive) ? 'text-foreground' : 'text-muted-foreground/70',
            )}>
              Mais
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
