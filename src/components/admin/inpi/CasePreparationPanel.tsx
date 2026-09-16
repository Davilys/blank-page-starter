import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Upload, FileText, X, Loader2, CheckCircle2, AlertTriangle, Brain, Save, RefreshCw,
  ClipboardList, Zap, Eye,
} from 'lucide-react';
import {
  CASE_CATEGORIES, ACCEPTED_EXTENSIONS, MAX_FILE_BYTES, EXTRACTION_LABEL,
  extractContent, sha256Hex, documentsFingerprint, fileExtension, isImageExt,
  type CaseCategory, type ExtractionStatus,
} from '@/lib/inpi/caseDocuments';
import { rasterizePdfPages, imageToDataUrl } from '@/lib/inpi/packageBuilder';

interface CaseDoc {
  id: string;
  category: CaseCategory;
  file_name: string;
  byte_size: number | null;
  sha256: string | null;
  extraction_status: ExtractionStatus;
  extraction_notes: string | null;
  review_status: string;
  page_count: number | null;
  interpreted_pages: number | null;
  unreadable_pages: number | null;
  vision_read_pages: number | null;
}

interface UploadAttempt {
  id: string;
  category: CaseCategory;
  file: File;
  status: 'enviando' | 'falha';
  error: string | null;
}

interface OrientationRow {
  id: string;
  version: number;
  sections: Record<string, unknown>;
  editable_text: string | null;
  human_edited: boolean;
  documents_fingerprint: string | null;
  confirmed_at: string | null;
}

interface Props {
  resourceType: string;
  agentId: string;
  agentName: string;
  agentStrategy: string;
  onBack: () => void;
  onProceed: (payload: { caseId: string; files: File[]; orientation: string }) => void;
}

const BUCKET = 'inpi-recursos-docs';

