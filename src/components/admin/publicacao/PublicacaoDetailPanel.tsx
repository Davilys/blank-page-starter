import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  X, Edit3, Bell, ExternalLink, Upload, Gavel, Trash2, Receipt,
  Users, Eye, Activity, FileText, Search, CheckCircle2, Newspaper,
  Shield, Award, RefreshCw, FileCheck, TrendingUp, Star, Check, Package,
} from 'lucide-react';
import type { Publicacao, PubStatus, LogEntry } from './types';
import { STATUS_CONFIG } from './types';
import { getDaysLeft, getScheduledAlerts } from './helpers';

const SERVICE_TYPES = [
  { id: 'pedido_registro', label: 'Pedido de Registro', description: 'Solicitação inicial junto ao INPI', icon: FileText },
  { id: 'cumprimento_exigencia', label: 'Cumprimento de Exigência', description: 'Resposta a exigência formal do INPI', icon: FileCheck },
  { id: 'oposicao', label: 'Manifestação de Oposição', description: 'Defesa contra oposição de terceiros', icon: Shield },
  { id: 'recurso', label: 'Recurso Administrativo', description: 'Recurso contra indeferimento do INPI', icon: TrendingUp },
  { id: 'renovacao', label: 'Renovação de Marca', description: 'Renovação do registro decenal', icon: RefreshCw },
  { id: 'notificacao', label: 'Notificação Extrajudicial', description: 'Cessação de uso indevido', icon: Bell },
  { id: 'deferimento', label: 'Deferimento', description: 'Pedido aprovado, aguardando concessão', icon: CheckCircle2 },
  { id: 'certificado', label: 'Certificado', description: 'Marca registrada e certificada', icon: Star },
  { id: 'distrato', label: 'Distrato', description: 'Serviço cancelado ou encerrado', icon: X },
];

const SERVICE_TO_STATUS: Record<string, string> = {
  pedido_registro: '003',
  cumprimento_exigencia: 'exigencia_merito',
  oposicao: 'oposicao',
  recurso: 'indeferimento',
  renovacao: 'renovacao',
  notificacao: '003',
  deferimento: 'deferimento',
  certificado: 'certificado',
  distrato: 'arquivado',
};

const STATUS_TO_SERVICE: Record<string, string> = {};
Object.entries(SERVICE_TO_STATUS).forEach(([svc, st]) => { if (!STATUS_TO_SERVICE[st]) STATUS_TO_SERVICE[st] = svc; });

const TIMELINE_STEPS = [
  { key: 'data_deposito', label: 'Depósito', icon: FileText, description: 'Pedido protocolado no INPI' },
  { key: 'data_publicacao_rpi', label: 'Publicação RPI', icon: Newspaper, description: 'Publicado na Revista da PI' },
  { key: 'prazo_oposicao', label: 'Prazo Oposição (60d)', icon: Gavel, description: 'Período para manifestações' },
  { key: 'data_decisao', label: 'Decisão', icon: Shield, description: 'Deferimento ou indeferimento' },
  { key: 'data_certificado', label: 'Certificado', icon: Award, description: 'Emissão do certificado' },
  { key: 'data_renovacao', label: 'Renovação (9 anos)', icon: RefreshCw, description: 'Prazo ordinário + 6m ord. + 6m extra' },
] as const;

interface Props {
  selected: Publicacao | null;
  onClose: () => void;
  processMap: Map<string, any>;
  clientMap: Map<string, any>;
  adminMap: Map<string, any>;
  logs: LogEntry[];
  onEdit: () => void;
  onDelete: () => void;
  onGenerateReminder: (pub: Publicacao) => void;
  onUploadDocument: (file: File) => void;
  onMarkOposition: () => void;
  onShowClientSheet: (pubId: string) => void;
  onAssignClient: (data: { pubId: string; clientId: string | null; oldClientId: string | null; processId: string | null; selectedProcessId?: string | null; brandName?: string; processNumber?: string; nclClass?: string }) => void;
  onUpdateFields: (id: string, changes: any, original: Publicacao) => void;
  onShowInvoice: () => void;
  clients: any[];
  processes: any[];
  showClientSheet: boolean;
}

