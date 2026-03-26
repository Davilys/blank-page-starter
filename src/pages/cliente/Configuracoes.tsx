import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ClientLayout } from '@/components/cliente/ClientLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Building2, Loader2, Check, X, Shield, Bell,
  Camera, Eye, EyeOff, MapPin, Phone, Mail, CreditCard,
  Tag, Briefcase, ChevronRight, Save, AlertCircle, CheckCircle2,
  Settings, Globe, Palette, Key, Activity, Star
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  validateCPF, validateCNPJ, formatCPF, formatCNPJ,
  formatCEP, formatPhone, fetchAddressByCEP
} from '@/lib/validators';

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Profile {
  full_name: string;
  phone: string;
  cpf: string;
  cnpj: string;
  company_name: string;
  address: string;
  address_number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

interface BrandData {
  brand_name: string;
  business_area: string;
}

// ─── Partículas de fundo ─────────────────────────────────────────────────────
function Particles() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: (i * 137.5) % 100,
    y: (i * 73.1) % 100,
    size: (i % 3) + 1,
    delay: (i * 0.3) % 3,
    duration: 4 + (i % 4),
  }));
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-primary/10"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size * 3, height: p.size * 3 }}
          animate={{ y: [-10, 10, -10], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ─── Ícone de validação (extraído fora do componente para não causar erro de ref) ─
function ValidationIcon({ isValid }: { isValid: boolean | null }) {
  if (isValid === null) return null;
  return isValid
    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
    : <AlertCircle className="h-4 w-4 text-destructive" />;
}

// ─── Barra de progresso do perfil ────────────────────────────────────────────
function ProfileProgress({ profile, cpf, cnpj, brandData }: {
  profile: Profile; cpf: string; cnpj: string; brandData: BrandData;
}) {
  const fields = [
    { label: 'Nome', done: !!profile.full_name },
    { label: 'Telefone', done: !!profile.phone },
    { label: 'CPF', done: cpf.replace(/\D/g, '').length === 11 },
    { label: 'Endereço', done: !!profile.address },
    { label: 'Cidade', done: !!profile.city },
    { label: 'CEP', done: !!profile.zip_code },
    { label: 'Marca', done: !!brandData.brand_name },
    { label: 'Ramo', done: !!brandData.business_area },
  ];
  const done = fields.filter(f => f.done).length;
  const pct = Math.round((done / fields.length) * 100);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-6 shadow-lg">
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, hsl(var(--primary)) 0, hsl(var(--primary)) 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px' }} />
      <div className="relative flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Perfil Completo</h3>
          <p className="text-sm text-muted-foreground">{done} de {fields.length} campos preenchidos</p>
        </div>
        <div className="relative h-16 w-16">
          <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
            <motion.circle
              cx="32" cy="32" r="28" fill="none"
              stroke="hsl(var(--primary))" strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 28}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - pct / 100) }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-primary">
            {pct}%
          </span>
        </div>
      </div>
      <div className="relative grid grid-cols-4 gap-2">
        {fields.map((f) => (
          <div key={f.label} className={`flex items-center gap-1 text-xs rounded-lg px-2 py-1 ${f.done ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
            {f.done ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {f.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab lateral ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'pessoal', label: 'Dados Pessoais', icon: User },
  { id: 'endereco', label: 'Endereço', icon: MapPin },
  { id: 'marca', label: 'Dados da Marca', icon: Tag },
  { id: 'empresa', label: 'Empresa', icon: Building2 },
  { id: 'seguranca', label: 'Segurança', icon: Shield },
  { id: 'notificacoes', label: 'Notificações', icon: Bell },
];

// ─── Componente de campo premium ─────────────────────────────────────────────
function PremiumField({
  label, id, value, onChange, placeholder, type = 'text',
  disabled = false, maxLength, suffix, icon: Icon,
  validation,
}: {
  label: string; id: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  type?: string; disabled?: boolean; maxLength?: number;
  suffix?: React.ReactNode; icon?: React.ElementType;
  validation?: boolean | null;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className={`relative flex items-center rounded-xl border transition-all duration-200 bg-background
        ${focused ? 'border-primary ring-2 ring-primary/20 shadow-sm' : 'border-border'}
        ${disabled ? 'opacity-60' : ''}
        ${validation === false ? 'border-destructive ring-2 ring-destructive/20' : ''}
        ${validation === true ? 'border-green-500 ring-2 ring-green-500/20' : ''}
      `}>
        {Icon && (
          <div className="pl-3 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 bg-transparent px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none disabled:cursor-not-allowed"
        />
        {suffix && <div className="pr-3">{suffix}</div>}
      </div>
    </div>
  );
}

// ─── Card de seção ────────────────────────────────────────────────────────────
function SectionCard({ title, subtitle, icon: Icon, children, accentColor = 'primary' }: {
  title: string; subtitle: string; icon: React.ElementType;
  children: React.ReactNode; accentColor?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-blue-500 to-transparent" />
      <div className="p-6 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </motion.div>
  );
}

// ─── Toggle de notificação ────────────────────────────────────────────────────
function NotifToggle({ label, desc, value, onChange }: {
  label: string; desc: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none
          ${value ? 'bg-primary' : 'bg-muted'}`}
      >
        <motion.span
          className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
          animate={{ x: value ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function Configuracoes() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [activeTab, setActiveTab] = useState('pessoal');
  const [loading, setLoading] = useState(true);

  // Profile state
  const [profile, setProfile] = useState<Profile>({
    full_name: '', phone: '', cpf: '', cnpj: '', company_name: '',
    address: '', address_number: '', neighborhood: '', city: '', state: '', zip_code: '',
  });
  const [cpf, setCpf] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [brandData, setBrandData] = useState<BrandData>({ brand_name: '', business_area: '' });
  const [brandProcessId, setBrandProcessId] = useState<string | null>(null);
  const [validation, setValidation] = useState<{ cpf: boolean | null; cnpj: boolean | null }>({ cpf: null, cnpj: null });

  // Security state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState({
    email_updates: true,
    email_payment: true,
    email_contract: true,
    email_process: true,
    browser_push: false,
  });

  // Loading states
  const [saving, setSaving] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [loadingCEP, setLoadingCEP] = useState(false);

  // ── Auth ──
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) navigate('/cliente/login');
      else { setUser(session.user); fetchProfile(session.user.id); }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/cliente/login');
      else { setUser(session.user); fetchProfile(session.user.id); }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // ── Fetch ──
  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (data) {
      let addr = data.address || '';
      let addrNum = '';
      if (addr.includes(',')) {
        const parts = addr.split(',');
        addr = parts[0].trim();
        addrNum = parts.slice(1).join(',').trim();
      }
      setProfile({
        full_name: data.full_name || '',
        phone: data.phone ? formatPhone(data.phone) : '',
        cpf: data.cpf || '',
        cnpj: data.cnpj || '',
        company_name: data.company_name || '',
        address: addr,
        address_number: addrNum,
        neighborhood: data.neighborhood || '',
        city: data.city || '',
        state: data.state || '',
        zip_code: data.zip_code ? formatCEP(data.zip_code) : '',
      });
      const cpfVal = data.cpf || (data.cpf_cnpj?.replace(/\D/g, '').length === 11 ? data.cpf_cnpj : '');
      if (cpfVal) { setCpf(formatCPF(cpfVal)); setValidation(p => ({ ...p, cpf: validateCPF(cpfVal.replace(/\D/g, '')) })); }
      const cnpjVal = data.cnpj || '';
      if (cnpjVal) { setCnpj(formatCNPJ(cnpjVal)); setValidation(p => ({ ...p, cnpj: validateCNPJ(cnpjVal.replace(/\D/g, '')) })); }
      if (data.company_name) {
        let cn = data.company_name;
        if (cn.includes('| CNPJ:')) cn = cn.split('| CNPJ:')[0].trim();
        const parts = cn.split('|').map((s: string) => s.trim());
        setRazaoSocial(parts[0] || '');
        setNomeFantasia(parts[1] || '');
      }
    }
    const { data: proc } = await supabase.from('brand_processes').select('id,brand_name,business_area').eq('user_id', uid).limit(1).maybeSingle();
    if (proc) { setBrandProcessId(proc.id); setBrandData({ brand_name: proc.brand_name || '', business_area: proc.business_area || '' }); }
    setLoading(false);
  };

  // ── Handlers ──
  const handleCEPChange = useCallback(async (value: string) => {
    const fmt = formatCEP(value);
    setProfile(p => ({ ...p, zip_code: fmt }));
    const clean = value.replace(/\D/g, '');
    if (clean.length === 8) {
      setLoadingCEP(true);
      const addr = await fetchAddressByCEP(clean);
      setLoadingCEP(false);
      if (addr) {
        setProfile(p => ({ ...p, address: addr.logradouro, neighborhood: addr.bairro, city: addr.localidade, state: addr.uf }));
        toast.success('Endereço encontrado!');
      } else toast.error('CEP não encontrado');
    }
  }, []);

  const handleCPFChange = (v: string) => {
    const fmt = formatCPF(v);
    setCpf(fmt);
    const clean = v.replace(/\D/g, '');
    if (clean.length === 11) {
      const ok = validateCPF(clean);
      setValidation(p => ({ ...p, cpf: ok }));
      if (!ok) toast.error('CPF inválido');
    } else setValidation(p => ({ ...p, cpf: null }));
  };

  const handleCNPJChange = (v: string) => {
    const fmt = formatCNPJ(v);
    setCnpj(fmt);
    const clean = v.replace(/\D/g, '');
    if (clean.length === 14) {
      const ok = validateCNPJ(clean);
      setValidation(p => ({ ...p, cnpj: ok }));
      if (!ok) toast.error('CNPJ inválido');
    } else setValidation(p => ({ ...p, cnpj: null }));
  };

  const calcPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    setPasswordStrength(score);
  };

  const handlePasswordChange = (v: string) => {
    setNewPassword(v);
    calcPasswordStrength(v);
  };

  // ── Save handlers ──
  const handleSavePersonal = async () => {
    if (!user) return;
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF && cleanCPF.length !== 11) return toast.error('CPF deve ter 11 dígitos');
    if (cleanCPF && !validateCPF(cleanCPF)) return toast.error('CPF inválido');
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: profile.full_name,
      phone: profile.phone?.replace(/\D/g, '') || null,
      cpf: cleanCPF || null,
      cpf_cnpj: cleanCPF || null,
    }).eq('id', user.id);
    if (error) toast.error('Erro ao salvar dados pessoais');
    else toast.success('Dados pessoais salvos com sucesso! ✓');
    setSaving(false);
  };

  const handleSaveAddress = async () => {
    if (!user) return;
    setSavingAddress(true);
    const fullAddr = profile.address_number ? `${profile.address}, ${profile.address_number}` : profile.address;
    const { error } = await supabase.from('profiles').update({
      address: fullAddr,
      neighborhood: profile.neighborhood,
      city: profile.city,
      state: profile.state,
      zip_code: profile.zip_code?.replace(/\D/g, '') || null,
    }).eq('id', user.id);
    if (error) toast.error('Erro ao salvar endereço');
    else toast.success('Endereço salvo com sucesso! ✓');
    setSavingAddress(false);
  };

  const handleSaveBrand = async () => {
    if (!user) return;
    setSavingBrand(true);
    try {
      if (brandProcessId) {
        const { error } = await supabase.from('brand_processes').update({
          brand_name: brandData.brand_name || null,
          business_area: brandData.business_area || null,
        }).eq('id', brandProcessId);
        if (error) throw error;
      } else {
        const { data: np, error } = await supabase.from('brand_processes').insert({
          user_id: user.id,
          brand_name: brandData.brand_name || 'Marca não definida',
          business_area: brandData.business_area || null,
          status: 'em_andamento',
          pipeline_stage: 'protocolado',
        }).select('id').single();
        if (error) throw error;
        if (np) setBrandProcessId(np.id);
      }
      toast.success('Dados da marca salvos! ✓');
    } catch { toast.error('Erro ao salvar dados da marca'); }
    setSavingBrand(false);
  };

  const handleSaveCompany = async () => {
    if (!user) return;
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    if (cleanCNPJ && cleanCNPJ.length !== 14) return toast.error('CNPJ deve ter 14 dígitos');
    if (cleanCNPJ && !validateCNPJ(cleanCNPJ)) return toast.error('CNPJ inválido');
    setSavingCompany(true);
    let companyName = razaoSocial;
    if (nomeFantasia) companyName = `${razaoSocial} | ${nomeFantasia}`;
    const { error } = await supabase.from('profiles').update({
      company_name: companyName || null,
      cnpj: cleanCNPJ || null,
    }).eq('id', user.id);
    if (error) toast.error('Erro ao salvar dados da empresa');
    else toast.success('Dados da empresa salvos! ✓');
    setSavingCompany(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) return toast.error('Senha deve ter ao menos 8 caracteres');
    if (newPassword !== confirmPassword) return toast.error('As senhas não coincidem');
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error('Erro ao alterar senha');
    else { toast.success('Senha alterada com sucesso! ✓'); setNewPassword(''); setConfirmPassword(''); setPasswordStrength(0); }
    setChangingPassword(false);
  };

  const strengthColors = ['bg-muted', 'bg-destructive', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
  const strengthLabels = ['', 'Fraca', 'Regular', 'Boa', 'Forte'];

  if (loading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <Settings className="h-10 w-10 text-primary mx-auto" />
            </motion.div>
            <p className="text-muted-foreground text-sm">Carregando configurações...</p>
          </div>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="relative min-h-screen">
        <Particles />

        {/* ── Header ── */}
        <div className="relative z-10 mb-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <Settings className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações</h1>
                <p className="text-muted-foreground text-sm">Gerencie seu perfil e preferências</p>
              </div>
            </div>
          </motion.div>

          {/* Profile Progress */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <ProfileProgress profile={profile} cpf={cpf} cnpj={cnpj} brandData={brandData} />
          </motion.div>
        </div>

        {/* ── Layout: Tabs + Content ── */}
        <div className="relative z-10 flex gap-6">

          {/* Sidebar Tabs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="hidden md:flex flex-col gap-1 w-56 shrink-0"
          >
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="p-3 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">Seções</p>
              </div>
              {TABS.map((tab, i) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * i }}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-sm transition-all duration-200
                      ${active
                        ? 'bg-primary/10 text-primary font-semibold border-r-2 border-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`h-4 w-4 ${active ? 'text-primary' : ''}`} />
                      {tab.label}
                    </div>
                    {active && <ChevronRight className="h-3 w-3 text-primary" />}
                  </motion.button>
                );
              })}
            </div>

            {/* User card */}
            <div className="rounded-2xl border border-border bg-card shadow-sm p-4 mt-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                  {(profile.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{profile.full_name || 'Usuário'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <Activity className="h-3 w-3" />
                <span>Conta ativa</span>
              </div>
            </div>
          </motion.div>

          {/* Mobile tab pills */}
          <div className="md:hidden flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all
                    ${activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground'}`}
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">

              {/* ── Dados Pessoais ── */}
              {activeTab === 'pessoal' && (
                <SectionCard key="pessoal" title="Dados Pessoais" subtitle="Suas informações de identificação" icon={User}>
                  <div className="grid gap-5 md:grid-cols-2">
                    <PremiumField
                      label="Nome Completo" id="full_name"
                      value={profile.full_name}
                      onChange={v => setProfile(p => ({ ...p, full_name: v }))}
                      placeholder="Seu nome completo"
                      icon={User}
                    />
                    <PremiumField
                      label="E-mail" id="email"
                      value={user?.email || ''}
                      onChange={() => {}}
                      disabled
                      icon={Mail}
                    />
                    <PremiumField
                      label="Telefone / WhatsApp" id="phone"
                      value={profile.phone}
                      onChange={v => setProfile(p => ({ ...p, phone: formatPhone(v) }))}
                      placeholder="(11) 99999-9999"
                      maxLength={15}
                      icon={Phone}
                    />
                    <PremiumField
                      label="CPF" id="cpf"
                      value={cpf}
                      onChange={handleCPFChange}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      icon={CreditCard}
                      validation={validation.cpf}
                      suffix={<ValidationIcon isValid={validation.cpf} />}
                    />
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={handleSavePersonal}
                      disabled={saving}
                      className="gap-2 rounded-xl px-6"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {saving ? 'Salvando...' : 'Salvar Dados Pessoais'}
                    </Button>
                  </div>
                </SectionCard>
              )}

              {/* ── Endereço ── */}
              {activeTab === 'endereco' && (
                <SectionCard key="endereco" title="Endereço" subtitle="Localização para correspondência e documentos" icon={MapPin}>
                  <div className="grid gap-5 md:grid-cols-2">
                    <PremiumField
                      label="CEP" id="cep"
                      value={profile.zip_code}
                      onChange={handleCEPChange}
                      placeholder="00000-000"
                      maxLength={9}
                      icon={MapPin}
                      suffix={loadingCEP ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : undefined}
                    />
                    <PremiumField
                      label="Logradouro (Rua/Avenida)" id="address"
                      value={profile.address}
                      onChange={v => setProfile(p => ({ ...p, address: v }))}
                      placeholder="Rua, Avenida..."
                      icon={MapPin}
                    />
                    <PremiumField
                      label="Número" id="number"
                      value={profile.address_number}
                      onChange={v => setProfile(p => ({ ...p, address_number: v }))}
                      placeholder="123"
                    />
                    <PremiumField
                      label="Bairro" id="neighborhood"
                      value={profile.neighborhood}
                      onChange={v => setProfile(p => ({ ...p, neighborhood: v }))}
                      placeholder="Bairro"
                    />
                    <PremiumField
                      label="Cidade" id="city"
                      value={profile.city}
                      onChange={v => setProfile(p => ({ ...p, city: v }))}
                      placeholder="Cidade"
                      icon={Globe}
                    />
                    <PremiumField
                      label="Estado (UF)" id="state"
                      value={profile.state}
                      onChange={v => setProfile(p => ({ ...p, state: v }))}
                      placeholder="SP"
                      maxLength={2}
                    />
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={handleSaveAddress} disabled={savingAddress} className="gap-2 rounded-xl px-6">
                      {savingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {savingAddress ? 'Salvando...' : 'Salvar Endereço'}
                    </Button>
                  </div>
                </SectionCard>
              )}

              {/* ── Dados da Marca ── */}
              {activeTab === 'marca' && (
                <SectionCard key="marca" title="Dados da Marca" subtitle="Informações sobre a marca que está sendo registrada" icon={Tag}>
                  <div className="grid gap-5 md:grid-cols-2">
                    <PremiumField
                      label="Nome da Marca" id="brand_name"
                      value={brandData.brand_name}
                      onChange={v => setBrandData(p => ({ ...p, brand_name: v }))}
                      placeholder="Nome da marca a ser registrada"
                      icon={Tag}
                    />
                    <PremiumField
                      label="Ramo de Atividade" id="business_area"
                      value={brandData.business_area}
                      onChange={v => setBrandData(p => ({ ...p, business_area: v }))}
                      placeholder="Ex: Alimentação, Tecnologia..."
                      icon={Briefcase}
                    />
                  </div>

                  {/* Preview card */}
                  {brandData.brand_name && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-5 p-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
                          {brandData.brand_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{brandData.brand_name}</p>
                          <p className="text-xs text-muted-foreground">{brandData.business_area || 'Ramo não definido'}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Em processo de registro</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <Button onClick={handleSaveBrand} disabled={savingBrand} className="gap-2 rounded-xl px-6">
                      {savingBrand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {savingBrand ? 'Salvando...' : 'Salvar Dados da Marca'}
                    </Button>
                  </div>
                </SectionCard>
              )}

              {/* ── Empresa ── */}
              {activeTab === 'empresa' && (
                <SectionCard key="empresa" title="Dados da Empresa" subtitle="Preencha se for pessoa jurídica (opcional)" icon={Building2}>
                  <div className="grid gap-5 md:grid-cols-2">
                    <PremiumField
                      label="Razão Social" id="razao"
                      value={razaoSocial}
                      onChange={setRazaoSocial}
                      placeholder="Razão Social da empresa"
                      icon={Building2}
                    />
                    <PremiumField
                      label="CNPJ" id="cnpj"
                      value={cnpj}
                      onChange={handleCNPJChange}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      validation={validation.cnpj}
                      suffix={<ValidationIcon isValid={validation.cnpj} />}
                      icon={CreditCard}
                    />
                    <div className="md:col-span-2">
                      <PremiumField
                        label="Nome Fantasia" id="fantasia"
                        value={nomeFantasia}
                        onChange={setNomeFantasia}
                        placeholder="Nome Fantasia (opcional)"
                        icon={Briefcase}
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button onClick={handleSaveCompany} disabled={savingCompany} className="gap-2 rounded-xl px-6">
                      {savingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {savingCompany ? 'Salvando...' : 'Salvar Dados da Empresa'}
                    </Button>
                  </div>
                </SectionCard>
              )}

              {/* ── Segurança ── */}
              {activeTab === 'seguranca' && (
                <SectionCard key="seguranca" title="Segurança" subtitle="Proteja o acesso à sua conta" icon={Shield}>
                  <div className="space-y-6">
                    {/* Account info */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Último acesso', value: 'Agora', icon: Activity },
                        { label: 'Status da conta', value: 'Ativa', icon: CheckCircle2 },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
                          <item.icon className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <p className="text-sm font-semibold text-foreground">{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Password change */}
                    <div className="space-y-4 pt-2 border-t border-border/50">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Key className="h-4 w-4 text-primary" />
                        Alterar Senha
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nova Senha</Label>
                          <div className={`relative flex items-center rounded-xl border transition-all duration-200 bg-background border-border`}>
                            <div className="pl-3 text-muted-foreground"><Lock className="h-4 w-4" /></div>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={e => handlePasswordChange(e.target.value)}
                              placeholder="••••••••"
                              className="flex-1 bg-transparent px-3 py-3 text-sm outline-none text-foreground placeholder:text-muted-foreground/60"
                            />
                            <button type="button" onClick={() => setShowPassword(p => !p)} className="pr-3 text-muted-foreground hover:text-foreground">
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {/* Strength meter */}
                          {newPassword && (
                            <div className="space-y-1">
                              <div className="flex gap-1">
                                {[1, 2, 3, 4].map(i => (
                                  <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= passwordStrength ? strengthColors[passwordStrength] : 'bg-muted'}`} />
                                ))}
                              </div>
                              <p className={`text-xs font-medium ${passwordStrength <= 1 ? 'text-destructive' : passwordStrength <= 2 ? 'text-yellow-500' : passwordStrength <= 3 ? 'text-blue-500' : 'text-green-500'}`}>
                                Força: {strengthLabels[passwordStrength]}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirmar Senha</Label>
                          <div className={`relative flex items-center rounded-xl border transition-all duration-200 bg-background
                            ${confirmPassword && confirmPassword !== newPassword ? 'border-destructive ring-2 ring-destructive/20' : 'border-border'}
                            ${confirmPassword && confirmPassword === newPassword ? 'border-green-500 ring-2 ring-green-500/20' : ''}
                          `}>
                            <div className="pl-3 text-muted-foreground"><Lock className="h-4 w-4" /></div>
                            <input
                              type={showConfirm ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={e => setConfirmPassword(e.target.value)}
                              placeholder="••••••••"
                              className="flex-1 bg-transparent px-3 py-3 text-sm outline-none text-foreground placeholder:text-muted-foreground/60"
                            />
                            <button type="button" onClick={() => setShowConfirm(p => !p)} className="pr-3 text-muted-foreground hover:text-foreground">
                              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {confirmPassword && (
                            <p className={`text-xs font-medium ${confirmPassword === newPassword ? 'text-green-500' : 'text-destructive'}`}>
                              {confirmPassword === newPassword ? '✓ Senhas coincidem' : '✗ Senhas não coincidem'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          onClick={handleChangePassword}
                          disabled={changingPassword || !newPassword || !confirmPassword}
                          className="gap-2 rounded-xl px-6"
                        >
                          {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                          {changingPassword ? 'Alterando...' : 'Alterar Senha'}
                        </Button>
                      </div>
                    </div>

                    {/* Security tips */}
                    <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Dicas de segurança
                      </p>
                      <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                        <li>• Use ao menos 8 caracteres com letras, números e símbolos</li>
                        <li>• Não reutilize senhas de outras plataformas</li>
                        <li>• Nunca compartilhe suas credenciais de acesso</li>
                      </ul>
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* ── Notificações ── */}
              {activeTab === 'notificacoes' && (
                <SectionCard key="notificacoes" title="Preferências de Notificação" subtitle="Escolha como e quando deseja ser notificado" icon={Bell}>
                  <div className="space-y-1">
                    <NotifToggle
                      label="Atualizações do processo"
                      desc="Receba e-mails sobre o andamento do registro da sua marca"
                      value={notifPrefs.email_process}
                      onChange={v => setNotifPrefs(p => ({ ...p, email_process: v }))}
                    />
                    <NotifToggle
                      label="Avisos de pagamento"
                      desc="Boletos, vencimentos e confirmações de pagamento"
                      value={notifPrefs.email_payment}
                      onChange={v => setNotifPrefs(p => ({ ...p, email_payment: v }))}
                    />
                    <NotifToggle
                      label="Contratos e documentos"
                      desc="Solicitações de assinatura e novos documentos disponíveis"
                      value={notifPrefs.email_contract}
                      onChange={v => setNotifPrefs(p => ({ ...p, email_contract: v }))}
                    />
                    <NotifToggle
                      label="Novidades e promoções"
                      desc="Informações sobre novos serviços e ofertas exclusivas"
                      value={notifPrefs.email_updates}
                      onChange={v => setNotifPrefs(p => ({ ...p, email_updates: v }))}
                    />
                    <NotifToggle
                      label="Notificações no navegador"
                      desc="Alertas em tempo real quando estiver navegando no site"
                      value={notifPrefs.browser_push}
                      onChange={v => setNotifPrefs(p => ({ ...p, browser_push: v }))}
                    />
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={() => toast.success('Preferências de notificação salvas! ✓')}
                      className="gap-2 rounded-xl px-6"
                    >
                      <Save className="h-4 w-4" />
                      Salvar Preferências
                    </Button>
                  </div>
                </SectionCard>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}
