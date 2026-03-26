import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, FileText, Users, Search, RefreshCw, CheckCircle, AlertCircle,
  Calendar, Loader2, BookOpen, Filter, Download, Eye, ArrowRight, Clock,
  Building2, Cloud, CloudDownload, Globe, Sparkles, Zap, UserPlus,
  AlertTriangle, BarChart3, TrendingUp, Shield, Activity, Newspaper,
  ExternalLink, Hash, Layers, Radio, Database, Wifi, Pencil, Save, X,
} from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calcAutoFields } from '@/components/admin/publicacao/helpers';
// PublicacaoTab moved to its own page at /admin/publicacao

// ─── Types ───────────────────────────────────────────────────────────
interface RpiUpload {
  id: string;
  file_name: string;
  file_path: string;
  rpi_date: string | null;
  rpi_number: string | null;
  total_processes_found: number;
  total_clients_matched: number;
  status: string;
  summary: string | null;
  processed_at: string | null;
  created_at: string;
}

interface RpiEntry {
  id: string;
  process_number: string;
  brand_name: string | null;
  ncl_classes: string[] | null;
  dispatch_type: string | null;
  dispatch_code: string | null;
  dispatch_text: string | null;
  publication_date: string | null;
  holder_name: string | null;
  matched_client_id: string | null;
  matched_process_id: string | null;
  update_status: string;
  tag: string | null;
  deadline_date?: string | null;
  priority?: 'urgent' | 'medium' | null;
  client?: { full_name: string | null; email: string; company_name: string | null };
  process?: { pipeline_stage: string | null; status: string | null };
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  company_name: string | null;
  cpf_cnpj: string | null;
  phone: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────
const DISPATCH_TYPE_OPTIONS = [
  { value: '003', label: '003' },
  { value: 'oposicao', label: 'Oposição' },
  { value: 'exigencia_merito', label: 'Exigência de Mérito' },
  { value: 'indeferimento', label: 'Indeferimento' },
  { value: 'deferimento', label: 'Deferimento' },
  { value: 'certificado', label: 'Certificado' },
  { value: 'renovacao', label: 'Renovação' },
  { value: 'arquivado', label: 'Arquivado' },
];

const TAG_OPTIONS = [
  { value: 'pending', label: 'Aguardando', color: 'bg-muted text-muted-foreground' },
  { value: 'em_contato', label: 'Em contato', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { value: 'resolvido', label: 'Resolvido', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { value: 'nao_responde', label: 'Não responde', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { value: 'arquivado', label: 'Arquivado', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  { value: 'prazo_encerrado', label: 'Prazo encerrado', color: 'bg-red-500/10 text-red-600 dark:text-red-400' },
];

const PIPELINE_STAGES = [
  { value: 'protocolado', label: 'Protocolado' },
  { value: '003', label: '003' },
  { value: 'oposicao', label: 'Oposição' },
  { value: 'exigencia_merito', label: 'Exigência de Mérito' },
  { value: 'indeferimento', label: 'Indeferimento' },
  { value: 'notificacao_extrajudicial', label: 'Notificação Extrajudicial' },
  { value: 'deferimento', label: 'Deferimento' },
  { value: 'certificado', label: 'Certificado' },
  { value: 'renovacao', label: 'Renovação' },
  { value: 'arquivado', label: 'Arquivado' },
  { value: 'distrato', label: 'Distrato' },
];

// Map pipeline stages to publicacao status
const PIPELINE_TO_PUB_STATUS: Record<string, string> = {
  protocolado: '003',
  '003': '003',
  oposicao: 'oposicao',
  exigencia_merito: 'exigencia_merito',
  indeferimento: 'indeferimento',
  notificacao_extrajudicial: '003',
  deferimento: 'deferimento',
  certificado: 'certificado',
  certificados: 'certificado',
  renovacao: 'renovacao',
  arquivado: 'arquivado',
  distrato: 'arquivado',
};

// Map publicacao/dispatch status to pipeline stage (reverse)
const PUB_STATUS_TO_PIPELINE: Record<string, string> = {
  '003': '003',
  oposicao: 'oposicao',
  exigencia_merito: 'exigencia_merito',
  indeferimento: 'indeferimento',
  deferimento: 'deferimento',
  certificado: 'certificados',
  renovacao: 'renovacao',
  arquivado: 'distrato',
};

function getDispatchBadge(dispatchType: string | null) {
  const type = (dispatchType || '').toLowerCase();
  // IMPORTANT: Check "indeferimento" BEFORE "deferimento" to avoid false match
  if (type.includes('indeferido') || type.includes('indeferimento'))
    return <Badge className="bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400">✗ Indeferimento</Badge>;
  if (type.includes('deferido') || type.includes('deferimento'))
    return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400">✓ Deferimento</Badge>;
  if (type.includes('exigência') || type.includes('exigencia'))
    return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400">⚡ Exigência</Badge>;
  if (type.includes('oposição') || type.includes('oposicao'))
    return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400">⚔ Oposição</Badge>;
  if (type.includes('certificado'))
    return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400">📜 Certificado</Badge>;
  if (type.includes('renovação') || type.includes('renovacao'))
    return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400">🔄 Renovação</Badge>;
  if (type.includes('arquivado'))
    return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20 dark:text-gray-400">📁 Arquivado</Badge>;
  if (type.includes('003'))
    return <Badge className="bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400">003</Badge>;
  return <Badge variant="outline">{dispatchType || 'Outro'}</Badge>;
}

function suggestStage(dispatchCode: string | null, dispatchText: string | null): string {
  const text = (dispatchText || '').toLowerCase();
  if (text.includes('deferido') || text.includes('deferimento')) return 'deferimento';
  if (text.includes('indeferido') || text.includes('indeferimento')) return 'indeferimento';
  if (text.includes('exigência') || text.includes('exigencia')) return '003';
  if (text.includes('oposição') || text.includes('oposicao')) return 'oposicao';
  if (text.includes('certificado') || text.includes('concessão')) return 'certificados';
  if (text.includes('renovação') || text.includes('prorrogação')) return 'renovacao';
  return 'protocolado';
}

// ─── Animated stat card ──────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, gradient, delay = 0 }: { 
  icon: typeof FileText; label: string; value: string | number; gradient: string; delay?: number; 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <Card className={`relative overflow-hidden border-0 shadow-lg ${gradient}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
        <CardContent className="relative pt-6 pb-5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-white/80 font-medium">{label}</p>
              <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Detail row for expanded cards ──────────────────────────────────
function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{label}</span>
      <span className={`text-sm font-medium text-foreground truncate text-right ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

// Helper: resolve brand_process id from matched_process_id or by client_id
async function resolveBrandProcessId(
  matchedProcessId: string | null | undefined,
  clientId: string | null | undefined,
  processNumber?: string | null
): Promise<string | null> {
  if (matchedProcessId) return matchedProcessId;
  if (!clientId) return null;
  // Try to find by process_number first
  if (processNumber) {
    const { data } = await supabase.from('brand_processes')
      .select('id')
      .eq('process_number', processNumber)
      .maybeSingle();
    if (data) return data.id;
  }
  // Fallback: find by user_id (client_id) — pick the first one
  const { data } = await supabase.from('brand_processes')
    .select('id')
    .eq('user_id', clientId)
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

// ─── Main Component ──────────────────────────────────────────────────
export default function RevistaINPI() {
  const [uploads, setUploads] = useState<RpiUpload[]>([]);
  const [entries, setEntries] = useState<RpiEntry[]>([]);
  const [selectedUpload, setSelectedUpload] = useState<RpiUpload | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMatched, setFilterMatched] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [fetchingRemote, setFetchingRemote] = useState(false);
  const [recentRpis, setRecentRpis] = useState<number[]>([]);
  const [rpWithXml, setRpWithXml] = useState<number[]>([]);
  const [latestRpi, setLatestRpi] = useState<number | null>(null);
  const [selectedRpiNumber, setSelectedRpiNumber] = useState<string>('');
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RpiEntry | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [newStage, setNewStage] = useState('');
  const [updating, setUpdating] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignEntry, setAssignEntry] = useState<RpiEntry | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [availableClients, setAvailableClients] = useState<Profile[]>([]);
  const [selectedClient, setSelectedClient] = useState<Profile | null>(null);
  const [assignPriority, setAssignPriority] = useState<'urgent' | 'medium'>('medium');
  const [assigning, setAssigning] = useState(false);
  const [updatingTag, setUpdatingTag] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('fetch');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ brand_name: '', process_number: '', ncl_classes: '', holder_name: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [updatingDispatchType, setUpdatingDispatchType] = useState<string | null>(null);

  const handleDispatchTypeChange = async (entry: RpiEntry, newType: string) => {
    setUpdatingDispatchType(entry.id);
    try {
      // Update dispatch_type on rpi_entries
      const { error: entryError } = await supabase.from('rpi_entries').update({
        dispatch_type: DISPATCH_TYPE_OPTIONS.find(o => o.value === newType)?.label || newType,
        updated_at: new Date().toISOString(),
      }).eq('id', entry.id);
      if (entryError) throw entryError;

      // Update or create publicacao in publicacoes_marcas with the new status
      const { data: existingPub } = await supabase.from('publicacoes_marcas')
        .select('id')
        .eq('rpi_entry_id', entry.id)
        .maybeSingle();

      // Calculate deadlines based on new dispatch type
      const autoFields = calcAutoFields({
        data_publicacao_rpi: entry.publication_date || null,
        status: newType as any,
      }, DISPATCH_TYPE_OPTIONS.find(o => o.value === newType)?.label || newType);

      // Get rpi_number from selectedUpload
      const currentRpiNumber = selectedUpload?.rpi_number || null;

      if (existingPub) {
        const { error: pubError } = await supabase.from('publicacoes_marcas').update({
          status: newType,
          data_publicacao_rpi: entry.publication_date || null,
          rpi_number: currentRpiNumber,
          proximo_prazo_critico: autoFields.proximo_prazo_critico || null,
          descricao_prazo: autoFields.descricao_prazo || null,
          updated_at: new Date().toISOString(),
        }).eq('id', existingPub.id);
        if (pubError) throw pubError;
      } else {
        // Create new publicacao linked to this RPI entry
        const { error: insertError } = await supabase.from('publicacoes_marcas').insert({
          status: newType,
          tipo_publicacao: 'publicacao_rpi',
          rpi_entry_id: entry.id,
          process_id: entry.matched_process_id || null,
          client_id: entry.matched_client_id || null,
          brand_name_rpi: entry.brand_name || null,
          process_number_rpi: entry.process_number || null,
          data_publicacao_rpi: entry.publication_date || null,
          rpi_number: currentRpiNumber,
          proximo_prazo_critico: autoFields.proximo_prazo_critico || null,
          descricao_prazo: autoFields.descricao_prazo || null,
        });
        if (insertError) throw insertError;
      }

      // [SYNC] Also update brand_processes.pipeline_stage — resolve process by client if needed
      const resolvedProcessId = await resolveBrandProcessId(entry.matched_process_id, entry.matched_client_id, entry.process_number);
      if (resolvedProcessId) {
        const pipelineStage = PUB_STATUS_TO_PIPELINE[newType] || newType;
        const { error: procError } = await supabase.from('brand_processes').update({
          pipeline_stage: pipelineStage,
          updated_at: new Date().toISOString(),
        }).eq('id', resolvedProcessId);
        if (procError) console.error('Error syncing pipeline_stage:', procError);

        // Also link the process_id on publicacoes_marcas if not set
        if (existingPub) {
          await supabase.from('publicacoes_marcas').update({ process_id: resolvedProcessId }).eq('id', existingPub.id);
        }

        // Save matched_process_id on rpi_entry for future lookups
        if (!entry.matched_process_id) {
          await supabase.from('rpi_entries').update({ matched_process_id: resolvedProcessId }).eq('id', entry.id);
        }
      }

      // Update local state
      setEntries(prev => prev.map(e => e.id === entry.id ? {
        ...e,
        dispatch_type: DISPATCH_TYPE_OPTIONS.find(o => o.value === newType)?.label || newType,
        matched_process_id: resolvedProcessId || e.matched_process_id,
      } : e));

      toast.success(`Tipo alterado para "${DISPATCH_TYPE_OPTIONS.find(o => o.value === newType)?.label}" — Publicações e Jurídico sincronizados!`);
    } catch (err) {
      console.error('Error updating dispatch type:', err);
      toast.error('Erro ao atualizar tipo do despacho');
    } finally {
      setUpdatingDispatchType(null);
    }
  };

  useEffect(() => {
    fetchUploads();
    fetchAvailableRpis();
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedUpload) fetchEntries(selectedUpload.id);
  }, [selectedUpload]);

  // ─── Data fetching (unchanged logic) ──────────────────────────────
  const fetchClients = async () => {
    const allClients: Profile[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase.from('profiles').select('id, full_name, email, company_name, cpf_cnpj, phone').order('full_name').range(from, from + pageSize - 1);
      if (error) { console.error('Error fetching clients:', error); break; }
      if (!data || data.length === 0) break;
      allClients.push(...(data as Profile[]));
      if (data.length < pageSize) break;
      from += pageSize;
    }
    setAvailableClients(allClients);
  };

  const fetchAvailableRpis = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-inpi-magazine`, {
        method: 'POST',
        body: JSON.stringify({ mode: 'list' }),
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        setRecentRpis(data.recentRpis || []);
        setRpWithXml(data.rpWithXml || []);
        setLatestRpi(data.latestRpi);
        const defaultRpi = data.rpWithXml?.[0] || data.latestRpi;
        setSelectedRpiNumber(defaultRpi?.toString() || '');
      }
    } catch (error) { console.error('Error fetching RPI list:', error); }
  };

  const fetchUploads = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('rpi_uploads').select('*').order('created_at', { ascending: false });
    if (error) { toast.error('Erro ao carregar uploads'); console.error(error); }
    else {
      setUploads(data || []);
      if (data && data.length > 0 && !selectedUpload) setSelectedUpload(data[0]);
    }
    setLoading(false);
  };

  const fetchEntries = async (uploadId: string) => {
    const { data, error } = await supabase.from('rpi_entries').select('*').eq('rpi_upload_id', uploadId).order('created_at', { ascending: false });
    if (error) { toast.error('Erro ao carregar entradas'); return; }
    const entriesWithDetails = await Promise.all(
      (data || []).map(async (entry) => {
        let client = null, process = null;
        if (entry.matched_client_id) {
          const { data: p } = await supabase.from('profiles').select('full_name, email, company_name').eq('id', entry.matched_client_id).single();
          client = p;
        }
        if (entry.matched_process_id) {
          const { data: pr } = await supabase.from('brand_processes').select('pipeline_stage, status').eq('id', entry.matched_process_id).single();
          process = pr;
        }
        return { ...entry, client, process };
      })
    );
    setEntries(entriesWithDetails);
  };

  const handleRemoteFetch = async (rpiNumber?: number) => {
    setFetchingRemote(true);
    try {
      const targetRpi = rpiNumber || parseInt(selectedRpiNumber) || latestRpi;
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-inpi-magazine`, {
        method: 'POST',
        body: JSON.stringify({ rpiNumber: targetRpi }),
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.error === 'XML_NOT_AVAILABLE' || result.error === 'XML_NOT_YET_AVAILABLE') {
          toast.info(result.message, { duration: 8000 });
          if (result.latestWithXml) { setSelectedRpiNumber(result.latestWithXml.toString()); toast.info(`Sugerimos buscar a RPI ${result.latestWithXml} que possui XML disponível.`, { duration: 5000 }); }
        } else { toast.error(result.message || 'Erro ao buscar RPI'); }
        return;
      }
      if (result.totalProcesses === 0) { toast.info(result.message, { duration: 6000 }); }
      else { toast.success(`RPI ${result.rpiNumber} processada! ${result.totalProcesses} processos encontrados, ${result.matchedClients} clientes identificados.`); }
      await fetchUploads();
      if (result.uploadId) {
        const { data: newUpload } = await supabase.from('rpi_uploads').select('*').eq('id', result.uploadId).single();
        if (newUpload) { setSelectedUpload(newUpload); await fetchEntries(newUpload.id); }
      }
    } catch (error) { console.error('Remote fetch error:', error); toast.error('Erro ao buscar RPI do portal INPI'); }
    finally { setFetchingRemote(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'xml', 'xlsx', 'xls'].includes(ext)) { toast.error('Envie um arquivo .pdf, .xml, .xlsx ou .xls'); return; }
    setUploading(true);
    try {
      const fileName = `rpi_${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('documents').upload(`rpi/${fileName}`, file);
      if (uploadError) throw uploadError;
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage.from('documents').createSignedUrl(uploadData.path, 3600);
      if (signedUrlError) throw signedUrlError;
      const { data: rpiUpload, error: insertError } = await supabase.from('rpi_uploads').insert({ file_name: file.name, file_path: uploadData.path, status: 'pending' }).select().single();
      if (insertError) throw insertError;
      toast.success('Arquivo enviado! Iniciando análise...');
      setSelectedUpload(rpiUpload);
      setUploads(prev => [rpiUpload, ...prev]);
      await processRpi(rpiUpload.id, signedUrlData.signedUrl);
    } catch (error) { console.error('Upload error:', error); toast.error('Erro ao enviar arquivo'); }
    finally { setUploading(false); }
  };

  const processRpi = async (rpiUploadId: string, fileUrl: string) => {
    setProcessing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-rpi`, {
        method: 'POST',
        body: JSON.stringify({ rpiUploadId, fileUrl }),
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
      });
      if (response.status === 429) { toast.error('Limite de requisições excedido.'); await fetchUploads(); return; }
      if (response.status === 402) { toast.error('Créditos de IA esgotados.'); await fetchUploads(); return; }
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Erro ao processar arquivo'); }
      const result = await response.json();
      if (result.total_processes === 0) { toast.info(result.summary || 'Nenhum processo encontrado.', { duration: 6000 }); }
      else { toast.success(`Análise concluída! ${result.total_processes} processos encontrados, ${result.matched_clients} clientes identificados.`); }
      const { data: updatedUploads } = await supabase.from('rpi_uploads').select('*').order('created_at', { ascending: false });
      if (updatedUploads) {
        setUploads(updatedUploads);
        const processedUpload = updatedUploads.find(u => u.id === rpiUploadId);
        if (processedUpload) { setSelectedUpload(processedUpload); await fetchEntries(rpiUploadId); }
      }
    } catch (error) {
      console.error('Process error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar revista.');
      await supabase.from('rpi_uploads').update({ status: 'error' }).eq('id', rpiUploadId);
      await fetchUploads();
    } finally { setProcessing(false); }
  };

