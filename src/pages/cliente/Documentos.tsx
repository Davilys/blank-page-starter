import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ClientLayout } from '@/components/cliente/ClientLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  FolderOpen, Search, Download, FileText, Eye, Upload,
  FileSignature, Inbox, Shield, RefreshCw, X,
  File as FileIcon, CheckCircle, Scale, BadgeDollarSign,
  Building2, Award, BookOpen, ClipboardList, Package, Printer,
  ExternalLink, Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { DocumentUploader } from '@/components/shared/DocumentUploader';
import { DocumentPreview } from '@/components/shared/DocumentPreview';
import { DocumentRenderer, generateDocumentPrintHTML, getLogoBase64ForPDF } from '@/components/contracts/DocumentRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ── Types ────────────────────────────────────────────────────────────────────
interface Document {
  id: string;
  name: string;
  document_type: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  signature_status?: string;
  blockchain_hash?: string;
  isContract?: boolean;
  contract_id?: string;
}

interface ContractData {
  contract_html: string | null;
  blockchain_hash: string | null;
  blockchain_timestamp: string | null;
  signature_ip: string | null;
  blockchain_tx_id: string | null;
  blockchain_network: string | null;
  document_type: string | null;
  signatory_name: string | null;
  signatory_cpf: string | null;
  signatory_cnpj: string | null;
  client_signature_image: string | null;
}

// ── Fixed tab config ─────────────────────────────────────────────────────────
const TABS = [
  { key: 'all',        label: 'Todos',       icon: FolderOpen,      colorRgb: '99,102,241' },
  { key: 'contrato',   label: 'Contrato',    icon: FileSignature,   colorRgb: '59,130,246' },
  { key: 'procuracao', label: 'Procuração',  icon: Scale,           colorRgb: '139,92,246' },
  { key: 'taxa',       label: 'Taxa',        icon: BadgeDollarSign, colorRgb: '16,185,129' },
  { key: 'busca_inpi', label: 'Busca INPI',  icon: Building2,       colorRgb: '249,115,22' },
  { key: 'certificado',label: 'Certificado', icon: Award,           colorRgb: '234,179,8'  },
  { key: 'rpi',        label: 'RPI',         icon: BookOpen,        colorRgb: '20,184,166' },
  { key: 'parecer',    label: 'Parecer',     icon: ClipboardList,   colorRgb: '239,68,68'  },
  { key: 'comprovante',label: 'Comprovantes',icon: Package,         colorRgb: '6,182,212'  },
  { key: 'outro',      label: 'Outros',      icon: FileIcon,        colorRgb: '100,116,139'},
] as const;

type TabKey = typeof TABS[number]['key'];

// Types that map to "outros" bucket
const OUTRO_TYPES = new Set(['outro', 'anexo', 'laudo', 'notificacao', 'distrato', 'imagem']);

function normalizeType(raw: string | null | undefined): TabKey {
  if (!raw) return 'outro';
  const t = raw.toLowerCase().trim();
  if (t === 'contrato') return 'contrato';
  if (t === 'procuracao' || t === 'procuração') return 'procuracao';
  if (t === 'taxa') return 'taxa';
  if (t === 'busca_inpi' || t === 'busca inpi') return 'busca_inpi';
  if (t === 'certificado') return 'certificado';
  if (t === 'rpi') return 'rpi';
  if (t === 'parecer') return 'parecer';
  if (t === 'comprovante' || t === 'comprovantes') return 'comprovante';
  return 'outro';
}

