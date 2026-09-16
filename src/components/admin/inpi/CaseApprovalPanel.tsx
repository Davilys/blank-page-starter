/**
 * Revisão → aprovação vinculada à versão → pacote de exportação.
 * Exclusivo das três modalidades do upgrade (indeferimento, exigência de
 * mérito e manifestação à oposição).
 *
 * Regras:
 *  - A aprovação grava os identificadores e hashes do texto, da orientação e
 *    do conjunto exato de anexos. Qualquer alteração invalida a aprovação
 *    daquela versão, preservando o registro histórico.
 *  - O pacote só é anunciado como completo quando todos os documentos ativos
 *    foram convertidos integralmente para o PDF.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ShieldCheck, FileStack, Loader2, AlertTriangle, CheckCircle2, RefreshCw, FileDown,
} from 'lucide-react';
import {
  documentsFingerprint, sha256HexOfText, CATEGORY_LABEL, CONVERSION_LABEL,
  EXTRACTION_LABEL, type CaseCategory, type ExtractionStatus,
} from '@/lib/inpi/caseDocuments';
import { convertDocument, summarizePackage, type AnnexDoc } from '@/lib/inpi/packageBuilder';
import type { NativeAnnexDoc } from '@/components/admin/INPIResourcePDFPreview';

const BUCKET = 'inpi-recursos-docs';

interface CaseDocRow {
  id: string;
  category: CaseCategory;
  file_name: string;
  storage_path: string;
  sha256: string | null;
  extraction_status: ExtractionStatus;
  extraction_notes: string | null;
  page_count: number | null;
  interpreted_pages: number | null;
  unreadable_pages: number | null;
  conversion_status: string;
  conversion_notes: string | null;
  display_order: number | null;
}

interface ApprovalRow {
  id: string;
  approval_kind: string;
  content_hash: string | null;
  documents_hash: string | null;
  orientation_hash: string | null;
  approved_at: string;
  invalidated_at: string | null;
  invalidation_reason: string | null;
}

export interface ExportPackageState {
  annexes: NativeAnnexDoc[];
  isComplete: boolean;
  draftStamp: string | null;
  /** Pacote incompleto ou sem conferência: só prévia, nunca protocolo. */
  previewOnly: boolean;
}

interface ReviewFinding {
  tipo?: string;
  trecho?: string;
  problema?: string;
  sugestao?: string;
  bloqueante?: boolean;
  fontes?: string[];
}

interface ReviewRow {
  id: string;
  content_hash: string;
  documents_hash: string | null;
  findings: ReviewFinding[];
  summary: string | null;
  has_blocking: boolean;
  model: string | null;
  created_at: string;
}

interface Props {
  caseId: string;
  resourceId: string | null;
  resourceType: string;
  content: string;
  onPackageReady: (state: ExportPackageState) => void;
}

