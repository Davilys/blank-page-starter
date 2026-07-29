import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, X, ArrowUp, ArrowDown, Image as ImageIcon, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export interface EvidenceRow {
  id: string;
  resource_id: string;
  storage_path: string;
  page_number: number | null;
  source_file_name: string | null;
  mime_type: string;
  caption: string | null;
  ocr_text: string | null;
  placement: 'inline' | 'annex';
  display_order: number;
  included: boolean;
  party?: 'cliente' | 'concorrente';
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  resourceId: string;
  onChanged?: (rows: EvidenceRow[]) => void;
  onRegenerate?: (rows: EvidenceRow[]) => Promise<void> | void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function normalizeSignedUrl(url: string) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const base = import.meta.env.VITE_SUPABASE_URL || '';
  if (!base) return url;
  const normalizedPath = url.startsWith('/storage/v1') ? url : `/storage/v1${url.startsWith('/') ? url : `/${url}`}`;
  return `${base.replace(/\/$/, '')}${normalizedPath}`;
}

export function EvidenceGallery({ open, onOpenChange, resourceId, onChanged, onRegenerate }: Props) {
  const [rows, setRows] = useState<EvidenceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [regenerating, setRegenerating] = useState(false);
  const [activeParty, setActiveParty] = useState<'cliente' | 'concorrente'>('cliente');

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inpi_resource_evidences' as any)
      .select('*')
      .eq('resource_id', resourceId)
      .order('display_order', { ascending: true });
    if (error) {
      toast.error('Erro ao carregar evidências');
      setLoading(false);
      return;
    }
    const list = (data as unknown as EvidenceRow[]) || [];
    setRows(list);
    // Gera signed URLs em lote via Edge Function, igual ao PDF final.
    // Isso evita quebra por RLS do bucket privado e ainda repara imagens antigas extraídas de PDF.
    const urls: Record<string, string> = {};
    if (list.length > 0) {
      const { data: signRes, error: signErr } = await supabase.functions.invoke('sign-inpi-evidence', {
        body: { paths: list.map((r) => r.storage_path), repair: true },
      });
      if (signErr) {
        console.error('Erro ao assinar previews de evidências:', signErr);
      } else {
        const signedRows: Array<{ path: string; signedUrl?: string; signedURL?: string }> = signRes?.urls || [];
        const byPath = new Map(signedRows.map((u) => [u.path, normalizeSignedUrl(u.signedUrl || u.signedURL || '')]));
        list.forEach((r) => {
          const signed = byPath.get(r.storage_path);
          if (signed) urls[r.id] = signed;
        });
      }
    }
    setSignedUrls(urls);
    setLoading(false);
    onChanged?.(list);
  };

  useEffect(() => {
    if (open && resourceId) fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resourceId]);

  const handleUpload = async (files: FileList | null, party: 'cliente' | 'concorrente') => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    const invalid = arr.filter(
      (f) => !(f.type === 'application/pdf' || f.type.startsWith('image/')),
    );
    if (invalid.length) {
      toast.error('Aceita apenas PDF ou imagens (PNG/JPG)');
      return;
    }
    setUploading(true);
    try {
      const images = arr.filter((f) => f.type.startsWith('image/'));
      const pdfs = arr.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
      let total = 0;

      // Imagens: upload direto ao Storage + insert (evita OOM na edge function).
      if (images.length > 0) {
        const { data: existing } = await supabase
          .from('inpi_resource_evidences' as any)
          .select('display_order')
          .eq('resource_id', resourceId)
          .order('display_order', { ascending: false })
          .limit(1);
        let order = (existing && (existing[0] as any)?.display_order)
          ? (existing[0] as any).display_order + 1
          : 1;

        for (const f of images) {
          // Normaliza extensão (evita "jpeg", "svg+xml" quebrarem o path/preview).
          const rawExt = (f.name.split('.').pop() || f.type.split('/')[1] || 'png').toLowerCase();
          const ext = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png';
          const mime = f.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
          const path = `${resourceId}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('inpi-resource-evidence')
            .upload(path, f, { contentType: mime, upsert: false });
          if (upErr) {
            console.error('upload img err:', upErr);
            toast.error(`Falha ao enviar ${f.name}: ${upErr.message}`);
            continue;
          }
          const { error: insErr } = await supabase.from('inpi_resource_evidences' as any).insert({
            resource_id: resourceId,
            storage_path: path,
            page_number: null,
            source_file_name: f.name,
            mime_type: mime,
            caption: f.name,
            ocr_text: '',
            placement: 'inline',
            display_order: order++,
            included: true,
            party,
          });
          if (insErr) {
            console.error('insert evidence err:', insErr);
            toast.error(`Falha ao registrar ${f.name}: ${insErr.message}`);
            // limpa arquivo órfão no storage
            await supabase.storage.from('inpi-resource-evidence').remove([path]).catch(() => {});
            continue;
          }
          total++;
        }
      }

      // PDFs: continuam via edge function (extrai imagens embutidas), 1 por vez.
      for (const f of pdfs) {
        const base64 = await fileToBase64(f);
        const { data, error } = await supabase.functions.invoke('extract-resource-evidences', {
          body: {
            resource_id: resourceId,
            files: [{ name: f.name, type: f.type, base64 }],
            ocr: true,
            party,
          },
        });
        if (error) {
          console.error(error);
          toast.error(`Falha ao processar ${f.name}`);
          continue;
        }
        if (data?.success) total += data.count || 0;
      }

      toast.success(`${total} evidência(s) adicionada(s)`);
      await fetchRows();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Erro ao extrair evidências');
    } finally {
      setUploading(false);
    }
  };

  const updateRow = async (id: string, patch: Partial<EvidenceRow>) => {
    const safePatch = { ...patch, placement: 'inline' as const };
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...safePatch } : r)));
    const { error } = await supabase
      .from('inpi_resource_evidences' as any)
      .update(safePatch)
      .eq('id', id);
    if (error) toast.error('Erro ao atualizar');
  };

  const deleteRow = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    await supabase.storage.from('inpi-resource-evidence').remove([row.storage_path]).catch(() => {});
    await supabase.from('inpi_resource_evidences' as any).delete().eq('id', id);
    toast.success('Evidência removida');
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = rows.findIndex((r) => r.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= rows.length) return;
    const a = rows[idx];
    const b = rows[swap];
    const newRows = [...rows];
    newRows[idx] = { ...b, display_order: a.display_order };
    newRows[swap] = { ...a, display_order: b.display_order };
    setRows(newRows);
    await Promise.all([
      supabase.from('inpi_resource_evidences' as any).update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('inpi_resource_evidences' as any).update({ display_order: a.display_order }).eq('id', b.id),
    ]);
  };

  const docNumbers = useMemo(() => {
    const map: Record<string, number> = {};
    let n = 1;
    rows.filter((r) => r.included).forEach((r) => { map[r.id] = n++; });
    return map;
  }, [rows]);

  const rowsForParty = (p: 'cliente' | 'concorrente') =>
    rows.filter((r) => (r.party || 'cliente') === p);

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    try {
      await onRegenerate(rows.filter((r) => r.included));
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Galeria de evidências do recurso
          </DialogTitle>
          <DialogDescription>
            Anexe PDFs ou imagens — o sistema extrai cada página, faz OCR e gera legendas.
            Marque quais entram no recurso, escolha se aparecem <strong>inline</strong> (no meio do argumento como Doc. N) ou apenas no <strong>anexo</strong> final.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeParty} onValueChange={(v) => setActiveParty(v as 'cliente' | 'concorrente')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cliente">
              Evidências do Cliente
              <Badge variant="secondary" className="ml-2">{rowsForParty('cliente').length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="concorrente">
              Evidências do Concorrente
              <Badge variant="secondary" className="ml-2">{rowsForParty('concorrente').length}</Badge>
            </TabsTrigger>
          </TabsList>

          {(['cliente', 'concorrente'] as const).map((party) => (
            <TabsContent key={party} value={party} className="mt-3">
              <div className="flex flex-wrap gap-2 items-center border-b pb-3 mb-3">
                <label className="inline-flex">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    multiple
                    hidden
                    onChange={(e) => handleUpload(e.target.files, party)}
                  />
                  <Button asChild variant="default" disabled={uploading}>
                    <span>
                      {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      {uploading
                        ? 'Extraindo…'
                        : party === 'cliente'
                          ? 'Anexar provas do cliente (logo, site, fachada, produto…)'
                          : 'Anexar provas do concorrente (pedido INPI, site, produto…)'}
                    </span>
                  </Button>
                </label>
                <Badge variant="outline">
                  {rowsForParty(party).filter((r) => r.included).length} incluídas
                </Badge>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Carregando…
                </div>
              ) : rowsForParty(party).length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  {party === 'cliente'
                    ? 'Nenhuma prova do cliente ainda. Anexe logotipo, print do site, fachada, produtos, embalagens, material publicitário.'
                    : 'Nenhuma prova do concorrente ainda. Anexe print do pedido no INPI, site do concorrente, logotipo, produtos ou material publicitário.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rowsForParty(party).map((r, idx, arr) => (
                    <EvidenceCard
                      key={r.id}
                      row={r}
                      idx={idx}
                      total={arr.length}
                      docNumber={docNumbers[r.id]}
                      signedUrl={signedUrls[r.id]}
                      onMove={move}
                      onDelete={deleteRow}
                      onUpdate={updateRow}
                      onCaptionLocal={(id, v) => setRows((p) => p.map((x) => x.id === id ? { ...x, caption: v } : x))}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex flex-wrap gap-2 items-center mt-4 pt-3 border-t">
          <Badge variant="secondary">{rows.filter((r) => r.included).length} incluídas no total</Badge>
          {onRegenerate && (
            <div className="ml-auto">
              <Button onClick={handleRegenerate} disabled={regenerating || rows.filter((r) => r.included).length === 0} variant="secondary">
                {regenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Regenerar recurso citando as evidências
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EvidenceCard({
  row: r,
  idx,
  total,
  docNumber,
  signedUrl,
  onMove,
  onDelete,
  onUpdate,
  onCaptionLocal,
}: {
  row: EvidenceRow;
  idx: number;
  total: number;
  docNumber?: number;
  signedUrl?: string;
  onMove: (id: string, dir: -1 | 1) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<EvidenceRow>) => void;
  onCaptionLocal: (id: string, value: string) => void;
}) {
  return (
    <div className={`border rounded-lg p-3 space-y-2 ${r.included ? '' : 'opacity-50'}`}>
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1">
          <Button size="icon" variant="ghost" onClick={() => onMove(r.id, -1)} disabled={idx === 0}>
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onMove(r.id, +1)} disabled={idx === total - 1}>
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1">
          {signedUrl ? (
            <img src={signedUrl} alt={r.caption || 'evidência'} className="w-full h-40 object-contain bg-muted rounded" />
          ) : (
            <div className="w-full h-40 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
              sem preview
            </div>
          )}
        </div>
        <Button size="icon" variant="ghost" onClick={() => onDelete(r.id)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {r.included && docNumber !== undefined && (
          <Badge variant="default">Doc. {String(docNumber).padStart(2, '0')}</Badge>
        )}
        <span className="text-muted-foreground truncate flex-1">
          {r.source_file_name}{r.page_number ? ` — pág. ${r.page_number}` : ''}
        </span>
      </div>

      <Input
        value={r.caption || ''}
        placeholder="Legenda da evidência"
        onChange={(e) => onCaptionLocal(r.id, e.target.value)}
        onBlur={(e) => onUpdate(r.id, { caption: e.target.value })}
      />

      <div className="flex items-center gap-4 text-xs">
        <label className="flex items-center gap-2">
          <Switch checked={r.included} onCheckedChange={(v) => onUpdate(r.id, { included: v })} />
          Incluir
        </label>
        <span className="text-muted-foreground">Sempre inline no recurso</span>
      </div>

      {r.ocr_text && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Ver OCR</summary>
          <Textarea className="mt-1 text-xs h-24" value={r.ocr_text} readOnly />
        </details>
      )}
    </div>
  );
}

export default EvidenceGallery;