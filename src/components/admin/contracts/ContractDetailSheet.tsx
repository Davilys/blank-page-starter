import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { 
  Eye, Send, Mail, MoreVertical, Trash2, EyeOff, Copy, ExternalLink,
  FileText, Paperclip, MessageSquare, History, CheckSquare, StickyNote, Save, 
  Link, Loader2, Shield, Clock, Download, Plus, X, Check, AlertCircle,
  Upload, File, Image, FileArchive, User, Calendar, ChevronRight,
  Activity, RefreshCw, Pen, Edit2, Lock, Files
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DocumentRenderer, generateDocumentPrintHTML, getLogoBase64ForPDF } from '@/components/contracts/DocumentRenderer';
import { cn } from '@/lib/utils';
import { replaceContractVariables } from '@/hooks/useContractTemplate';
import { generateContractPrintHTML } from '@/components/contracts/ContractRenderer';

interface Contract {
  id: string;
  contract_number: string | null;
  subject: string | null;
  contract_value: number | null;
  start_date: string | null;
  end_date: string | null;
  signature_status: string | null;
  signed_at: string | null;
  visible_to_client: boolean | null;
  user_id: string | null;
  contract_html?: string | null;
  description?: string | null;
  contract_type_id: string | null;
  document_type?: string | null;
  signature_token?: string | null;
  signature_expires_at?: string | null;
  signatory_name?: string | null;
  signatory_cpf?: string | null;
  signatory_cnpj?: string | null;
  client_signature_image?: string | null;
  blockchain_hash?: string | null;
  blockchain_timestamp?: string | null;
  blockchain_tx_id?: string | null;
  blockchain_network?: string | null;
  signature_ip?: string | null;
  payment_method?: string | null;
  penalty_value?: number | null;
}

interface ContractType { id: string; name: string; }
interface AuditLog {
  id: string; event_type: string; event_data: any;
  ip_address: string | null; user_agent: string | null; created_at: string;
}
interface Attachment { id: string; name: string; file_url: string; file_size: number | null; mime_type: string | null; created_at: string; }
interface Comment { id: string; content: string; user_id: string | null; created_at: string; }
interface Note { id: string; content: string; created_by: string | null; created_at: string; updated_at: string; }
interface Task { id: string; title: string; description: string | null; completed: boolean | null; due_date: string | null; assigned_to: string | null; created_at: string; }
interface RenewalHistory { id: string; renewed_at: string; new_end_date: string | null; new_value: number | null; previous_end_date: string | null; previous_value: number | null; notes: string | null; }
interface ContractPreviewData {
  id: string;
  contract_html: string | null;
  document_type: string | null;
  client_signature_image: string | null;
  blockchain_hash: string | null;
  blockchain_timestamp: string | null;
  blockchain_tx_id: string | null;
  blockchain_network: string | null;
  signature_ip: string | null;
  signatory_name: string | null;
  signatory_cpf: string | null;
  signatory_cnpj: string | null;
}

interface ContractDetailSheetProps {
  contract: Contract | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  contract: 'Contrato', procuracao: 'Procuração',
  distrato_multa: 'Distrato com Multa', distrato_sem_multa: 'Distrato sem Multa',
};

const EVENT_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  link_generated: { label: 'Link gerado', color: 'text-blue-400', icon: Link },
  link_accessed: { label: 'Link acessado', color: 'text-yellow-400', icon: Eye },
  signature_request_sent: { label: 'Solicitação enviada', color: 'text-purple-400', icon: Send },
  document_viewed: { label: 'Documento visualizado', color: 'text-cyan-400', icon: FileText },
  signature_drawn: { label: 'Assinatura desenhada', color: 'text-orange-400', icon: Pen },
  contract_signed: { label: 'Contrato assinado', color: 'text-green-400', icon: Check },
};

function FileIcon({ mimeType }: { mimeType: string | null }) {
  if (!mimeType) return <File className="h-5 w-5 text-muted-foreground" />;
  if (mimeType.startsWith('image/')) return <Image className="h-5 w-5 text-blue-400" />;
  if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-red-400" />;
  if (mimeType.includes('zip') || mimeType.includes('rar')) return <FileArchive className="h-5 w-5 text-yellow-400" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── Premium Empty State ──────────────────────────────────────────────────────
function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 gap-3"
    >
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border flex items-center justify-center">
          <Icon className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Plus className="h-3 w-3 text-primary/60" />
        </div>
      </div>
      <div className="text-center">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </motion.div>
  );
}

