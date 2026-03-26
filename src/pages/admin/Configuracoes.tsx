import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GeneralSettings } from '@/components/admin/settings/GeneralSettings';
import { IntegrationSettings } from '@/components/admin/settings/IntegrationSettings';
import { APIWebhooksSettings } from '@/components/admin/settings/APIWebhooksSettings';
import { EmailSettings } from '@/components/admin/email/EmailSettings';
import { WhatsAppSettings } from '@/components/admin/settings/WhatsAppSettings';
import { NotificationSettings } from '@/components/admin/settings/NotificationSettings';
import { SecuritySettings } from '@/components/admin/settings/SecuritySettings';
import { AppearanceSettings } from '@/components/admin/settings/AppearanceSettings';
import { ContractSettings } from '@/components/admin/settings/ContractSettings';
import { ProcessSettings } from '@/components/admin/settings/ProcessSettings';
import { FinancialSettings } from '@/components/admin/settings/FinancialSettings';
import { BackupSettings } from '@/components/admin/settings/BackupSettings';
import { PricingSettings } from '@/components/admin/settings/PricingSettings';
import { AutomatedEmailSettings } from '@/components/admin/settings/AutomatedEmailSettings';
import { AutomatedSMSSettings } from '@/components/admin/settings/AutomatedSMSSettings';
import { AutomatedWhatsAppSettings } from '@/components/admin/settings/AutomatedWhatsAppSettings';
import { AISettings } from '@/components/admin/settings/AISettings';
import { AwardSettings } from '@/components/admin/settings/AwardSettings';
import { cn } from '@/lib/utils';
import {
  Settings, Database, Webhook, Mail, MessageCircle, Bell, Shield,
  Palette, FileSignature, GitBranch, Wallet, HardDrive, Tag, Zap,
  ChevronRight, Cpu, Activity, Smartphone, MessageSquare, Brain, Trophy
} from 'lucide-react';

