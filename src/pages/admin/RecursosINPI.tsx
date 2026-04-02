import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileText, Upload, Loader2, Edit3, Check, Download, Printer, FileCheck, 
  History, Plus, Eye, Search, X, Calendar, Scale, Shield, Gavel, 
  AlertTriangle, Sparkles, ArrowRight, Brain, Zap,
  BarChart3, Clock, CheckCircle2, XCircle, Trash2, MoreVertical,
  RotateCcw, RefreshCw, Crown, Flame, Target, Sword, BookOpen,
  FileWarning, Image as ImageIcon, UserCheck, UserMinus
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { INPIResourcePDFPreview } from '@/components/admin/INPIResourcePDFPreview';
import { INPILegalChatDialog } from '@/components/admin/inpi/INPILegalChatDialog';
import { motion, AnimatePresence } from 'framer-motion';

interface ExtractedData {
  process_number: string;
  brand_name: string;
  ncl_class: string;
  holder: string;
  examiner_or_opponent: string;
  legal_basis: string;
}

interface INPIResource {
  id: string;
  resource_type: string;
  process_number: string | null;
  brand_name: string | null;
  ncl_class: string | null;
  holder: string | null;
  examiner_or_opponent: string | null;
  status: string;
  draft_content: string | null;
  final_content: string | null;
  created_at: string;
  approved_at: string | null;
}

interface NotificanteData {
  nome: string;
  cpf_cnpj: string;
  endereco: string;
  processo_inpi: string;
  registro_marca: string;
  marca: string;
}

interface NotificadoData {
  nome: string;
  cpf_cnpj: string;
  endereco: string;
}

interface ProcuradorData {
  marca: string;
  processo_inpi: string;
  ncl_class: string;
  titular: string;
  cpf_cnpj_titular: string;
  endereco_titular: string;
  procurador_antigo: string;
  motivo: string;
}

type Step = 'list' | 'select-type' | 'select-agent' | 'notificacao-data' | 'procurador-data' | 'resposta-notificacao-data' | 'upload' | 'processing' | 'review' | 'approved';

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  indeferimento: 'Recurso contra Indeferimento',
  exigencia_merito: 'Exigência de Mérito',
  oposicao: 'Manifestação à Oposição',
  notificacao_extrajudicial: 'Notificação Extrajudicial',
  resposta_notificacao_extrajudicial: 'Resposta a Notificação Extrajudicial',
  troca_procurador: 'Troca de Procurador',
  nomeacao_procurador: 'Nomeação de Procurador'
};

const RESOURCE_TYPE_CONFIG: Record<string, { icon: typeof Gavel; color: string; gradient: string; description: string }> = {
  indeferimento: {
    icon: XCircle,
    color: 'text-red-500',
    gradient: 'from-red-500/10 to-red-600/5 border-red-500/20 hover:border-red-500/40',
    description: 'Para marcas que tiveram o pedido indeferido pelo INPI. A IA analisará o fundamento e elaborará defesa robusta.'
  },
  exigencia_merito: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    gradient: 'from-amber-500/10 to-amber-600/5 border-amber-500/20 hover:border-amber-500/40',
    description: 'Para atender exigências técnicas formuladas pelo INPI com argumentação jurídica precisa e fundamentada.'
  },
  oposicao: {
    icon: Shield,
    color: 'text-blue-500',
    gradient: 'from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:border-blue-500/40',
    description: 'Para responder a oposições de terceiros contra a marca com análise comparativa detalhada.'
  },
  notificacao_extrajudicial: {
    icon: FileWarning,
    color: 'text-purple-500',
    gradient: 'from-purple-500/10 to-purple-600/5 border-purple-500/20 hover:border-purple-500/40',
    description: 'Para notificar pessoa ou empresa que esteja usando sua marca indevidamente. Documento jurídico completo com fundamentação legal.'
  },
  resposta_notificacao_extrajudicial: {
    icon: Shield,
    color: 'text-cyan-500',
    gradient: 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20 hover:border-cyan-500/40',
    description: 'Para elaborar defesa jurídica em resposta a uma notificação extrajudicial recebida. A IA analisará o PDF da notificação e criará uma defesa robusta com jurisprudência real.'
  },
  troca_procurador: {
    icon: UserMinus,
    color: 'text-orange-500',
    gradient: 'from-orange-500/10 to-orange-600/5 border-orange-500/20 hover:border-orange-500/40',
    description: 'Para revogar procurador anterior e nomear novo procurador junto ao INPI. Petição completa com fundamentação na LPI.'
  },
  nomeacao_procurador: {
    icon: UserCheck,
    color: 'text-teal-500',
    gradient: 'from-teal-500/10 to-teal-600/5 border-teal-500/20 hover:border-teal-500/40',
    description: 'Para nomear procurador para representar o titular junto ao INPI. Petição com outorga de poderes e dados do constituinte.'
  }
};

// AI Agent profiles inspired by top Brazilian IP lawyers
const AI_AGENTS = {
  mazzola: {
    id: 'mazzola',
    name: 'Agente Mazzola',
    subtitle: 'Estratégia Dannemann Siemsen',
    inspiration: 'Marcelo Mazzola',
    firm: 'Dannemann Siemsen',
    icon: Crown,
    color: 'from-amber-500 to-yellow-600',
    bgGlow: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30 hover:border-amber-500/60',
    badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    style: 'Contencioso Técnico-Acadêmico',
    description: 'Abordagem fundamentada em 120+ anos de tradição do escritório mais premiado do Brasil. Especialista em contencioso de marcas com argumentação densa, jurisprudência real do STJ/TRF e análise comparativa minuciosa do conjunto marcário.',
    strengths: [
      'Jurisprudência consolidada STJ e TRFs',
      'Análise técnica do conjunto marcário (fonética, visual, ideológica)',
      'Argumentação densa e acadêmica',
      'Referência ao Manual de Marcas do INPI (7ª edição vigente)',
    ],
    promptExtra: `ESTRATÉGIA INSPIRADA NO ESTILO DANNEMANN SIEMSEN (Marcelo Mazzola):

TOM E ABORDAGEM: Acadêmico-institucional, densamente fundamentado, com autoridade de quem representa o escritório mais tradicional e premiado do Brasil em PI (fundado em 1900). O texto deve transmitir peso institucional e erudição jurídica.

TÉCNICAS OBRIGATÓRIAS DESTE AGENTE:
1. FUNDAMENTAÇÃO DOUTRINÁRIA DENSA — cite obrigatoriamente Denis Borges Barbosa ("Uma Introdução à Propriedade Intelectual", 2ª ed., pp. 829-890) e J. da Gama Cerqueira ("Tratado da Propriedade Industrial", vol. II, tomo I) em cada argumento principal
2. JURISPRUDÊNCIA CONSOLIDADA — priorize precedentes do STJ com citação de EMENTA completa: REsp 1.188.105/RJ (Min. Luis Felipe Salomão, 4ª Turma, j. 19/06/2012), REsp 1.315.621/SP (Min. Nancy Andrighi, 3ª Turma), REsp 862.117/RJ, AgRg no REsp 1.346.089/RJ
3. ANÁLISE COMPARATIVA TRÍPLICE — desenvolva em profundidade: (a) elemento fonético com análise silábica detalhada, (b) elemento visual com descrição de grafismo, tipografia e cores, (c) elemento ideológico/conceitual com campo semântico
4. TEORIA DA IMPRESSÃO DE CONJUNTO — aplique com citação do Manual de Marcas INPI (Cap. 5, Seção 5.10.1) demonstrando que a comparação deve ser global e não fragmentária
5. CLASSIFICAÇÃO DE NICE — detalhe CADA especificação dos produtos/serviços das classes envolvidas, demonstrando distinção prática
6. LINGUAGEM: Períodos longos, vocabulário jurídico sofisticado, citações em latim quando pertinentes (nulla poena sine lege, in dubio pro registrando), parágrafos densos com múltiplas referências
7. PRECEDENTES INTERNACIONAIS — quando pertinente, cite decisões do EUIPO e USPTO sobre coexistência de marcas similares
8. CITE registros análogos já deferidos pelo INPI na mesma classe como prova de consistência`,
  },
  guerra: {
    id: 'guerra',
    name: 'Agente Guerra',
    subtitle: 'Estratégia Guerra IP',
    inspiration: 'Alberto Guerra',
    firm: 'Guerra IP',
    icon: Sword,
    color: 'from-red-500 to-rose-600',
    bgGlow: 'bg-red-500/20',
    borderColor: 'border-red-500/30 hover:border-red-500/60',
    badgeColor: 'bg-red-500/10 text-red-600 border-red-500/30',
    style: 'Ataque Direto e Assertivo',
    description: 'Abordagem combativa e estratégica com 30+ anos de experiência em PI. Foco em identificar falhas procedimentais do INPI, demonstrar distinção prática no mercado e usar análise de coexistência com registros análogos já deferidos.',
    strengths: [
      'Identificação de falhas procedimentais do INPI',
      'Análise de coexistência com registros análogos já deferidos',
      'Demonstração prática de distinção no mercado',
      'Argumentação combativa e assertiva',
    ],
    promptExtra: `ESTRATÉGIA INSPIRADA NO ESTILO GUERRA IP (Alberto Guerra):

TOM E ABORDAGEM: Combativo, direto, incisivo. O texto deve transmitir a postura de um advogado que não aceita decisões superficiais e que desafia FRONTALMENTE a análise do examinador. Linguagem objetiva, sem rodeios, mas sempre técnica.

TÉCNICAS OBRIGATÓRIAS DESTE AGENTE:
1. ATAQUE À FUNDAMENTAÇÃO — questione DIRETAMENTE se o examinador analisou TODOS os critérios do Manual de Marcas. Identifique CADA falha: fundamentação genérica, análise superficial, desconsideração de elementos distintivos, aplicação equivocada de artigos
2. PRECEDENTES INTERNOS DO INPI — pesquise e cite MARCAS ANÁLOGAS já deferidas pelo próprio INPI que tenham grau de semelhança igual ou superior ao caso, demonstrando INCOERÊNCIA na decisão. Frases como: "O próprio INPI deferiu registros com grau de semelhança SUPERIOR ao presente caso..."
3. PRINCÍPIO DA ESPECIALIDADE APROFUNDADO — detalhe CADA especificação da classe NCL, demonstrando que os produtos/serviços são distintos na prática: canais de venda diferentes, público-alvo diferente, faixa de preço diferente, forma de comercialização diferente
4. FALHAS PROCEDIMENTAIS — identifique: (a) falta de motivação adequada (art. 50, Lei 9.784/99), (b) análise que não considerou todos os elementos distintivos, (c) comparação isolada de elementos ao invés de impressão de conjunto, (d) desconsideração de provas ou argumentos apresentados
5. JURISPRUDÊNCIA COMBATIVA — priorize: REsp 1.166.498/RJ (distinção suficiente), decisões da 2ª Turma Especializada do TRF-2 que REFORMARAM indeferimentos do INPI, demonstrando que o Judiciário frequentemente discorda do INPI
6. REGISTROS DE TERCEIROS — cite registros vigentes de marcas com elementos em comum na mesma classe, provando que o INPI já aceitou convivência similar
7. LINGUAGEM: Direta, assertiva, com frases de impacto. Use expressões como "data venia", "com a devida vênia do ilustre examinador", "a decisão padece de fundamentação adequada", "não resiste a uma análise mais detida"
8. PRINCÍPIO DA ISONOMIA — demonstre que a decisão trata desigualmente situações iguais, violando o art. 5º da CF/88`,
  },
  nascimento: {
    id: 'nascimento',
    name: 'Agente Nascimento',
    subtitle: 'Estratégia David do Nascimento',
    inspiration: 'Marcello do Nascimento',
    firm: 'David Do Nascimento Advogados',
    icon: Target,
    color: 'from-blue-500 to-indigo-600',
    bgGlow: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30 hover:border-blue-500/60',
    badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    style: 'Estratégia Comercial e Gestão de Marca',
    description: 'Abordagem estratégica combinando expertise jurídica com visão de negócios. Foco em gestão estratégica de portfólio, análise de mercado relevante e construção de argumentação baseada em convivência comercial e diferenciação de público-alvo.',
    strengths: [
      'Gestão estratégica de portfólio de marcas',
      'Argumentação baseada em convivência comercial',
      'Análise de mercado relevante e público-alvo',
      'Construção narrativa persuasiva e estruturada',
    ],
    promptExtra: `ESTRATÉGIA INSPIRADA NO ESTILO DAVID DO NASCIMENTO (Marcello do Nascimento):

TOM E ABORDAGEM: Estratégico-empresarial, combinando expertise jurídica com visão de negócios. O texto deve construir uma NARRATIVA CONVINCENTE que demonstre o valor da marca no mercado e o prejuízo desproporcional do indeferimento. Abordagem de "storytelling jurídico".

TÉCNICAS OBRIGATÓRIAS DESTE AGENTE:
1. ANÁLISE DE MERCADO RELEVANTE — desenvolva em profundidade: (a) definição do mercado relevante conforme critérios do CADE, (b) segmentação de público-alvo com dados demográficos e comportamentais, (c) canais de distribuição e comercialização, (d) faixa de preço e posicionamento, (e) área geográfica de atuação
2. CONVIVÊNCIA COMERCIAL — demonstre que as marcas em cotejo coexistem (ou podem coexistir) no mercado sem qualquer confusão: (a) apresente cenário real de mercado, (b) demonstre que consumidores do segmento são sofisticados/atentos, (c) analise o grau de atenção do consumidor na decisão de compra
3. INVESTIMENTO E REPUTAÇÃO — argumente sobre o investimento do titular na marca: publicidade, presença digital, eventos, parcerias, reconhecimento no mercado. Demonstre que indeferir a marca causa PREJUÍZO DESPROPORCIONAL
4. GESTÃO ESTRATÉGICA DE PORTFÓLIO — quando aplicável, demonstre como a marca se insere no portfólio do titular e sua importância estratégica para os negócios
5. PROPORCIONALIDADE E RAZOABILIDADE — aplique extensivamente estes princípios constitucionais (art. 5º, LIV, CF/88): o indeferimento causa mais dano ao titular do que a eventual coexistência causaria a terceiros
6. TRADE DRESS E APRESENTAÇÃO VISUAL — quando pertinente, análise detalhada do conjunto-imagem: embalagem, cores, layout, apresentação geral do produto/serviço (art. 124, XIX da LPI)
7. JURISPRUDÊNCIA COMERCIAL — priorize: REsp 1.095.362/SP (convivência pacífica), AgRg no REsp 1.255.654/RJ, decisões do CADE sobre mercados relevantes, decisões que valorizam a liberdade de iniciativa (art. 170, CF)
8. DIREITO COMPARADO — cite quando pertinente como o USPTO, EUIPO e OMPI tratam casos similares, demonstrando que a tendência internacional é pela coexistência quando há distinção suficiente
9. LINGUAGEM: Persuasiva, narrativa, construindo um "caso" passo a passo. Comece cada seção com contextualização do cenário de mercado. Use expressões como "a realidade do mercado demonstra", "os consumidores do segmento", "a convivência pacífica comprova"
10. LIVRE INICIATIVA — invoque o art. 170 da CF/88 e demonstre que o registro de marcas deve fomentar, não restringir, a atividade econômica`,
  },
};