export default function CaseApprovalPanel({
  caseId, resourceId, resourceType, content, onPackageReady,
}: Props) {
  const [docs, setDocs] = useState<CaseDocRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [orientationText, setOrientationText] = useState('');
  const [contentHash, setContentHash] = useState('');
  const [documentsHash, setDocumentsHash] = useState('');
  const [orientationHash, setOrientationHash] = useState('');
  const [annexes, setAnnexes] = useState<AnnexDoc[] | null>(null);
  const [converting, setConverting] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewRow | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const reload = useCallback(async () => {
    const [{ data: d }, { data: a }, { data: o }, { data: r }] = await Promise.all([
      supabase
        .from('inpi_case_documents')
        .select('id, category, file_name, storage_path, sha256, extraction_status, extraction_notes, page_count, interpreted_pages, unreadable_pages, conversion_status, conversion_notes, display_order')
        .eq('case_id', caseId).eq('is_active', true).order('display_order', { ascending: true }),
      supabase
        .from('inpi_case_approvals')
        .select('id, approval_kind, content_hash, documents_hash, orientation_hash, approved_at, invalidated_at, invalidation_reason')
        .eq('case_id', caseId).order('approved_at', { ascending: false }),
      supabase
        .from('inpi_case_orientations')
        .select('editable_text, version')
        .eq('case_id', caseId).order('version', { ascending: false }).limit(1),
      supabase
        .from('inpi_draft_reviews')
        .select('id, content_hash, documents_hash, findings, summary, has_blocking, model, created_at')
        .eq('case_id', caseId).order('created_at', { ascending: false }).limit(1),
    ]);
    setDocs((d || []) as unknown as CaseDocRow[]);
    setApprovals((a || []) as unknown as ApprovalRow[]);
    setOrientationText(((o || [])[0]?.editable_text as string) || '');
    setReview(((r || [])[0] as unknown as ReviewRow) || null);
  }, [caseId]);

  useEffect(() => { void reload(); }, [reload]);

  /* Hashes correntes — texto, anexos e orientação. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c, dh, oh] = await Promise.all([
        sha256HexOfText(content || ''),
        sha256HexOfText(documentsFingerprint(docs)),
        sha256HexOfText(orientationText || ''),
      ]);
      if (cancelled) return;
      setContentHash(c); setDocumentsHash(dh); setOrientationHash(oh);
    })();
    return () => { cancelled = true; };
  }, [content, docs, orientationText]);

  const matches = useCallback(
    (ap: ApprovalRow) =>
      !ap.invalidated_at &&
      ap.content_hash === contentHash &&
      ap.documents_hash === documentsHash &&
      ap.orientation_hash === orientationHash,
    [contentHash, documentsHash, orientationHash],
  );

  const textApproval = approvals.find((a) => a.approval_kind === 'texto_interno' && matches(a));
  const protocolApproval = approvals.find((a) => a.approval_kind === 'conferencia_protocolo' && matches(a));
  const supersededApprovals = approvals.filter((a) => !a.invalidated_at && !matches(a));

  /* Invalida, uma única vez, as aprovações cujo conjunto mudou. */
  useEffect(() => {
    if (!contentHash || supersededApprovals.length === 0) return;
    const ids = supersededApprovals.map((a) => a.id);
    void supabase
      .from('inpi_case_approvals')
      .update({
        invalidated_at: new Date().toISOString(),
        invalidation_reason: 'Texto, orientação ou conjunto de anexos alterado após a aprovação.',
      })
      .in('id', ids)
      .then(() => reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentHash, documentsHash, orientationHash, supersededApprovals.length]);

  const summary = useMemo(() => (annexes ? summarizePackage(annexes) : null), [annexes]);
  const packageComplete = !!summary?.isComplete;

  /* Revisão jurídica válida apenas para esta versão exata de texto e anexos. */
  const currentReview =
    review && review.content_hash === contentHash && review.documents_hash === documentsHash
      ? review
      : null;

  const draftStamp = useMemo(() => {
    if (!packageComplete) return 'PRÉVIA — PACOTE INCOMPLETO, NÃO PROTOCOLAR';
    if (!protocolApproval) return 'MINUTA — PENDENTE DE CONFERÊNCIA';
    return null;
  }, [protocolApproval, packageComplete]);

  /* ── Revisão jurídica automática ─────────────────────────────────────── */
  const runReview = async () => {
    if (reviewing) return; // clique repetido
    setReviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke('review-inpi-draft', {
        body: { caseId, resourceId, content, contentHash, documentsHash },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha na revisão');
      setReview(data.review as ReviewRow);
      toast[(data.review as ReviewRow).has_blocking ? 'warning' : 'success'](
        (data.review as ReviewRow).has_blocking
          ? 'Revisão concluída com apontamentos bloqueantes.'
          : 'Revisão concluída sem apontamentos bloqueantes.',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha na revisão jurídica.');
    } finally {
      setReviewing(false);
    }
  };

  /* ── Conversão dos anexos para o PDF final ───────────────────────────── */
  const buildPackage = async () => {
    if (!docs.length) { toast.error('Nenhum documento ativo no caso.'); return; }
    setConverting(true);
    try {
      const built: AnnexDoc[] = [];
      let n = 1;
      for (const doc of docs) {
        const { data: blob, error } = await supabase.storage.from(BUCKET).download(doc.storage_path);
        if (error || !blob) {
          built.push({
            id: doc.id, docNumber: n++, title: `Doc. ${String(n).padStart(2, '0')} — ${doc.file_name}`,
            category: doc.category, categoryLabel: CATEGORY_LABEL[doc.category] || doc.category,
            fileName: doc.file_name, images: [], textBlocks: [], pageEstimate: 0,
            status: 'falha', notes: error?.message || 'Arquivo não localizado no armazenamento.',
          });
          continue;
        }
        const annex = await convertDocument(
          { id: doc.id, file_name: doc.file_name, category: doc.category, categoryLabel: CATEGORY_LABEL[doc.category] || doc.category },
          blob, n++,
        );
        built.push(annex);
        await supabase.from('inpi_case_documents').update({
          conversion_status: annex.status,
          conversion_notes: annex.notes,
          converted_page_count: annex.pageEstimate || null,
          processing_confirmed_at: annex.status === 'convertido' ? new Date().toISOString() : null,
        }).eq('id', doc.id);
      }
      setAnnexes(built);
      const sum = summarizePackage(built);
      onPackageReady({
        annexes: built.map((a) => ({
          id: a.id, docNumber: a.docNumber, title: a.title, categoryLabel: a.categoryLabel,
          fileName: a.fileName, images: a.images, textBlocks: a.textBlocks,
          status: a.status, notes: a.notes,
        })),
        isComplete: sum.isComplete,
        previewOnly: !protocolApproval || !sum.isComplete,
        draftStamp: !sum.isComplete
          ? 'PRÉVIA — PACOTE INCOMPLETO, NÃO PROTOCOLAR'
          : !protocolApproval
            ? 'MINUTA — PENDENTE DE CONFERÊNCIA'
            : null,
      });
      await supabase.from('inpi_export_packages').insert({
        case_id: caseId,
        resource_id: resourceId,
        content_hash: contentHash,
        documents_hash: documentsHash,
        is_complete: sum.isComplete,
        is_draft_stamped: !protocolApproval || !sum.isComplete,
        total_annexes: built.length,
        total_pages: sum.totalAnnexPages,
        manifest: built.map((a) => ({
          doc: a.docNumber, arquivo: a.fileName, finalidade: a.categoryLabel,
          paginas: a.pageEstimate, situacao: a.status,
        })),
        failed_documents: sum.failed.map((a) => ({ arquivo: a.fileName, motivo: a.notes })),
      });
      await reload();
      toast[sum.isComplete ? 'success' : 'warning'](
        sum.isComplete
          ? `Pacote preparado: ${built.length} anexo(s), ${sum.totalAnnexPages} página(s).`
          : `Pacote preparado com pendências: ${sum.failed.length} documento(s) não convertido(s).`,
      );
    } finally {
      setConverting(false);
    }
  };

  /* ── Aprovações ───────────────────────────────────────────────────────── */
  const approve = async (kind: 'texto_interno' | 'conferencia_protocolo') => {
    if (approving) return; // clique repetido
    if (kind === 'conferencia_protocolo') {
      if (!textApproval) {
        toast.error('Aprove o texto internamente antes de liberar para protocolo.');
        return;
      }
      if (!summary) {
        toast.error('Prepare o pacote de anexos antes da conferência para protocolo.');
        return;
      }
      if (!packageComplete) {
        toast.error(
          'Há anexo não incluído no pacote. A conferência para protocolo fica bloqueada; só é possível baixar a prévia.',
        );
        return;
      }
      if (!currentReview) {
        toast.error('Execute a revisão jurídica desta versão antes da conferência para protocolo.');
        return;
      }
      if (currentReview.has_blocking) {
        toast.error('A revisão apontou problemas bloqueantes. Corrija antes de conferir para protocolo.');
        return;
      }
    }
    setApproving(kind);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Versão da peça registrada junto da aprovação.
      const { data: lastVersion } = await supabase
        .from('inpi_draft_versions')
        .select('id, version, content_hash')
        .eq('case_id', caseId).order('version', { ascending: false }).limit(1);
      let draftVersionId = lastVersion?.[0]?.content_hash === contentHash ? lastVersion?.[0]?.id : null;
      if (!draftVersionId) {
        const { data: created, error } = await supabase
          .from('inpi_draft_versions')
          .insert({
            case_id: caseId,
            version: (lastVersion?.[0]?.version || 0) + 1,
            content,
            content_hash: contentHash,
            documents_fingerprint: documentsFingerprint(docs),
            created_by: user?.id ?? null,
          })
          .select('id').single();
        if (error) throw error;
        draftVersionId = created.id;
      }
      const { error: apErr } = await supabase.from('inpi_case_approvals').insert({
        case_id: caseId,
        draft_version_id: draftVersionId,
        approval_kind: kind,
        content_hash: contentHash,
        documents_hash: documentsHash,
        orientation_hash: orientationHash,
        approved_by: user?.id ?? null,
      });
      // Duas abas ou dois envios simultâneos: o servidor recusa a segunda gravação.
      if (apErr && (apErr as { code?: string }).code === '23505') {
        await reload();
        toast.info('Esta aprovação já estava registrada para esta mesma versão.');
        return;
      }
      if (apErr) throw apErr;
      await reload();
      toast.success(kind === 'texto_interno' ? 'Texto aprovado internamente.' : 'Conferência para protocolo registrada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao registrar a aprovação.');
    } finally {
      setApproving(null);
    }
  };

  const unreadable = docs.filter((d) => d.extraction_status === 'falha' || d.extraction_status === 'recebido' || d.extraction_status === 'parcial');

  return (
    <div className="space-y-4">
      {/* Estado dos documentos: leitura x conversão */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileStack className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Documentos do caso — leitura e conversão</h3>
            <Badge variant="outline" className="ml-auto text-[11px]">{docs.length} ativo(s)</Badge>
          </div>
          <div className="space-y-2">
            {docs.map((d) => {
              const annex = annexes?.find((a) => a.id === d.id);
              return (
                <div key={d.id} className="rounded-md border p-2 text-xs space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.file_name}</span>
                    <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[d.category] || d.category}</Badge>
                    <Badge variant="outline" className="text-[10px]">Leitura: {EXTRACTION_LABEL[d.extraction_status] || d.extraction_status}</Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${(annex?.status || d.conversion_status) === 'convertido' ? 'text-emerald-600' : (annex?.status || d.conversion_status) === 'falha' ? 'text-destructive' : ''}`}
                    >
                      {CONVERSION_LABEL[(annex?.status || d.conversion_status) as keyof typeof CONVERSION_LABEL] || 'Conversão pendente'}
                    </Badge>
                  </div>
                  {(d.unreadable_pages ?? 0) > 0 && (
                    <p className="text-muted-foreground">
                      {d.interpreted_pages ?? 0} de {d.page_count ?? '?'} página(s) interpretadas — {d.unreadable_pages} sem texto extraível.
                    </p>
                  )}
                  {(annex?.notes || d.conversion_notes) && (
                    <p className="text-muted-foreground">{annex?.notes || d.conversion_notes}</p>
                  )}
                </div>
              );
            })}
            {!docs.length && <p className="text-xs text-muted-foreground">Nenhum documento ativo neste caso.</p>}
          </div>

          {unreadable.length > 0 && (
            <div className="flex gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {unreadable.length} documento(s) sem conteúdo integralmente conferido. Nenhuma conclusão pode ser
                afirmada a partir de páginas não interpretadas.
              </span>
            </div>
          )}

          <Button size="sm" variant="outline" onClick={buildPackage} disabled={converting || !docs.length}>
            {converting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {annexes ? 'Refazer conversão dos anexos' : 'Preparar pacote de anexos'}
          </Button>

          {summary && (
            <div className={`rounded-md p-2 text-xs ${summary.isComplete ? 'bg-emerald-500/10 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
              {summary.isComplete
                ? `Pacote completo: ${summary.annexes.length} anexo(s), ${summary.totalAnnexPages} página(s) de anexo.`
                : `Pacote incompleto: ${summary.failed.length} documento(s) com falha ou conversão parcial. Não protocolar.`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revisão jurídica do conteúdo */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Revisão jurídica do conteúdo</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Confere se cada fato tem lastro nos documentos, se as referências foram conferidas, se todos os
            fundamentos foram respondidos e se não há informação inventada.
          </p>
          <Button size="sm" variant="outline" onClick={runReview} disabled={reviewing || !content?.trim()}>
            {reviewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {currentReview ? 'Revisar novamente' : 'Revisar conteúdo jurídico'}
          </Button>
          {review && !currentReview && (
            <div className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700">
              A revisão existente é de outra versão do texto ou dos anexos. Execute a revisão novamente.
            </div>
          )}
          {currentReview && (
            <div className="space-y-2">
              <div className={`rounded-md p-2 text-xs ${currentReview.has_blocking ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-700'}`}>
                {currentReview.summary || (currentReview.has_blocking
                  ? 'Há apontamentos bloqueantes nesta versão.'
                  : 'Nenhum apontamento bloqueante nesta versão.')}
              </div>
              {(currentReview.findings || []).map((f, i) => (
                <div key={i} className="rounded-md border p-2 text-[11px] space-y-1">
                  <p className="font-medium">
                    {f.bloqueante ? '🔴' : '🟡'} {f.tipo?.replace(/_/g, ' ')}
                    {f.fontes?.length ? ` · ${f.fontes.join(', ')}` : ''}
                  </p>
                  {f.trecho && <p className="italic text-muted-foreground">“{f.trecho}”</p>}
                  {f.problema && <p>{f.problema}</p>}
                  {f.sugestao && <p className="text-muted-foreground">Sugestão: {f.sugestao}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aprovações vinculadas à versão */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Aprovação vinculada a esta versão</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Texto <code>{contentHash.slice(0, 10)}</code> · Anexos <code>{documentsHash.slice(0, 10)}</code> ·
            Orientação <code>{orientationHash.slice(0, 10)}</code>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={textApproval ? 'outline' : 'default'} disabled={!!textApproval || approving !== null} onClick={() => approve('texto_interno')}>
              {approving === 'texto_interno' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {textApproval ? 'Texto aprovado' : 'Aprovar texto (interno)'}
            </Button>
            <Button
              size="sm"
              variant={protocolApproval ? 'outline' : 'default'}
              disabled={
                !!protocolApproval || approving !== null || !packageComplete ||
                !currentReview || currentReview.has_blocking
              }
              onClick={() => approve('conferencia_protocolo')}
            >
              {approving === 'conferencia_protocolo' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
              {protocolApproval ? 'Conferido para protocolo' : 'Conferir para protocolo'}
            </Button>
          </div>
          {!packageComplete && summary && (
            <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              Há anexo não incluído. A conferência para protocolo está bloqueada — só é possível baixar uma
              prévia carimbada.
            </div>
          )}
          {approvals.some((a) => a.invalidated_at) && (
            <>
              <Separator />
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <p className="font-medium">Histórico de aprovações invalidadas (preservado):</p>
                {approvals.filter((a) => a.invalidated_at).slice(0, 5).map((a) => (
                  <p key={a.id}>
                    {a.approval_kind === 'texto_interno' ? 'Texto' : 'Protocolo'} — aprovado em{' '}
                    {new Date(a.approved_at).toLocaleString('pt-BR')} · invalidado: {a.invalidation_reason}
                  </p>
                ))}
              </div>
            </>
          )}
          {draftStamp && (
            <div className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700">
              O PDF sairá carimbado como <strong>{draftStamp}</strong> até que texto, anexos e conferência estejam completos.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