export function ContractDetailSheet({ contract, open, onOpenChange, onUpdate }: ContractDetailSheetProps) {
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [formData, setFormData] = useState({
    subject: '', contract_value: '', start_date: '', end_date: '',
    description: '', contract_type_id: '', visible_to_client: true,
  });
  const [saving, setSaving] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [renewalHistory, setRenewalHistory] = useState<RenewalHistory[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatingNewLink, setGeneratingNewLink] = useState(false);
  const [previewData, setPreviewData] = useState<ContractPreviewData | null>(null);
  const [loadingPreviewData, setLoadingPreviewData] = useState(false);

  // Comments
  const [newComment, setNewComment] = useState('');
  const [savingComment, setSavingComment] = useState(false);

  // Notes
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');

  // Tasks
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', due_date: '' });
  const [savingTask, setSavingTask] = useState(false);

  // Attachments
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { fetchContractTypes(); }, []);

  useEffect(() => {
    if (contract) {
      setPreviewData(null);
      setFormData({
        subject: contract.subject || '',
        contract_value: contract.contract_value?.toString() || '',
        start_date: contract.start_date || '',
        end_date: contract.end_date || '',
        description: contract.description || '',
        contract_type_id: contract.contract_type_id || '',
        visible_to_client: contract.visible_to_client ?? true,
      });
      fetchContractData(contract.id);
      fetchContractPreviewData(contract.id);
    }
  }, [contract]);

  const fetchContractPreviewData = async (contractId: string): Promise<ContractPreviewData | null> => {
    setLoadingPreviewData(true);
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, contract_html, document_type, client_signature_image, blockchain_hash, blockchain_timestamp, blockchain_tx_id, blockchain_network, signature_ip, signatory_name, signatory_cpf, signatory_cnpj')
        .eq('id', contractId)
        .single();

      if (error) throw error;

      const normalized = data as ContractPreviewData;
      setPreviewData(normalized);
      return normalized;
    } catch (error) {
      console.error('Error fetching contract preview data:', error);
      return null;
    } finally {
      setLoadingPreviewData(false);
    }
  };

  const getResolvedContract = () => {
    if (!contract) return null;
    if (!previewData || previewData.id !== contract.id) return contract;
    return { ...contract, ...previewData };
  };

  const fetchContractTypes = async () => {
    const { data } = await supabase.from('contract_types').select('*');
    setContractTypes(data || []);
  };

  const fetchContractData = async (contractId: string) => {
    setLoading(true);
    try {
      const [commentsRes, notesRes, tasksRes, attachmentsRes, renewalRes, auditRes] = await Promise.all([
        supabase.from('contract_comments').select('*').eq('contract_id', contractId).order('created_at', { ascending: false }),
        supabase.from('contract_notes').select('*').eq('contract_id', contractId).order('created_at', { ascending: false }),
        supabase.from('contract_tasks').select('*').eq('contract_id', contractId).order('created_at', { ascending: false }),
        supabase.from('contract_attachments').select('*').eq('contract_id', contractId).order('created_at', { ascending: false }),
        supabase.from('contract_renewal_history').select('*').eq('contract_id', contractId).order('renewed_at', { ascending: false }),
        supabase.from('signature_audit_log').select('*').eq('contract_id', contractId).order('created_at', { ascending: false }),
      ]);
      setComments(commentsRes.data || []);
      setNotes(notesRes.data || []);
      setTasks(tasksRes.data || []);
      setAttachments(attachmentsRes.data || []);
      setRenewalHistory(renewalRes.data || []);
      setAuditLogs(auditRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  // ─── Save Contract Info ───────────────────────────────────────────────────
  const handleSave = async () => {
    if (!contract) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('contracts').update({
        subject: formData.subject,
        contract_value: formData.contract_value ? parseFloat(formData.contract_value) : null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        description: formData.description || null,
        contract_type_id: formData.contract_type_id || null,
        visible_to_client: formData.visible_to_client,
      }).eq('id', contract.id);
      if (error) throw error;
      toast.success('Contrato atualizado');
      onUpdate();
    } catch {
      toast.error('Erro ao atualizar contrato');
    } finally {
      setSaving(false);
    }
  };

  // ─── Comments CRUD ────────────────────────────────────────────────────────
  const addComment = async () => {
    if (!contract || !newComment.trim()) return;
    setSavingComment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('contract_comments').insert({
        contract_id: contract.id,
        content: newComment.trim(),
        user_id: user?.id || null,
      });
      if (error) throw error;
      setNewComment('');
      toast.success('Comentário adicionado');
      await fetchContractData(contract.id);
    } catch {
      toast.error('Erro ao adicionar comentário');
    } finally {
      setSavingComment(false);
    }
  };

  const deleteComment = async (id: string) => {
    if (!contract) return;
    const { error } = await supabase.from('contract_comments').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir comentário'); return; }
    toast.success('Comentário excluído');
    await fetchContractData(contract.id);
  };

  // ─── Notes CRUD ───────────────────────────────────────────────────────────
  const addNote = async () => {
    if (!contract || !newNote.trim()) return;
    setSavingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('contract_notes').insert({
        contract_id: contract.id,
        content: newNote.trim(),
        created_by: user?.id || null,
      });
      if (error) throw error;
      setNewNote('');
      toast.success('Nota salva');
      await fetchContractData(contract.id);
    } catch {
      toast.error('Erro ao salvar nota');
    } finally {
      setSavingNote(false);
    }
  };

  const saveEditNote = async (id: string) => {
    if (!contract || !editingNoteContent.trim()) return;
    const { error } = await supabase.from('contract_notes').update({ content: editingNoteContent.trim() }).eq('id', id);
    if (error) { toast.error('Erro ao editar nota'); return; }
    setEditingNoteId(null);
    toast.success('Nota atualizada');
    await fetchContractData(contract.id);
  };

  const deleteNote = async (id: string) => {
    if (!contract) return;
    const { error } = await supabase.from('contract_notes').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir nota'); return; }
    toast.success('Nota excluída');
    await fetchContractData(contract.id);
  };

  // ─── Tasks CRUD ───────────────────────────────────────────────────────────
  const addTask = async () => {
    if (!contract || !newTask.title.trim()) return;
    setSavingTask(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('contract_tasks').insert({
        contract_id: contract.id,
        title: newTask.title.trim(),
        description: newTask.description || null,
        due_date: newTask.due_date || null,
        completed: false,
        created_by: user?.id || null,
      });
      if (error) throw error;
      setNewTask({ title: '', description: '', due_date: '' });
      setShowTaskForm(false);
      toast.success('Tarefa criada');
      await fetchContractData(contract.id);
    } catch {
      toast.error('Erro ao criar tarefa');
    } finally {
      setSavingTask(false);
    }
  };

  const toggleTask = async (task: Task) => {
    if (!contract) return;
    const { error } = await supabase.from('contract_tasks').update({
      completed: !task.completed,
      completed_at: !task.completed ? new Date().toISOString() : null,
    }).eq('id', task.id);
    if (error) { toast.error('Erro ao atualizar tarefa'); return; }
    await fetchContractData(contract.id);
  };

  const deleteTask = async (id: string) => {
    if (!contract) return;
    const { error } = await supabase.from('contract_tasks').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir tarefa'); return; }
    toast.success('Tarefa excluída');
    await fetchContractData(contract.id);
  };

  // ─── Attachments ──────────────────────────────────────────────────────────
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !contract) return;
    setUploadingFile(true);
    let uploaded = 0;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `contracts/${contract.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
        if (uploadError) { toast.error(`Erro ao enviar ${file.name}`); continue; }
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
        const { error: dbError } = await supabase.from('contract_attachments').insert({
          contract_id: contract.id,
          name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user?.id || null,
        });
        if (!dbError) uploaded++;
      }
      if (uploaded > 0) {
        toast.success(`${uploaded} arquivo(s) enviado(s)`);
        await fetchContractData(contract.id);
      }
    } finally {
      setUploadingFile(false);
    }
  };

  const deleteAttachment = async (attachment: Attachment) => {
    if (!contract) return;
    // Extract path from public URL
    const urlParts = attachment.file_url.split('/storage/v1/object/public/documents/');
    if (urlParts[1]) {
      await supabase.storage.from('documents').remove([urlParts[1]]);
    }
    const { error } = await supabase.from('contract_attachments').delete().eq('id', attachment.id);
    if (error) { toast.error('Erro ao excluir anexo'); return; }
    toast.success('Anexo excluído');
    await fetchContractData(contract.id);
  };

  // ─── Signature / Link / Email ─────────────────────────────────────────────
  const generateSignatureLink = async () => {
    if (!contract) return;
    setGeneratingLink(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-signature-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ contractId: contract.id, baseUrl: getProductionBaseUrl() }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || 'Erro ao gerar link');
      toast.success('Link de assinatura gerado!');
      onUpdate();

      // Auto-send notification to client
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-signature-request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ contractId: contract.id, channels: ['email', 'whatsapp'], baseUrl: getProductionBaseUrl() }),
        });
        toast.success('Notificação enviada ao cliente automaticamente!');
      } catch (e) {
        console.error('Auto-send notification failed:', e);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao gerar link');
    } finally {
      setGeneratingLink(false);
    }
  };

  // ─── Generate New Link (update template + new token) ───────────────────
  const generateNewContractLink = async () => {
    if (!contract || !contract.user_id) {
      toast.error('Contrato sem cliente associado');
      return;
    }
    setGeneratingNewLink(true);
    try {
      const docType = contract.document_type || 'contract';

      // 1. Fetch the correct active template based on document type
      const templateNamePatterns: Record<string, string[]> = {
        'contract': ['%Registro de Marca%', '%Contrato Padrão%'],
        'procuracao': ['%Procura%'],
        'distrato_multa': ['%Distrato com Multa%', '%Distrato%Multa%'],
        'distrato_sem_multa': ['%Distrato sem Multa%'],
      };

      const patterns = templateNamePatterns[docType] || templateNamePatterns['contract'];
      const orFilter = patterns.map(p => `name.ilike.${p}`).join(',');

      const { data: templateData, error: templateError } = await supabase
        .from('contract_templates')
        .select('content')
        .eq('is_active', true)
        .or(orFilter)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (templateError || !templateData?.length) throw new Error(`Template ativo não encontrado para tipo: ${DOCUMENT_TYPE_LABELS[docType] || docType}`);

      // 2. Fetch client profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email, phone, cpf, cnpj, company_name, address, neighborhood, city, state, zip_code')
        .eq('id', contract.user_id)
        .single();
      
      if (profileError || !profile) throw new Error('Dados do cliente não encontrados');

      // 3. Replace variables based on document type
      let replacedContent: string;
      const hasCNPJ = !!(profile.cnpj && profile.cnpj.trim());
      const currentDateFormatted = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      const enderecoCompleto = [profile.address, profile.neighborhood, profile.city ? `${profile.city} - ${profile.state}` : profile.state, profile.zip_code ? `CEP ${profile.zip_code}` : ''].filter(Boolean).join(', ');
      const nomeEmpresa = hasCNPJ && profile.company_name ? profile.company_name : profile.full_name || '';

      if (docType === 'procuracao' || docType === 'distrato_multa' || docType === 'distrato_sem_multa') {
        // These templates use {{nome_empresa}}, {{nome_representante}}, {{cpf_representante}}, etc.
        replacedContent = templateData[0].content
          .replace(/\{\{nome_empresa\}\}/g, nomeEmpresa)
          .replace(/\{\{endereco_empresa\}\}/g, enderecoCompleto)
          .replace(/\{\{cidade\}\}/g, profile.city || '')
          .replace(/\{\{estado\}\}/g, profile.state || '')
          .replace(/\{\{cep\}\}/g, profile.zip_code || '')
          .replace(/\{\{cnpj\}\}/g, profile.cnpj || '')
          .replace(/\{\{nome_representante\}\}/g, profile.full_name || '')
          .replace(/\{\{cpf_representante\}\}/g, profile.cpf || '')
          .replace(/\{\{email\}\}/g, profile.email || '')
          .replace(/\{\{telefone\}\}/g, profile.phone || '')
          .replace(/\{\{marca\}\}/g, contract.subject || '')
          .replace(/\{\{data_procuracao\}\}/g, currentDateFormatted)
          .replace(/\{\{data_distrato\}\}/g, currentDateFormatted)
          .replace(/\{\{numero_parcelas\}\}/g, contract.penalty_value ? '1' : '')
          .replace(/\{\{valor_multa\}\}/g, contract.penalty_value ? contract.penalty_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00')
          .replace(/\{\{data\}\}/g, new Date().toLocaleDateString('pt-BR'));
      } else {
        // Contract type uses replaceContractVariables
        replacedContent = replaceContractVariables(templateData[0].content, {
          personalData: {
            fullName: profile.full_name || '',
            email: profile.email || '',
            phone: profile.phone || '',
            cpf: profile.cpf || '',
            cep: profile.zip_code || '',
            address: profile.address || '',
            neighborhood: profile.neighborhood || '',
            city: profile.city || '',
            state: profile.state || '',
          },
          brandData: {
            brandName: contract.subject || '',
            businessArea: '',
            hasCNPJ,
            cnpj: profile.cnpj || '',
            companyName: profile.company_name || '',
          },
          paymentMethod: contract.payment_method || '',
        });
      }

      // 4. Generate full HTML using generateDocumentPrintHTML (handles all doc types correctly)
      const logoBase64 = await getLogoBase64ForPDF();
      const newHtml = generateDocumentPrintHTML(
        docType as any,
        replacedContent,
        null, // no client signature
        undefined, // no blockchain signature
        profile.full_name || undefined,
        profile.cpf || undefined,
        profile.cnpj || undefined,
        undefined,
        getProductionBaseUrl(),
        logoBase64,
      );

      // 5. Update contract_html in database
      const { error: updateError } = await supabase
        .from('contracts')
        .update({ contract_html: newHtml })
        .eq('id', contract.id);
      
      if (updateError) throw updateError;

      // 6. Generate new signature link
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-signature-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ contractId: contract.id, baseUrl: getProductionBaseUrl() }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || 'Erro ao gerar link');

      toast.success('Documento atualizado com template vigente e novo link gerado!');
      onUpdate();

      // Auto-send notification to client
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-signature-request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ contractId: contract.id, channels: ['email', 'whatsapp'], baseUrl: getProductionBaseUrl() }),
        });
        toast.success('Notificação enviada ao cliente automaticamente!');
      } catch (e) {
        console.error('Auto-send notification failed:', e);
      }
    } catch (error: any) {
      console.error('Error generating new contract link:', error);
      toast.error(error.message || 'Erro ao gerar novo link');
    } finally {
      setGeneratingNewLink(false);
    }
  };

  const sendSignatureRequest = async () => {
    if (!contract) return;
    setSendingRequest(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-signature-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ contractId: contract.id, channels: ['email', 'whatsapp'], baseUrl: getProductionBaseUrl() }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success('Solicitação de assinatura enviada!');
        if (contract) fetchContractData(contract.id);
      } else throw new Error(result.error || 'Erro ao enviar solicitação');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar solicitação');
    } finally {
      setSendingRequest(false);
    }
  };

  const getProductionBaseUrl = () => {
    const origin = window.location.origin;
    const isPreview = origin.includes('lovableproject.com') || origin.includes('lovable.app') || origin.includes('localhost');
    return isPreview ? 'https://webmarcas.net' : origin;
  };

  const copySignatureLink = () => {
    if (contract?.signature_token) {
      navigator.clipboard.writeText(`${getProductionBaseUrl()}/assinar/${contract.signature_token}`);
      toast.success('Link copiado!');
    }
  };

  const openPreview = async (triggerPrint = false) => {
    if (!contract) return;

    let resolvedContract = getResolvedContract();

    if (!resolvedContract?.contract_html) {
      const fetchedData = await fetchContractPreviewData(contract.id);
      if (fetchedData && fetchedData.id === contract.id) {
        resolvedContract = { ...contract, ...fetchedData };
      }
    }

    if (!resolvedContract?.contract_html) {
      toast.error('Documento sem conteúdo');
      return;
    }

    const logoBase64 = await getLogoBase64ForPDF();
    const printHtml = generateDocumentPrintHTML(
      (resolvedContract.document_type as any) || 'contract',
      resolvedContract.contract_html,
      resolvedContract.client_signature_image || null,
      resolvedContract.blockchain_hash ? {
        hash: resolvedContract.blockchain_hash,
        timestamp: resolvedContract.blockchain_timestamp || '',
        txId: resolvedContract.blockchain_tx_id || '',
        network: resolvedContract.blockchain_network || '',
        ipAddress: resolvedContract.signature_ip || '',
      } : undefined,
      resolvedContract.signatory_name || undefined,
      resolvedContract.signatory_cpf || undefined,
      resolvedContract.signatory_cnpj || undefined,
      undefined, window.location.origin, logoBase64
    );
    const enhancedHtml = printHtml.replace('</head>', `
      <style>
        @media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact !important; } }
        .save-pdf-btn { position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; gap: 10px; }
        .save-pdf-btn button { padding: 12px 24px; font-size: 14px; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .btn-primary { background: linear-gradient(135deg, #f97316, #ea580c); color: white; }
        .btn-secondary { background: #f1f5f9; color: #334155; }
      </style>
    </head>`).replace('<body', `<body><div class="save-pdf-btn no-print">
        <button class="btn-primary" onclick="window.print()">Salvar como PDF</button>
        <button class="btn-secondary" onclick="window.close()">Fechar</button>
      </div><body`);
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(enhancedHtml);
      newWindow.document.close();
      if (triggerPrint) newWindow.onload = () => setTimeout(() => newWindow.print(), 500);
    }
  };

  const sendContractEmail = async () => {
    if (!contract) return;
    setSendingEmail(true);
    try {
      let clientEmail = '';
      let clientName = '';
      if (contract.user_id) {
        const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', contract.user_id).single();
        clientEmail = profile?.email || '';
        clientName = profile?.full_name || '';
      }
      if (!clientEmail && contract.signatory_name) {
        const { data: lead } = await supabase.from('leads').select('email, full_name').eq('full_name', contract.signatory_name).single();
        clientEmail = lead?.email || '';
        clientName = lead?.full_name || '';
      }
      if (!clientEmail) { toast.error('Cliente sem email cadastrado'); return; }
      if (contract.signature_status === 'signed') {
        const { data: template } = await supabase.from('email_templates').select('subject, body').eq('trigger_event', 'contract_signed').eq('is_active', true).single();
        if (!template) { toast.error('Template de email não encontrado'); return; }
        const baseUrl = window.location.origin;
        const verificationUrl = contract.blockchain_hash ? `${baseUrl}/verificar-contrato?hash=${contract.blockchain_hash}` : `${baseUrl}/cliente/documentos`;
        const displayName = clientName || contract.signatory_name || 'Cliente';
        let emailBody = template.body
          .replace(/\{\{nome\}\}/g, displayName).replace(/\{\{marca\}\}/g, contract.subject || '')
          .replace(/\{\{data_assinatura\}\}/g, contract.signed_at ? format(new Date(contract.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'N/A')
          .replace(/\{\{hash_contrato\}\}/g, contract.blockchain_hash || 'N/A')
          .replace(/\{\{ip_assinatura\}\}/g, contract.signature_ip || 'N/A')
          .replace(/\{\{verification_url\}\}/g, verificationUrl).replace(/\{\{app_url\}\}/g, baseUrl);
        let emailSubject = template.subject.replace(/\{\{nome\}\}/g, displayName).replace(/\{\{marca\}\}/g, contract.subject || '');
        const response = await supabase.functions.invoke('send-email', { body: { to: [clientEmail], subject: emailSubject, body: emailBody.replace(/<[^>]*>/g, ''), html: emailBody } });
        if (response.error) throw response.error;
      } else {
        const session = await supabase.auth.getSession();
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-signature-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.data.session?.access_token}` },
          body: JSON.stringify({ contractId: contract.id, channels: ['email'], baseUrl: window.location.origin, overrideContact: { email: clientEmail, name: clientName || contract.signatory_name } }),
        });
        const result = await response.json();
        if (!response.ok || result.error) throw new Error(result.error || 'Erro ao enviar email');
      }
      toast.success('Email enviado com sucesso!');
      setEmailDialogOpen(false);
      if (contract) fetchContractData(contract.id);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar email');
    } finally {
      setSendingEmail(false);
    }
  };

  if (!contract) return null;

  const resolvedContract = getResolvedContract();
  const documentContent = resolvedContract?.contract_html || '';
  const documentType = (resolvedContract?.document_type as any) || 'contract';

  const signatureUrl = contract.signature_token ? `${getProductionBaseUrl()}/assinar/${contract.signature_token}` : null;
  const isExpired = contract.signature_expires_at ? new Date(contract.signature_expires_at) < new Date() : false;
  const isSigned = contract.signature_status === 'signed';

  const tabCounts = {
    attachments: attachments.length,
    comments: comments.length,
    tasks: tasks.length,
    notes: notes.length,
    audit: auditLogs.length,
    history: renewalHistory.length,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-hidden flex flex-col p-0">
        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className="px-6 pt-6 pb-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
          <SheetHeader className="space-y-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  {contract.document_type && contract.document_type !== 'contract' && (
                    <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400 bg-blue-500/10">
                      {DOCUMENT_TYPE_LABELS[contract.document_type] || contract.document_type}
                    </Badge>
                  )}
                  <Badge className={cn('text-xs border-0', isSigned
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-amber-500/15 text-amber-400')}>
                    <div className={cn('w-1.5 h-1.5 rounded-full mr-1.5', isSigned ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse')} />
                    {isSigned ? 'Assinado' : 'Pendente'}
                  </Badge>
                  {contract.signed_at && (
                    <span className="text-xs text-muted-foreground">
                      Assinado em {format(new Date(contract.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
                <SheetTitle className="text-lg font-bold truncate">
                  {contract.subject || `Contrato #${contract.contract_number}`}
                </SheetTitle>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => openPreview()} className="h-8 gap-1.5 text-xs">
                  <Eye className="h-3.5 w-3.5" /> Visualizar
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openPreview(true)} disabled={downloadingPdf}>
                  {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEmailDialogOpen(true)}>
                  <Mail className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={async () => {
                    if (!contract) return;
                    await Promise.all([fetchContractData(contract.id), fetchContractPreviewData(contract.id)]);
                  }}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openPreview()}><Eye className="h-4 w-4 mr-2" />Visualizar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openPreview(true)}><Download className="h-4 w-4 mr-2" />Download PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEmailDialogOpen(true)}><Mail className="h-4 w-4 mr-2" />Enviar por Email</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Blockchain Badge */}
            {isSigned && contract.blockchain_hash && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <span className="font-semibold text-sm text-emerald-400">Certificação Digital</span>
                  <div className="ml-auto flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-500">Verificado</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { label: 'Hash SHA-256', value: contract.blockchain_hash, mono: true },
                    { label: 'Rede', value: contract.blockchain_network },
                    { label: 'IP do Signatário', value: contract.signature_ip },
                    { label: 'TX ID', value: contract.blockchain_tx_id, mono: true },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-emerald-600 dark:text-emerald-500 font-medium mb-0.5">{item.label}</p>
                      <p className={cn('truncate text-foreground/80', item.mono && 'font-mono')}>{item.value || '—'}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Signature Link */}
            {!isSigned && (
              <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium text-xs">Link de Assinatura</span>
                  </div>
                  {signatureUrl && !isExpired && (
                    <Badge variant="outline" className="text-[10px] h-5">
                      <Clock className="h-2.5 w-2.5 mr-1" />
                      Expira {format(new Date(contract.signature_expires_at!), 'dd/MM/yyyy', { locale: ptBR })}
                    </Badge>
                  )}
                  {isExpired && <Badge variant="destructive" className="text-[10px] h-5">Expirado</Badge>}
                </div>
                {signatureUrl && !isExpired ? (
                  <div className="flex items-center gap-2">
                    <Input value={signatureUrl} readOnly className="font-mono text-xs h-8 flex-1 bg-background" />
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={copySignatureLink}><Copy className="h-3 w-3" /></Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                      <a href={signatureUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{isExpired ? 'Link expirado. Gere um novo.' : 'Nenhum link gerado ainda.'}</p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={generateSignatureLink} disabled={generatingLink}>
                    {generatingLink ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Link className="h-3 w-3 mr-1.5" />}
                    {signatureUrl ? 'Regenerar' : 'Gerar Link'}
                  </Button>
                  {isExpired && !isSigned && (
                    <Button size="sm" className="h-7 text-xs" onClick={generateNewContractLink} disabled={generatingNewLink}>
                      {generatingNewLink ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1.5" />}
                      Gerar Novo Link
                    </Button>
                  )}
                  {signatureUrl && !isExpired && (
                    <Button size="sm" className="h-7 text-xs" onClick={sendSignatureRequest} disabled={sendingRequest}>
                      {sendingRequest ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Send className="h-3 w-3 mr-1.5" />}
                      Enviar para Cliente
                    </Button>
                  )}
                </div>
              </div>
            )}
          </SheetHeader>
        </div>

        {/* ─── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 pt-3 pb-0 flex-shrink-0 border-b border-border">
              <TabsList className="h-auto bg-transparent p-0 gap-0 w-full justify-start overflow-x-auto flex-nowrap">
                {[
                  { value: 'info', label: 'Info', icon: FileText, count: null },
                  { value: 'contract', label: 'Documento', icon: Files, count: null },
                  { value: 'attachments', label: 'Anexos', icon: Paperclip, count: tabCounts.attachments },
                  { value: 'comments', label: 'Comentários', icon: MessageSquare, count: tabCounts.comments },
                  { value: 'audit', label: 'Auditoria', icon: Activity, count: tabCounts.audit },
                  { value: 'tasks', label: 'Tarefas', icon: CheckSquare, count: tabCounts.tasks },
                  { value: 'notes', label: 'Notas', icon: StickyNote, count: tabCounts.notes },
                  { value: 'history', label: 'Histórico', icon: History, count: tabCounts.history },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="relative h-10 rounded-none px-3 text-xs font-medium text-muted-foreground border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent bg-transparent hover:text-foreground transition-colors gap-1.5 whitespace-nowrap"
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {tab.count !== null && tab.count > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold leading-none">
                        {tab.count}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <div className="px-6 py-5">

                {/* ─── INFO TAB ───────────────────────────────────────────── */}
                <TabsContent value="info" className="mt-0 space-y-5">
                  <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 border border-border">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox id="hide" checked={!formData.visible_to_client}
                        onCheckedChange={(c) => setFormData({ ...formData, visible_to_client: !c })} />
                      <span className="text-xs flex items-center gap-1.5 text-muted-foreground">
                        <EyeOff className="h-3.5 w-3.5" /> Ocultar do cliente
                      </span>
                    </label>
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente</Label>
                      <Input disabled value={contract.signatory_name || 'Cliente vinculado'} className="bg-muted/30" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assunto *</Label>
                      <Input value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} placeholder="Assunto do contrato" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor do Contrato</Label>
                      <div className="relative">
                        <Input type="number" step="0.01" value={formData.contract_value} onChange={(e) => setFormData({ ...formData, contract_value: e.target.value })} className="pr-12" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo de contrato</Label>
                      <Select value={formData.contract_type_id} onValueChange={(v) => setFormData({ ...formData, contract_type_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                        <SelectContent>
                          {contractTypes.map(type => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data de Início</Label>
                        <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data Final</Label>
                        <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</Label>
                      <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving} size="sm">
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </div>
                </TabsContent>

                {/* ─── DOCUMENT TAB ───────────────────────────────────────── */}
                <TabsContent value="contract" className="mt-0">
                  <div className="border rounded-xl overflow-hidden">
                    {documentContent ? (
                      <DocumentRenderer
                        documentType={documentType}
                        content={documentContent}
                        clientSignature={resolvedContract?.client_signature_image || null}
                        signatoryName={resolvedContract?.signatory_name || undefined}
                        signatoryCpf={resolvedContract?.signatory_cpf || undefined}
                        signatoryCnpj={resolvedContract?.signatory_cnpj || undefined}
                        showCertificationSection={isSigned}
                        blockchainSignature={resolvedContract?.blockchain_hash ? {
                          hash: resolvedContract.blockchain_hash,
                          timestamp: resolvedContract.blockchain_timestamp || '',
                          txId: resolvedContract.blockchain_tx_id || '',
                          network: resolvedContract.blockchain_network || '',
                          ipAddress: resolvedContract.signature_ip || '',
                        } : undefined}
                      />
                    ) : loadingPreviewData ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : (
                      <EmptyState icon={FileText} title="Nenhum documento" description="Este contrato não possui conteúdo definido" />
                    )}
                  </div>
                </TabsContent>

                {/* ─── ATTACHMENTS TAB ────────────────────────────────────── */}
                <TabsContent value="attachments" className="mt-0 space-y-4">
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />

                  {/* Drop zone */}
                  <div
                    className={cn(
                      'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
                      dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
                    )}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files); }}
                  >
                    {uploadingFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">Enviando arquivo(s)...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Upload className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Arraste arquivos ou clique para selecionar</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Suporta qualquer tipo de arquivo</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {attachments.length === 0 ? (
                    <EmptyState icon={Paperclip} title="Nenhum anexo" description="Faça upload de documentos, imagens ou outros arquivos" />
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence>
                        {attachments.map((att) => (
                          <motion.div
                            key={att.id}
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors group"
                          >
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <FileIcon mimeType={att.mime_type} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{att.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatBytes(att.file_size)} · {format(new Date(att.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <a href={att.file_url} target="_blank" rel="noopener noreferrer" download>
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => deleteAttachment(att)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </TabsContent>

                {/* ─── COMMENTS TAB ───────────────────────────────────────── */}
                <TabsContent value="comments" className="mt-0 space-y-4">
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <Textarea
                      placeholder="Escreva um comentário sobre este contrato..."
                      rows={3}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) addComment(); }}
                      className="resize-none border-0 bg-transparent p-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
                    />
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <span className="text-[10px] text-muted-foreground">Ctrl+Enter para enviar</span>
                      <Button size="sm" className="h-7 text-xs" onClick={addComment} disabled={savingComment || !newComment.trim()}>
                        {savingComment ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <MessageSquare className="h-3 w-3 mr-1.5" />}
                        Comentar
                      </Button>
                    </div>
                  </div>

                  {comments.length === 0 ? (
                    <EmptyState icon={MessageSquare} title="Nenhum comentário" description="Seja o primeiro a comentar sobre este contrato" />
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence>
                        {comments.map((c) => (
                          <motion.div
                            key={c.id}
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex gap-3 group"
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 rounded-xl border border-border bg-card p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold">Administrador</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                                  </span>
                                  <Button
                                    variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                                    onClick={() => deleteComment(c.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.content}</p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </TabsContent>

                {/* ─── AUDIT TAB ──────────────────────────────────────────── */}
                <TabsContent value="audit" className="mt-0">
                  {auditLogs.length === 0 ? (
                    <EmptyState icon={Activity} title="Nenhum registro" description="As atividades de assinatura aparecerão aqui" />
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
                      <div className="space-y-1">
                        <AnimatePresence>
                          {auditLogs.map((log, idx) => {
                            const evtCfg = EVENT_LABELS[log.event_type] || { label: log.event_type, color: 'text-muted-foreground', icon: Activity };
                            const EvtIcon = evtCfg.icon;
                            return (
                              <motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="flex gap-4 pl-2"
                              >
                                <div className={cn('relative z-10 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center flex-shrink-0 mt-3', 'bg-muted')}>
                                  <EvtIcon className={cn('h-3 w-3', evtCfg.color)} />
                                </div>
                                <div className="flex-1 py-3 pr-2">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <span className={cn('text-sm font-semibold', evtCfg.color)}>{evtCfg.label}</span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                                    </span>
                                  </div>
                                  <div className="flex gap-3 mt-1 flex-wrap">
                                    {log.ip_address && (
                                      <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded font-mono">
                                        IP: {log.ip_address}
                                      </span>
                                    )}
                                    {log.user_agent && (
                                      <span className="text-[10px] text-muted-foreground truncate max-w-xs">
                                        {log.user_agent.substring(0, 60)}...
                                      </span>
                                    )}
                                  </div>
                                  {log.event_data && Object.keys(log.event_data).length > 0 && (
                                    <details className="mt-1.5">
                                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                                        <ChevronRight className="h-3 w-3 inline mr-1" />Ver dados
                                      </summary>
                                      <pre className="text-[10px] bg-muted/50 border border-border p-2 rounded-lg mt-1 overflow-x-auto font-mono">
                                        {JSON.stringify(log.event_data, null, 2)}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ─── TASKS TAB ──────────────────────────────────────────── */}
                <TabsContent value="tasks" className="mt-0 space-y-4">
                  {/* New task form */}
                  <AnimatePresence>
                    {showTaskForm ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">Nova Tarefa</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowTaskForm(false)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Título da tarefa *"
                          value={newTask.title}
                          onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                          autoFocus
                        />
                        <Textarea
                          placeholder="Descrição (opcional)"
                          rows={2}
                          value={newTask.description}
                          onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                          className="resize-none"
                        />
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <Input
                              type="date"
                              value={newTask.due_date}
                              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                              className="h-8 text-xs"
                            />
                          </div>
                          <Button size="sm" className="h-8 text-xs" onClick={addTask} disabled={savingTask || !newTask.title.trim()}>
                            {savingTask ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Plus className="h-3 w-3 mr-1.5" />}
                            Criar
                          </Button>
                        </div>
                      </motion.div>
                    ) : (
                      <Button variant="outline" className="w-full h-10 border-dashed" onClick={() => setShowTaskForm(true)}>
                        <Plus className="h-4 w-4 mr-2" />Nova Tarefa
                      </Button>
                    )}
                  </AnimatePresence>

                  {tasks.length === 0 ? (
                    <EmptyState icon={CheckSquare} title="Nenhuma tarefa" description="Crie tarefas para acompanhar o progresso do contrato" />
                  ) : (
                    <div className="space-y-2">
                      {/* Progress bar */}
                      {tasks.length > 0 && (
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-primary"
                              initial={{ width: 0 }}
                              animate={{ width: `${(tasks.filter(t => t.completed).length / tasks.length) * 100}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {tasks.filter(t => t.completed).length}/{tasks.length} concluídas
                          </span>
                        </div>
                      )}
                      <AnimatePresence>
                        {tasks.map((task) => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className={cn(
                              'flex items-start gap-3 p-3 rounded-xl border transition-all group',
                              task.completed ? 'border-border bg-muted/20 opacity-60' : 'border-border bg-card hover:bg-muted/20'
                            )}
                          >
                            <button
                              className={cn(
                                'w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all',
                                task.completed ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-primary'
                              )}
                              onClick={() => toggleTask(task)}
                            >
                              {task.completed && <Check className="h-3 w-3 text-primary-foreground" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-sm font-medium', task.completed && 'line-through text-muted-foreground')}>
                                {task.title}
                              </p>
                              {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                              {task.due_date && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <span className={cn('text-[10px]', new Date(task.due_date) < new Date() && !task.completed ? 'text-red-400' : 'text-muted-foreground')}>
                                    {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                                    {new Date(task.due_date) < new Date() && !task.completed && ' · Atrasada'}
                                  </span>
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                              onClick={() => deleteTask(task.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </TabsContent>

                {/* ─── NOTES TAB ──────────────────────────────────────────── */}
                <TabsContent value="notes" className="mt-0 space-y-4">
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <Textarea
                      placeholder="Adicione uma nota interna sobre este contrato..."
                      rows={4}
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="resize-none border-0 bg-transparent p-0 focus-visible:ring-0"
                    />
                    <div className="flex justify-end border-t border-border pt-3">
                      <Button size="sm" className="h-7 text-xs" onClick={addNote} disabled={savingNote || !newNote.trim()}>
                        {savingNote ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <StickyNote className="h-3 w-3 mr-1.5" />}
                        Salvar Nota
                      </Button>
                    </div>
                  </div>

                  {notes.length === 0 ? (
                    <EmptyState icon={StickyNote} title="Nenhuma nota" description="Adicione notas internas sobre este contrato" />
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence>
                        {notes.map((note) => (
                          <motion.div
                            key={note.id}
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="rounded-xl border border-border bg-amber-500/5 border-amber-500/20 p-4 group relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/40 rounded-l-xl" />
                            <div className="pl-3">
                              {editingNoteId === note.id ? (
                                <div className="space-y-2">
                                  <Textarea
                                    value={editingNoteContent}
                                    onChange={(e) => setEditingNoteContent(e.target.value)}
                                    rows={3}
                                    className="resize-none text-sm"
                                    autoFocus
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingNoteId(null)}>Cancelar</Button>
                                    <Button size="sm" className="h-7 text-xs" onClick={() => saveEditNote(note.id)}>
                                      <Save className="h-3 w-3 mr-1" />Salvar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="text-[10px] text-muted-foreground">
                                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: ptBR })}
                                    </span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button variant="ghost" size="icon" className="h-6 w-6"
                                        onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.content); }}>
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => deleteNote(note.id)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </TabsContent>

                {/* ─── HISTORY TAB ────────────────────────────────────────── */}
                <TabsContent value="history" className="mt-0">
                  {renewalHistory.length === 0 ? (
                    <EmptyState icon={History} title="Sem histórico" description="O histórico de renovações do contrato aparecerá aqui" />
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence>
                        {renewalHistory.map((h, idx) => (
                          <motion.div
                            key={h.id}
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="rounded-xl border border-border bg-card p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <RefreshCw className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold">Renovação de Contrato</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(h.renewed_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                              {h.previous_end_date && h.new_end_date && (
                                <div className="col-span-2 flex items-center gap-2">
                                  <div className="flex-1 p-2 rounded-lg bg-muted/50 text-center">
                                    <p className="text-muted-foreground text-[10px] mb-0.5">Término anterior</p>
                                    <p className="font-medium">{format(new Date(h.previous_end_date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                                  </div>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <div className="flex-1 p-2 rounded-lg bg-primary/10 border border-primary/20 text-center">
                                    <p className="text-primary text-[10px] mb-0.5">Novo término</p>
                                    <p className="font-medium text-primary">{format(new Date(h.new_end_date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                                  </div>
                                </div>
                              )}
                              {h.previous_value != null && h.new_value != null && (
                                <div className="col-span-2 flex items-center gap-2">
                                  <div className="flex-1 p-2 rounded-lg bg-muted/50 text-center">
                                    <p className="text-muted-foreground text-[10px] mb-0.5">Valor anterior</p>
                                    <p className="font-medium">
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(h.previous_value)}
                                    </p>
                                  </div>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <div className="flex-1 p-2 rounded-lg bg-primary/10 border border-primary/20 text-center">
                                    <p className="text-primary text-[10px] mb-0.5">Novo valor</p>
                                    <p className="font-medium text-primary">
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(h.new_value)}
                                    </p>
                                  </div>
                                </div>
                              )}
                              {h.notes && (
                                <div className="col-span-2 p-2 rounded-lg bg-muted/30">
                                  <p className="text-muted-foreground text-[10px] mb-0.5">Observações</p>
                                  <p>{h.notes}</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </TabsContent>

              </div>
            </ScrollArea>
          </Tabs>
        </div>

        {/* ─── Email Dialog ─────────────────────────────────────────────────── */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isSigned ? 'Enviar Confirmação de Assinatura' : 'Enviar Link de Assinatura'}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <div className={cn('flex items-center gap-2 p-3 rounded-lg border', isSigned
                ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800')}>
                {isSigned
                  ? <Shield className="h-5 w-5 text-green-600" />
                  : <AlertCircle className="h-5 w-5 text-amber-600" />}
                <div>
                  <p className={cn('text-sm font-medium', isSigned ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200')}>
                    {isSigned ? 'Contrato já assinado' : 'Contrato pendente de assinatura'}
                  </p>
                  <p className={cn('text-xs', isSigned ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>
                    {isSigned
                      ? 'O cliente receberá a confirmação com detalhes da assinatura e verificação blockchain.'
                      : 'O cliente receberá o link para assinar o documento digitalmente.'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Documento: "{contract.subject || contract.contract_number}"</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancelar</Button>
              <Button onClick={sendContractEmail} disabled={sendingEmail}>
                {sendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                {sendingEmail ? 'Enviando...' : isSigned ? 'Enviar Confirmação' : 'Enviar Link'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
