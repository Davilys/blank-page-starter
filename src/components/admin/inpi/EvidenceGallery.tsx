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
  kind?: 'brand_logo' | 'inpi_consulta' | 'evidence';
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

export function EvidenceGallery({ open, onOpenChange, resourceId, onChanged, onRegenerate }: Props) {
  const [rows, setRows] = useState<EvidenceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [regenerating, setRegenerating] = useState(false);

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
    // Gera signed URLs em lote
    const urls: Record<string, string> = {};
    await Promise.all(
      list.map(async (r) => {
        const { data: s } = await supabase.storage
          .from('inpi-resource-evidence')
          .createSignedUrl(r.storage_path, 3600);
        if (s?.signedUrl) urls[r.id] = s.signedUrl;
      }),
    );
    setSignedUrls(urls);
    setLoading(false);
    onChanged?.(list);
  };

  useEffect(() => {
    if (open && resourceId) fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resourceId]);

  const handleUpload = async (files: FileList | null) => {
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
      const filesB64 = await Promise.all(
        arr.map(async (f) => ({ name: f.name, type: f.type, base64: await fileToBase64(f) })),
      );
      const { data, error } = await supabase.functions.invoke('extract-resource-evidences', {
        body: { resource_id: resourceId, files: filesB64, ocr: true },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao extrair evidências');
      toast.success(`${data.count} evidência(s) extraída(s)`);
      await fetchRows();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Erro ao extrair evidências');
    } finally {
      setUploading(false);
    }
  };

  const updateRow = async (id: string, patch: Partial<EvidenceRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase
      .from('inpi_resource_evidences' as any)
      .update(patch)
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
    rows.filter((r) => r.included && (r.kind || 'evidence') === 'evidence').forEach((r) => { map[r.id] = n++; });
    return map;
  }, [rows]);

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

        <div className="flex flex-wrap gap-2 items-center border-b pb-3 mb-3">
          <label className="inline-flex">
            <input
              type="file"
              accept="application/pdf,image/*"
              multiple
              hidden
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button asChild variant="default" disabled={uploading}>
              <span>
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {uploading ? 'Extraindo…' : 'Anexar PDFs / imagens'}
              </span>
            </Button>
          </label>
          <Badge variant="secondary">{rows.filter((r) => r.included).length} incluídas</Badge>
          <Badge variant="outline">{rows.filter((r) => r.included && r.placement === 'inline').length} inline</Badge>
          <Badge variant="outline">{rows.filter((r) => r.included && r.placement === 'annex').length} no anexo</Badge>

          {onRegenerate && (
            <div className="ml-auto">
              <Button onClick={handleRegenerate} disabled={regenerating || rows.filter((r) => r.included).length === 0} variant="secondary">
                {regenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Regenerar recurso citando as evidências
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Carregando…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            Nenhuma evidência ainda. Anexe PDFs (prints, decisões, fotos do produto) para começar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rows.map((r, idx) => (
              <div key={r.id} className={`border rounded-lg p-3 space-y-2 ${r.included ? '' : 'opacity-50'}`}>
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" onClick={() => move(r.id, -1)} disabled={idx === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => move(r.id, +1)} disabled={idx === rows.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1">
                    {signedUrls[r.id] ? (
                      <img
                        src={signedUrls[r.id]}
                        alt={r.caption || 'evidência'}
                        className="w-full h-40 object-contain bg-muted rounded"
                      />
                    ) : (
                      <div className="w-full h-40 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                        sem preview
                      </div>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteRow(r.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {r.included && docNumbers[r.id] && (
                    <Badge variant="default">Doc. {String(docNumbers[r.id]).padStart(2, '0')}</Badge>
                  )}
                  {(() => {
                    const k = r.kind || 'evidence';
                    if (k === 'brand_logo') return <Badge className="bg-blue-600">🏷️ Logo da marca</Badge>;
                    if (k === 'inpi_consulta') return <Badge className="bg-emerald-600">📄 Consulta INPI</Badge>;
                    return <Badge variant="outline">📎 Evidência</Badge>;
                  })()}
                  <span className="text-muted-foreground truncate flex-1">
                    {r.source_file_name}{r.page_number ? ` — pág. ${r.page_number}` : ''}
                  </span>
                </div>

                <Input
                  value={r.caption || ''}
                  placeholder="Legenda da evidência"
                  onChange={(e) => setRows((p) => p.map((x) => x.id === r.id ? { ...x, caption: e.target.value } : x))}
                  onBlur={(e) => updateRow(r.id, { caption: e.target.value })}
                />

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Tipo:</span>
                  <select
                    value={r.kind || 'evidence'}
                    onChange={(e) => updateRow(r.id, { kind: e.target.value as any })}
                    className="text-xs border rounded px-2 py-1 bg-background"
                  >
                    <option value="evidence">Evidência (anexo / inline)</option>
                    <option value="brand_logo">Logo da marca (header)</option>
                    <option value="inpi_consulta">Consulta INPI (header)</option>
                  </select>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-2">
                    <Switch checked={r.included} onCheckedChange={(v) => updateRow(r.id, { included: v })} />
                    Incluir
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch
                      checked={r.placement === 'inline'}
                      onCheckedChange={(v) => updateRow(r.id, { placement: v ? 'inline' : 'annex' })}
                    />
                    Inline (no argumento)
                  </label>
                </div>

                {r.ocr_text && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Ver OCR</summary>
                    <Textarea
                      className="mt-1 text-xs h-24"
                      value={r.ocr_text}
                      readOnly
                    />
                  </details>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EvidenceGallery;