export default function CasePreparationPanel({
  resourceType, agentId, agentName, agentStrategy, onBack, onProceed,
}: Props) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [docs, setDocs] = useState<CaseDoc[]>([]);
  const [busyCategory, setBusyCategory] = useState<CaseCategory | null>(null);
  const [uploadAttempts, setUploadAttempts] = useState<UploadAttempt[]>([]);
  const [visionBusy, setVisionBusy] = useState<Set<string>>(new Set());
  const [orientation, setOrientation] = useState<OrientationRow | null>(null);
  const [orientationText, setOrientationText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const localFiles = useRef<Map<string, File>>(new Map());
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const caseInitStarted = useRef(false);

  const reloadDocs = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('inpi_case_documents')
      .select('id, category, file_name, byte_size, sha256, extraction_status, extraction_notes, review_status, page_count, interpreted_pages, unreadable_pages, vision_read_pages')
      .eq('case_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) {
      toast.error('Não foi possível atualizar a lista de documentos: ' + error.message);
      throw error;
    }
    setDocs((data || []) as CaseDoc[]);
  }, []);

  /* ── Caso: criado uma única vez por sessão de preparação. ───────────── */
  useEffect(() => {
    if (caseInitStarted.current) return;
    caseInitStarted.current = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Sua sessão expirou. Entre novamente para anexar documentos.');
        return;
      }

      const storageKey = `inpi-resource-case:${user.id}:${resourceType}:${agentId}`;
      const storedCaseId = sessionStorage.getItem(storageKey);
      if (storedCaseId) {
        const { data: existingCase, error: existingError } = await supabase
          .from('inpi_resource_cases')
          .select('id')
          .eq('id', storedCaseId)
          .eq('owner_id', user.id)
          .eq('resource_type', resourceType)
          .eq('agent_id', agentId)
          .maybeSingle();

        if (existingError) {
          toast.error('Não foi possível recuperar o caso: ' + existingError.message);
          return;
        }
        if (existingCase) {
          setCaseId(existingCase.id);
          try {
            await reloadDocs(existingCase.id);
          } catch {
            // reloadDocs já mostra o erro real ao usuário.
          }
          return;
        }
        sessionStorage.removeItem(storageKey);
      }

      const { data, error } = await supabase
        .from('inpi_resource_cases')
        .insert({
          owner_id: user.id,
          resource_type: resourceType,
          agent_id: agentId,
          agent_name: agentName,
          status: 'documentos',
        })
        .select('id')
        .single();
      if (error) { toast.error('Não foi possível abrir o caso: ' + error.message); return; }
      sessionStorage.setItem(storageKey, data.id);
      setCaseId(data.id);
      setDocs([]);
    })();
  }, [resourceType, agentId, agentName, reloadDocs]);

  const setAttempt = (id: string, patch: Partial<UploadAttempt>) => {
    setUploadAttempts((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const removeAttempt = (id: string) => {
    setUploadAttempts((current) => current.filter((item) => item.id !== id));
  };

  const uploadFile = async (attempt: UploadAttempt) => {
    if (!caseId) return;
    const { category, file } = attempt;
    setAttempt(attempt.id, { status: 'enviando', error: null });
    setBusyCategory(category);
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error('Arquivo acima de 25 MB.');

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error(authError?.message || 'Sessão expirada. Entre novamente.');

      const hash = await sha256Hex(file);
      if (docs.some((d) => d.sha256 === hash)) {
        removeAttempt(attempt.id);
        toast.info(`${file.name} já estava anexado.`);
        return;
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${caseId}/${category}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || 'application/pdf',
        upsert: false,
      });
      if (upErr) throw new Error(`Falha no armazenamento: ${upErr.message}`);

      const { data: row, error: insErr } = await supabase
        .from('inpi_case_documents')
        .insert({
          case_id: caseId,
          category,
          file_name: file.name,
          mime_type: file.type || null,
          declared_mime_type: file.type || null,
          byte_size: file.size,
          storage_path: path,
          sha256: hash,
          extraction_status: 'recebido',
          uploaded_by: user.id,
          display_order: docs.length,
        })
        .select('id, category, file_name, byte_size, sha256, extraction_status, extraction_notes, review_status, page_count, interpreted_pages, unreadable_pages, vision_read_pages')
        .single();
      if (insErr) {
        const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([path]);
        const cleanupNote = cleanupError ? `; limpeza pendente: ${cleanupError.message}` : '';
        throw new Error(`Falha ao vincular ao caso: ${insErr.message}${cleanupNote}`);
      }

      const persisted = row as CaseDoc;
      localFiles.current.set(persisted.id, file);
      setDocs((current) => [...current.filter((doc) => doc.id !== persisted.id), persisted]);
      removeAttempt(attempt.id);

      const result = await extractContent(file);
      const { error: extractionUpdateError } = await supabase
        .from('inpi_case_documents')
        .update({
          extraction_status: result.status,
          extraction_notes: result.notes,
          extracted_text: result.text,
          page_count: result.pageCount,
          interpreted_pages: result.interpretedPages,
          unreadable_pages: result.unreadablePages,
          sheet_names: result.sheetNames,
        })
        .eq('id', persisted.id);
      if (extractionUpdateError) {
        toast.warning(`${file.name}: recebido, mas a leitura não foi salva (${extractionUpdateError.message}).`);
      }

      await reloadDocs(caseId);
      if (result.status === 'recebido' || result.status === 'parcial') {
        await runVisionRead(persisted.id, file);
      }
      if (orientation) markStale();
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Falha desconhecida no envio.';
      setAttempt(attempt.id, { status: 'falha', error: reason });
      toast.error(`${file.name}: ${reason}`);
    } finally {
      setBusyCategory(null);
    }
  };

  const handleFiles = (category: CaseCategory, files: File[]) => {
    if (!files.length || !caseId) return;
    const attempts = files.map((file) => ({
      id: crypto.randomUUID(), category, file, status: 'enviando' as const, error: null,
    }));
    setUploadAttempts((current) => [...current, ...attempts]);
    void (async () => {
      for (const attempt of attempts) await uploadFile(attempt);
    })();
  };

  /** Envia as páginas digitalizadas para leitura visual da IA. */
  const runVisionRead = async (docId: string, file: File) => {
    if (!caseId) return;
    if (visionBusy.has(docId)) return; // protege contra clique repetido
    setVisionBusy((s) => new Set(s).add(docId));
    try {
      const ext = fileExtension(file.name);
      let pages: { page: number; dataUrl: string }[] = [];
      if (ext === 'pdf') {
        const all = await rasterizePdfPages(file, Array.from({ length: 12 }, (_, i) => i + 1));
        pages = all;
      } else if (isImageExt(ext)) {
        pages = [{ page: 1, dataUrl: await imageToDataUrl(file) }];
      }
      if (!pages.length) return;
      const { data, error } = await supabase.functions.invoke('read-inpi-scanned-pages', {
        body: { caseId, documentId: docId, pages },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha na leitura visual');
      toast.success(
        `${file.name}: ${data.pages_interpreted} página(s) interpretada(s) por leitura visual.`,
      );
    } catch (e) {
      toast.warning(
        `${file.name}: leitura visual não concluída (${e instanceof Error ? e.message : 'erro'}). ` +
          'As páginas seguem como não conferidas.',
      );
    } finally {
      setVisionBusy((s) => { const n = new Set(s); n.delete(docId); return n; });
      await reloadDocs(caseId);
    }
  };

  const removeDoc = async (docId: string) => {
    if (!caseId) return;
    await supabase.from('inpi_case_documents').update({ is_active: false }).eq('id', docId);
    localFiles.current.delete(docId);
    await reloadDocs(caseId);
    if (orientation) markStale();
  };

  const currentFingerprint = useMemo(() => documentsFingerprint(docs), [docs]);
  const isStale = !!orientation && orientation.documents_fingerprint !== currentFingerprint;

  const markStale = () => {
    if (!orientation) return;
    supabase.from('inpi_case_orientations').update({ is_stale: true }).eq('id', orientation.id);
  };

  const usable = docs.filter((d) => d.extraction_status !== 'falha');
  const failed = docs.filter((d) => d.extraction_status === 'falha');
  const missingRequired = CASE_CATEGORIES.filter(
    (c) => c.required && !usable.some((d) => d.category === c.key),
  );

  /* ── Orientação com IA ───────────────────────────────────────────────── */
  const generateOrientation = async () => {
    if (!caseId) return;
    if (!usable.length) { toast.error('Anexe ao menos um arquivo utilizável.'); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-inpi-orientation', {
        body: {
          caseId,
          agentStrategy,
          previousEdits: orientation?.human_edited ? orientationText : undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao gerar orientação');
      setOrientation(data.orientation as OrientationRow);
      setOrientationText((data.orientation as OrientationRow).editable_text || '');
      toast.success('Orientação gerada. Revise e confirme antes de gerar a peça.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar orientação');
    } finally {
      setGenerating(false);
    }
  };

  const saveOrientation = async () => {
    if (!orientation) return;
    setSaving(true);
    const { error } = await supabase
      .from('inpi_case_orientations')
      .update({ editable_text: orientationText, human_edited: true })
      .eq('id', orientation.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setOrientation({ ...orientation, editable_text: orientationText, human_edited: true });
    toast.success('Orientação salva.');
  };

  const confirmAndProceed = async () => {
    if (!caseId || !orientation) return;
    if (isStale) { toast.error('Os documentos mudaram. Atualize a análise antes de gerar a peça.'); return; }
    const { error } = await supabase
      .from('inpi_case_orientations')
      .update({ confirmed_at: new Date().toISOString(), editable_text: orientationText })
      .eq('id', orientation.id);
    if (error) { toast.error(error.message); return; }
    const files: File[] = [];
    for (const doc of usable) {
      const localFile = localFiles.current.get(doc.id);
      if (localFile) {
        files.push(localFile);
        continue;
      }

      const { data: storedFile, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(doc.storage_path);
      if (downloadError || !storedFile) {
        toast.error(
          `${doc.file_name}: não foi possível recuperar o arquivo (${downloadError?.message || 'arquivo indisponível'}).`,
        );
        return;
      }
      const restoredFile = new File([storedFile], doc.file_name, {
        type: storedFile.type || 'application/octet-stream',
      });
      localFiles.current.set(doc.id, restoredFile);
      files.push(restoredFile);
    }
    if (!files.length) { toast.error('Anexe ao menos um arquivo utilizável.'); return; }
    onProceed({ caseId, files, orientation: orientationText });
  };

  const requestList = useMemo(() => {
    const rec = (orientation?.sections?.['documentos_recomendados'] as
      | { documento?: string; finalidade?: string }[]
      | undefined) || [];
    if (!rec.length) return '';
    return (
      'Prezado cliente, para seguirmos com a sua defesa no INPI precisamos dos itens abaixo:\n\n' +
      rec.map((r, i) => `${i + 1}. ${r.documento} — ${r.finalidade}`).join('\n')
    );
  }, [orientation]);

  const sections = orientation?.sections as Record<string, unknown> | undefined;
  const listOf = (key: string): string[] => {
    const v = sections?.[key];
    return Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))) : [];
  };

  const statusBadge = (s: ExtractionStatus) => {
    const map: Record<ExtractionStatus, string> = {
      pendente: 'bg-muted text-muted-foreground',
      lendo: 'bg-primary/10 text-primary',
      recebido: 'bg-primary/10 text-primary',
      parcial: 'bg-amber-500/10 text-amber-600',
      lido: 'bg-emerald-500/10 text-emerald-600',
      nativo: 'bg-primary/10 text-primary',
      falha: 'bg-destructive/10 text-destructive',
    };
    return <Badge variant="outline" className={`text-[11px] ${map[s]}`}>{EXTRACTION_LABEL[s]}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* DOCUMENTOS POR FINALIDADE */}
      <Card className="border-primary/20">
        <CardContent className="p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold">Documentos do caso</h2>
            <p className="text-sm text-muted-foreground">
              Anexe cada arquivo na finalidade correta. Aceita PDF, imagens, Word, Excel, CSV e texto.
            </p>
          </div>

          {CASE_CATEGORIES.map((cat) => {
            const catDocs = docs.filter((d) => d.category === cat.key);
            const catAttempts = uploadAttempts.filter((item) => item.category === cat.key);
            const hint = (cat.hint as Record<string, string>)[resourceType] || cat.hint.default;
            return (
              <div key={cat.key} className="rounded-xl border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-2">
                      {cat.label}
                      {cat.required && <span className="text-destructive text-xs">obrigatório</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
                  </div>
                  <Button
                    variant="outline" size="sm" className="rounded-lg shrink-0"
                    disabled={!caseId || busyCategory === cat.key}
                    onClick={() => inputs.current[cat.key]?.click()}
                  >
                    {busyCategory === cat.key
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Upload className="h-4 w-4" />}
                    <span className="ml-2">Anexar</span>
                  </Button>
                  <input
                    ref={(el) => { inputs.current[cat.key] = el; }}
                    type="file" multiple hidden accept={ACCEPTED_EXTENSIONS}
                     onChange={(e) => {
                       // Safari mantém FileList ligada ao input. Copiar antes de limpar evita
                       // que a seleção fique vazia depois do primeiro await do upload.
                       const selectedFiles = Array.from(e.currentTarget.files ?? []);
                       e.currentTarget.value = '';
                       handleFiles(cat.key, selectedFiles);
                     }}
                  />
                </div>

                 {catAttempts.map((attempt) => (
                   <div key={attempt.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                     {attempt.status === 'enviando'
                       ? <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
                       : <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                     <div className="flex-1 min-w-0">
                       <p className="text-sm truncate">{attempt.file.name}</p>
                       <p className={`text-[11px] ${attempt.status === 'falha' ? 'text-destructive' : 'text-muted-foreground'}`}>
                         {attempt.status === 'enviando' ? 'Enviando' : attempt.error}
                       </p>
                     </div>
                     {attempt.status === 'falha' && (
                       <Button
                         variant="outline" size="sm" className="h-8 shrink-0"
                         onClick={() => void uploadFile(attempt)}
                       >
                         <RefreshCw className="h-3.5 w-3.5" />
                         <span className="ml-1">Tentar novamente</span>
                       </Button>
                     )}
                   </div>
                 ))}

                {catDocs.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{d.file_name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {((d.byte_size || 0) / 1024).toFixed(1)} KB
                        {d.extraction_notes ? ` • ${d.extraction_notes}` : ''}
                        {(d.vision_read_pages || 0) > 0
                          ? ` • ${d.vision_read_pages} página(s) lidas visualmente pela IA`
                          : ''}
                      </p>
                    </div>
                    {(d.unreadable_pages || 0) > 0 && localFiles.current.has(d.id) && (
                      <Button
                        variant="outline" size="sm" className="h-7 text-[11px] shrink-0"
                        disabled={visionBusy.has(d.id)}
                        onClick={() => runVisionRead(d.id, localFiles.current.get(d.id) as File)}
                      >
                        {visionBusy.has(d.id)
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Eye className="h-3 w-3" />}
                        <span className="ml-1">Ler páginas com IA</span>
                      </Button>
                    )}
                    {statusBadge(d.extraction_status)}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeDoc(d.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            );
          })}

          <div className="rounded-xl border p-4 text-sm space-y-1 bg-muted/30">
            <p className="font-medium">Situação do dossiê</p>
            <p className="text-muted-foreground">
              {usable.length} arquivo(s) utilizável(is) • {failed.length} com falha de leitura
            </p>
            {missingRequired.length > 0 && (
              <p className="text-amber-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Falta anexar: {missingRequired.map((m) => m.label).join(', ')}. É possível seguir, mas a
                análise ficará incompleta.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CONSULTORIA PREPARATÓRIA */}
      <Card className="border-amber-500/30">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Brain className="h-5 w-5 text-amber-600" /> Consultoria preparatória
              </h2>
              <p className="text-sm text-muted-foreground">
                A IA analisa os anexos e devolve fundamentos, provas, riscos e a estratégia para {agentName}.
              </p>
            </div>
            <Button
              onClick={generateOrientation}
              disabled={generating || !usable.length}
              className="rounded-xl gap-2 shrink-0"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {orientation ? 'Atualizar análise' : 'Gerar orientação com IA'}
            </Button>
          </div>

          {isStale && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-amber-600" />
              Os documentos mudaram depois desta análise. Atualize antes de gerar a peça.
            </div>
          )}

          {orientation && (
            <div className="space-y-4">
              <Separator />
              {[
                { key: 'fundamentos', title: 'Fundamentos a responder' },
                { key: 'provas', title: 'Provas disponíveis e o que demonstram' },
                { key: 'pontos_favoraveis', title: 'Pontos favoráveis' },
                { key: 'pontos_desfavoraveis', title: 'Pontos desfavoráveis' },
                { key: 'lacunas', title: 'Lacunas' },
                { key: 'documentos_recomendados', title: 'Documentos adicionais recomendados' },
              ].map(({ key, title }) => {
                const items = listOf(key);
                if (!items.length) return null;
                return (
                  <div key={key}>
                    <p className="font-semibold text-sm mb-1">{title}</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {items.map((it, i) => <li key={i}>• {it}</li>)}
                    </ul>
                  </div>
                );
              })}

              <div>
                <p className="font-semibold text-sm mb-1">
                  Estratégia para {agentName} <span className="font-normal text-muted-foreground">(editável)</span>
                </p>
                <Textarea
                  value={orientationText}
                  onChange={(e) => setOrientationText(e.target.value)}
                  rows={10}
                  className="text-sm resize-y"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button variant="outline" size="sm" className="rounded-lg gap-2" onClick={saveOrientation} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar orientação
                  </Button>
                  {requestList && (
                    <Button
                      variant="outline" size="sm" className="rounded-lg gap-2"
                      onClick={() => {
                        navigator.clipboard.writeText(requestList);
                        toast.success('Lista copiada. Nada foi enviado ao cliente automaticamente.');
                      }}
                    >
                      <ClipboardList className="h-4 w-4" /> Copiar pedido de documentos
                    </Button>
                  )}
                  {orientation.human_edited && (
                    <Badge variant="outline" className="text-[11px] bg-emerald-500/10 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Editada por humano
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="rounded-xl">Voltar</Button>
        <Button
          onClick={confirmAndProceed}
          disabled={!orientation || isStale || !usable.length}
          className="flex-1 rounded-xl h-12 gap-2"
        >
          <Zap className="h-5 w-5" />
          Confirmar orientação e gerar peça com {agentName}
        </Button>
      </div>
    </div>
  );
}