// ─── Nav config ───────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Sistema',
    items: [
      { value: 'geral',      label: 'Geral',             icon: Settings,       color: '#3b82f6', glow: '#3b82f618', desc: 'Empresa e horários' },
      { value: 'aparencia',  label: 'Aparência',          icon: Palette,        color: '#8b5cf6', glow: '#8b5cf618', desc: 'Tema e identidade' },
      { value: 'seguranca',  label: 'Segurança',          icon: Shield,         color: '#f43f5e', glow: '#f43f5e18', desc: 'Admins e permissões' },
      { value: 'backup',     label: 'Backup',             icon: HardDrive,      color: '#6366f1', glow: '#6366f118', desc: 'Dados e exportação' },
    ],
  },
  {
    label: 'Negócios',
    items: [
      { value: 'precos',     label: 'Preços',             icon: Tag,            color: '#10b981', glow: '#10b98118', desc: 'Tabela de serviços' },
      { value: 'contratos',  label: 'Contratos',          icon: FileSignature,  color: '#f59e0b', glow: '#f59e0b18', desc: 'Modelos e assinaturas' },
      { value: 'processos',  label: 'Processos',          icon: GitBranch,      color: '#06b6d4', glow: '#06b6d418', desc: 'Pipeline e etapas' },
      { value: 'financeiro', label: 'Financeiro',         icon: Wallet,         color: '#22c55e', glow: '#22c55e18', desc: 'Cobranças e faturas' },
      { value: 'premiacao', label: 'Premiação',           icon: Trophy,         color: '#f59e0b', glow: '#f59e0b18', desc: 'Bônus e metas da equipe', badge: 'Novo' },
    ],
  },
  {
    label: 'Comunicação',
    items: [
      { value: 'email-auto', label: 'E-mails Relatórios', icon: Zap,           color: '#f97316', glow: '#f9731618', desc: 'Fluxos automatizados', badge: 'Novo' },
      { value: 'sms-auto',   label: 'SMS Relatórios',     icon: Smartphone,     color: '#06b6d4', glow: '#06b6d418', desc: 'Notificações SMS', badge: 'Novo' },
      { value: 'whatsapp-auto', label: 'WhatsApp Relatórios', icon: MessageSquare, color: '#10b981', glow: '#10b98118', desc: 'BotConversa', badge: 'Novo' },
      { value: 'email',      label: 'E-mail',             icon: Mail,           color: '#3b82f6', glow: '#3b82f618', desc: 'Contas e SMTP' },
      { value: 'whatsapp',   label: 'WhatsApp',           icon: MessageCircle,  color: '#22c55e', glow: '#22c55e18', desc: 'Integração WhatsApp' },
      { value: 'notificacoes', label: 'Notificações',     icon: Bell,           color: '#f59e0b', glow: '#f59e0b18', desc: 'Alertas do sistema' },
    ],
  },
  {
    label: 'Inteligência Artificial',
    items: [
      { value: 'ia',          label: 'Sistema de IAs',    icon: Brain,          color: '#a855f7', glow: '#a855f718', desc: 'Provedores e modelos', badge: 'Novo' },
    ],
  },
  {
    label: 'Integrações',
    items: [
      { value: 'integracoes', label: 'Integrações',       icon: Database,       color: '#8b5cf6', glow: '#8b5cf618', desc: 'Apps conectados' },
      { value: 'api',         label: 'API e Webhooks',    icon: Webhook,        color: '#6366f1', glow: '#6366f118', desc: 'Endpoints e tokens' },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items);

// ─── Fixed particles ──────────────────────────────
const PARTICLES = Array.from({ length: 28 }).map((_, i) => ({
  id: i,
  x: (i * 43.7 + 17) % 100,
  y: (i * 61.3 + 11) % 100,
  size: 1 + (i % 4) * 0.4,
  dur: 9 + (i % 7),
  delay: (i * 0.41) % 6,
  op: 0.03 + (i % 4) * 0.018,
}));

// ─── Live clock ───────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-[11px] text-muted-foreground/60 tracking-widest tabular-nums">
      {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

// ─── Nav Item ─────────────────────────────────────
function NavItem({
  item, isActive, onClick,
}: {
  item: typeof ALL_ITEMS[0]; isActive: boolean; onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200',
        isActive
          ? 'bg-card/80 shadow-[0_2px_12px_hsl(var(--foreground)/0.06)]'
          : 'hover:bg-muted/40'
      )}
    >
      {/* Active indicator bar */}
      {isActive && (
        <motion.div
          layoutId="settings-active-bar"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
          style={{ background: item.color }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      {/* Icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200"
        style={{
          background: isActive ? `${item.color}22` : 'transparent',
          border: isActive ? `1px solid ${item.color}35` : '1px solid transparent',
        }}
      >
        <Icon
          className="h-4 w-4 transition-colors duration-200"
          style={{ color: isActive ? item.color : undefined }}
        />
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'text-sm font-semibold truncate transition-colors duration-200',
            isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
          )}>
            {item.label}
          </span>
          {item.badge && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
              {item.badge}
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/60 truncate">{item.desc}</p>
      </div>

      {isActive && (
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: item.color }} />
      )}
    </motion.button>
  );
}

// ─── Section Header ───────────────────────────────
function SectionHeader({ item }: { item: typeof ALL_ITEMS[0] }) {
  const Icon = item.icon;
  return (
    <motion.div
      key={item.value}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-2xl overflow-hidden border border-border/50 bg-card/50 backdrop-blur-xl p-5 mb-5"
    >
      {/* Top line colored */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${item.color}, transparent)` }}
      />
      {/* Glow bg */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top left, ${item.color}12 0%, transparent 60%)` }}
      />

      <div className="relative flex items-center gap-4">
        <motion.div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
          style={{ background: `${item.color}20`, border: `1px solid ${item.color}35` }}
          animate={{ boxShadow: [`0 0 16px ${item.color}20`, `0 0 28px ${item.color}40`, `0 0 16px ${item.color}20`] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon className="h-6 w-6" style={{ color: item.color }} />
        </motion.div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-foreground">{item.label}</h2>
            {item.badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                {item.badge}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{item.desc}</p>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-2">
          <LiveClock />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Content renderer ────────────────────────────
function SettingsContent({ active }: { active: string }) {
  const map: Record<string, React.ReactNode> = {
    geral:       <GeneralSettings />,
    precos:      <PricingSettings />,
    'email-auto':<AutomatedEmailSettings />,
    'sms-auto':  <AutomatedSMSSettings />,
    'whatsapp-auto': <AutomatedWhatsAppSettings />,
    ia:          <AISettings />,
    integracoes: <IntegrationSettings />,
    api:         <APIWebhooksSettings />,
    email:       <EmailSettings />,
    whatsapp:    <WhatsAppSettings />,
    notificacoes:<NotificationSettings />,
    seguranca:   <SecuritySettings />,
    aparencia:   <AppearanceSettings />,
    contratos:   <ContractSettings />,
    processos:   <ProcessSettings />,
    financeiro:  <FinancialSettings />,
    backup:      <BackupSettings />,
    premiacao:   <AwardSettings />,
  };
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={active}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {map[active]}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main Page ────────────────────────────────────
export default function AdminConfiguracoes() {
  const [activeTab, setActiveTab] = useState('geral');
  const activeItem = ALL_ITEMS.find(i => i.value === activeTab) || ALL_ITEMS[0];

  return (
    <>
      <div className="relative min-h-full pb-8">

        {/* ── Background particles ── */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          {PARTICLES.map(p => (
            <motion.div
              key={p.id}
              className="absolute rounded-full bg-primary"
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, opacity: p.op }}
              animate={{ y: [-8, 8, -8], opacity: [p.op, p.op * 2.2, p.op] }}
              transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
            />
          ))}
          <motion.div
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/8 to-transparent"
            animate={{ top: ['0%', '100%'] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        {/* ── HUD Hero Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-2xl overflow-hidden border border-border/50 bg-card/50 backdrop-blur-xl p-5 mb-5 z-10"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Icon + Title */}
            <div className="flex items-center gap-4 flex-1">
              <div className="relative">
                <motion.div
                  className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-[0_0_24px_hsl(var(--primary)/0.4)]"
                  animate={{ boxShadow: ['0 0 20px hsl(var(--primary)/0.3)', '0 0 40px hsl(var(--primary)/0.55)', '0 0 20px hsl(var(--primary)/0.3)'] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Settings className="h-7 w-7 text-white" />
                </motion.div>
                <motion.div
                  className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Configurações
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-[10px] font-bold uppercase tracking-wider">
                    <motion.span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                    />
                    SISTEMA
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" />
                  Central de controle e configuração do CRM WebMarcas Intelligence PI
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-12 bg-border/40" />

            {/* Stats strip */}
            <div className="flex items-center gap-5">
              {[
                { label: 'Módulos', value: ALL_ITEMS.length, icon: Cpu },
                { label: 'Grupos',  value: NAV_GROUPS.length, icon: Activity },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <p className="text-xl font-black text-foreground leading-none">{s.value}</p>
                  <p className="text-[10px] font-medium text-muted-foreground mt-0.5 uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Clock */}
            <div className="hidden sm:block w-px h-12 bg-border/40" />
            <div className="hidden sm:flex flex-col items-end gap-0.5">
              <LiveClock />
              <span className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-mono">CRM v2026</span>
            </div>
          </div>
        </motion.div>

        {/* ── Mobile Nav (< lg) — fora do flex row, largura total ── */}
        <div className="flex lg:hidden flex-col gap-3 mb-3 relative z-10">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/50 px-1 mb-1.5">
                {group.label}
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ WebkitOverflowScrolling: 'touch' }}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.value;
                  return (
                    <button
                      key={item.value}
                      onClick={() => setActiveTab(item.value)}
                      className={cn(
                        'flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold border transition-all duration-150 whitespace-nowrap',
                        isActive ? 'text-white border-transparent' : 'bg-card/60 border-border/40 text-muted-foreground'
                      )}
                      style={isActive ? { background: item.color, boxShadow: `0 2px 10px ${item.color}50`, border: 'none' } : {}}
                    >
                      <Icon className="h-3 w-3 flex-shrink-0" />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="text-[8px] font-black bg-white/20 px-1 rounded-full">{item.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Layout: sidebar (desktop) + content ── */}
        <div className="relative z-10 flex gap-4">

          {/* ── Left Sidebar (desktop only) ── */}
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="w-64 flex-shrink-0 hidden lg:block"
          >
            <div className="sticky top-4 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden">
              <div className="h-[1.5px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="p-3 space-y-1">
                {NAV_GROUPS.map((group, gi) => (
                  <div key={gi} className={cn(gi > 0 && 'mt-3')}>
                    <div className="px-3 mb-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                        {group.label}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map(item => (
                        <NavItem
                          key={item.value}
                          item={item}
                          isActive={activeTab === item.value}
                          onClick={() => setActiveTab(item.value)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-emerald-500"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                  />
                  <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
                    Sistema Online
                  </span>
                </div>
              </div>
            </div>
          </motion.aside>

          {/* ── Content Area ── */}
          <motion.main
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 min-w-0"
          >
            <SectionHeader item={activeItem} />
            <SettingsContent active={activeTab} />
          </motion.main>
        </div>
      </div>
    </>
  );
}
