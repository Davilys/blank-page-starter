import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  User, Save, UserCheck, Flame, Tag, X, Plus,
  MessageSquare, Mail, Phone as PhoneIcon, Send,
  Loader2, Clock, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  cpf_cnpj: string | null;
  status: string;
  origin: string | null;
  estimated_value: number | null;
  notes: string | null;
  created_at: string;
  lead_score?: number | null;
  lead_temperature?: string | null;
  tags?: string[] | null;
  remarketing_count?: number | null;
}

interface LeadActivity {
  id: string;
  activity_type: string;
  content: string | null;
  created_at: string;
}

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

const STATUS_OPTIONS = [
  { value: 'novo', label: 'Novo' },
  { value: 'contato', label: 'Em Contato' },
  { value: 'qualificado', label: 'Qualificado' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'convertido', label: 'Convertido' },
  { value: 'perdido', label: 'Perdido' },
];

const ACTIVITY_ICONS: Record<string, typeof MessageSquare> = {
  nota: MessageSquare,
  email: Mail,
  ligacao: PhoneIcon,
  remarketing: Send,
  whatsapp: PhoneIcon,
};

export function LeadDetailSheet({ lead, open, onOpenChange, onRefresh }: LeadDetailSheetProps) {
  const [form, setForm] = useState<Partial<Lead>>({});
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (lead) {
      setForm({ ...lead });
      fetchActivities(lead.id);
    }
  }, [lead]);

  const fetchActivities = async (leadId: string) => {
    setLoadingActivities(true);
    try {
      const { data } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(50);
      setActivities((data as any[]) || []);
    } catch { /* ignore */ }
    finally { setLoadingActivities(false); }
  };

  const handleSave = async () => {
    if (!lead) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('leads').update({
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        company_name: form.company_name || null,
        cpf_cnpj: form.cpf_cnpj || null,
        status: form.status,
        origin: form.origin,
        estimated_value: form.estimated_value,
        notes: form.notes || null,
        lead_score: form.lead_score || 0,
        lead_temperature: form.lead_temperature || 'frio',
        tags: form.tags || [],
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id);
      if (error) throw error;
      toast.success('Lead atualizado!');
      onRefresh();
    } catch { toast.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const addNote = async () => {
    if (!lead || !newNote.trim()) return;
    setAddingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        admin_id: user?.id,
        activity_type: 'nota',
        content: newNote,
      } as any);
      if (error) throw error;
      setNewNote('');
      toast.success('Nota adicionada!');
      fetchActivities(lead.id);

      await supabase.from('leads').update({
        last_activity_at: new Date().toISOString(),
      }).eq('id', lead.id);
    } catch { toast.error('Erro ao adicionar nota'); }
    finally { setAddingNote(false); }
  };

  const addTag = () => {
    if (!newTag.trim()) return;
    const tags = [...(form.tags || [])];
    if (!tags.includes(newTag.trim())) {
      tags.push(newTag.trim());
      setForm(prev => ({ ...prev, tags }));
    }
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    setForm(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tag) }));
  };

  const handleConvert = async () => {
    if (!lead) return;
    setConverting(true);
    try {
      const { data: profile, error: pErr } = await supabase.from('profiles').insert({
        id: crypto.randomUUID(),
        email: lead.email || `lead_${lead.id}@temp.com`,
        full_name: lead.full_name,
        phone: lead.phone,
        company_name: lead.company_name,
        cpf_cnpj: lead.cpf_cnpj,
        origin: lead.origin,
        contract_value: lead.estimated_value,
      }).select().single();
      if (pErr) throw pErr;

      await supabase.from('leads').update({
        status: 'convertido',
        converted_at: new Date().toISOString(),
        converted_to_client_id: profile.id,
      }).eq('id', lead.id);

      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'nota',
        content: `Lead convertido em cliente: ${profile.full_name}`,
      } as any);

      toast.success('Lead convertido em cliente com sucesso!');
      onOpenChange(false);
      onRefresh();
    } catch { toast.error('Erro ao converter lead'); }
    finally { setConverting(false); }
  };

  const sendRemarketing = async () => {
    if (!lead?.email) {
      toast.error('Lead não possui e-mail cadastrado');
      return;
    }
    try {
      const { error } = await supabase.functions.invoke('send-lead-remarketing', {
        body: { lead_ids: [lead.id] },
      });
      if (error) throw error;
      toast.success('Remarketing enviado!');
      fetchActivities(lead.id);
    } catch { toast.error('Erro ao enviar remarketing'); }
  };

  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center text-white font-black">
              {lead.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-black">{lead.full_name}</p>
              <p className="text-xs text-muted-foreground">{lead.email || 'Sem e-mail'}</p>
            </div>
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="dados" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="atividades">Atividades</TabsTrigger>
            <TabsTrigger value="remarketing">Remarketing</TabsTrigger>
          </TabsList>

          {/* ── DADOS ── */}
          <TabsContent value="dados" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Nome</Label>
                <Input
                  value={form.full_name || ''}
                  onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                  className="h-9 text-sm rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">E-mail</Label>
                <Input
                  value={form.email || ''}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="h-9 text-sm rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Telefone</Label>
                <Input
                  value={form.phone || ''}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="h-9 text-sm rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Empresa</Label>
                <Input
                  value={form.company_name || ''}
                  onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))}
                  className="h-9 text-sm rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Status</Label>
                <Select value={form.status || 'novo'} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="h-9 text-sm rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Temperatura</Label>
                <Select value={form.lead_temperature || 'frio'} onValueChange={v => setForm(p => ({ ...p, lead_temperature: v }))}>
                  <SelectTrigger className="h-9 text-sm rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frio">❄️ Frio</SelectItem>
                    <SelectItem value="morno">🌡️ Morno</SelectItem>
                    <SelectItem value="quente">🔥 Quente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Score (0-100)</Label>
                <Input
                  type="number" min={0} max={100}
                  value={form.lead_score ?? 0}
                  onChange={e => setForm(p => ({ ...p, lead_score: parseInt(e.target.value) || 0 }))}
                  className="h-9 text-sm rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Valor Estimado</Label>
                <Input
                  type="number"
                  value={form.estimated_value ?? ''}
                  onChange={e => setForm(p => ({ ...p, estimated_value: parseFloat(e.target.value) || null }))}
                  className="h-9 text-sm rounded-xl"
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Tags</Label>
              <div className="flex flex-wrap gap-1.5">
                {(form.tags || []).map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                    {tag}
                    <button onClick={() => removeTag(tag)}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Nova tag..."
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="h-8 text-xs rounded-xl"
                />
                <Button size="sm" variant="outline" onClick={addTag} className="h-8 rounded-xl">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Observações</Label>
              <Textarea
                value={form.notes || ''}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={3}
                className="text-sm rounded-xl resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
              {form.status !== 'convertido' && (
                <Button
                  onClick={handleConvert}
                  disabled={converting}
                  variant="outline"
                  className="rounded-xl gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                >
                  {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                  Converter em Cliente
                </Button>
              )}
            </div>
          </TabsContent>

          {/* ── ATIVIDADES ── */}
          <TabsContent value="atividades" className="space-y-4 mt-4">
            {/* Add note */}
            <div className="flex gap-2">
              <Textarea
                placeholder="Adicionar nota..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                rows={2}
                className="text-sm rounded-xl resize-none"
              />
              <Button onClick={addNote} disabled={addingNote || !newNote.trim()} size="sm" className="rounded-xl self-end">
                {addingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            {/* Timeline */}
            {loadingActivities ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma atividade registrada
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map(act => {
                  const Icon = ACTIVITY_ICONS[act.activity_type] || FileText;
                  return (
                    <div key={act.id} className="flex gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground">{act.activity_type}</span>
                          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(act.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{act.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── REMARKETING ── */}
          <TabsContent value="remarketing" className="space-y-4 mt-4">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                <h4 className="text-sm font-bold">Remarketing Individual</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Envie um e-mail de remarketing para este lead.
                Remarketing enviados: <span className="font-bold text-foreground">{lead?.remarketing_count || 0}</span>
              </p>
              <Button
                onClick={sendRemarketing}
                disabled={!lead?.email}
                className="w-full rounded-xl gap-2"
              >
                <Send className="h-4 w-4" />
                Enviar Remarketing
              </Button>
              {!lead?.email && (
                <p className="text-[11px] text-destructive">Lead sem e-mail cadastrado</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