function getTabCfg(key: TabKey) {
  return TABS.find(t => t.key === key) ?? TABS[TABS.length - 1];
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Particles (deterministic)
const PARTICLES = Array.from({ length: 12 }).map((_, i) => ({
  x: (i * 53.7 + 11) % 100, y: (i * 37.3 + 7) % 100,
  s: 1 + (i % 3) * 0.6, dur: 7 + (i % 5),
  delay: (i * 0.52) % 5, op: 0.025 + (i % 4) * 0.012,
}));

// ── Contract Preview Modal ───────────────────────────────────────────────────
function ContractPreviewModal({ contractId, name, signatureStatus, blockchainHash, open, onClose }: {
  contractId: string;
  name: string;
  signatureStatus?: string;
  blockchainHash?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [contractData, setContractData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && contractId) {
      setLoading(true);
      supabase
        .from('contracts')
        .select(`contract_html, blockchain_hash, blockchain_timestamp, signature_ip,
                 blockchain_tx_id, blockchain_network, document_type,
                 signatory_name, signatory_cpf, signatory_cnpj, client_signature_image`)
        .eq('id', contractId)
        .single()
        .then(({ data }) => {
          setContractData(data);
          setLoading(false);
        });
    }
  }, [open, contractId]);

  const handlePrint = async () => {
    if (!contractData?.contract_html) return;
    try {
      const logoBase64 = await getLogoBase64ForPDF();
      const docType = (contractData.document_type || 'contract') as any;
      const printHtml = generateDocumentPrintHTML(
        docType,
        contractData.contract_html,
        contractData.client_signature_image || undefined,
        contractData.blockchain_hash ? {
          hash: contractData.blockchain_hash,
          timestamp: contractData.blockchain_timestamp || '',
          txId: contractData.blockchain_tx_id || '',
          network: contractData.blockchain_network || '',
          ipAddress: contractData.signature_ip || '',
        } : undefined,
        contractData.signatory_name || undefined,
        contractData.signatory_cpf || undefined,
        contractData.signatory_cnpj || undefined,
        undefined,
        window.location.origin,
        logoBase64
      );

      const enhanced = printHtml
        .replace('</head>', `<style>
          @media print { .no-print { display: none !important; } }
          .fab { position:fixed;top:16px;right:16px;z-index:9999;display:flex;gap:8px; }
          .fab button { padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer;border:none;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.15); }
          .fab .p { background:linear-gradient(135deg,#f97316,#ea580c);color:#fff; }
          .fab .s { background:#f1f5f9;color:#334155; }
        </style></head>`)
        .replace('<body', `<body><div class="fab no-print"><button class="p" onclick="window.print()">⬇ Salvar PDF</button><button class="s" onclick="window.close()">✕ Fechar</button></div>`);

      const w = window.open('', '_blank');
      if (w) {
        w.document.write(enhanced);
        w.document.close();
        w.onload = () => setTimeout(() => w.print(), 500);
      }
    } catch (e) {
      toast.error('Erro ao gerar PDF');
    }
  };

  const isSigned = signatureStatus === 'signed';
  const blockchainSig = contractData?.blockchain_hash ? {
    hash: contractData.blockchain_hash,
    timestamp: contractData.blockchain_timestamp || '',
    txId: contractData.blockchain_tx_id || '',
    network: contractData.blockchain_network || '',
    ipAddress: contractData.signature_ip || '',
  } : undefined;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileSignature className="h-4 w-4 text-blue-500" />
              <span className="truncate max-w-[320px]">{name}</span>
            </DialogTitle>
            <div className="flex gap-2">
              {contractData?.contract_html && (
                <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5">
                  <Printer className="h-3.5 w-3.5" />
                  Salvar PDF
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => window.open(`/verificar-contrato?id=${contractId}`, '_blank')} className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-lg border bg-muted/20 p-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando contrato...</p>
            </div>
          ) : contractData?.contract_html ? (
            <ScrollArea className="h-[62vh]">
              <div className="bg-white rounded-lg p-4">
                {isSigned && (
                  <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    <span className="text-emerald-800 font-medium text-sm">Contrato Assinado Digitalmente</span>
                    {blockchainHash && <Shield className="h-4 w-4 text-blue-600 ml-1 flex-shrink-0" />}
                  </div>
                )}
                <DocumentRenderer
                  documentType={(contractData.document_type || 'contract') as any}
                  content={contractData.contract_html}
                  clientSignature={contractData.client_signature_image || undefined}
                  blockchainSignature={blockchainSig}
                  showCertificationSection={isSigned}
                  signatoryName={contractData.signatory_name || undefined}
                  signatoryCpf={contractData.signatory_cpf || undefined}
                  signatoryCnpj={contractData.signatory_cnpj || undefined}
                />
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <FileText className="h-14 w-14 opacity-30" />
              <p className="font-medium">Conteúdo não disponível</p>
              <p className="text-sm">Abra o contrato na página de verificação</p>
              <Button size="sm" onClick={() => window.open(`/verificar-contrato?id=${contractId}`, '_blank')} className="gap-2 mt-2">
                <ExternalLink className="h-4 w-4" />
                Abrir contrato
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── DocCard ──────────────────────────────────────────────────────────────────
function DocCard({ doc, index }: { doc: Document; index: number }) {
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [filePreviewOpen, setFilePreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const tab = getTabCfg(normalizeType(doc.document_type));
  const Icon = tab.icon;
  const rgb = tab.colorRgb;
  const timeAgo = doc.created_at
    ? formatDistanceToNow(new Date(doc.created_at), { addSuffix: true, locale: ptBR })
    : '';

  // Contract-specific actions
  const handleView = () => {
    if (doc.isContract && doc.contract_id) {
      setContractModalOpen(true);
    } else {
      setFilePreviewOpen(true);
    }
  };

  const handleDownload = async () => {
    if (doc.isContract && doc.contract_id) {
      // For contracts: fetch and print as PDF
      setDownloading(true);
      try {
        const { data } = await supabase
          .from('contracts')
          .select(`contract_html, blockchain_hash, blockchain_timestamp, signature_ip,
                   blockchain_tx_id, blockchain_network, document_type,
                   signatory_name, signatory_cpf, signatory_cnpj, client_signature_image`)
          .eq('id', doc.contract_id)
          .single();

        if (!data?.contract_html) {
          // Fallback: open verify page
          window.open(`/verificar-contrato?id=${doc.contract_id}`, '_blank');
          return;
        }

        const logoBase64 = await getLogoBase64ForPDF();
        const docType = (data.document_type || 'contract') as any;
        const printHtml = generateDocumentPrintHTML(
          docType,
          data.contract_html,
          data.client_signature_image || undefined,
          data.blockchain_hash ? {
            hash: data.blockchain_hash,
            timestamp: data.blockchain_timestamp || '',
            txId: data.blockchain_tx_id || '',
            network: data.blockchain_network || '',
            ipAddress: data.signature_ip || '',
          } : undefined,
          data.signatory_name || undefined,
          data.signatory_cpf || undefined,
          data.signatory_cnpj || undefined,
          undefined,
          window.location.origin,
          logoBase64
        );

        const enhanced = printHtml
          .replace('</head>', `<style>
            @media print { .no-print { display: none !important; } }
            .fab { position:fixed;top:16px;right:16px;z-index:9999;display:flex;gap:8px; }
            .fab button { padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer;border:none;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.15); }
            .fab .p { background:linear-gradient(135deg,#f97316,#ea580c);color:#fff; }
            .fab .s { background:#f1f5f9;color:#334155; }
          </style></head>`)
          .replace('<body', `<body><div class="fab no-print"><button class="p" onclick="window.print()">⬇ Salvar PDF</button><button class="s" onclick="window.close()">✕ Fechar</button></div>`);

        const w = window.open('', '_blank');
        if (w) {
          w.document.write(enhanced);
          w.document.close();
          w.onload = () => setTimeout(() => w.print(), 500);
        }
      } catch (e) {
        toast.error('Erro ao gerar PDF do contrato');
      } finally {
        setDownloading(false);
      }
      return;
    }

    // Regular file download
    setDownloading(true);
    try {
      const response = await fetch(doc.file_url);
      if (!response.ok) throw new Error('fetch failed');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = blobUrl;
      a.download = doc.name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // fallback: direct open
      window.open(doc.file_url, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 25 }}
        whileHover={{ y: -2, transition: { duration: 0.12 } }}
        className="group relative rounded-2xl border overflow-hidden backdrop-blur-sm cursor-default"
        style={{
          background: `linear-gradient(135deg, hsl(var(--card)/0.92) 0%, rgba(${rgb},0.04) 100%)`,
          borderColor: `rgba(${rgb},0.16)`,
        }}
      >
        {/* Left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl"
          style={{ background: `linear-gradient(180deg, transparent, rgba(${rgb},0.85), transparent)` }} />

        <div className="flex items-start gap-3 p-4 pl-5">
          {/* Icon */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border mt-0.5"
            style={{ background: `rgba(${rgb},0.1)`, borderColor: `rgba(${rgb},0.22)` }}>
            <Icon className="h-5 w-5" style={{ color: `rgb(${rgb})` }} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="font-semibold text-sm text-foreground leading-snug truncate pr-1">{doc.name}</p>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0"
                style={{
                  background: `rgba(${rgb},0.1)`,
                  borderColor: `rgba(${rgb},0.28)`,
                  color: `rgb(${rgb})`,
                }}>
                {tab.label}
              </span>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-3">
              <span className="text-[11px] text-muted-foreground">{timeAgo}</span>
              {doc.file_size && (
                <span className="text-[11px] text-muted-foreground">{formatSize(doc.file_size)}</span>
              )}
              {doc.blockchain_hash && (
                <span className="text-[11px] text-emerald-500 flex items-center gap-1 font-medium">
                  <Shield className="h-2.5 w-2.5" /> Blockchain
                </span>
              )}
              {doc.signature_status === 'signed' && (
                <span className="text-[11px] text-blue-500 flex items-center gap-1 font-medium">
                  <CheckCircle className="h-2.5 w-2.5" /> Assinado
                </span>
              )}
            </div>

            {/* Action buttons — visible on hover */}
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
              <button
                onClick={handleView}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors"
                style={{
                  background: `rgba(${rgb},0.1)`,
                  borderColor: `rgba(${rgb},0.25)`,
                  color: `rgb(${rgb})`,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = `rgba(${rgb},0.18)`)}
                onMouseLeave={e => (e.currentTarget.style.background = `rgba(${rgb},0.1)`)}
              >
                <Eye className="h-3 w-3" />
                Visualizar
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-muted/70 border border-border/50 text-foreground hover:bg-muted transition-colors disabled:opacity-60"
              >
                {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                {doc.isContract ? 'Baixar PDF' : 'Baixar'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Contract modal */}
      {doc.isContract && doc.contract_id && contractModalOpen && (
        <ContractPreviewModal
          contractId={doc.contract_id}
          name={doc.name}
          signatureStatus={doc.signature_status}
          blockchainHash={doc.blockchain_hash}
          open={contractModalOpen}
          onClose={() => setContractModalOpen(false)}
        />
      )}

      {/* Regular file preview */}
      {!doc.isContract && filePreviewOpen && (
        <DocumentPreview
          open={filePreviewOpen}
          onOpenChange={setFilePreviewOpen}
          document={{
            name: doc.name,
            file_url: doc.file_url,
            mime_type: doc.mime_type,
            document_type: doc.document_type,
          }}
        />
      )}
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Documentos() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) navigate('/cliente/login');
      else { setUser(session.user); fetchDocs(session.user.id); }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/cliente/login');
      else { setUser(session.user); fetchDocs(session.user.id); }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchDocs = async (uid: string) => {
    setLoading(true);
    const [{ data: docs }, { data: contracts }] = await Promise.all([
      supabase.from('documents').select('*').eq('user_id', uid).is('contract_id', null).order('created_at', { ascending: false }),
      supabase.from('contracts')
        .select('id, subject, signature_status, blockchain_hash, created_at, visible_to_client, document_type')
        .eq('user_id', uid).eq('visible_to_client', true)
        .order('created_at', { ascending: false }),
    ]);

    // Determine document type for each contract
    const contractDocs: Document[] = (contracts || []).map(c => {
      let docType = 'contrato';
      if (c.document_type === 'procuracao') docType = 'procuracao';
      return {
        id: `contract-${c.id}`,
        name: c.subject || 'Contrato sem título',
        document_type: docType,
        file_url: '',
        file_size: null,
        mime_type: 'application/pdf',
        created_at: c.created_at || '',
        signature_status: c.signature_status || undefined,
        blockchain_hash: c.blockchain_hash || undefined,
        isContract: true,
        contract_id: c.id,
      };
    });

    setDocuments([...contractDocs, ...(docs || [])]);
    setLoading(false);
  };

  // Count per tab key
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: documents.length };
    for (const doc of documents) {
      const k = normalizeType(doc.document_type);
      map[k] = (map[k] || 0) + 1;
    }
    return map;
  }, [documents]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return documents.filter(d => {
      const matchSearch = !q || d.name.toLowerCase().includes(q);
      const docKey = normalizeType(d.document_type);
      const matchTab = activeTab === 'all' || docKey === activeTab;
      return matchSearch && matchTab;
    });
  }, [documents, search, activeTab]);

  const handleUploadComplete = () => {
    if (user) fetchDocs(user.id);
    toast.success('Documento enviado com sucesso!');
    setUploading(false);
  };

  return (
    <ClientLayout>
      <div className="relative space-y-5">
        {/* Background particles */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          {PARTICLES.map((p, i) => (
            <motion.div key={i} className="absolute rounded-full"
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, background: 'hsl(var(--primary))', opacity: p.op }}
              animate={{ y: [-6, 6, -6], opacity: [p.op, p.op * 2, p.op] }}
              transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </div>

        <div className="relative z-10 space-y-5">
          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/60 backdrop-blur-xl p-5"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg"
                  animate={{ boxShadow: ['0 0 16px rgba(245,158,11,0.3)', '0 0 28px rgba(245,158,11,0.5)', '0 0 16px rgba(245,158,11,0.3)'] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <FolderOpen className="h-5 w-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-xl font-black tracking-tight">Documentos</h1>
                  <p className="text-xs text-muted-foreground">{documents.length} arquivos</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => user && fetchDocs(user.id)} className="gap-2">
                  <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                  Atualizar
                </Button>
                <Button size="sm" onClick={() => setUploading(true)}
                  className="gap-2 bg-gradient-to-r from-primary to-violet-500 text-white shadow-md hover:shadow-lg transition-shadow">
                  <Upload className="h-3.5 w-3.5" />
                  Enviar
                </Button>
              </div>
            </div>
          </motion.div>

          {/* ── Upload modal ── */}
          <AnimatePresence>
            {uploading && user && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
              >
                <motion.div
                  initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                  className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">Enviar Documento</h3>
                    <button onClick={() => setUploading(false)}
                      className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <DocumentUploader userId={user.id} onUploadComplete={handleUploadComplete} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Search ── */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar documentos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-xl border-border/60 bg-card/60 backdrop-blur-sm h-10"
            />
          </div>

          {/* ── Fixed Tabs ── */}
          <div className="relative">
            {/* Scroll container */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {TABS.map(tab => {
                const count = counts[tab.key] || 0;
                const isActive = activeTab === tab.key;
                const TabIcon = tab.icon;
                return (
                  <motion.button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all flex-shrink-0',
                      isActive
                        ? 'text-white shadow-md'
                        : 'bg-card/70 text-muted-foreground border-border/50 hover:border-border hover:text-foreground'
                    )}
                    style={isActive ? {
                      background: `linear-gradient(135deg, rgb(${tab.colorRgb}), rgba(${tab.colorRgb},0.75))`,
                      borderColor: `rgba(${tab.colorRgb},0.4)`,
                      boxShadow: `0 4px 14px rgba(${tab.colorRgb},0.35)`,
                    } : {}}
                  >
                    <TabIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    {tab.label}
                    <span className={cn(
                      'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                      isActive ? 'bg-white/25 text-white' : 'bg-muted text-muted-foreground'
                    )}>
                      {count}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* ── Document List ── */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-[88px] rounded-2xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 gap-3 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                <Inbox className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="font-semibold text-muted-foreground">
                {search ? 'Nenhum documento encontrado' : activeTab === 'all' ? 'Nenhum documento disponível' : `Nenhum documento do tipo "${getTabCfg(activeTab).label}"`}
              </p>
              {!search && (
                <Button size="sm" onClick={() => setUploading(true)} className="gap-2 mt-1">
                  <Upload className="h-3.5 w-3.5" />
                  Enviar primeiro documento
                </Button>
              )}
            </motion.div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((doc, i) => (
                  <DocCard key={doc.id} doc={doc} index={i} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </ClientLayout>
  );
}