type AgentId = keyof typeof AI_AGENTS;

const STEPS_FLOW = [
  { key: 'select-type', label: 'Tipo', icon: Gavel },
  { key: 'select-agent', label: 'Estratégia', icon: Brain },
  { key: 'notificacao-data', label: 'Dados', icon: FileText },
  { key: 'procurador-data', label: 'Dados', icon: UserCheck },
  { key: 'resposta-notificacao-data', label: 'Documento', icon: Upload },
  { key: 'upload', label: 'Documento', icon: Upload },
  { key: 'processing', label: 'IA Processando', icon: Zap },
  { key: 'review', label: 'Revisão', icon: Edit3 },
  { key: 'approved', label: 'Aprovado', icon: CheckCircle2 },
];

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.4, ease: 'easeOut' as const }
};

export default function RecursosINPI() {
  const [step, setStep] = useState<Step>('list');
  const [resourceType, setResourceType] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AgentId>('mazzola');
  const [file, setFile] = useState<File | null>(null);
  const [multipleFiles, setMultipleFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [currentResourceId, setCurrentResourceId] = useState<string | null>(null);
  const [resources, setResources] = useState<INPIResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [selectedResource, setSelectedResource] = useState<INPIResource | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [showLegalChat, setShowLegalChat] = useState(false);

  // Client search for Notificante
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState<Array<{ id: string; full_name: string | null; email: string | null; phone: string | null; cpf_cnpj: string | null; address: string | null; company_name: string | null }>>([]);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingResource, setEditingResource] = useState<INPIResource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // Notificação Extrajudicial state
  const [notificanteData, setNotificanteData] = useState<NotificanteData>({
    nome: '', cpf_cnpj: '', endereco: '', processo_inpi: '', registro_marca: '', marca: ''
  });
  const [notificadoData, setNotificadoData] = useState<NotificadoData>({
    nome: '', cpf_cnpj: '', endereco: ''
  });
  const [userInstructions, setUserInstructions] = useState('');

  // Procurador state
  const [procuradorData, setProcuradorData] = useState<ProcuradorData>({
    marca: '', processo_inpi: '', ncl_class: '', titular: '', cpf_cnpj_titular: '', endereco_titular: '',
    procurador_antigo: '', motivo: ''
  });
  useEffect(() => {
    if (clientSearchTimeoutRef.current) clearTimeout(clientSearchTimeoutRef.current);
    if (!clientSearchQuery || clientSearchQuery.length < 2) {
      setClientSearchResults([]);
      setShowClientDropdown(false);
      return;
    }
    setIsSearchingClients(true);
    clientSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const term = `%${clientSearchQuery}%`;
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, cpf_cnpj, address, company_name')
          .or(`full_name.ilike.${term},email.ilike.${term},cpf_cnpj.ilike.${term},company_name.ilike.${term}`)
          .limit(10);
        setClientSearchResults(data || []);
        setShowClientDropdown(true);
      } catch (e) {
        console.error('Client search error:', e);
      } finally {
        setIsSearchingClients(false);
      }
    }, 400);
    return () => { if (clientSearchTimeoutRef.current) clearTimeout(clientSearchTimeoutRef.current); };
  }, [clientSearchQuery]);

  // Click outside to close client dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectClient = (client: typeof clientSearchResults[0]) => {
    setNotificanteData({
      nome: client.company_name || client.full_name || '',
      cpf_cnpj: client.cpf_cnpj || '',
      endereco: client.address || '',
      processo_inpi: notificanteData.processo_inpi,
      registro_marca: notificanteData.registro_marca,
      marca: notificanteData.marca,
    });
    setClientSearchQuery(client.company_name || client.full_name || '');
    setShowClientDropdown(false);
  };

  useEffect(() => { fetchResources(); }, []);

  useEffect(() => {
    if (step === 'processing') {
      setProcessingProgress(0);
      const interval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 6;
        });
      }, 900);
      return () => clearInterval(interval);
    }
  }, [step]);

  const fetchResources = async () => {
    try {
      const { data, error } = await supabase
        .from('inpi_resources')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setResources(data || []);
    } catch (error) {
      console.error('Error fetching resources:', error);
      toast.error('Erro ao carregar recursos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteResource = async (id: string) => {
    try {
      const { error } = await supabase.from('inpi_resources').delete().eq('id', id);
      if (error) throw error;
      toast.success('Recurso excluído com sucesso');
      setShowDeleteConfirm(null);
      fetchResources();
    } catch (error) {
      console.error('Error deleting resource:', error);
      toast.error('Erro ao excluir recurso');
    }
  };

  const handleEditResource = (resource: INPIResource) => {
    setEditingResource(resource);
    let content = resource.final_content || resource.draft_content || '';
    const data = {
      process_number: resource.process_number || '',
      brand_name: resource.brand_name || '',
      ncl_class: resource.ncl_class || '',
      holder: resource.holder || '',
      examiner_or_opponent: resource.examiner_or_opponent || '',
      legal_basis: '',
    };
    setExtractedData(data);
    setResourceType(resource.resource_type);
    setCurrentResourceId(resource.id);

    // Legacy auto-fix: if draft starts with section I without the mandatory header, inject it
    const RESOURCE_TYPE_LABELS_UPPER: Record<string, string> = {
      indeferimento: 'RECURSO CONTRA INDEFERIMENTO',
      exigencia_merito: 'CUMPRIMENTO DE EXIGÊNCIA DE MÉRITO / RECURSO ADMINISTRATIVO',
      oposicao: 'MANIFESTAÇÃO À OPOSIÇÃO',
    };
    const startsWithSection = /^\s*(I\s*[–—\-\.]\s*)/m.test(content.substring(0, 200));
    const hasHeader = /RECURSO ADMINISTRATIVO/i.test(content.substring(0, 300));
    if (startsWithSection && !hasHeader && RESOURCE_TYPE_LABELS_UPPER[resource.resource_type]) {
      const label = RESOURCE_TYPE_LABELS_UPPER[resource.resource_type];
      const brandUpper = (data.brand_name || 'N/I').toUpperCase();
      const isOposicao = resource.resource_type === 'oposicao';
      const personLabel = isOposicao ? 'Oponente' : 'Examinador(a)';
      const header = `RECURSO ADMINISTRATIVO – ${label}\n\nMARCA: ${brandUpper}\n\nEXCELENTÍSSIMO SENHOR PRESIDENTE DA DIRETORIA DE MARCAS,\nPATENTES E DESENHOS INDUSTRIAIS DO INSTITUTO NACIONAL\nDA PROPRIEDADE INDUSTRIAL – INPI\n\nProcesso INPI nº: ${data.process_number || 'N/I'}\nMarca: ${data.brand_name || 'N/I'}\nClasse NCL (12ª Ed.): ${data.ncl_class || 'N/I'}\nTitular/Requerente: ${data.holder || 'N/I'}\n${personLabel}: ${data.examiner_or_opponent || 'N/I'}\nProcurador: Davilys Danques de Oliveira Cunha – CPF 393.239.118-79`;
      content = `${header}\n\n${content}`;
      // Persist the fix
      supabase.from('inpi_resources').update({ draft_content: content }).eq('id', resource.id).then();
    }

    setDraftContent(content);
    setStep('review');
  };

  const handleRequestNewStrategy = (resource: INPIResource) => {
    setEditingResource(resource);
    setResourceType(resource.resource_type);
    setCurrentResourceId(resource.id);
    setStep('select-agent');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      const invalidFiles = newFiles.filter(f => 
        !['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'].includes(f.type)
      );
      if (invalidFiles.length > 0) {
        toast.error('Formatos aceitos: PDF, JPG, PNG, GIF, WEBP');
        return;
      }
      const currentCount = multipleFiles.length;
      const maxFiles = 10;
      const remaining = maxFiles - currentCount;
      if (remaining <= 0) {
        toast.error('Máximo de 10 arquivos atingido');
        return;
      }
      const filesToAdd = newFiles.slice(0, remaining);
      setMultipleFiles(prev => [...prev, ...filesToAdd]);
      if (filesToAdd.length < newFiles.length) {
        toast.warning(`Apenas ${filesToAdd.length} arquivo(s) adicionado(s). Máximo de 10 arquivos.`);
      }
    }
  };

  const handleMultiFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setMultipleFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeMultiFile = (index: number) => {
    setMultipleFiles(prev => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processDocument = async () => {
    if (resourceType === 'notificacao_extrajudicial') {
      return processNotificacao();
    }
    if (resourceType === 'resposta_notificacao_extrajudicial') {
      return processRespostaNotificacao();
    }
    if (resourceType === 'troca_procurador' || resourceType === 'nomeacao_procurador') {
      return processProcurador();
    }
    if (multipleFiles.length === 0 || !resourceType) {
      toast.error('Anexe pelo menos um documento para continuar');
      return;
    }
    setIsProcessing(true);
    setStep('processing');

    try {
      const agent = AI_AGENTS[selectedAgent];

      // Convert all files to base64
      const filesBase64 = await Promise.all(
        multipleFiles.map(async (f) => ({
          base64: await fileToBase64(f),
          type: f.type,
          name: f.name,
        }))
      );

      const { data, error } = await supabase.functions.invoke('process-inpi-resource', {
        body: { files: filesBase64, resourceType, agentStrategy: agent.promptExtra, agentName: agent.name }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao processar documento');

      setExtractedData(data.extracted_data);
      setDraftContent(data.resource_content);

      const { data: { user } } = await supabase.auth.getUser();

      const { data: insertedResource, error: insertError } = await supabase
        .from('inpi_resources')
        .insert({
          user_id: user?.id,
          resource_type: resourceType,
          process_number: data.extracted_data?.process_number,
          brand_name: data.extracted_data?.brand_name,
          ncl_class: data.extracted_data?.ncl_class,
          holder: data.extracted_data?.holder,
          examiner_or_opponent: data.extracted_data?.examiner_or_opponent,
          legal_basis: data.extracted_data?.legal_basis,
          draft_content: data.resource_content,
          status: 'pending_review'
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setCurrentResourceId(insertedResource.id);
      setProcessingProgress(100);
      setTimeout(() => setStep('review'), 500);
      toast.success(`Recurso gerado com sucesso pela estratégia ${agent.name}!`);
    } catch (error) {
      console.error('Error processing document:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar documento');
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const processNotificacao = async () => {
    if (!notificanteData.nome || !notificadoData.nome) {
      toast.error('Preencha pelo menos o nome do notificante e do notificado');
      return;
    }
    setIsProcessing(true);
    setStep('processing');

    try {
      const agent = AI_AGENTS[selectedAgent];

      // Convert files to base64
      const filesBase64 = await Promise.all(
        multipleFiles.map(async (f) => ({
          base64: await fileToBase64(f),
          type: f.type,
          name: f.name,
        }))
      );

      const { data, error } = await supabase.functions.invoke('process-inpi-resource', {
        body: {
          resourceType: 'notificacao_extrajudicial',
          agentStrategy: agent.promptExtra,
          agentName: agent.name,
          notificanteData,
          notificadoData,
          userInstructions,
          files: filesBase64,
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao processar notificação');

      setExtractedData(data.extracted_data);
      setDraftContent(data.resource_content);

      const { data: { user } } = await supabase.auth.getUser();

      const { data: insertedResource, error: insertError } = await supabase
        .from('inpi_resources')
        .insert({
          user_id: user?.id,
          resource_type: 'notificacao_extrajudicial',
          process_number: notificanteData.processo_inpi || null,
          brand_name: notificanteData.marca || null,
          holder: notificanteData.nome,
          examiner_or_opponent: notificadoData.nome,
          draft_content: data.resource_content,
          status: 'pending_review'
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setCurrentResourceId(insertedResource.id);
      setProcessingProgress(100);
      setTimeout(() => setStep('review'), 500);
      toast.success(`Notificação Extrajudicial gerada com sucesso pela estratégia ${agent.name}!`);
    } catch (error) {
      console.error('Error processing notificacao:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar notificação');
      setStep('notificacao-data');
    } finally {
      setIsProcessing(false);
    }
  };

  const processRespostaNotificacao = async () => {
    if (multipleFiles.length === 0) {
      toast.error('Anexe pelo menos o PDF da notificação extrajudicial recebida');
      return;
    }
    setIsProcessing(true);
    setStep('processing');

    try {
      const agent = AI_AGENTS[selectedAgent];

      const filesBase64 = await Promise.all(
        multipleFiles.map(async (f) => ({
          base64: await fileToBase64(f),
          type: f.type,
          name: f.name,
        }))
      );

      const { data, error } = await supabase.functions.invoke('process-inpi-resource', {
        body: {
          resourceType: 'resposta_notificacao_extrajudicial',
          agentStrategy: agent.promptExtra,
          agentName: agent.name,
          files: filesBase64,
          userInstructions,
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao processar resposta');

      setExtractedData(data.extracted_data);
      setDraftContent(data.resource_content);

      const { data: { user } } = await supabase.auth.getUser();

      const { data: insertedResource, error: insertError } = await supabase
        .from('inpi_resources')
        .insert({
          user_id: user?.id,
          resource_type: 'resposta_notificacao_extrajudicial',
          process_number: data.extracted_data?.process_number || null,
          brand_name: data.extracted_data?.brand_name || null,
          holder: data.extracted_data?.holder || null,
          examiner_or_opponent: data.extracted_data?.examiner_or_opponent || null,
          draft_content: data.resource_content,
          status: 'pending_review'
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setCurrentResourceId(insertedResource.id);
      setProcessingProgress(100);
      setTimeout(() => setStep('review'), 500);
      toast.success(`Resposta à Notificação gerada com sucesso pela estratégia ${agent.name}!`);
    } catch (error) {
      console.error('Error processing resposta notificacao:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar resposta');
      setStep('resposta-notificacao-data');
    } finally {
      setIsProcessing(false);
    }
  };

  const processProcurador = async () => {
    if (!procuradorData.titular || !procuradorData.marca) {
      toast.error('Preencha pelo menos o nome do titular e da marca');
      return;
    }
    setIsProcessing(true);
    setStep('processing');

    try {
      const agent = AI_AGENTS[selectedAgent];

      const filesBase64 = await Promise.all(
        multipleFiles.map(async (f) => ({
          base64: await fileToBase64(f),
          type: f.type,
          name: f.name,
        }))
      );

      const { data, error } = await supabase.functions.invoke('process-inpi-resource', {
        body: {
          resourceType,
          agentStrategy: agent.promptExtra,
          agentName: agent.name,
          procuradorData,
          files: filesBase64,
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao processar petição');

      setExtractedData(data.extracted_data);
      setDraftContent(data.resource_content);

      const { data: { user } } = await supabase.auth.getUser();

      const { data: insertedResource, error: insertError } = await supabase
        .from('inpi_resources')
        .insert({
          user_id: user?.id,
          resource_type: resourceType,
          process_number: procuradorData.processo_inpi || null,
          brand_name: procuradorData.marca || null,
          ncl_class: procuradorData.ncl_class || null,
          holder: procuradorData.titular,
          examiner_or_opponent: 'Davilys Danques de Oliveira Cunha',
          draft_content: data.resource_content,
          status: 'pending_review'
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setCurrentResourceId(insertedResource.id);
      setProcessingProgress(100);
      setTimeout(() => setStep('review'), 500);
      const label = resourceType === 'troca_procurador' ? 'Troca de Procurador' : 'Nomeação de Procurador';
      toast.success(`${label} gerada com sucesso pela estratégia ${agent.name}!`);
    } catch (error) {
      console.error('Error processing procurador:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar petição');
      setStep('procurador-data');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestAdjustment = async () => {
    if (!adjustmentNotes.trim()) {
      toast.error('Por favor, descreva os ajustes desejados');
      return;
    }
    setIsAdjusting(true);

    try {
      const { data, error } = await supabase.functions.invoke('adjust-inpi-resource', {
        body: { 
          currentContent: draftContent, 
          adjustmentInstructions: adjustmentNotes,
          resourceType: resourceType || selectedResource?.resource_type,
          extractedData: extractedData || {
            process_number: selectedResource?.process_number,
            brand_name: selectedResource?.brand_name,
            ncl_class: selectedResource?.ncl_class,
            holder: selectedResource?.holder,
            examiner_or_opponent: selectedResource?.examiner_or_opponent || '',
          }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao ajustar recurso');

      const newContent = data.adjusted_content;
      setDraftContent(newContent);

      if (currentResourceId) {
        // Save adjusted content AND log the adjustment in history
        const { data: currentResource } = await supabase
          .from('inpi_resources')
          .select('adjustments_history')
          .eq('id', currentResourceId)
          .single();

        const history = Array.isArray(currentResource?.adjustments_history) 
          ? currentResource.adjustments_history 
          : [];
        
        history.push({
          date: new Date().toISOString(),
          instructions: adjustmentNotes,
          previous_length: draftContent.length,
          new_length: newContent.length,
        });

        await supabase
          .from('inpi_resources')
          .update({ 
            draft_content: newContent,
            adjustments_history: history,
          })
          .eq('id', currentResourceId);
      }

      setAdjustmentNotes('');
      toast.success('Recurso ajustado e incorporado com sucesso!');
    } catch (error) {
      console.error('Error adjusting resource:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao ajustar recurso');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleApproveResource = async () => {
    if (!currentResourceId) return;
    try {
      const { data: updatedResource, error } = await supabase
        .from('inpi_resources')
        .update({
          final_content: draftContent,
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', currentResourceId)
        .select()
        .single();

      if (error) throw error;

      setSelectedResource(updatedResource);
      setStep('approved');
      toast.success(
        resourceType === 'notificacao_extrajudicial'
          ? 'Notificação aprovada!'
          : resourceType === 'resposta_notificacao_extrajudicial'
            ? 'Resposta à Notificação aprovada!'
            : 'Recurso aprovado!'
      );
      fetchResources();
    } catch (error) {
      console.error('Error approving resource:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao aprovar recurso');
    }
  };

  const resetFlow = () => {
    setStep('list');
    setResourceType('');
    setSelectedAgent('mazzola');
    setFile(null);
    setMultipleFiles([]);
    setExtractedData(null);
    setDraftContent('');
    setAdjustmentNotes('');
    setCurrentResourceId(null);
    setSelectedResource(null);
    setEditingResource(null);
    setProcessingProgress(0);
    setNotificanteData({ nome: '', cpf_cnpj: '', endereco: '', processo_inpi: '', registro_marca: '', marca: '' });
    setNotificadoData({ nome: '', cpf_cnpj: '', endereco: '' });
    setUserInstructions('');
    setProcuradorData({ marca: '', processo_inpi: '', ncl_class: '', titular: '', cpf_cnpj_titular: '', endereco_titular: '', procurador_antigo: '', motivo: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (multiFileInputRef.current) multiFileInputRef.current.value = '';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Rascunho</Badge>;
      case 'pending_review': return <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600 bg-amber-500/10"><Edit3 className="h-3 w-3" /> Em Revisão</Badge>;
      case 'approved': return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="h-3 w-3" /> Aprovado</Badge>;
      case 'finalized': return <Badge className="gap-1 bg-blue-600 hover:bg-blue-700"><FileCheck className="h-3 w-3" /> Finalizado</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredResources = resources.filter((resource) => {
    const matchesQuery = !searchQuery || 
      resource.brand_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.process_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = !searchDate || format(new Date(resource.created_at), 'yyyy-MM-dd') === searchDate;
    return matchesQuery && matchesDate;
  });

  const stats = {
    total: resources.length,
    approved: resources.filter(r => r.status === 'approved').length,
    pending: resources.filter(r => r.status === 'pending_review').length,
    draft: resources.filter(r => r.status === 'draft').length,
  };

  const dispatchStats = {
    indeferimento: resources.filter(r => r.resource_type === 'indeferimento').length,
    exigencia_merito: resources.filter(r => r.resource_type === 'exigencia_merito').length,
    oposicao: resources.filter(r => r.resource_type === 'oposicao').length,
    notificacao_extrajudicial: resources.filter(r => r.resource_type === 'notificacao_extrajudicial').length,
    resposta_notificacao_extrajudicial: resources.filter(r => r.resource_type === 'resposta_notificacao_extrajudicial').length,
    troca_procurador: resources.filter(r => r.resource_type === 'troca_procurador').length,
    nomeacao_procurador: resources.filter(r => r.resource_type === 'nomeacao_procurador').length,
  };
  const maxDispatch = Math.max(...Object.values(dispatchStats), 1);

  const isProcuradorType = resourceType === 'troca_procurador' || resourceType === 'nomeacao_procurador';
  const isRespostaNotificacao = resourceType === 'resposta_notificacao_extrajudicial';

  const getVisibleSteps = () => {
    if (resourceType === 'notificacao_extrajudicial') {
      return STEPS_FLOW.filter(s => s.key !== 'upload' && s.key !== 'procurador-data' && s.key !== 'resposta-notificacao-data');
    }
    if (isRespostaNotificacao) {
      return STEPS_FLOW.filter(s => s.key !== 'upload' && s.key !== 'notificacao-data' && s.key !== 'procurador-data');
    }
    if (isProcuradorType) {
      return STEPS_FLOW.filter(s => s.key !== 'upload' && s.key !== 'notificacao-data' && s.key !== 'resposta-notificacao-data');
    }
    return STEPS_FLOW.filter(s => s.key !== 'notificacao-data' && s.key !== 'procurador-data' && s.key !== 'resposta-notificacao-data');
  };

  const currentStepIndex = getVisibleSteps().findIndex(s => s.key === step);
  const agent = AI_AGENTS[selectedAgent];

  return (
    <>
      <div className="space-y-6">
        {/* Premium Header */}
        <motion.div {...fadeIn} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/10 p-6 md:p-8">
          <div className="absolute inset-0 bg-grid-pattern opacity-5" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                <Scale className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Recursos INPI</h1>
                <p className="text-muted-foreground text-sm md:text-base">
                  IA Jurídica com 3 estratégias inspiradas nos maiores advogados do Brasil
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {step === 'list' ? (
                <Button onClick={() => setStep('select-type')} size="lg" className="gap-2 shadow-lg shadow-primary/20 rounded-xl">
                  <Sparkles className="h-4 w-4" />
                  Criar Recurso com IA
                </Button>
              ) : (
                <Button variant="outline" onClick={resetFlow} className="gap-2 rounded-xl">
                  <ArrowRight className="h-4 w-4 rotate-180" />
                  Voltar à Lista
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        {step === 'list' && (
          <>
            <motion.div {...fadeIn} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total de Recursos', value: stats.total, icon: BarChart3, color: 'text-primary', bg: 'bg-primary/10' },
                { label: 'Aprovados', value: stats.approved, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: 'Em Revisão', value: stats.pending, icon: Edit3, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                { label: 'Rascunhos', value: stats.draft, icon: FileText, color: 'text-muted-foreground', bg: 'bg-muted' },
              ].map((stat, i) => (
                <Card key={i} className="border-border/50 hover:border-border transition-colors">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>

            <motion.div {...fadeIn} transition={{ delay: 0.2 }} className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { 
                  label: 'Indeferimentos', 
                  subtitle: 'Recurso contra decisão',
                  count: dispatchStats.indeferimento, 
                  icon: XCircle, 
                  gradient: 'from-red-500 to-rose-600',
                  glowColor: 'hsla(0, 72%, 51%, 0.15)',
                  ringColor: 'stroke-red-500',
                  ringBg: 'stroke-red-500/15',
                  tagBg: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
                  approved: resources.filter(r => r.resource_type === 'indeferimento' && r.status === 'approved').length,
                },
                { 
                  label: 'Exigências', 
                  subtitle: 'Mérito técnico',
                  count: dispatchStats.exigencia_merito, 
                  icon: AlertTriangle, 
                  gradient: 'from-amber-500 to-orange-500',
                  glowColor: 'hsla(38, 92%, 50%, 0.15)',
                  ringColor: 'stroke-amber-500',
                  ringBg: 'stroke-amber-500/15',
                  tagBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                  approved: resources.filter(r => r.resource_type === 'exigencia_merito' && r.status === 'approved').length,
                },
                { 
                  label: 'Oposições', 
                  subtitle: 'Manifestação de terceiros',
                  count: dispatchStats.oposicao, 
                  icon: Shield, 
                  gradient: 'from-blue-500 to-indigo-600',
                  glowColor: 'hsla(210, 100%, 50%, 0.15)',
                  ringColor: 'stroke-blue-500',
                  ringBg: 'stroke-blue-500/15',
                  tagBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                  approved: resources.filter(r => r.resource_type === 'oposicao' && r.status === 'approved').length,
                },
                { 
                  label: 'Notificações', 
                  subtitle: 'Extrajudicial',
                  count: dispatchStats.notificacao_extrajudicial, 
                  icon: FileWarning, 
                  gradient: 'from-purple-500 to-violet-600',
                  glowColor: 'hsla(270, 70%, 50%, 0.15)',
                  ringColor: 'stroke-purple-500',
                  ringBg: 'stroke-purple-500/15',
                  tagBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
                  approved: resources.filter(r => r.resource_type === 'notificacao_extrajudicial' && r.status === 'approved').length,
                },
                { 
                  label: 'Resposta Notificação', 
                  subtitle: 'Defesa extrajudicial',
                  count: dispatchStats.resposta_notificacao_extrajudicial, 
                  icon: Shield, 
                  gradient: 'from-cyan-500 to-sky-600',
                  glowColor: 'hsla(190, 90%, 50%, 0.15)',
                  ringColor: 'stroke-cyan-500',
                  ringBg: 'stroke-cyan-500/15',
                  tagBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
                  approved: resources.filter(r => r.resource_type === 'resposta_notificacao_extrajudicial' && r.status === 'approved').length,
                },
                { 
                  label: 'Troca Procurador', 
                  subtitle: 'Revogação e nomeação',
                  count: dispatchStats.troca_procurador, 
                  icon: UserMinus, 
                  gradient: 'from-orange-500 to-amber-600',
                  glowColor: 'hsla(25, 95%, 53%, 0.15)',
                  ringColor: 'stroke-orange-500',
                  ringBg: 'stroke-orange-500/15',
                  tagBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
                  approved: resources.filter(r => r.resource_type === 'troca_procurador' && r.status === 'approved').length,
                },
                { 
                  label: 'Nomeação Procurador', 
                  subtitle: 'Outorga de poderes',
                  count: dispatchStats.nomeacao_procurador, 
                  icon: UserCheck, 
                  gradient: 'from-teal-500 to-emerald-600',
                  glowColor: 'hsla(160, 84%, 39%, 0.15)',
                  ringColor: 'stroke-teal-500',
                  ringBg: 'stroke-teal-500/15',
                  tagBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
                  approved: resources.filter(r => r.resource_type === 'nomeacao_procurador' && r.status === 'approved').length,
                },
              ].map((item, i) => {
                const pct = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0;
                const circumference = 2 * Math.PI * 36;
                const strokeDash = (pct / 100) * circumference;

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.25 + i * 0.12, ease: 'easeOut' }}
                    className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card backdrop-blur-sm hover:shadow-xl transition-all duration-500"
                    style={{ boxShadow: `0 8px 32px ${item.glowColor}` }}
                  >
                    {/* Background decorative gradient */}
                    <div className={`absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${item.gradient} opacity-[0.07] blur-2xl group-hover:opacity-[0.12] transition-opacity duration-500`} />
                    <div className={`absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-gradient-to-tr ${item.gradient} opacity-[0.04] blur-xl`} />

                    <div className="relative p-5 flex items-start gap-4">
                      {/* Animated Ring Chart */}
                      <div className="relative flex-shrink-0">
                        <svg width="88" height="88" viewBox="0 0 88 88" className="transform -rotate-90">
                          <circle cx="44" cy="44" r="36" fill="none" strokeWidth="6" className={item.ringBg} />
                          <motion.circle
                            cx="44" cy="44" r="36" fill="none" strokeWidth="6"
                            className={item.ringColor}
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            initial={{ strokeDashoffset: circumference }}
                            animate={{ strokeDashoffset: circumference - strokeDash }}
                            transition={{ duration: 1.2, delay: 0.4 + i * 0.15, ease: 'easeOut' }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-lg font-bold leading-none">{item.count}</span>
                          <span className="text-[10px] text-muted-foreground font-medium">{pct}%</span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-2.5">
                        <div>
                          <h3 className="font-semibold text-sm tracking-tight">{item.label}</h3>
                          <p className="text-[11px] text-muted-foreground leading-tight">{item.subtitle}</p>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${item.tagBg}`}>
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {item.approved} aprovado{item.approved !== 1 ? 's' : ''}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground border border-border/50">
                            {item.count - item.approved} pendente{item.count - item.approved !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Mini bar */}
                        <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full bg-gradient-to-r ${item.gradient}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${maxDispatch > 0 ? (item.count / maxDispatch) * 100 : 0}%` }}
                            transition={{ duration: 0.9, delay: 0.5 + i * 0.15, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </>
        )}

        {/* Step Indicator */}
        {step !== 'list' && (
          <motion.div {...fadeIn} className="flex items-center justify-center gap-1 md:gap-2 py-2 overflow-x-auto">
            {getVisibleSteps().map((s, i) => {
              const isActive = s.key === step;
              const isPast = i < currentStepIndex;
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center gap-1 md:gap-2 shrink-0">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' :
                    isPast ? 'bg-primary/15 text-primary' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">{s.label}</span>
                  </div>
                  {i < getVisibleSteps().length - 1 && (
                    <div className={`w-4 md:w-8 h-0.5 rounded-full transition-colors ${isPast ? 'bg-primary' : 'bg-muted'}`} />
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {/* LIST */}
          {step === 'list' && (
            <motion.div key="list" {...fadeIn}>
              <Card className="border-border/50">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <History className="h-5 w-5 text-primary" />
                    Histórico de Recursos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Pesquisar por marca ou processo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 rounded-xl" />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} className="pl-9 rounded-xl w-full sm:w-44" />
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Carregando recursos...</p>
                    </div>
                  ) : filteredResources.length === 0 ? (
                    <div className="text-center py-12 space-y-3">
                      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground font-medium">
                        {resources.length === 0 ? 'Nenhum recurso criado ainda.' : 'Nenhum resultado encontrado.'}
                      </p>
                      {resources.length === 0 && (
                        <Button variant="outline" onClick={() => setStep('select-type')} className="gap-2 rounded-xl">
                          <Plus className="h-4 w-4" />
                          Criar primeiro recurso
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="font-semibold">Marca</TableHead>
                            <TableHead className="font-semibold">Processo</TableHead>
                            <TableHead className="font-semibold">Tipo</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="font-semibold">Data</TableHead>
                            <TableHead className="font-semibold text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredResources.map((resource) => (
                            <TableRow key={resource.id} className="hover:bg-muted/30 transition-colors">
                              <TableCell className="font-medium">{resource.brand_name || '-'}</TableCell>
                              <TableCell className="font-mono text-sm">{resource.process_number || '-'}</TableCell>
                              <TableCell>
                                <span className="text-sm">{RESOURCE_TYPE_LABELS[resource.resource_type] || resource.resource_type}</span>
                              </TableCell>
                              <TableCell>{getStatusBadge(resource.status)}</TableCell>
                              <TableCell className="text-sm">{format(new Date(resource.created_at), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg" onClick={() => { setSelectedResource(resource); setShowPDFPreview(true); }}>
                                    <Eye className="h-4 w-4" />
                                    <span className="hidden sm:inline">Ver</span>
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52">
                                      <DropdownMenuItem onClick={() => handleEditResource(resource)} className="gap-2">
                                        <Edit3 className="h-4 w-4" />
                                        Editar Recurso
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleRequestNewStrategy(resource)} className="gap-2">
                                        <RefreshCw className="h-4 w-4" />
                                        Nova Estratégia com IA
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => { setSelectedResource(resource); setShowPDFPreview(true); }} className="gap-2">
                                        <Download className="h-4 w-4" />
                                        Gerar PDF Timbrado
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => setShowDeleteConfirm(resource.id)} className="gap-2 text-destructive focus:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                        Excluir Recurso
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* SELECT TYPE */}
          {step === 'select-type' && (
            <motion.div key="select-type" {...fadeIn} className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">Qual tipo de recurso deseja gerar?</h2>
                <p className="text-muted-foreground text-sm mt-1">Selecione o tipo e avance para escolher a estratégia jurídica</p>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {Object.entries(RESOURCE_TYPE_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  const isSelected = resourceType === key;
                  return (
                    <motion.div
                      key={key}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setResourceType(key)}
                      className={`relative cursor-pointer rounded-2xl border-2 p-6 transition-all bg-gradient-to-br ${config.gradient} ${
                        isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background border-primary/50' : ''
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3">
                          <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3.5 w-3.5 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                      <div className={`h-12 w-12 rounded-xl bg-background/80 backdrop-blur flex items-center justify-center mb-4 ${config.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="font-semibold text-base mb-2">{RESOURCE_TYPE_LABELS[key]}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{config.description}</p>
                    </motion.div>
                  );
                })}
              </div>
              <div className="pt-4">
                <Button 
                  onClick={() => setStep('select-agent')} 
                  disabled={!resourceType} 
                  size="lg"
                  className="w-full gap-3 rounded-xl shadow-lg shadow-primary/15 h-14 text-base"
                >
                  <Brain className="h-5 w-5" />
                  Escolher Estratégia Jurídica
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* SELECT AGENT — THE PREMIUM STEP */}
          {step === 'select-agent' && (
            <motion.div key="select-agent" {...fadeIn} className="space-y-6">
              <div className="text-center space-y-2">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', duration: 0.6 }}
                  className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-xl shadow-primary/25 mb-4"
                >
                  <Brain className="h-8 w-8 text-primary-foreground" />
                </motion.div>
                <h2 className="text-2xl font-bold tracking-tight">Escolha sua Estratégia Jurídica</h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Cada agente de IA é inspirado em um dos maiores advogados de Propriedade Industrial do Brasil, com estratégias reais e jurisprudência consolidada.
                </p>
              </div>

              <Tabs value={selectedAgent} onValueChange={(v) => setSelectedAgent(v as AgentId)} className="w-full">
                <TabsList className="w-full h-auto p-1.5 bg-muted/80 rounded-2xl grid grid-cols-3 gap-1">
                  {Object.values(AI_AGENTS).map((ag) => {
                    const AgIcon = ag.icon;
                    return (
                      <TabsTrigger
                        key={ag.id}
                        value={ag.id}
                        className="rounded-xl py-3 px-2 data-[state=active]:shadow-lg data-[state=active]:bg-background flex flex-col items-center gap-1 text-xs md:text-sm transition-all"
                      >
                        <AgIcon className="h-5 w-5" />
                        <span className="font-semibold truncate">{ag.name}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {Object.values(AI_AGENTS).map((ag) => {
                  const AgIcon = ag.icon;
                  return (
                    <TabsContent key={ag.id} value={ag.id} className="mt-6">
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Card className={`border-2 ${ag.borderColor} overflow-hidden transition-all`}>
                          {/* Agent Header */}
                          <div className={`relative p-6 md:p-8 bg-gradient-to-r ${ag.color} text-white overflow-hidden`}>
                            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L3N2Zz4=')] opacity-30" />
                            <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/4" />
                            
                            <div className="relative flex flex-col md:flex-row items-start md:items-center gap-4">
                              <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-xl">
                                <AgIcon className="h-8 w-8" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-xl md:text-2xl font-bold">{ag.name}</h3>
                                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 text-xs">
                                    <Flame className="h-3 w-3 mr-1" />
                                    Elite
                                  </Badge>
                                </div>
                                <p className="text-white/80 text-sm">{ag.subtitle}</p>
                                <p className="text-white/60 text-xs mt-1">Inspirado em {ag.inspiration} • {ag.firm}</p>
                              </div>
                              <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30">
                                <BookOpen className="h-3 w-3 mr-1" />
                                {ag.style}
                              </Badge>
                            </div>
                          </div>

                          <CardContent className="p-6 md:p-8 space-y-6">
                            <p className="text-muted-foreground leading-relaxed">{ag.description}</p>

                            {/* Strengths */}
                            <div>
                              <Label className="flex items-center gap-2 mb-3 font-semibold">
                                <Zap className="h-4 w-4 text-primary" />
                                Pontos Fortes desta Estratégia
                              </Label>
                              <div className="grid sm:grid-cols-2 gap-2">
                                {ag.strengths.map((s, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border/50"
                                  >
                                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span className="text-sm">{s}</span>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </TabsContent>
                  );
                })}
              </Tabs>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep('select-type')} className="rounded-xl">Voltar</Button>
                {resourceType === 'notificacao_extrajudicial' ? (
                  <Button 
                    onClick={() => setStep('notificacao-data')} 
                    size="lg" 
                    className={`flex-1 gap-3 rounded-xl h-14 text-base shadow-xl bg-gradient-to-r ${agent.color} hover:opacity-90 transition-opacity`}
                  >
                    <agent.icon className="h-5 w-5" />
                    Usar {agent.name} e Preencher Dados
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </Button>
                ) : isRespostaNotificacao ? (
                  <Button 
                    onClick={() => setStep('resposta-notificacao-data')} 
                    size="lg" 
                    className={`flex-1 gap-3 rounded-xl h-14 text-base shadow-xl bg-gradient-to-r ${agent.color} hover:opacity-90 transition-opacity`}
                  >
                    <agent.icon className="h-5 w-5" />
                    Usar {agent.name} e Anexar Notificação
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </Button>
                ) : isProcuradorType ? (
                  <Button 
                    onClick={() => setStep('procurador-data')} 
                    size="lg" 
                    className={`flex-1 gap-3 rounded-xl h-14 text-base shadow-xl bg-gradient-to-r ${agent.color} hover:opacity-90 transition-opacity`}
                  >
                    <agent.icon className="h-5 w-5" />
                    Usar {agent.name} e Preencher Dados
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setStep('upload')} 
                    size="lg" 
                    className={`flex-1 gap-3 rounded-xl h-14 text-base shadow-xl bg-gradient-to-r ${agent.color} hover:opacity-90 transition-opacity`}
                  >
                    <agent.icon className="h-5 w-5" />
                    Usar {agent.name} e Anexar Documentos
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* NOTIFICAÇÃO EXTRAJUDICIAL DATA FORM */}
          {step === 'notificacao-data' && (
            <motion.div key="notificacao-data" {...fadeIn} className="space-y-6">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold">Dados da Notificação Extrajudicial</h2>
                <p className="text-muted-foreground text-sm mt-1">Preencha os dados do notificante e do notificado para a IA gerar a notificação</p>
              </div>

              {/* Notificante */}
              <Card className="border-purple-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-5 w-5 text-purple-500" />
                    Dados do Notificante (Titular da Marca)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Client Search */}
                  <div className="relative" ref={clientDropdownRef}>
                    <Label className="flex items-center gap-2 mb-2">
                      <Search className="h-3.5 w-3.5" />
                      Pesquisar Cliente
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Digite nome, e-mail, CPF/CNPJ ou empresa..."
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                        onFocus={() => { if (clientSearchResults.length > 0) setShowClientDropdown(true); }}
                        className="pl-9 rounded-xl"
                      />
                      {isSearchingClients && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {clientSearchQuery && !isSearchingClients && (
                        <button
                          onClick={() => { setClientSearchQuery(''); setClientSearchResults([]); setShowClientDropdown(false); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {showClientDropdown && clientSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-xl max-h-64 overflow-y-auto">
                        {clientSearchResults.map((client) => (
                          <button
                            key={client.id}
                            onClick={() => handleSelectClient(client)}
                            className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border/50 last:border-0"
                          >
                            <p className="font-medium text-sm">{client.company_name || client.full_name || 'Sem nome'}</p>
                            <p className="text-xs text-muted-foreground">
                              {[client.email, client.cpf_cnpj, client.phone].filter(Boolean).join(' • ')}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                    {showClientDropdown && clientSearchQuery.length >= 2 && clientSearchResults.length === 0 && !isSearchingClients && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-xl p-4 text-center">
                        <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Selecione um cliente para preencher automaticamente ou preencha manualmente abaixo
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome / Razão Social *</Label>
                      <Input
                        placeholder="Nome completo ou razão social"
                        value={notificanteData.nome}
                        onChange={(e) => setNotificanteData(prev => ({ ...prev, nome: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CPF / CNPJ</Label>
                      <Input
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        value={notificanteData.cpf_cnpj}
                        onChange={(e) => setNotificanteData(prev => ({ ...prev, cpf_cnpj: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Endereço</Label>
                      <Input
                        placeholder="Endereço completo"
                        value={notificanteData.endereco}
                        onChange={(e) => setNotificanteData(prev => ({ ...prev, endereco: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome da Marca *</Label>
                      <Input
                        placeholder="Nome da marca registrada"
                        value={notificanteData.marca}
                        onChange={(e) => setNotificanteData(prev => ({ ...prev, marca: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nº Processo INPI</Label>
                      <Input
                        placeholder="Ex: 920123456"
                        value={notificanteData.processo_inpi}
                        onChange={(e) => setNotificanteData(prev => ({ ...prev, processo_inpi: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nº Registro da Marca</Label>
                      <Input
                        placeholder="Número do registro"
                        value={notificanteData.registro_marca}
                        onChange={(e) => setNotificanteData(prev => ({ ...prev, registro_marca: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notificado */}
              <Card className="border-red-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Dados do Notificado (Infrator)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome / Razão Social *</Label>
                      <Input
                        placeholder="Nome completo ou razão social do infrator"
                        value={notificadoData.nome}
                        onChange={(e) => setNotificadoData(prev => ({ ...prev, nome: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CPF / CNPJ</Label>
                      <Input
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        value={notificadoData.cpf_cnpj}
                        onChange={(e) => setNotificadoData(prev => ({ ...prev, cpf_cnpj: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Endereço</Label>
                      <Input
                        placeholder="Endereço completo do infrator"
                        value={notificadoData.endereco}
                        onChange={(e) => setNotificadoData(prev => ({ ...prev, endereco: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Instruções */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    Instruções para o Agente de IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Descreva o contexto da infração: como a marca está sendo usada indevidamente, onde (loja, site, redes sociais), há quanto tempo, em quais produtos/serviços, e qualquer outra informação relevante para a elaboração da notificação..."
                    value={userInstructions}
                    onChange={(e) => setUserInstructions(e.target.value)}
                    rows={6}
                    className="rounded-xl resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Quanto mais detalhes você fornecer, mais precisa e robusta será a notificação gerada pela IA.
                  </p>
                </CardContent>
              </Card>

              {/* Anexar Documentos */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    Anexar Documentos (Provas)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Anexe PDFs, fotos, prints e outros documentos que comprovem o uso indevido da marca. (Opcional)
                  </p>
                  
                  <div 
                    onClick={() => multiFileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 rounded-xl cursor-pointer transition-colors hover:bg-muted/50"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Clique para selecionar arquivos</p>
                    <p className="text-xs text-muted-foreground">PDFs, imagens (JPG, PNG) e documentos</p>
                  </div>
                  <input 
                    ref={multiFileInputRef} 
                    type="file" 
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp" 
                    multiple 
                    className="hidden" 
                    onChange={handleMultiFileSelect} 
                  />

                  {multipleFiles.length > 0 && (
                    <div className="space-y-2">
                      {multipleFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border">
                          {f.type.startsWith('image/') ? (
                            <ImageIcon className="h-5 w-5 text-blue-500 shrink-0" />
                          ) : (
                            <FileText className="h-5 w-5 text-red-500 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{f.name}</p>
                            <p className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeMultiFile(i)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep('select-agent')} className="rounded-xl">Voltar</Button>
                <Button 
                  onClick={processDocument}
                  disabled={!notificanteData.nome || !notificadoData.nome}
                  size="lg" 
                  className={`flex-1 gap-3 rounded-xl h-14 text-base shadow-xl bg-gradient-to-r ${agent.color} hover:opacity-90 transition-opacity`}
                >
                  <Zap className="h-5 w-5" />
                  Gerar Notificação com {agent.name}
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* PROCURADOR DATA FORM */}
          {step === 'procurador-data' && (
            <motion.div key="procurador-data" {...fadeIn} className="space-y-6">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold">
                  {resourceType === 'troca_procurador' ? 'Dados para Troca de Procurador' : 'Dados para Nomeação de Procurador'}
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Preencha os dados do titular e do(s) procurador(es) para a IA gerar a petição
                </p>
              </div>

              {/* Titular / Cliente */}
              <Card className="border-teal-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-5 w-5 text-teal-500" />
                    Dados do Titular / Constituinte
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Client Search */}
                  <div className="relative" ref={clientDropdownRef}>
                    <Label className="flex items-center gap-2 mb-2">
                      <Search className="h-3.5 w-3.5" />
                      Pesquisar Cliente
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Digite nome, e-mail, CPF/CNPJ ou empresa..."
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                        onFocus={() => { if (clientSearchResults.length > 0) setShowClientDropdown(true); }}
                        className="pl-9 rounded-xl"
                      />
                      {isSearchingClients && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {clientSearchQuery && !isSearchingClients && (
                        <button
                          onClick={() => { setClientSearchQuery(''); setClientSearchResults([]); setShowClientDropdown(false); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {showClientDropdown && clientSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-xl max-h-64 overflow-y-auto">
                        {clientSearchResults.map((client) => (
                          <button
                            key={client.id}
                            onClick={() => {
                              setProcuradorData(prev => ({
                                ...prev,
                                titular: client.company_name || client.full_name || '',
                                cpf_cnpj_titular: client.cpf_cnpj || '',
                              }));
                              setClientSearchQuery(client.company_name || client.full_name || '');
                              setShowClientDropdown(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border/50 last:border-0"
                          >
                            <p className="font-medium text-sm">{client.company_name || client.full_name || 'Sem nome'}</p>
                            <p className="text-xs text-muted-foreground">
                              {[client.email, client.cpf_cnpj, client.phone].filter(Boolean).join(' • ')}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Selecione um cliente para preencher automaticamente ou preencha manualmente abaixo
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome / Razão Social do Titular *</Label>
                      <Input
                        placeholder="Nome completo ou razão social"
                        value={procuradorData.titular}
                        onChange={(e) => setProcuradorData(prev => ({ ...prev, titular: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CPF / CNPJ do Titular</Label>
                      <Input
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        value={procuradorData.cpf_cnpj_titular}
                        onChange={(e) => setProcuradorData(prev => ({ ...prev, cpf_cnpj_titular: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Endereço do Titular</Label>
                      <Input
                        placeholder="Rua Exemplo, nº 123, Bairro Exemplo, Cidade Exemplo, Estado Exemplo, CEP 00000-000"
                        value={procuradorData.endereco_titular}
                        onChange={(e) => setProcuradorData(prev => ({ ...prev, endereco_titular: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome da Marca *</Label>
                      <Input
                        placeholder="Nome da marca registrada"
                        value={procuradorData.marca}
                        onChange={(e) => setProcuradorData(prev => ({ ...prev, marca: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nº Processo INPI</Label>
                      <Input
                        placeholder="Ex: 920123456"
                        value={procuradorData.processo_inpi}
                        onChange={(e) => setProcuradorData(prev => ({ ...prev, processo_inpi: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Classe NCL</Label>
                      <Input
                        placeholder="Ex: 35"
                        value={procuradorData.ncl_class}
                        onChange={(e) => setProcuradorData(prev => ({ ...prev, ncl_class: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Procurador Antigo (só para troca) */}
              {resourceType === 'troca_procurador' && (
                <Card className="border-orange-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UserMinus className="h-5 w-5 text-orange-500" />
                      Procurador Anterior (a ser revogado)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome Completo *</Label>
                        <Input
                          placeholder="Nome do procurador anterior"
                          value={procuradorData.procurador_antigo}
                          onChange={(e) => setProcuradorData(prev => ({ ...prev, procurador_antigo: e.target.value }))}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Novo Procurador (fixo) */}
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-emerald-500" />
                    {resourceType === 'troca_procurador' ? 'Novo Procurador (a ser nomeado)' : 'Procurador a ser Nomeado'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 rounded-xl bg-background border border-emerald-500/20">
                    <p className="font-semibold text-foreground">Davilys Danques de Oliveira Cunha</p>
                    <p className="text-sm text-muted-foreground mt-1">CPF: 393.239.118-79 | RG: 50.688.779-0</p>
                    <p className="text-sm text-muted-foreground">Av. Brigadeiro Luís Antônio, Nº 2696 - Centro, São Paulo/SP</p>
                    <p className="text-xs text-emerald-600 mt-2 font-medium">✓ Procurador institucional — dados preenchidos automaticamente</p>
                  </div>
                </CardContent>
              </Card>

              {/* Instruções / Motivo */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    Instruções para o Agente de IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder={resourceType === 'troca_procurador' 
                      ? "Descreva o motivo da troca de procurador, informações adicionais sobre o caso, e qualquer instrução especial para a elaboração da petição..."
                      : "Descreva o contexto da nomeação, poderes específicos a serem outorgados, e qualquer informação relevante..."
                    }
                    value={procuradorData.motivo}
                    onChange={(e) => setProcuradorData(prev => ({ ...prev, motivo: e.target.value }))}
                    rows={5}
                    className="rounded-xl resize-none"
                  />
                </CardContent>
              </Card>

              {/* Anexar Documentos */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    Anexar Documentos (Opcional)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Anexe procurações anteriores, documentos do processo ou outros arquivos relevantes.
                  </p>
                  <div 
                    onClick={() => multiFileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 rounded-xl cursor-pointer transition-colors hover:bg-muted/50"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Clique para selecionar arquivos</p>
                    <p className="text-xs text-muted-foreground">PDFs, imagens (JPG, PNG) e documentos</p>
                  </div>
                  <input 
                    ref={multiFileInputRef} 
                    type="file" 
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp" 
                    multiple 
                    className="hidden" 
                    onChange={handleMultiFileSelect} 
                  />
                  {multipleFiles.length > 0 && (
                    <div className="space-y-2">
                      {multipleFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border">
                          {f.type.startsWith('image/') ? (
                            <ImageIcon className="h-5 w-5 text-blue-500 shrink-0" />
                          ) : (
                            <FileText className="h-5 w-5 text-red-500 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{f.name}</p>
                            <p className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeMultiFile(i)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep('select-agent')} className="rounded-xl">Voltar</Button>
                <Button 
                  onClick={processDocument}
                  disabled={!procuradorData.titular || !procuradorData.marca}
                  size="lg" 
                  className={`flex-1 gap-3 rounded-xl h-14 text-base shadow-xl bg-gradient-to-r ${agent.color} hover:opacity-90 transition-opacity`}
                >
                  <Zap className="h-5 w-5" />
                  Gerar {resourceType === 'troca_procurador' ? 'Troca' : 'Nomeação'} com {agent.name}
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* RESPOSTA A NOTIFICAÇÃO EXTRAJUDICIAL */}
          {step === 'resposta-notificacao-data' && (
            <motion.div key="resposta-notificacao-data" {...fadeIn} className="space-y-6">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold">Resposta a Notificação Extrajudicial</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Anexe o PDF da notificação extrajudicial recebida. A IA irá analisar e elaborar uma defesa jurídica robusta.
                </p>
              </div>

              {/* Upload da Notificação */}
              <Card className="border-cyan-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="h-5 w-5 text-cyan-500" />
                    Anexar Notificação Recebida *
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Anexe o PDF da notificação extrajudicial recebida e documentos de suporte (provas, registros de marca, etc.)
                  </p>
                  <div 
                    onClick={() => multiFileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-cyan-500/25 hover:border-cyan-500/50 rounded-xl cursor-pointer transition-colors hover:bg-cyan-500/5"
                  >
                    <Upload className="h-6 w-6 text-cyan-500 mb-2" />
                    <p className="text-sm font-medium">Clique para selecionar arquivos</p>
                    <p className="text-xs text-muted-foreground">PDF da notificação recebida + documentos de suporte (até 10 arquivos)</p>
                  </div>
                  <input 
                    ref={multiFileInputRef} 
                    type="file" 
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp" 
                    multiple 
                    className="hidden" 
                    onChange={handleMultiFileSelect} 
                  />
                  {multipleFiles.length > 0 && (
                    <div className="space-y-2">
                      {multipleFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-cyan-500/5 rounded-xl border border-cyan-500/10">
                          {f.type.startsWith('image/') ? (
                            <ImageIcon className="h-5 w-5 text-blue-500 shrink-0" />
                          ) : (
                            <FileText className="h-5 w-5 text-red-500 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{f.name}</p>
                            <p className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeMultiFile(i)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground text-center">{multipleFiles.length}/10 arquivo(s)</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Instruções adicionais */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    Instruções Adicionais (Opcional)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Descreva o contexto da sua defesa, argumentos específicos que deseja incluir, informações sobre seu uso legítimo da marca, provas de anterioridade, etc..."
                    value={userInstructions}
                    onChange={(e) => setUserInstructions(e.target.value)}
                    rows={5}
                    className="rounded-xl resize-none"
                  />
                </CardContent>
              </Card>

              {/* Info box */}
              <div className="p-4 bg-cyan-500/5 rounded-xl border border-cyan-500/20">
                <div className="flex items-start gap-3">
                  <Brain className="h-5 w-5 text-cyan-500 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium mb-1">O que a IA irá fazer:</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Analisar integralmente a notificação extrajudicial recebida</li>
                      <li>• Identificar fundamentos legais e alegações do notificante</li>
                      <li>• Elaborar defesa robusta refutando cada ponto da notificação</li>
                      <li>• Fundamentar com jurisprudência real (STJ, TRF-2, TRF-3)</li>
                      <li>• Aplicar a LPI, Manual de Marcas do INPI e doutrina especializada</li>
                      <li>• Demonstrar legitimidade do uso e/ou coexistência pacífica</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep('select-agent')} className="rounded-xl">Voltar</Button>
                <Button 
                  onClick={processDocument}
                  disabled={multipleFiles.length === 0}
                  size="lg" 
                  className={`flex-1 gap-3 rounded-xl h-14 text-base shadow-xl bg-gradient-to-r ${agent.color} hover:opacity-90 transition-opacity`}
                >
                  <Zap className="h-5 w-5" />
                  Gerar Defesa com {agent.name}
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* UPLOAD */}
          {step === 'upload' && (
            <motion.div key="upload" {...fadeIn}>
              <Card className="border-primary/20 shadow-lg shadow-primary/5">
                <CardContent className="p-8 space-y-6">
                  <div className="text-center mb-2">
                    <h2 className="text-xl font-bold">Anexar Documentos</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                      Anexe até 10 arquivos (PDF, JPG, PNG) para a IA analisar detalhadamente • {RESOURCE_TYPE_LABELS[resourceType]}
                    </p>
                  </div>

                  {/* File list */}
                  {multipleFiles.length > 0 && (
                    <div className="space-y-2">
                      {multipleFiles.map((f, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-3 bg-primary/5 rounded-xl border border-primary/10">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{f.name}</p>
                            <p className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setMultipleFiles(prev => prev.filter((_, i) => i !== idx))}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground text-center">{multipleFiles.length}/10 arquivo(s)</p>
                    </div>
                  )}

                  {/* Drop zone to add more files */}
                  {multipleFiles.length < 10 && (
                    <>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 rounded-xl cursor-pointer transition-colors hover:bg-muted/50"
                      >
                        <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Clique para adicionar arquivos</p>
                        <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG • Até 10 arquivos</p>
                      </div>
                      <input 
                        ref={fileInputRef} 
                        type="file" 
                        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" 
                        multiple 
                        className="hidden" 
                        onChange={handleFileSelect} 
                      />
                    </>
                  )}

                  {/* Agent badge */}
                  <div className={`p-4 rounded-xl border-2 ${agent.borderColor} bg-gradient-to-r ${agent.color}/5`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-white`}>
                        <agent.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">{agent.style} • Inspirado em {agent.inspiration}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-xl border">
                    <div className="flex items-start gap-3">
                      <Brain className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium mb-1">O que a IA irá fazer:</p>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• Analisar todos os documentos anexados detalhadamente</li>
                          <li>• Extrair dados (nº processo, marca, classe NCL)</li>
                          <li>• Aplicar a estratégia {agent.style}</li>
                          <li>• Elaborar recurso com jurisprudência real (STJ, TRF-2, TRF-3)</li>
                          <li>• Incluir fundamentação da LPI e Manual de Marcas do INPI</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => { setMultipleFiles([]); setStep('select-agent'); }} className="rounded-xl">Voltar</Button>
                    <Button 
                      onClick={processDocument} 
                      disabled={multipleFiles.length === 0}
                      className={`flex-1 gap-2 rounded-xl h-12 text-base shadow-lg bg-gradient-to-r ${agent.color} hover:opacity-90`}
                    >
                      <Zap className="h-5 w-5" />
                      Processar {multipleFiles.length} arquivo(s) com {agent.name}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* PROCESSING */}
          {step === 'processing' && (
            <motion.div key="processing" {...fadeIn}>
              <Card className="border-primary/20 overflow-hidden">
                <div className="h-1 bg-muted">
                  <motion.div 
                    className={`h-full bg-gradient-to-r ${agent.color}`}
                    initial={{ width: '0%' }}
                    animate={{ width: `${processingProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <CardContent className="py-16">
                  <div className="flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto">
                    <div className="relative">
                      <div className={`absolute inset-0 ${agent.bgGlow} rounded-full blur-xl animate-pulse`} />
                      <div className={`relative h-20 w-20 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center shadow-lg`}>
                        <agent.icon className="h-10 w-10 text-white animate-pulse" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">{agent.name} Processando</h3>
                      <p className="text-muted-foreground">
                        {resourceType === 'notificacao_extrajudicial' 
                          ? `Elaborando Notificação Extrajudicial com estratégia "${agent.style}" e fundamentação legal completa...`
                          : resourceType === 'resposta_notificacao_extrajudicial'
                          ? `Analisando notificação recebida e elaborando defesa com estratégia "${agent.style}" e jurisprudência real...`
                          : `Aplicando estratégia "${agent.style}" com jurisprudência real e fundamentação completa...`
                        }
                      </p>
                    </div>
                    <div className="w-full space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium text-primary">{Math.round(processingProgress)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div 
                          className={`h-full bg-gradient-to-r ${agent.color} rounded-full`}
                          style={{ width: `${processingProgress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                      {(resourceType === 'notificacao_extrajudicial' 
                        ? ['Analisando dados', 'Processando provas', 'Fundamentação legal', 'Elaborando notificação', 'Revisão final']
                        : resourceType === 'resposta_notificacao_extrajudicial'
                        ? ['Lendo notificação', 'Identificando alegações', 'Fundamentação legal', 'Elaborando defesa', 'Revisão final']
                        : ['Lendo PDF', 'Extraindo dados', 'Analisando fundamentos', 'Aplicando estratégia', 'Elaborando recurso']
                      ).map((label, i) => (
                        <Badge key={i} variant="outline" className={`text-xs ${processingProgress > (i + 1) * 18 ? 'border-primary/50 text-primary' : 'text-muted-foreground'}`}>
                          {processingProgress > (i + 1) * 18 ? <Check className="h-3 w-3 mr-1" /> : <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* REVIEW */}
          {step === 'review' && (
            <motion.div key="review" {...fadeIn} className="space-y-4">
              {extractedData && (
                <Card className="border-primary/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileCheck className="h-5 w-5 text-primary" />
                      {resourceType === 'notificacao_extrajudicial' ? 'Dados da Notificação' : 'Dados Extraídos do Documento'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {(resourceType === 'notificacao_extrajudicial' ? [
                        { label: 'Marca', value: extractedData.brand_name, icon: '®️' },
                        { label: 'Processo INPI', value: extractedData.process_number, icon: '📋' },
                        { label: 'Notificante', value: extractedData.holder, icon: '👤' },
                        { label: 'Notificado', value: extractedData.examiner_or_opponent, icon: '⚠️' },
                      ] : [
                        { label: 'Processo', value: extractedData.process_number, icon: '📋' },
                        { label: 'Marca', value: extractedData.brand_name, icon: '®️' },
                        { label: 'Classe NCL', value: extractedData.ncl_class, icon: '📑' },
                        { label: 'Titular', value: extractedData.holder, icon: '👤' },
                        { label: resourceType === 'oposicao' ? 'Oponente' : 'Examinador(a)', value: extractedData.examiner_or_opponent, icon: resourceType === 'oposicao' ? '⚖️' : '👩‍⚖️' },
                        { label: 'Fundamento Legal', value: extractedData.legal_basis, icon: '📖' },
                      ]).map((item, i) => (
                        <div key={i} className="p-3 rounded-xl bg-muted/50 border border-border/50">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">{item.icon} {item.label}</span>
                          <p className="font-medium text-sm mt-1 truncate">{item.value || '-'}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Edit3 className="h-5 w-5 text-primary" />
                    {resourceType === 'notificacao_extrajudicial' ? 'Rascunho da Notificação' : 'Rascunho do Recurso'}
                    <Badge variant="outline" className="ml-auto text-xs border-amber-500/30 text-amber-600 bg-amber-500/10">Revisão obrigatória</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-white dark:bg-gray-950 border rounded-xl p-6 max-h-[500px] overflow-y-auto shadow-inner">
                    <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-foreground">{draftContent}</pre>
                  </div>
                  
                  <div className="p-4 rounded-xl bg-muted/50 border space-y-3">
                    <Label htmlFor="adjustments" className="flex items-center gap-2 font-semibold">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Ajustes com IA
                    </Label>
                    <Textarea
                      id="adjustments"
                      placeholder={resourceType === 'notificacao_extrajudicial' 
                        ? "Descreva os ajustes desejados. Ex: Reforce a fundamentação no item III, adicione mais detalhes sobre o uso indevido..."
                        : "Descreva os ajustes desejados. Ex: Reforce a argumentação no item III, adicione referência ao art. 124 da LPI..."
                      }
                      value={adjustmentNotes}
                      onChange={(e) => setAdjustmentNotes(e.target.value)}
                      rows={4}
                      className="rounded-xl resize-none"
                    />
                    <p className="text-xs text-muted-foreground">A IA ajustará apenas os trechos indicados, mantendo o restante intacto.</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={handleRequestAdjustment} disabled={isAdjusting || !adjustmentNotes.trim()} className="gap-2 rounded-xl">
                      {isAdjusting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
                      Ajustar com IA
                    </Button>
                    <Button onClick={handleApproveResource} className="flex-1 gap-2 rounded-xl h-11 shadow-lg shadow-primary/15">
                      <CheckCircle2 className="h-4 w-4" />
                      {resourceType === 'notificacao_extrajudicial'
                        ? 'Aprovar Notificação Final'
                        : resourceType === 'resposta_notificacao_extrajudicial'
                          ? 'Aprovar Resposta Final'
                          : 'Aprovar Recurso Final'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* APPROVED */}
          {step === 'approved' && (
            <motion.div key="approved" {...fadeIn}>
              <Card className="border-emerald-500/20 overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
                <CardContent className="p-8">
                  <div className="text-center space-y-4 mb-8">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', delay: 0.2 }}
                      className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto"
                    >
                      <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    </motion.div>
                    <h3 className="text-xl font-bold">
                      {resourceType === 'notificacao_extrajudicial'
                        ? 'Notificação Aprovada com Sucesso!'
                        : resourceType === 'resposta_notificacao_extrajudicial'
                          ? 'Resposta à Notificação Aprovada com Sucesso!'
                          : 'Recurso Aprovado com Sucesso!'}
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      {resourceType === 'notificacao_extrajudicial'
                        ? 'A notificação foi aprovada e está pronta para geração do PDF final com papel timbrado oficial da WebMarcas.'
                        : resourceType === 'resposta_notificacao_extrajudicial'
                          ? 'A resposta à notificação foi aprovada e está pronta para geração do PDF final com papel timbrado oficial da WebMarcas.'
                          : 'O recurso foi aprovado e está pronto para geração do PDF final com papel timbrado oficial.'}
                    </p>
                  </div>
                  
                  <div className="grid sm:grid-cols-3 gap-3">
                    <Button variant="outline" onClick={() => window.print()} className="gap-2 rounded-xl h-12">
                      <Printer className="h-4 w-4" />
                      Imprimir
                    </Button>
                    <Button
                      onClick={() => {
                        if (currentResourceId) {
                          const resource: INPIResource = {
                            id: currentResourceId,
                            resource_type: resourceType,
                            process_number: extractedData?.process_number || null,
                            brand_name: extractedData?.brand_name || null,
                            ncl_class: extractedData?.ncl_class || null,
                            holder: extractedData?.holder || null,
                            examiner_or_opponent: extractedData?.examiner_or_opponent || null,
                            status: 'approved',
                            draft_content: null,
                            final_content: draftContent,
                            created_at: new Date().toISOString(),
                            approved_at: new Date().toISOString()
                          };
                          setSelectedResource(resource);
                          setShowPDFPreview(true);
                        }
                      }}
                      className="gap-2 rounded-xl h-12 shadow-lg shadow-primary/15"
                    >
                      <Download className="h-4 w-4" />
                      Gerar PDF Timbrado
                    </Button>
                    <Button variant="ghost" onClick={resetFlow} className="gap-2 rounded-xl h-12">
                      <Plus className="h-4 w-4" />
                      {resourceType === 'notificacao_extrajudicial'
                        ? 'Nova Notificação'
                        : resourceType === 'resposta_notificacao_extrajudicial'
                          ? 'Nova Resposta à Notificação'
                          : 'Novo Recurso'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PDF Preview Dialog */}
        <Dialog open={showPDFPreview} onOpenChange={setShowPDFPreview}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {selectedResource?.resource_type === 'notificacao_extrajudicial'
                  ? 'Notificação Extrajudicial — Papel Timbrado'
                  : selectedResource?.resource_type === 'resposta_notificacao_extrajudicial'
                    ? 'Resposta à Notificação Extrajudicial — Papel Timbrado'
                    : selectedResource?.resource_type === 'troca_procurador'
                      ? 'Petição de Troca de Procurador — Papel Timbrado'
                      : selectedResource?.resource_type === 'nomeacao_procurador'
                        ? 'Petição de Nomeação de Procurador — Papel Timbrado'
                        : 'Recurso Administrativo — Papel Timbrado'}
              </DialogTitle>
            </DialogHeader>
            {selectedResource && (
              <INPIResourcePDFPreview
                resource={selectedResource}
                content={selectedResource.final_content || selectedResource.draft_content || draftContent}
                resourceType={selectedResource.resource_type}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Excluir Recurso
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este recurso? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(null)} className="flex-1 rounded-xl">Cancelar</Button>
              <Button variant="destructive" onClick={() => showDeleteConfirm && handleDeleteResource(showDeleteConfirm)} className="flex-1 gap-2 rounded-xl">
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Floating Legal AI Chat Button */}
      <button
        onClick={() => setShowLegalChat(true)}
        className="fixed bottom-24 right-6 z-[9999] h-14 w-14 rounded-full bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white shadow-2xl hover:shadow-purple-500/40 transition-all duration-300 flex items-center justify-center group"
        title="Consultora Jurídica IA"
      >
        <Scale className="h-6 w-6 group-hover:scale-110 transition-transform" />
      </button>

      <INPILegalChatDialog open={showLegalChat} onOpenChange={setShowLegalChat} />
    </>
  );
}