  const handleOpenUpdateDialog = (entry: RpiEntry, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedEntry(entry);
    setNewStage(suggestStage(entry.dispatch_code, entry.dispatch_text));
    setUpdateDialogOpen(true);
  };

  const handleUpdateProcess = async () => {
    if (!selectedEntry || !newStage) return;
    setUpdating(true);
    try {
      // [AUTO-SAVE] If user was editing process data and ALL fields are filled, save automatically
      const isEditingThisEntry = editingEntryId === selectedEntry.id;
      if (isEditingThisEntry) {
        const allFieldsFilled = editForm.brand_name.trim() && editForm.process_number.trim() && editForm.ncl_classes.trim() && editForm.holder_name.trim();
        if (allFieldsFilled) {
          const nclArray = editForm.ncl_classes.split(',').map(s => s.trim()).filter(Boolean);
          await supabase.from('rpi_entries').update({
            brand_name: editForm.brand_name || null,
            process_number: editForm.process_number,
            ncl_classes: nclArray.length > 0 ? nclArray : null,
            holder_name: editForm.holder_name || null,
            updated_at: new Date().toISOString(),
          }).eq('id', selectedEntry.id);

          // Sync to publicacoes_marcas (with client_id + data_publicacao_rpi)
          const resolvedProcId = await resolveBrandProcessId(selectedEntry.matched_process_id, selectedEntry.matched_client_id, editForm.process_number);
          const currentRpiNum = selectedUpload?.rpi_number || null;

          const { data: linkedPubEdit } = await supabase.from('publicacoes_marcas')
            .select('id').eq('rpi_entry_id', selectedEntry.id).maybeSingle();
          if (linkedPubEdit) {
            await supabase.from('publicacoes_marcas').update({
              brand_name_rpi: editForm.brand_name || null,
              process_number_rpi: editForm.process_number || null,
              client_id: selectedEntry.matched_client_id || null,
              data_publicacao_rpi: selectedEntry.publication_date || null,
              process_id: resolvedProcId || null,
              rpi_number: currentRpiNum,
              updated_at: new Date().toISOString(),
            }).eq('id', linkedPubEdit.id);
          }

          // Sync to brand_processes using resolveBrandProcessId
          if (resolvedProcId) {
            const currentDispatchAuto = (selectedEntry.dispatch_type || '').toLowerCase();
            const matchedDispatchAuto = DISPATCH_TYPE_OPTIONS.find(o => o.label.toLowerCase() === currentDispatchAuto || o.value === currentDispatchAuto);
            const dispatchValAuto = matchedDispatchAuto?.value || null;
            const pipelineStageAuto = dispatchValAuto ? (PUB_STATUS_TO_PIPELINE[dispatchValAuto] || dispatchValAuto) : null;

            const bpUpdateAuto: Record<string, any> = {
              brand_name: editForm.brand_name,
              process_number: editForm.process_number,
              ncl_classes: nclArray.map(Number).filter(n => !isNaN(n)),
              updated_at: new Date().toISOString(),
            };
            if (pipelineStageAuto) bpUpdateAuto.pipeline_stage = pipelineStageAuto;
            await supabase.from('brand_processes').update(bpUpdateAuto).eq('id', resolvedProcId);

            // Store matched_process_id on rpi_entry
            if (!selectedEntry.matched_process_id) {
              await supabase.from('rpi_entries').update({ matched_process_id: resolvedProcId }).eq('id', selectedEntry.id);
            }
          }

          // Update selectedEntry reference for the rest of the function
          selectedEntry.brand_name = editForm.brand_name;
          selectedEntry.process_number = editForm.process_number;

          setEditingEntryId(null);
          toast.success('Dados do processo salvos automaticamente!');
        }
      }

      // Resolve the brand_process — by matched_process_id or by client_id
      const resolvedProcessId = await resolveBrandProcessId(selectedEntry.matched_process_id, selectedEntry.matched_client_id, selectedEntry.process_number);
      if (resolvedProcessId) {
        const { error } = await supabase.from('brand_processes').update({ pipeline_stage: newStage, status: 'em_andamento', updated_at: new Date().toISOString() }).eq('id', resolvedProcessId);
        if (error) throw error;

        // Save matched_process_id on rpi_entry for future lookups
        if (!selectedEntry.matched_process_id) {
          await supabase.from('rpi_entries').update({ matched_process_id: resolvedProcessId }).eq('id', selectedEntry.id);
        }
      }
      const { error: entryError } = await supabase.from('rpi_entries').update({ update_status: 'updated', updated_at: new Date().toISOString() }).eq('id', selectedEntry.id);
      if (entryError) throw entryError;

      // [SYNC] Also update publicacoes_marcas.status to match the new pipeline stage
      const { data: linkedPub } = await supabase.from('publicacoes_marcas')
        .select('id')
        .eq('rpi_entry_id', selectedEntry.id)
        .maybeSingle();
      if (linkedPub) {
        const pubStatus = PIPELINE_TO_PUB_STATUS[newStage] || newStage;
        await supabase.from('publicacoes_marcas').update({
          status: pubStatus,
          process_id: resolvedProcessId || undefined,
          updated_at: new Date().toISOString(),
        }).eq('id', linkedPub.id);
      }

      if (selectedEntry.matched_client_id) {
        await supabase.from('notifications').insert({ user_id: selectedEntry.matched_client_id, title: 'Atualização do Processo', message: `Seu processo da marca \"${selectedEntry.brand_name}\" foi atualizado com base na RPI.`, type: 'info', link: '/cliente/processos' });
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('client_activities').insert({ user_id: selectedEntry.matched_client_id, admin_id: user?.id, activity_type: 'process_update', description: `Processo atualizado via RPI para etapa: ${PIPELINE_STAGES.find(s => s.value === newStage)?.label}` });
      }
      toast.success('Processo atualizado com sucesso!');
      setUpdateDialogOpen(false);
      if (selectedUpload) await fetchEntries(selectedUpload.id);
    } catch (error) { console.error('Update error:', error); toast.error('Erro ao atualizar processo'); }
    finally { setUpdating(false); }
  };

