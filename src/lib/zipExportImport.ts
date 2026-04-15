import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';

export type ProgressCallback = (current: number, total: number, label: string) => void;

// ─── Document Export ──────────────────────────────────

interface DocumentForExport {
  id: string;
  name: string;
  file_url: string;
  document_type: string | null;
  mime_type: string | null;
  file_size: number | null;
  protocol: string | null;
  user_id: string | null;
  process_id: string | null;
  created_at: string | null;
  contract_id?: string | null;
  profiles?: { full_name: string | null; email: string } | null;
  brand_processes?: { brand_name: string } | null;
}

interface DocumentManifestEntry {
  name: string;
  document_type: string | null;
  mime_type: string | null;
  file_size: number | null;
  protocol: string | null;
  created_at: string | null;
  client_email: string | null;
  brand_name: string | null;
  file_path: string; // path inside ZIP
}

export async function exportDocumentsZip(
  documents: DocumentForExport[],
  onProgress?: ProgressCallback
): Promise<Blob> {
  const zip = new JSZip();
  const manifest: DocumentManifestEntry[] = [];
  const filesFolder = zip.folder('files')!;

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    onProgress?.(i + 1, documents.length, doc.name);

    const safeName = `${(doc.protocol || doc.id).replace(/[^a-zA-Z0-9_-]/g, '_')}_${doc.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    let fileAdded = false;

    try {
      const response = await fetch(doc.file_url);
      if (response.ok) {
        const blob = await response.blob();
        filesFolder.file(safeName, blob);
        fileAdded = true;
      }
    } catch {
      // File not accessible, skip
    }

    manifest.push({
      name: doc.name,
      document_type: doc.document_type,
      mime_type: doc.mime_type,
      file_size: doc.file_size,
      protocol: doc.protocol,
      created_at: doc.created_at,
      client_email: (doc.profiles as any)?.email || null,
      brand_name: (doc.brand_processes as any)?.brand_name || null,
      file_path: fileAdded ? `files/${safeName}` : '',
    });
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

// ─── Contract Export ──────────────────────────────────

interface ContractForExport {
  id: string;
  contract_number: string | null;
  subject: string | null;
  contract_value: number | null;
  start_date: string | null;
  end_date: string | null;
  signature_status: string | null;
  signed_at: string | null;
  contract_html: string | null;
  description: string | null;
  payment_method: string | null;
  document_type?: string | null;
  contract_type?: { name: string } | null;
  contract_template?: { name: string } | null;
  profile?: { full_name: string | null; email: string | null } | null;
  user_id: string | null;
  created_at: string | null;
}

interface ContractManifestEntry {
  contract_number: string | null;
  subject: string | null;
  contract_value: number | null;
  start_date: string | null;
  end_date: string | null;
  signature_status: string | null;
  signed_at: string | null;
  contract_html: string | null;
  description: string | null;
  payment_method: string | null;
  document_type: string | null;
  contract_type_name: string | null;
  template_name: string | null;
  client_email: string | null;
  client_name: string | null;
  created_at: string | null;
  pdf_files: string[]; // paths inside ZIP
}

export async function exportContractsZip(
  contracts: ContractForExport[],
  onProgress?: ProgressCallback
): Promise<Blob> {
  const zip = new JSZip();
  const manifest: ContractManifestEntry[] = [];
  const pdfsFolder = zip.folder('pdfs')!;

  for (let i = 0; i < contracts.length; i++) {
    const c = contracts[i];
    onProgress?.(i + 1, contracts.length, c.contract_number || c.subject || `Contrato ${i + 1}`);

    const pdfFiles: string[] = [];

    // Fetch associated PDF documents
    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('id, name, file_url, protocol')
        .eq('contract_id', c.id);

      if (docs && docs.length > 0) {
        for (const doc of docs) {
          try {
            const resp = await fetch(doc.file_url);
            if (resp.ok) {
              const blob = await resp.blob();
              const safeName = `${(c.contract_number || c.id).replace(/[^a-zA-Z0-9_-]/g, '_')}_${doc.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
              pdfsFolder.file(safeName, blob);
              pdfFiles.push(`pdfs/${safeName}`);
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }

    manifest.push({
      contract_number: c.contract_number,
      subject: c.subject,
      contract_value: c.contract_value,
      start_date: c.start_date,
      end_date: c.end_date,
      signature_status: c.signature_status,
      signed_at: c.signed_at,
      contract_html: c.contract_html,
      description: c.description,
      payment_method: c.payment_method,
      document_type: c.document_type || null,
      contract_type_name: c.contract_type?.name || null,
      template_name: c.contract_template?.name || null,
      client_email: (c.profile as any)?.email || null,
      client_name: (c.profile as any)?.full_name || null,
      created_at: c.created_at,
      pdf_files: pdfFiles,
    });
  }

  zip.file('contracts_manifest.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

// ─── Import Documents from ZIP ───────────────────────

export async function importDocumentsZip(
  file: File,
  onProgress?: ProgressCallback
): Promise<{ imported: number; failed: number; errors: string[] }> {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('Arquivo manifest.json não encontrado no ZIP');

  const manifest: DocumentManifestEntry[] = JSON.parse(await manifestFile.async('text'));
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    onProgress?.(i + 1, manifest.length, entry.name);

    try {
      let storagePath = '';

      // Upload file to Storage if it exists in ZIP
      if (entry.file_path) {
        const fileData = zip.file(entry.file_path);
        if (fileData) {
          const blob = await fileData.async('blob');
          const ext = entry.name.split('.').pop() || 'bin';
          const uploadPath = `imported/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

          const { error: uploadErr } = await supabase.storage
            .from('documents')
            .upload(uploadPath, blob, { cacheControl: '3600', upsert: false });

          if (uploadErr) {
            errors.push(`Upload falhou para ${entry.name}: ${uploadErr.message}`);
            failed++;
            continue;
          }

          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(uploadPath);
          storagePath = urlData.publicUrl;
        }
      }

      if (!storagePath) {
        errors.push(`Sem arquivo para ${entry.name}`);
        failed++;
        continue;
      }

      // Call edge function to create document record
      const { error: fnErr } = await supabase.functions.invoke('import-documents-zip', {
        body: {
          documents: [{
            name: entry.name,
            file_url: storagePath,
            document_type: entry.document_type,
            mime_type: entry.mime_type,
            file_size: entry.file_size,
            protocol: entry.protocol,
            created_at: entry.created_at,
            client_email: entry.client_email,
            brand_name: entry.brand_name,
          }],
        },
      });

      if (fnErr) {
        errors.push(`Erro ao registrar ${entry.name}: ${fnErr.message}`);
        failed++;
      } else {
        imported++;
      }
    } catch (err: any) {
      errors.push(`Erro em ${entry.name}: ${err.message}`);
      failed++;
    }
  }

  return { imported, failed, errors };
}

// ─── Import Contracts from ZIP ───────────────────────

export async function importContractsZip(
  file: File,
  onProgress?: ProgressCallback
): Promise<{ imported: number; failed: number; errors: string[] }> {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('contracts_manifest.json');
  if (!manifestFile) throw new Error('Arquivo contracts_manifest.json não encontrado no ZIP');

  const manifest: ContractManifestEntry[] = JSON.parse(await manifestFile.async('text'));
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    onProgress?.(i + 1, manifest.length, entry.contract_number || entry.subject || `Contrato ${i + 1}`);

    try {
      // Upload associated PDFs
      const uploadedPdfs: { name: string; file_url: string }[] = [];
      for (const pdfPath of entry.pdf_files) {
        const pdfData = zip.file(pdfPath);
        if (pdfData) {
          const blob = await pdfData.async('blob');
          const uploadPath = `imported/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`;
          const { error: uploadErr } = await supabase.storage
            .from('documents')
            .upload(uploadPath, blob, { cacheControl: '3600', upsert: false });

          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('documents').getPublicUrl(uploadPath);
            uploadedPdfs.push({ name: pdfPath.split('/').pop() || 'documento.pdf', file_url: urlData.publicUrl });
          }
        }
      }

      const { error: fnErr } = await supabase.functions.invoke('import-contracts-zip', {
        body: {
          contracts: [{
            contract_number: entry.contract_number,
            subject: entry.subject,
            contract_value: entry.contract_value,
            start_date: entry.start_date,
            end_date: entry.end_date,
            signature_status: entry.signature_status,
            signed_at: entry.signed_at,
            contract_html: entry.contract_html,
            description: entry.description,
            payment_method: entry.payment_method,
            document_type: entry.document_type,
            client_email: entry.client_email,
            created_at: entry.created_at,
            pdf_files: uploadedPdfs,
          }],
        },
      });

      if (fnErr) {
        errors.push(`Erro ao importar contrato ${entry.contract_number || i}: ${fnErr.message}`);
        failed++;
      } else {
        imported++;
      }
    } catch (err: any) {
      errors.push(`Erro em contrato ${entry.contract_number || i}: ${err.message}`);
      failed++;
    }
  }

  return { imported, failed, errors };
}

// ─── Helpers ─────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