export function PublicacaoDetailPanel({
  selected, onClose, processMap, clientMap, adminMap, logs, onEdit, onDelete,
  onGenerateReminder, onUploadDocument, onMarkOposition, onShowClientSheet,
  onAssignClient, onUpdateFields, onShowInvoice, clients, processes, showClientSheet,
}: Props) {
  const [clientAssignSearch, setClientAssignSearch] = useState('');
  const [showClientAssignDropdown, setShowClientAssignDropdown] = useState(false);
  const [showEditableFields, setShowEditableFields] = useState(false);
  const [editableBrandName, setEditableBrandName] = useState('');
  const [editableProcessNumber, setEditableProcessNumber] = useState('');
  const [editableNclClass, setEditableNclClass] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState(() => STATUS_TO_SERVICE[selected?.status || ''] || '');
  const clientAssignRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!selected || showClientSheet) return null;

  const proc = selected.process_id ? processMap.get(selected.process_id) : null;
  const brandName = proc?.brand_name || selected.brand_name_rpi || '—';
  const processNumber = proc?.process_number || selected.process_number_rpi || 'Sem número';
  const nclClass = (selected as any).ncl_class || proc?.ncl_classes?.join(', ') || null;

  return (
    <AnimatePresence mode="wait">
      <motion.div key={selected.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="lg:w-80 xl:w-96 flex-shrink-0">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Detalhes do Processo</CardTitle>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="mt-2">
              <p className="font-bold text-base break-words">{brandName}</p>
              <p className="text-xs text-muted-foreground">
                {processNumber} {' · '}
                {selected.client_id ? (clientMap.get(selected.client_id)?.full_name || '—') : <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 dark:text-amber-400 ml-1">Sem cliente</Badge>}
              </p>
              {nclClass && <p className="text-[10px] text-primary/80 font-medium mt-0.5">Classe Nice: {nclClass}</p>}
              {selected.descricao_prazo && <p className="text-xs text-primary font-medium mt-1">{selected.descricao_prazo}</p>}
              {selected.admin_id && adminMap.get(selected.admin_id) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Users className="w-3 h-3" /> Resp: {adminMap.get(selected.admin_id)?.full_name}</p>
              )}

              {/* Client assignment */}
              <div className="mt-3" ref={clientAssignRef}>
                <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Users className="w-3 h-3" /> Atribuir ao Cliente</Label>
                {selected.client_id && clientMap.get(selected.client_id) ? (() => {
                  const cl = clientMap.get(selected.client_id)!;
                  return (
                    <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{cl.full_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{cl.email}</p>
                        </div>
                        <button onClick={() => onAssignClient({ pubId: selected.id, clientId: null, oldClientId: selected.client_id, processId: selected.process_id })} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0" title="Desvincular cliente">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                        {cl.phone && <div><span className="text-muted-foreground">Tel:</span> <span className="font-medium">{cl.phone}</span></div>}
                        {cl.cpf_cnpj && <div><span className="text-muted-foreground">CPF/CNPJ:</span> <span className="font-medium">{cl.cpf_cnpj}</span></div>}
                        {cl.company_name && <div className="col-span-2"><span className="text-muted-foreground">Empresa:</span> <span className="font-medium">{cl.company_name}</span></div>}
                        {cl.contract_value != null && Number(cl.contract_value) > 0 && <div><span className="text-muted-foreground">Valor:</span> <span className="font-medium">R$ {Number(cl.contract_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>}
                      </div>
                      <button onClick={() => onShowClientSheet(selected.id)} className="w-full mt-1 text-[10px] text-primary hover:underline flex items-center justify-center gap-1">
                        <Eye className="w-3 h-3" /> Ver ficha completa do cliente
                      </button>
                    </div>
                  );
                })() : (
                  <div className="relative" ref={clientAssignRef}>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input placeholder="Buscar cliente por nome, email ou CPF..." value={clientAssignSearch} onChange={e => { setClientAssignSearch(e.target.value); setShowClientAssignDropdown(e.target.value.length >= 2); }} onFocus={() => { if (clientAssignSearch.length >= 2) setShowClientAssignDropdown(true); }} className="h-8 text-xs pl-7" />
                    </div>
                    {showClientAssignDropdown && clientAssignSearch.length >= 2 && (
                      <div className="fixed z-[9999] w-80 bg-popover border border-border rounded-lg shadow-xl max-h-60 overflow-y-auto" style={{ top: clientAssignRef.current ? clientAssignRef.current.getBoundingClientRect().bottom + 4 : 0, left: clientAssignRef.current ? clientAssignRef.current.getBoundingClientRect().left : 0 }}>
                        {(() => {
                          const q = clientAssignSearch.toLowerCase();
                          const matches = clients.filter((c: any) => (c.full_name?.toLowerCase().includes(q)) || (c.email?.toLowerCase().includes(q)) || (c.cpf_cnpj?.replace(/\D/g, '').includes(q.replace(/\D/g, '')))).slice(0, 12);
                          if (matches.length === 0) return <p className="text-xs text-muted-foreground p-3 text-center">Nenhum cliente encontrado</p>;
                          return matches.map((c: any) => {
                            const clientProcs = processes.filter((p: any) => p.user_id === c.id);
                            return (
                              <div key={c.id} className="border-b border-border/50 last:border-0">
                                <div className="px-3 py-2 hover:bg-accent/50 transition-colors">
                                  <p className="text-xs font-medium truncate">{c.full_name}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{c.email}{c.cpf_cnpj ? ` · ${c.cpf_cnpj}` : ''}</p>
                                </div>
                                {clientProcs.length > 0 ? (
                                  <div className="px-2 pb-1.5">
                                    <p className="text-[9px] text-muted-foreground uppercase font-semibold px-1 mb-0.5">Selecione a marca:</p>
                                    {clientProcs.map((cp: any) => (
                                      <button key={cp.id} onMouseDown={e => e.preventDefault()} onClick={() => { onAssignClient({ pubId: selected.id, clientId: c.id, oldClientId: selected.client_id, processId: selected.process_id, selectedProcessId: cp.id, brandName: cp.brand_name, processNumber: cp.process_number || undefined, nclClass: cp.ncl_classes?.join(', ') || undefined }); setShowClientAssignDropdown(false); setClientAssignSearch(''); }} className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-[10px] flex items-center gap-1.5 transition-colors">
                                        <FileText className="w-3 h-3 text-primary shrink-0" />
                                        <span className="font-medium truncate">{cp.brand_name}</span>
                                        {cp.process_number && <span className="text-muted-foreground font-mono">({cp.process_number})</span>}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <button onMouseDown={e => e.preventDefault()} onClick={() => { onAssignClient({ pubId: selected.id, clientId: c.id, oldClientId: selected.client_id, processId: selected.process_id }); setShowClientAssignDropdown(false); setClientAssignSearch(''); setShowEditableFields(true); }} className="w-full text-left px-3 py-1.5 text-[10px] text-primary hover:bg-accent transition-colors">
                                    Vincular sem processo →
                                  </button>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                    {/* Editable fields */}
                    <div className="mt-2 space-y-1.5">
                      <button onClick={() => setShowEditableFields(!showEditableFields)} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                        <Edit3 className="w-3 h-3" /> {showEditableFields ? 'Ocultar campos' : 'Preencher dados manualmente'}
                      </button>
                      {showEditableFields && (
                        <div className="space-y-1.5 p-2 rounded-lg border border-border bg-muted/30">
                          <div><Label className="text-[10px] text-muted-foreground">Nome da Marca</Label><Input className="h-7 text-xs" placeholder="Ex.: MINHA MARCA" value={editableBrandName} onChange={e => setEditableBrandName(e.target.value)} /></div>
                          <div><Label className="text-[10px] text-muted-foreground">Nº Processo</Label><Input className="h-7 text-xs" placeholder="Ex.: 123456789" value={editableProcessNumber} onChange={e => setEditableProcessNumber(e.target.value)} /></div>
                          <div><Label className="text-[10px] text-muted-foreground">Classe Nice (NCL)</Label><Input className="h-7 text-xs" placeholder="Ex.: 25, 35" value={editableNclClass} onChange={e => setEditableNclClass(e.target.value)} /></div>
                          {(editableBrandName || editableProcessNumber || editableNclClass) && (
                            <Button size="sm" className="w-full h-7 text-[10px]" onClick={() => {
                              const changes: any = {};
                              if (editableBrandName) changes.brand_name_rpi = editableBrandName;
                              if (editableProcessNumber) changes.process_number_rpi = editableProcessNumber;
                              if (editableNclClass) changes.ncl_class = editableNclClass;
                              onUpdateFields(selected.id, changes, selected);
                              setEditableBrandName(''); setEditableProcessNumber(''); setEditableNclClass(''); setShowEditableFields(false);
                            }}>Salvar campos</Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-500px)]">
              {/* Status badge */}
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className={cn('text-xs', STATUS_CONFIG[selected.status]?.bg, STATUS_CONFIG[selected.status]?.color)}>
                  {STATUS_CONFIG[selected.status]?.label}
                </Badge>
                {(() => {
                  const d = getDaysLeft(selected.proximo_prazo_critico);
                  if (d === null) return null;
                  return <Badge variant={d < 0 ? 'destructive' : d <= 7 ? 'destructive' : 'secondary'} className="text-[10px]">{d < 0 ? `${Math.abs(d)}d atrasado` : `${d}d restantes`}</Badge>;
                })()}
              </div>

              {/* Timeline */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Timeline</p>
                {TIMELINE_STEPS.map(step => {
                  const date = (selected as any)[step.key] as string | null;
                  const isCompleted = !!date && new Date(date) <= new Date();
                  const isOverdue = !!date && getDaysLeft(date) !== null && getDaysLeft(date)! < 0 && !isCompleted;
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className="flex gap-3 relative">
                      <div className="flex flex-col items-center">
                        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all', isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 text-emerald-600 dark:text-emerald-400' : isOverdue ? 'bg-red-100 dark:bg-red-900/40 border-red-500 text-red-600 dark:text-red-400 animate-pulse' : 'bg-muted border-border text-muted-foreground')}>
                          {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                        </div>
                        <div className="w-0.5 flex-1 bg-border min-h-[24px]" />
                      </div>
                      <div className="pb-6 flex-1">
                        <p className={cn('text-sm font-semibold', isCompleted ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</p>
                        <p className="text-xs text-muted-foreground">{step.description}</p>
                        {date && <p className={cn('text-xs mt-1 font-medium', isOverdue ? 'text-red-600 dark:text-red-400' : 'text-primary')}>{format(parseISO(date), "dd/MM/yyyy", { locale: ptBR })}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tipo de Serviço */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-3.5 h-3.5 text-primary" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo de Serviço</p>
                </div>
                <div className="space-y-1.5">
                  {SERVICE_TYPES.map(svc => {
                    const Icon = svc.icon;
                    const isSelected = selectedServiceType === svc.id;
                    return (
                      <motion.button
                        key={svc.id}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          'w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all',
                          isSelected ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/20 hover:bg-muted/30'
                        )}
                        onClick={() => {
                          setSelectedServiceType(svc.id);
                          const newStatus = SERVICE_TO_STATUS[svc.id];
                          if (newStatus && newStatus !== selected.status) {
                            onUpdateFields(selected.id, { status: newStatus }, selected);
                          }
                        }}
                      >
                        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', isSelected ? 'bg-primary/20' : 'bg-muted/50')}>
                          <Icon className={cn('h-3.5 w-3.5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-xs font-medium', isSelected && 'text-primary')}>{svc.label}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">{svc.description}</p>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {selected.proximo_prazo_critico && (() => {
                const alerts = getScheduledAlerts(selected.proximo_prazo_critico);
                if (alerts.length === 0) return null;
                return (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Alertas Programados</p>
                    {alerts.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground py-0.5">
                        <Bell className="w-3 h-3 text-amber-500" />
                        <span>{a.label}: {format(a.date, 'dd/MM/yyyy')}</span>
                        <span className="text-primary">(em {a.days}d)</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <Separator className="my-4" />

              {/* Actions */}
              <div className="space-y-1.5">
                <Button size="sm" variant="outline" className="w-full text-xs justify-start" onClick={onEdit}><Edit3 className="w-3 h-3 mr-2" /> Editar Publicação</Button>
                <Button size="sm" variant="outline" className="w-full text-xs justify-start" onClick={() => onGenerateReminder(selected)}><Bell className="w-3 h-3 mr-2" /> Gerar Lembrete</Button>
                {selected.rpi_link && <Button size="sm" variant="outline" className="w-full text-xs justify-start" asChild><a href={selected.rpi_link} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3 mr-2" /> Abrir RPI Oficial</a></Button>}
                <Button size="sm" variant="outline" className="w-full text-xs justify-start" onClick={() => fileInputRef.current?.click()}><Upload className="w-3 h-3 mr-2" /> Upload Documento RPI</Button>
                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => { const file = e.target.files?.[0]; if (file) onUploadDocument(file); e.target.value = ''; }} />
                {!selected.oposicao_protocolada && selected.status === 'oposicao' && <Button size="sm" variant="outline" className="w-full text-xs justify-start" onClick={onMarkOposition}><Gavel className="w-3 h-3 mr-2" /> Marcar Oposição Protocolada</Button>}
                <Button size="sm" variant="outline" className="w-full text-xs justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete}><Trash2 className="w-3 h-3 mr-2" /> Excluir Publicação</Button>
                {selected.client_id && <Button size="sm" variant="outline" className="w-full text-xs justify-start" onClick={onShowInvoice}><Receipt className="w-3 h-3 mr-2" /> Nova Fatura</Button>}
              </div>

              {/* Comments */}
              {selected.comentarios_internos && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Comentários</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap">{selected.comentarios_internos}</p>
                  </div>
                </>
              )}

              {/* Logs */}
              {logs.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5"><Activity className="w-3 h-3" /> Histórico ({logs.length})</p>
                    <div className="space-y-0">
                      {logs.slice(0, 15).map((log, idx) => {
                        const isStatusChange = log.campo_alterado === 'status';
                        const isClientChange = log.campo_alterado === 'client_id';
                        return (
                          <div key={log.id} className="flex gap-2.5">
                            <div className="flex flex-col items-center">
                              <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', isStatusChange ? 'bg-primary' : isClientChange ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                              {idx < Math.min(logs.length, 15) - 1 && <div className="w-px flex-1 bg-border" />}
                            </div>
                            <div className="pb-3 flex-1 min-w-0">
                              <div className="text-[10px]">
                                {isStatusChange ? (
                                  <span>Status: <span className="line-through text-muted-foreground">{STATUS_CONFIG[log.valor_anterior as PubStatus]?.label || log.valor_anterior}</span>{' → '}<span className="font-bold text-primary">{STATUS_CONFIG[log.valor_novo as PubStatus]?.label || log.valor_novo}</span></span>
                                ) : (
                                  <span><span className="font-semibold text-primary">{log.campo_alterado}</span>{log.valor_anterior && <span className="line-through text-muted-foreground ml-1">{log.valor_anterior?.substring(0, 30)}</span>}{log.valor_novo && <span className="font-medium ml-1">→ {log.valor_novo?.substring(0, 30)}</span>}</span>
                                )}
                              </div>
                              <p className="text-[9px] text-muted-foreground">{log.admin_email?.split('@')[0] || 'Sistema'} · {format(parseISO(log.created_at), "dd/MM HH:mm", { locale: ptBR })}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