  const handleOpenAssignDialog = (entry: RpiEntry, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAssignEntry(entry);
    setClientSearch('');
    setSelectedClient(null);
    setAssignPriority('medium');
    setAssignDialogOpen(true);
    // Re-fetch clients when dialog opens to ensure latest data
    if (availableClients.length === 0) {
      fetchClients();
    }
  };

  const filteredClients = useMemo(() => {
    if (!clientSearch || clientSearch.trim().length < 2) return [];
    const s = clientSearch.trim().toLowerCase();
    const sDigits = s.replace(/\D/g, '');
    return availableClients.filter(client => {
      const name = (client.full_name || '').toLowerCase();
      const email = (client.email || '').toLowerCase();
      const company = (client.company_name || '').toLowerCase();
      if (name.includes(s) || email.includes(s) || company.includes(s)) return true;
      if (sDigits.length > 0) {
        const cpf = (client.cpf_cnpj || '').replace(/\D/g, '');
        const phone = (client.phone || '').replace(/\D/g, '');
        if (cpf.includes(sDigits) || phone.includes(sDigits)) return true;
      }
      return false;
    });
  }, [clientSearch, availableClients]);

  const handleAssignClient = async () => {
    if (!assignEntry || !selectedClient) return;
    setAssigning(true);
    try {
      const deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() + 60);
      const { error: entryError } = await supabase.from('rpi_entries').update({ matched_client_id: selectedClient.id, update_status: 'pending', updated_at: new Date().toISOString(), linked_at: new Date().toISOString() }).eq('id', assignEntry.id);
      if (entryError) throw entryError;

      // Resolve process_id
      const resolvedProcessId = await resolveBrandProcessId(assignEntry.matched_process_id, selectedClient.id, assignEntry.process_number);

      // Save matched_process_id on rpi_entry for future lookups
      if (resolvedProcessId && !assignEntry.matched_process_id) {
        await supabase.from('rpi_entries').update({ matched_process_id: resolvedProcessId }).eq('id', assignEntry.id);
      }

      // Check if publicação already exists for this rpi_entry
      const { data: existingPub } = await supabase.from('publicacoes_marcas')
        .select('id')
        .eq('rpi_entry_id', assignEntry.id)
        .maybeSingle();

      // Also check by process_number_rpi (same process → update, not duplicate)
      let existingByProcessNumber = null;
      if (!existingPub && assignEntry.process_number) {
        const { data: pubByPn } = await supabase.from('publicacoes_marcas')
          .select('id')
          .eq('process_number_rpi', assignEntry.process_number)
          .maybeSingle();
        existingByProcessNumber = pubByPn;
      }

      // Determine status from dispatch_type
      let pubStatus = '003';
      if (assignEntry.dispatch_type) {
        const dispatchValue = DISPATCH_TYPE_OPTIONS.find(o => o.label === assignEntry.dispatch_type || o.value === assignEntry.dispatch_type)?.value || assignEntry.dispatch_type;
        pubStatus = dispatchValue;
      }

      // Calculate deadlines using calcAutoFields
      const dispatchLabel = assignEntry.dispatch_type || '';
      const autoFieldsAssign = calcAutoFields({
        data_publicacao_rpi: assignEntry.publication_date || null,
        status: pubStatus as any,
      }, dispatchLabel);

      const assignRpiNumber = selectedUpload?.rpi_number || null;

      if (existingPub) {
        // Update existing pub with client, process AND brand metadata
        await supabase.from('publicacoes_marcas').update({
          client_id: selectedClient.id,
          process_id: resolvedProcessId || undefined,
          status: pubStatus,
          brand_name_rpi: assignEntry.brand_name || null,
          process_number_rpi: assignEntry.process_number || null,
          ncl_class: assignEntry.ncl_classes?.join(', ') || null,
          data_publicacao_rpi: assignEntry.publication_date || null,
          rpi_number: assignRpiNumber,
          proximo_prazo_critico: autoFieldsAssign.proximo_prazo_critico || null,
          descricao_prazo: autoFieldsAssign.descricao_prazo || null,
          updated_at: new Date().toISOString(),
        }).eq('id', existingPub.id);
      } else if (existingByProcessNumber) {
        // Same process number → update card (move column), don't duplicate
        await supabase.from('publicacoes_marcas').update({
          client_id: selectedClient.id,
          process_id: resolvedProcessId || undefined,
          status: pubStatus,
          rpi_entry_id: assignEntry.id,
          brand_name_rpi: assignEntry.brand_name || null,
          process_number_rpi: assignEntry.process_number || null,
          ncl_class: assignEntry.ncl_classes?.join(', ') || null,
          data_publicacao_rpi: assignEntry.publication_date || null,
          rpi_number: assignRpiNumber,
          proximo_prazo_critico: autoFieldsAssign.proximo_prazo_critico || null,
          descricao_prazo: autoFieldsAssign.descricao_prazo || null,
          updated_at: new Date().toISOString(),
        }).eq('id', existingByProcessNumber.id);
      } else {
        // ★ CREATE new publicação card — only now that we have a client
        await supabase.from('publicacoes_marcas').insert({
          status: pubStatus,
          tipo_publicacao: 'publicacao_rpi',
          rpi_entry_id: assignEntry.id,
          process_id: resolvedProcessId || null,
          client_id: selectedClient.id,
          brand_name_rpi: assignEntry.brand_name || null,
          process_number_rpi: assignEntry.process_number || null,
          data_publicacao_rpi: assignEntry.publication_date || null,
          rpi_number: assignRpiNumber,
          proximo_prazo_critico: autoFieldsAssign.proximo_prazo_critico || format(deadlineDate, 'yyyy-MM-dd'),
          descricao_prazo: autoFieldsAssign.descricao_prazo || 'Prazo padrão - 60 dias',
        });
      }

      // [SYNC] Update brand_processes pipeline_stage + ncl_classes
      if (resolvedProcessId && assignEntry.dispatch_type) {
        const dispatchValue = DISPATCH_TYPE_OPTIONS.find(o => o.label === assignEntry.dispatch_type || o.value === assignEntry.dispatch_type)?.value || assignEntry.dispatch_type;
        const pipelineStage = PUB_STATUS_TO_PIPELINE[dispatchValue] || dispatchValue;
        const nclNumeric = assignEntry.ncl_classes?.map(Number).filter(n => !isNaN(n)) || [];
        await supabase.from('brand_processes').update({
          pipeline_stage: pipelineStage,
          ncl_classes: nclNumeric.length > 0 ? nclNumeric : undefined,
          updated_at: new Date().toISOString(),
        }).eq('id', resolvedProcessId);
      }

      await supabase.from('notifications').insert({ user_id: selectedClient.id, title: assignPriority === 'urgent' ? '🚨 URGENTE: Nova Publicação INPI' : 'Nova Publicação INPI', message: `Uma publicação referente ao processo ${assignEntry.process_number} (${assignEntry.brand_name || 'Marca'}) foi vinculada ao seu perfil. Prazo: 60 dias.`, type: assignPriority === 'urgent' ? 'warning' : 'info', link: '/cliente/processos' });
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('client_activities').insert({ user_id: selectedClient.id, admin_id: user?.id, activity_type: 'rpi_publication', description: `Publicação RPI vinculada: ${assignEntry.brand_name} - ${assignEntry.dispatch_type}. Prioridade: ${assignPriority === 'urgent' ? 'Urgente' : 'Média'}. Prazo: 60 dias.`, metadata: { process_number: assignEntry.process_number, dispatch_code: assignEntry.dispatch_code, dispatch_text: assignEntry.dispatch_text, deadline_date: deadlineDate.toISOString(), priority: assignPriority } });
      toast.success(`Publicação vinculada ao cliente ${selectedClient.full_name || selectedClient.email}!`);
      setAssignDialogOpen(false);
      if (selectedUpload) await fetchEntries(selectedUpload.id);
    } catch (error) { console.error('Assign error:', error); toast.error('Erro ao vincular cliente'); }
    finally { setAssigning(false); }
  };

  const handleUpdateTag = async (entryId: string, newTag: string) => {
    setUpdatingTag(entryId);
    try {
      const { error } = await supabase.from('rpi_entries').update({ tag: newTag, updated_at: new Date().toISOString() }).eq('id', entryId);
      if (error) throw error;
      toast.success('TAG atualizada');
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, tag: newTag } : e));
    } catch (error) { toast.error('Erro ao atualizar TAG'); }
    finally { setUpdatingTag(null); }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.brand_name?.toLowerCase().includes(searchTerm.toLowerCase()) || entry.process_number?.includes(searchTerm) || entry.holder_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterMatched === 'all' || (filterMatched === 'matched' && entry.matched_client_id) || (filterMatched === 'unmatched' && !entry.matched_client_id);
    return matchesSearch && matchesFilter;
  });

  const matchedEntries = entries.filter(e => e.matched_client_id);
  const deferimentos = entries.filter(e => (e.dispatch_text || '').toLowerCase().includes('deferid'));
  const indeferimentos = entries.filter(e => (e.dispatch_text || '').toLowerCase().includes('indeferid'));

  return (
    <>
      <div className="space-y-8">
        {/* ═══ HERO HEADER ═══ */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-8 lg:p-10"
        >
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-600/15 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }} />
          </div>

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/20 backdrop-blur-sm border border-primary/20">
                  <Newspaper className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                    Revista INPI
                  </h1>
                  <p className="text-white/50 text-sm font-medium">
                    Revista da Propriedade Industrial — Análise Inteligente
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1.5">
                  <Radio className="h-3 w-3 animate-pulse" />
                  Sistema Online
                </Badge>
                {latestRpi && (
                  <Badge className="bg-white/10 text-white/70 border-white/10 gap-1.5">
                    <Hash className="h-3 w-3" />
                    Última RPI: {latestRpi}
                  </Badge>
                )}
                <Badge className="bg-white/10 text-white/70 border-white/10 gap-1.5">
                  <Database className="h-3 w-3" />
                  {uploads.length} edições processadas
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Label
                htmlFor="pdf-upload"
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer transition-all text-sm font-medium ${
                  uploading || processing
                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                }`}
              >
                {uploading || processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? 'Enviando...' : processing ? 'Analisando...' : 'Upload Manual'}
              </Label>
              <Input id="pdf-upload" type="file" accept=".pdf,.xml,.xlsx,.xls" onChange={handleFileUpload} disabled={uploading || processing} className="hidden" />
              
              <Button
                onClick={() => handleRemoteFetch(rpWithXml[0] || latestRpi || undefined)}
                disabled={fetchingRemote || (!latestRpi && rpWithXml.length === 0)}
                size="lg"
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 rounded-xl"
              >
                {fetchingRemote ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                Buscar Última RPI
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ═══ STATS ═══ */}
        {selectedUpload && selectedUpload.status === 'completed' && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard icon={FileText} label="Nº da RPI" value={selectedUpload.rpi_number || 'N/A'} gradient="bg-gradient-to-br from-violet-600 to-purple-700" delay={0.1} />
            <StatCard icon={Calendar} label="Data RPI" value={selectedUpload.rpi_date ? format(new Date(selectedUpload.rpi_date), "dd/MM/yy", { locale: ptBR }) : '—'} gradient="bg-gradient-to-br from-blue-600 to-indigo-700" delay={0.15} />
            <StatCard icon={Search} label="Processos" value={selectedUpload.total_processes_found} gradient="bg-gradient-to-br from-cyan-600 to-teal-700" delay={0.2} />
            <StatCard icon={Users} label="Clientes" value={matchedEntries.length} gradient="bg-gradient-to-br from-emerald-600 to-green-700" delay={0.25} />
            <StatCard icon={AlertTriangle} label="Sem Vínculo" value={entries.length - matchedEntries.length} gradient="bg-gradient-to-br from-amber-600 to-orange-700" delay={0.3} />
          </div>
        )}

        {/* ═══ MAIN TABS ═══ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
            <TabsTrigger value="fetch" className="gap-2 rounded-lg data-[state=active]:shadow-sm">
              <Globe className="h-4 w-4" />
              Busca Remota
            </TabsTrigger>
            <TabsTrigger value="results" className="gap-2 rounded-lg data-[state=active]:shadow-sm">
              <Layers className="h-4 w-4" />
              Processos
              {entries.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">{entries.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 rounded-lg data-[state=active]:shadow-sm">
              <Clock className="h-4 w-4" />
              Histórico
            </TabsTrigger>
            {/* Publicações tab removed — now has its own page at /admin/publicacao */}
          </TabsList>

          {/* ─── TAB: Busca Remota ─── */}
          <TabsContent value="fetch" className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-primary/20 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Globe className="h-5 w-5 text-primary" />
                    Portal INPI — Busca Automática
                    <Badge variant="secondary" className="ml-2 gap-1">
                      <Wifi className="h-3 w-3" />
                      Live
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Selecione a edição da RPI e baixe automaticamente do portal oficial do INPI
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative space-y-6">
                  <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
                    <div className="flex-1 space-y-2">
                      <Label>Edição da RPI</Label>
                      <div className="flex gap-3">
                        <Select value={selectedRpiNumber} onValueChange={setSelectedRpiNumber}>
                          <SelectTrigger className="w-72 rounded-xl">
                            <SelectValue placeholder="Selecione a RPI" />
                          </SelectTrigger>
                          <SelectContent>
                            {recentRpis.map(rpi => {
                              const hasXml = rpWithXml.includes(rpi);
                              return (
                                <SelectItem key={rpi} value={rpi.toString()}>
                                  <span className="flex items-center gap-2">
                                    RPI {rpi}
                                    {rpi === latestRpi && <Badge variant="secondary" className="text-xs">Última</Badge>}
                                    {hasXml ? (
                                      <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">XML ✓</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs text-muted-foreground">Sem XML</Badge>
                                    )}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>

                        <Button
                          onClick={() => handleRemoteFetch()}
                          disabled={fetchingRemote || !selectedRpiNumber}
                          className="gap-2 rounded-xl"
                        >
                          {fetchingRemote ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
                          Buscar
                        </Button>
                      </div>
                      {!rpWithXml.includes(parseInt(selectedRpiNumber)) && selectedRpiNumber && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Esta RPI ainda não possui XML de Marcas disponível
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Info banner */}
                  <div className="rounded-xl bg-muted/50 p-4 flex items-start gap-3">
                    <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Como funciona</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        O sistema conecta diretamente ao portal <strong>revistas.inpi.gov.br</strong> e baixa o arquivo XML da seção de Marcas.
                        Em seguida, identifica automaticamente todos os processos do procurador <strong>Davilys Danques Oliveira Cunha</strong> e 
                        cruza com sua base de clientes para notificação imediata.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── TAB: Processos ─── */}
          <TabsContent value="results" className="space-y-4">
            {/* Processing Indicator */}
            <AnimatePresence>
              {(processing || fetchingRemote) && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent overflow-hidden">
                    <CardContent className="py-8">
                      <div className="flex items-center gap-6">
                        <div className="relative">
                          <div className="absolute inset-0 animate-ping opacity-20 rounded-full bg-primary" />
                          <div className="relative p-4 rounded-full bg-primary/10">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                          </div>
                        </div>
                        <div className="flex-1 space-y-3">
                          <h3 className="font-semibold text-lg">
                            {fetchingRemote ? 'Conectando ao Portal INPI...' : 'Analisando Revista...'}
                          </h3>
                          <div className="space-y-1.5">
                            {(fetchingRemote ? [
                              'Conectando ao portal INPI...',
                              'Baixando arquivo XML...',
                              'Processando dados estruturados...',
                            ] : [
                              'Identificando formato do arquivo',
                              'Aplicando OCR para PDFs digitalizados',
                              'Extraindo processos do procurador',
                              'Cruzando com base de clientes',
                            ]).map((step, i) => (
                              <motion.p
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.3 }}
                                className="text-sm text-muted-foreground flex items-center gap-2"
                              >
                                <Activity className="h-3 w-3 text-primary" />
                                {step}
                              </motion.p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Entries List */}
            {selectedUpload && (selectedUpload.status === 'completed' || entries.length > 0) && (
              <>
                {/* Search & Filters Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Layers className="h-5 w-5 text-primary" />
                      Processos Identificados
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {matchedEntries.length > 0
                        ? `${matchedEntries.length} de ${entries.length} vinculados a clientes`
                        : `${entries.length} processos encontrados`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar marca, processo..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 w-64 rounded-xl"
                      />
                    </div>
                    <Select value={filterMatched} onValueChange={(v: any) => setFilterMatched(v)}>
                      <SelectTrigger className="w-44 rounded-xl">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="matched">Clientes WebMarcas</SelectItem>
                        <SelectItem value="unmatched">Não identificados</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Process Cards */}
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {filteredEntries.map((entry, index) => {
                      const isExpanded = expandedEntryId === entry.id;
                      const tagOption = TAG_OPTIONS.find(t => t.value === (entry.tag || 'pending'));

                      return (
                        <motion.div
                          key={entry.id}
                          layout
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.35 }}
                        >
                          <Card
                            className={`group cursor-pointer transition-all duration-300 overflow-hidden ${
                              isExpanded
                                ? 'border-primary/40 shadow-lg shadow-primary/5 ring-1 ring-primary/10'
                                : 'hover:border-primary/20 hover:shadow-md'
                            }`}
                            onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                          >
                            {/* Card Header Row */}
                            <div className="px-5 py-4 flex items-center gap-4">
                              {/* Status indicator */}
                              <div className={`relative flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${
                                entry.update_status === 'updated'
                                  ? 'bg-emerald-500/10'
                                  : entry.matched_client_id
                                  ? 'bg-primary/10'
                                  : 'bg-muted'
                              }`}>
                                {entry.update_status === 'updated' ? (
                                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                                ) : (
                                  <FileText className="h-5 w-5 text-primary" />
                                )}
                                {entry.matched_client_id && entry.update_status !== 'updated' && (
                                  <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-card animate-pulse" />
                                )}
                              </div>

                              {/* Brand & Process */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-foreground truncate max-w-[200px]">
                                    {entry.brand_name || 'Marca não identificada'}
                                  </span>
                                  <code className="text-[11px] font-mono bg-muted/70 px-2 py-0.5 rounded-md text-muted-foreground">
                                    {entry.process_number}
                                  </code>
                                  {entry.ncl_classes && entry.ncl_classes.length > 0 && (
                                    <Badge variant="secondary" className="font-mono text-[10px] h-5">
                                      NCL {entry.ncl_classes.join(', ')}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {entry.dispatch_text || entry.dispatch_type || 'Sem descrição do despacho'}
                                </p>
                              </div>

                              {/* Right side badges */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {getDispatchBadge(entry.dispatch_type)}
                                {tagOption && (
                                  <Badge className={`${tagOption.color} text-[10px] border-0`}>
                                    {tagOption.label}
                                  </Badge>
                                )}
                                {entry.matched_client_id ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] gap-1">
                                    <Users className="h-3 w-3" />
                                    {entry.client?.full_name?.split(' ')[0] || 'Cliente'}
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1.5 rounded-lg border-primary/30 text-primary hover:bg-primary/10"
                                    onClick={(e) => handleOpenAssignDialog(entry, e)}
                                  >
                                    <UserPlus className="h-3 w-3" />
                                    Vincular
                                  </Button>
                                )}
                                <motion.div
                                  animate={{ rotate: isExpanded ? 90 : 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </motion.div>
                              </div>
                            </div>

                            {/* Expanded Detail Panel */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                                  className="overflow-hidden"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <div className="border-t border-border/50 bg-gradient-to-b from-muted/30 to-transparent">
                                    <div className="p-5 space-y-5">
                                      {/* Detail Grid */}
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Column 1: Process Info */}
                                        <div className="space-y-3">
                                          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                                            <FileText className="h-3.5 w-3.5" />
                                            Dados do Processo
                                            {editingEntryId !== entry.id && (
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 ml-auto"
                                                onClick={() => {
                                                  setEditingEntryId(entry.id);
                                                  setEditForm({
                                                    brand_name: entry.brand_name || '',
                                                    process_number: entry.process_number || '',
                                                    ncl_classes: entry.ncl_classes?.join(', ') || '',
                                                    holder_name: entry.holder_name || '',
                                                  });
                                                }}
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                              </Button>
                                            )}
                                          </h4>
                                          <div className="space-y-2.5 bg-card rounded-xl p-4 border border-border/50">
                                            {editingEntryId === entry.id ? (
                                              <>
                                                <div className="space-y-1.5">
                                                  <label className="text-[11px] text-muted-foreground">Nº Processo</label>
                                                  <Input value={editForm.process_number} onChange={e => setEditForm(f => ({ ...f, process_number: e.target.value }))} className="h-8 text-xs font-mono" />
                                                </div>
                                                <div className="space-y-1.5">
                                                  <label className="text-[11px] text-muted-foreground">Marca</label>
                                                  <Input value={editForm.brand_name} onChange={e => setEditForm(f => ({ ...f, brand_name: e.target.value }))} className="h-8 text-xs" />
                                                </div>
                                                <div className="space-y-1.5">
                                                  <label className="text-[11px] text-muted-foreground">Classe NCL (separar por vírgula)</label>
                                                  <Input value={editForm.ncl_classes} onChange={e => setEditForm(f => ({ ...f, ncl_classes: e.target.value }))} className="h-8 text-xs" placeholder="25, 35" />
                                                </div>
                                                <div className="space-y-1.5">
                                                  <label className="text-[11px] text-muted-foreground">Titular</label>
                                                  <Input value={editForm.holder_name} onChange={e => setEditForm(f => ({ ...f, holder_name: e.target.value }))} className="h-8 text-xs" />
                                                </div>
                                                <div className="flex gap-2 pt-2">
                                                  <Button
                                                    size="sm"
                                                    className="gap-1.5 h-8 text-xs rounded-lg flex-1"
                                                    disabled={savingEdit}
                                                    onClick={async () => {
                                                      setSavingEdit(true);
                                                      try {
                                                         const nclArray = editForm.ncl_classes.split(',').map(s => s.trim()).filter(Boolean);
                                                         const { error } = await supabase.from('rpi_entries').update({
                                                           brand_name: editForm.brand_name || null,
                                                           process_number: editForm.process_number,
                                                           ncl_classes: nclArray.length > 0 ? nclArray : null,
                                                           holder_name: editForm.holder_name || null,
                                                           updated_at: new Date().toISOString(),
                                                         }).eq('id', entry.id);
                                                         if (error) throw error;

                                                          // [SYNC] Propagate edits to publicacoes_marcas (with fallback lookup)
                                                          let linkedPub: { id: string } | null = null;
                                                          const { data: pubByRpi } = await supabase.from('publicacoes_marcas')
                                                            .select('id')
                                                            .eq('rpi_entry_id', entry.id)
                                                            .maybeSingle();
                                                          linkedPub = pubByRpi || null;
                                                          // Fallback: lookup by process_number_rpi if not found by rpi_entry_id
                                                          if (!linkedPub && editForm.process_number) {
                                                            const { data: pubByPn } = await supabase.from('publicacoes_marcas')
                                                              .select('id')
                                                              .eq('process_number_rpi', editForm.process_number)
                                                              .maybeSingle();
                                                            linkedPub = pubByPn || null;
                                                          }
                                                          // Resolve brand_process id for sync
                                                          const resolvedProcessId = (editForm.process_number && entry.matched_client_id)
                                                            ? await resolveBrandProcessId(entry.matched_process_id, entry.matched_client_id, editForm.process_number)
                                                            : entry.matched_process_id || null;

                                                          // Determine current dispatch_type mapped to pipeline_stage
                                                          const currentDispatch = (entry.dispatch_type || '').toLowerCase();
                                                          const matchedDispatch = DISPATCH_TYPE_OPTIONS.find(o => o.label.toLowerCase() === currentDispatch || o.value === currentDispatch);
                                                          const dispatchValue = matchedDispatch?.value || null;
                                                          const pipelineStage = dispatchValue ? (PUB_STATUS_TO_PIPELINE[dispatchValue] || dispatchValue) : null;

                                                           // Calculate deadlines
                                                           const autoFieldsEdit = calcAutoFields({
                                                             data_publicacao_rpi: entry.publication_date || null,
                                                             status: (dispatchValue || '003') as any,
                                                           }, entry.dispatch_type || null);

                                                           const inlineRpiNumber = selectedUpload?.rpi_number || null;

                                                           const pubSyncData: Record<string, any> = {
                                                             brand_name_rpi: editForm.brand_name || null,
                                                             process_number_rpi: editForm.process_number || null,
                                                             ncl_class: nclArray.length > 0 ? nclArray.join(', ') : null,
                                                             client_id: entry.matched_client_id || null,
                                                             data_publicacao_rpi: entry.publication_date || null,
                                                             process_id: resolvedProcessId || null,
                                                             rpi_number: inlineRpiNumber,
                                                             proximo_prazo_critico: autoFieldsEdit.proximo_prazo_critico || null,
                                                             descricao_prazo: autoFieldsEdit.descricao_prazo || null,
                                                             updated_at: new Date().toISOString(),
                                                           };
                                                           if (dispatchValue) pubSyncData.status = dispatchValue;

                                                          if (linkedPub) {
                                                            await supabase.from('publicacoes_marcas').update(pubSyncData).eq('id', linkedPub.id);
                                                          } else if (entry.matched_client_id) {
                                                            // Create publicacao if none exists and we have a client
                                                            await supabase.from('publicacoes_marcas').insert({
                                                              ...pubSyncData,
                                                              status: dispatchValue || '003',
                                                              tipo_publicacao: 'publicacao_rpi',
                                                              rpi_entry_id: entry.id,
                                                            });
                                                          }

                                                         // [SYNC] Update brand_processes: name, number, NCL, and pipeline_stage
                                                         if (resolvedProcessId) {
                                                           const bpUpdate: Record<string, any> = {
                                                             brand_name: editForm.brand_name || undefined,
                                                             process_number: editForm.process_number || undefined,
                                                             ncl_classes: nclArray.map(Number).filter(n => !isNaN(n)),
                                                             updated_at: new Date().toISOString(),
                                                           };
                                                           if (pipelineStage) bpUpdate.pipeline_stage = pipelineStage;
                                                           await supabase.from('brand_processes').update(bpUpdate).eq('id', resolvedProcessId);

                                                           // Store matched_process_id on rpi_entry for future lookups
                                                           if (!entry.matched_process_id) {
                                                             await supabase.from('rpi_entries').update({ matched_process_id: resolvedProcessId }).eq('id', entry.id);
                                                           }
                                                         }

                                                         toast.success('Dados atualizados e sincronizados!');
                                                         setEditingEntryId(null);
                                                         setEntries(prev => prev.map(e => e.id === entry.id ? {
                                                           ...e,
                                                           brand_name: editForm.brand_name || null,
                                                           process_number: editForm.process_number,
                                                           ncl_classes: nclArray.length > 0 ? nclArray : null,
                                                           holder_name: editForm.holder_name || null,
                                                         } : e));
                                                      } catch (err) { toast.error('Erro ao salvar'); console.error(err); }
                                                      finally { setSavingEdit(false); }
                                                    }}
                                                  >
                                                    {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                    Salvar
                                                  </Button>
                                                  <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs rounded-lg" onClick={() => setEditingEntryId(null)}>
                                                    <X className="h-3 w-3" />
                                                    Cancelar
                                                  </Button>
                                                </div>
                                              </>
                                            ) : (
                                              <>
                                                <DetailRow label="Nº Processo" value={entry.process_number} mono />
                                                <DetailRow label="Marca" value={entry.brand_name || '—'} />
                                                <DetailRow label="Classe NCL" value={entry.ncl_classes?.join(', ') || '—'} />
                                                <DetailRow label="Titular" value={entry.holder_name || '—'} />
                                                {entry.publication_date && (
                                                  <DetailRow label="Publicação" value={format(new Date(entry.publication_date), "dd/MM/yyyy", { locale: ptBR })} />
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </div>

                                        {/* Column 2: Dispatch Details */}
                                        <div className="space-y-3">
                                          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                                            <Sparkles className="h-3.5 w-3.5" />
                                            Despacho
                                          </h4>
                                          <div className="space-y-2.5 bg-card rounded-xl p-4 border border-border/50">
                                            <div>
                                              <span className="text-[11px] text-muted-foreground">Tipo</span>
                                              <div className="mt-1">
                                                <Select
                                                  value={(() => {
                                                    const currentType = (entry.dispatch_type || '').toLowerCase();
                                                    const match = DISPATCH_TYPE_OPTIONS.find(o => 
                                                      o.label.toLowerCase() === currentType || o.value === currentType
                                                    );
                                                    return match?.value || '';
                                                  })()}
                                                  onValueChange={(val) => handleDispatchTypeChange(entry, val)}
                                                  disabled={updatingDispatchType === entry.id}
                                                >
                                                  <SelectTrigger className="h-8 text-xs rounded-lg">
                                                    {updatingDispatchType === entry.id ? (
                                                      <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Salvando...</span>
                                                    ) : (
                                                      <SelectValue placeholder="Selecionar tipo" />
                                                    )}
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {DISPATCH_TYPE_OPTIONS.map(opt => (
                                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                            </div>
                                            <DetailRow label="Código" value={entry.dispatch_code || '—'} mono />
                                            <div>
                                              <span className="text-[11px] text-muted-foreground">Texto do Despacho</span>
                                              <p className="text-sm mt-1 leading-relaxed text-foreground">
                                                {entry.dispatch_text || 'Sem descrição disponível'}
                                              </p>
                                            </div>
                                            <div className="pt-1">
                                              <span className="text-[11px] text-muted-foreground">Etapa Sugerida</span>
                                              <div className="mt-1">
                                                <Badge className="bg-primary/10 text-primary border-primary/20">
                                                  {PIPELINE_STAGES.find(s => s.value === suggestStage(entry.dispatch_code, entry.dispatch_text))?.label || 'Protocolado'}
                                                </Badge>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Column 3: Client & Actions */}
                                        <div className="space-y-3">
                                          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                                            <Users className="h-3.5 w-3.5" />
                                            Cliente & Ações
                                          </h4>
                                          <div className="space-y-3 bg-card rounded-xl p-4 border border-border/50">
                                            {entry.matched_client_id ? (
                                              <div className="space-y-2">
                                                <div className="flex items-center gap-3">
                                                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <span className="text-sm font-bold text-primary">
                                                      {(entry.client?.full_name || entry.client?.email || '?')[0].toUpperCase()}
                                                    </span>
                                                  </div>
                                                  <div>
                                                    <p className="font-semibold text-sm">{entry.client?.full_name || 'Cliente'}</p>
                                                    <p className="text-xs text-muted-foreground">{entry.client?.email}</p>
                                                    {entry.client?.company_name && (
                                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Building2 className="h-3 w-3" />
                                                        {entry.client.company_name}
                                                      </p>
                                                    )}
                                                  </div>
                                                </div>
                                                {entry.process?.pipeline_stage && (
                                                  <div className="pt-1">
                                                    <span className="text-[11px] text-muted-foreground">Etapa Atual</span>
                                                    <div className="mt-1">
                                                      <Badge variant="outline">
                                                        {PIPELINE_STAGES.find(s => s.value === entry.process?.pipeline_stage)?.label || entry.process.pipeline_stage}
                                                      </Badge>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            ) : (
                                              <div className="text-center py-4 space-y-2">
                                                <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                                  <UserPlus className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <p className="text-xs text-muted-foreground">Nenhum cliente vinculado</p>
                                              </div>
                                            )}

                                            {/* TAG Selector */}
                                            <div className="pt-2 border-t border-border/30">
                                              <span className="text-[11px] text-muted-foreground">TAG</span>
                                              <Select value={entry.tag || 'pending'} onValueChange={(value) => handleUpdateTag(entry.id, value)} disabled={updatingTag === entry.id}>
                                                <SelectTrigger className="w-full h-9 rounded-lg text-xs mt-1">
                                                  {updatingTag === entry.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue />}
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {TAG_OPTIONS.map(opt => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                      <Badge className={`${opt.color} text-xs border-0`}>{opt.label}</Badge>
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>

                                          {/* Action Buttons */}
                                          <div className="flex flex-col gap-2">
                                            {entry.matched_client_id && entry.update_status !== 'updated' && (
                                              <Button size="sm" onClick={(e) => handleOpenUpdateDialog(entry, e)} className="gap-2 rounded-xl w-full">
                                                <RefreshCw className="h-4 w-4" />
                                                Atualizar Processo
                                              </Button>
                                            )}
                                            {!entry.matched_client_id && (
                                              <Button size="sm" variant="outline" onClick={(e) => handleOpenAssignDialog(entry, e)} className="gap-2 rounded-xl w-full">
                                                <UserPlus className="h-4 w-4" />
                                                Vincular Cliente
                                              </Button>
                                            )}
                                            {entry.update_status === 'updated' && (
                                              <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                                                <span className="text-sm font-medium text-emerald-600">Processo Atualizado</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {filteredEntries.length === 0 && !processing && !fetchingRemote && (
                    <Card className="border-dashed border-2">
                      <CardContent className="py-16 text-center">
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                          <Search className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <p className="text-muted-foreground font-medium">Nenhum processo encontrado</p>
                        {searchTerm && <p className="text-xs text-muted-foreground mt-1">Tente buscar com termos diferentes</p>}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            )}

            {/* Empty state */}
            {!loading && entries.length === 0 && !processing && !fetchingRemote && (
              <Card className="border-dashed border-2">
                <CardContent className="py-20 text-center">
                  <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center mb-6">
                    <Newspaper className="h-10 w-10 text-primary/40" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Nenhum processo carregado</h3>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    Busque a RPI mais recente do portal INPI ou faça upload manual para começar a análise.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={() => { setActiveTab('fetch'); }} variant="outline" className="gap-2 rounded-xl">
                      <Globe className="h-4 w-4" />
                      Ir para Busca Remota
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── TAB: Histórico ─── */}
          <TabsContent value="history" className="space-y-4">
            {uploads.length > 0 ? (
              <div className="grid gap-3">
                {uploads.map((upload, index) => (
                  <motion.div
                    key={upload.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedUpload?.id === upload.id
                          ? 'border-primary/50 bg-primary/[0.02] shadow-sm'
                          : 'hover:border-primary/20'
                      }`}
                      onClick={() => { setSelectedUpload(upload); setActiveTab('results'); }}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-xl ${
                              upload.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                              upload.status === 'error' ? 'bg-red-500/10 text-red-600' :
                              'bg-amber-500/10 text-amber-600'
                            }`}>
                              {upload.status === 'completed' ? <CheckCircle className="h-5 w-5" /> :
                               upload.status === 'error' ? <AlertCircle className="h-5 w-5" /> :
                               <Loader2 className="h-5 w-5 animate-spin" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">RPI {upload.rpi_number || '—'}</span>
                                {upload.rpi_date && (
                                  <Badge variant="outline" className="text-xs">
                                    {format(new Date(upload.rpi_date), "dd/MM/yyyy", { locale: ptBR })}
                                  </Badge>
                                )}
                                <Badge className={
                                  upload.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                  upload.status === 'error' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                                  'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                }>
                                  {upload.status === 'completed' ? 'Processada' : upload.status === 'error' ? 'Erro' : 'Pendente'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {upload.file_name} • {format(new Date(upload.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-right">
                            {upload.status === 'completed' && (
                              <div className="flex items-center gap-4">
                                <div>
                                  <p className="text-lg font-bold">{upload.total_processes_found}</p>
                                  <p className="text-xs text-muted-foreground">processos</p>
                                </div>
                                <div>
                                  <p className="text-lg font-bold text-emerald-600">{upload.total_clients_matched}</p>
                                  <p className="text-xs text-muted-foreground">clientes</p>
                                </div>
                              </div>
                            )}
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-2">
                <CardContent className="py-16 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum histórico</h3>
                  <p className="text-sm text-muted-foreground">As RPIs processadas aparecerão aqui.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Publicações tab removed — now at /admin/publicacao */}
        </Tabs>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        )}
      </div>

      {/* ═══ DIALOGS ═══ */}
      
      {/* Update Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Atualizar Processo
            </DialogTitle>
            <DialogDescription>Confirme a atualização do processo com base na publicação da RPI.</DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Marca</span>
                  <span className="font-semibold">{selectedEntry.brand_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Processo</span>
                  <span className="font-mono text-sm">{selectedEntry.process_number}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Despacho</span>
                  {getDispatchBadge(selectedEntry.dispatch_type)}
                </div>
                {selectedEntry.client && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Cliente</span>
                    <span className="font-medium">{selectedEntry.client.full_name || selectedEntry.client.company_name}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Etapa do Funil</Label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    {selectedEntry.process?.pipeline_stage && (
                      <Badge variant="outline" className="mb-2">
                        Atual: {PIPELINE_STAGES.find(s => s.value === selectedEntry.process?.pipeline_stage)?.label || selectedEntry.process.pipeline_stage}
                      </Badge>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Select value={newStage} onValueChange={setNewStage}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Nova etapa" /></SelectTrigger>
                      <SelectContent>
                        {PIPELINE_STAGES.map(stage => (<SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {suggestStage(selectedEntry.dispatch_code, selectedEntry.dispatch_text) === newStage && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Etapa sugerida automaticamente</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleUpdateProcess} disabled={updating || !newStage} className="rounded-xl gap-2">
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Client Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Vincular Cliente
            </DialogTitle>
            <DialogDescription>Selecione o cliente para vincular a esta publicação RPI. Prazo de 60 dias.</DialogDescription>
          </DialogHeader>
          {assignEntry && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Marca</span>
                  <span className="font-semibold">{assignEntry.brand_name || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Processo</span>
                  <span className="font-mono text-sm">{assignEntry.process_number}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Titular</span>
                  <span className="text-sm">{assignEntry.holder_name || '-'}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground">Despacho</span>
                  <div className="text-right">
                    {getDispatchBadge(assignEntry.dispatch_type)}
                    <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">{assignEntry.dispatch_text}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Buscar Cliente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Nome, email ou empresa..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="pl-9 rounded-xl" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Selecionar Cliente {availableClients.length > 0 && <span className="text-muted-foreground font-normal">({availableClients.length} disponíveis{filteredClients.length > 0 ? `, ${filteredClients.length} encontrados` : ''})</span>}</Label>
                <ScrollArea className="h-[200px] border rounded-xl p-2">
                  {filteredClients.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">{availableClients.length === 0 ? 'Carregando clientes...' : clientSearch && clientSearch.trim().length >= 2 ? `Nenhum cliente encontrado para "${clientSearch}"` : 'Digite ao menos 2 letras para buscar'}</div>
                  ) : (
                    <div className="space-y-1">
                      {filteredClients.slice(0, 50).map(client => (
                        <div
                          key={client.id}
                          onClick={() => setSelectedClient(client)}
                          className={`p-3 rounded-xl cursor-pointer transition-colors ${
                            selectedClient?.id === client.id ? 'bg-primary/10 border border-primary' : 'hover:bg-muted'
                          }`}
                        >
                          <div className="font-medium text-sm">{client.full_name || client.company_name || 'Sem nome'}</div>
                          <div className="text-xs text-muted-foreground">{client.email}</div>
                          {client.company_name && client.full_name && <div className="text-xs text-muted-foreground">{client.company_name}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label>Prioridade</Label>
                <div className="flex gap-3">
                  <Button type="button" variant={assignPriority === 'medium' ? 'default' : 'outline'} onClick={() => setAssignPriority('medium')} className="flex-1 gap-2 rounded-xl">
                    <Clock className="h-4 w-4" />Média
                  </Button>
                  <Button type="button" variant={assignPriority === 'urgent' ? 'destructive' : 'outline'} onClick={() => setAssignPriority('urgent')} className="flex-1 gap-2 rounded-xl">
                    <AlertTriangle className="h-4 w-4" />Urgente
                  </Button>
                </div>
              </div>

              <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 flex items-center gap-3">
                <Calendar className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm">Prazo: 60 dias para cumprimento</div>
                  <div className="text-xs text-muted-foreground">O cliente será notificado automaticamente</div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleAssignClient} disabled={assigning || !selectedClient} className="gap-2 rounded-xl">
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Vincular Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
