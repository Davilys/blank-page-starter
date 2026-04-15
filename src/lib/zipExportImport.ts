import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';

export type ProgressCallback = (current: number, total: number, label: string) => void;

// ─── Helpers ─────────────────────────────────────────

function extractStoragePath(fileUrl: string): string | null {
  const marker = '/storage/v1/object/public/documents/';
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(fileUrl.substring(idx + marker.length));
}

async function downloadFile(fileUrl: string): Promise<Blob | null> {
  // Try Supabase SDK first
  const storagePath = extractStoragePath(fileUrl);
  if (storagePath) {
    try {
      const { data, error } = await supabase.storage.from('documents').download(storagePath);
      if (!error && data) return data;
      console.warn(`SDK download failed for ${storagePath}:`, error?.message);
    } catch (e: any) {
      console.warn(`SDK download exception for ${storagePath}:`, e.message);
    }
  }

  // Fallback to fetch
  try {
    const response = await fetch(fileUrl);
    if (response.ok) return await response.blob();
    console.warn(`Fetch failed for ${fileUrl}: ${response.status}`);
  } catch (e: any) {
    console.warn(`Fetch exception for ${fileUrl}:`, e.message);
  }

  return null;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Document Export ──────────────────────────────────

interface DocumentForExport {
  id: string;
  name: string;
  file_url: string;
  document_type: string | null;
  mime_type: string | null;
  file_size: number | null;
  protocol?: string | null;
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
  // Dual-key for cross-project compatibility
  file_path: string;
  zip_filename: string;
  original_file_url: string;
  file_url: string;
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

    const blob = await downloadFile(doc.file_url);
    if (blob) {
      filesFolder.file(safeName, blob);
      fileAdded = true;
    } else {
      console.error(`Não foi possível baixar o arquivo: ${doc.name} (${doc.file_url})`);
    }

    const filePath = fileAdded ? `files/${safeName}` : '';

    manifest.push({
      name: doc.name,
      document_type: doc.document_type,
      mime_type: doc.mime_type,
      file_size: doc.file_size,
      protocol: doc.protocol ?? null,
      created_at: doc.created_at,
      client_email: (doc.profiles as any)?.email || null,
      brand_name: (doc.brand_processes as any)?.brand_name || null,
      // Write both keys for compatibility
      file_path: filePath,
      zip_filename: filePath,
      original_file_url: doc.file_url,
      file_url: doc.file_url,
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
  // Dual-key for compatibility
  pdf_files: string[];
  attached_pdfs: string[];
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

    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('id, name, file_url, protocol')
        .eq('contract_id', c.id);

      if (docs && docs.length > 0) {
        for (const doc of docs) {
          const blob = await downloadFile(doc.file_url);
          if (blob) {
            const safeName = `${(c.contract_number || c.id).replace(/[^a-zA-Z0-9_-]/g, '_')}_${doc.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            pdfsFolder.file(safeName, blob);
            pdfFiles.push(`pdfs/${safeName}`);
          }
        }
      }
    } catch (e: any) {
      console.warn(`Erro ao buscar docs do contrato ${c.id}:`, e.message);
    }

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
      // Write both keys
      pdf_files: pdfFiles,
      attached_pdfs: pdfFiles,
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

  const rawManifest: any[] = JSON.parse(await manifestFile.async('text'));
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  // Normalize manifest entries for cross-project compatibility
  const manifest = rawManifest.map((entry: any) => ({
    name: entry.name,
    document_type: entry.document_type,
    mime_type: entry.mime_type,
    file_size: entry.file_size,
    protocol: entry.protocol ?? null,
    created_at: entry.created_at,
    client_email: entry.client_email,
    brand_name: entry.brand_name,
    // Accept both field names
    file_path: entry.file_path || entry.zip_filename || '',
    original_file_url: entry.original_file_url || entry.file_url || '',
  }));

  // Process in batches of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    onProgress?.(i + 1, manifest.length, entry.name);

    try {
      let fileBlob: Blob | null = null;

      // Try from ZIP first using normalized file_path
      if (entry.file_path) {
        const fileData = zip.file(entry.file_path);
        if (fileData) {
          fileBlob = await fileData.async('blob');
        }
      }

      // Fallback: re-download from original URL
      if (!fileBlob && entry.original_file_url) {
        fileBlob = await downloadFile(entry.original_file_url);
      }

      if (!fileBlob) {
        errors.push(`Arquivo não encontrado no ZIP para: ${entry.name} (path: ${entry.file_path})`);
        failed++;
        continue;
      }

      const ext = entry.name.split('.').pop() || 'bin';
      const uploadPath = `imported/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(uploadPath, fileBlob, { cacheControl: '3600', upsert: false });

      if (uploadErr) {
        errors.push(`Falha no upload para ${entry.name}: ${uploadErr.message}`);
        failed++;
        continue;
      }

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(uploadPath);

      const { error: fnErr } = await supabase.functions.invoke('import-documents-zip', {
        body: {
          documents: [{
            name: entry.name,
            file_url: urlData.publicUrl,
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
        errors.push(`Falha ao registrar no banco: ${entry.name}: ${fnErr.message}`);
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

  const rawManifest: any[] = JSON.parse(await manifestFile.async('text'));
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  // Normalize manifest entries for cross-project compatibility
  const manifest = rawManifest.map((entry: any) => ({
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
    contract_type_name: entry.contract_type_name,
    template_name: entry.template_name,
    client_email: entry.client_email,
    client_name: entry.client_name,
    created_at: entry.created_at,
    // Accept both field names
    pdf_files: entry.pdf_files || entry.attached_pdfs || [],
  }));

  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    onProgress?.(i + 1, manifest.length, entry.contract_number || entry.subject || `Contrato ${i + 1}`);

    try {
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
          } else {
            errors.push(`Falha no upload do PDF ${pdfPath}: ${uploadErr.message}`);
          }
        } else {
          errors.push(`PDF não encontrado no ZIP: ${pdfPath}`);
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
        errors.push(`Falha ao registrar contrato ${entry.contract_number || i}: ${fnErr.message}`);
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
