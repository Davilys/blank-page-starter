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
  try {
    const response = await fetch(fileUrl);
    if (response.ok) return await response.blob();
    console.warn(`Fetch failed for ${fileUrl}: ${response.status}`);
  } catch (e: any) {
    console.warn(`Fetch exception for ${fileUrl}:`, e.message);
  }
  return null;
}

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/json': 'json',
  'application/octet-stream': 'bin',
};

function getExtensionFromName(name: string, mimeType?: string | null): string {
  const fromName = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  if (fromName && fromName.length <= 5) return fromName;
  if (mimeType && MIME_TO_EXT[mimeType.toLowerCase()]) return MIME_TO_EXT[mimeType.toLowerCase()];
  return 'bin';
}

function getMimeFromExt(ext: string): string {
  const lower = ext.toLowerCase();
  for (const [mime, e] of Object.entries(MIME_TO_EXT)) {
    if (e === lower) return mime;
  }
  return 'application/octet-stream';
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
  contract_id?: string | null;
  created_at: string | null;
  profiles?: { full_name: string | null; email: string } | null;
  brand_processes?: { brand_name: string } | null;
}

export async function exportDocumentsZip(
  documents: DocumentForExport[],
  onProgress?: ProgressCallback
): Promise<Blob> {
  const zip = new JSZip();
  const manifest: any[] = [];
  const filesFolder = zip.folder('files')!;

  // Resolve contract_number for documents linked to contracts
  const contractIds = Array.from(new Set(documents.map(d => d.contract_id).filter(Boolean) as string[]));
  const contractNumberMap: Record<string, string> = {};
  if (contractIds.length > 0) {
    const { data: contractsData } = await supabase
      .from('contracts')
      .select('id, contract_number')
      .in('id', contractIds);
    (contractsData || []).forEach((c: any) => { if (c.contract_number) contractNumberMap[c.id] = c.contract_number; });
  }

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
      console.error(`Não foi possível baixar: ${doc.name} (${doc.file_url})`);
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
      contract_number: doc.contract_id ? (contractNumberMap[doc.contract_id] || null) : null,
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
  contract_type?: { name: string } | string | null;
  contract_template?: { name: string } | null;
  profile?: { full_name: string | null; email: string | null } | null;
  user_id: string | null;
  created_at: string | null;
  // Blockchain & signature fields (loaded fresh below)
  [key: string]: any;
}

export async function exportContractsZip(
  contracts: ContractForExport[],
  onProgress?: ProgressCallback
): Promise<Blob> {
  const zip = new JSZip();
  const manifest: any[] = [];
  const pdfsFolder = zip.folder('pdfs')!;
  const otsFolder = zip.folder('ots_proofs')!;

  // Hydrate full contract rows (in case caller passed partial)
  const ids = contracts.map(c => c.id);
  const { data: fullContracts } = await supabase
    .from('contracts')
    .select('*, contract_type_ref:contract_types(name), contract_template:contract_templates(name), profile:profiles!contracts_user_id_fkey(full_name, email), process:brand_processes(brand_name)')
    .in('id', ids);

  const fullMap: Record<string, any> = {};
  (fullContracts || []).forEach((c: any) => { fullMap[c.id] = c; });

  for (let i = 0; i < contracts.length; i++) {
    const original = contracts[i];
    const c = fullMap[original.id] || original;
    onProgress?.(i + 1, contracts.length, c.contract_number || c.subject || `Contrato ${i + 1}`);

    const pdfFiles: { path: string; name: string; mime_type: string }[] = [];
    let otsPath: string | null = null;

    // Download attached PDFs/documents
    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('id, name, file_url, protocol, mime_type, document_type')
        .eq('contract_id', c.id);

      if (docs && docs.length > 0) {
        for (const doc of docs) {
          const blob = await downloadFile(doc.file_url);
          if (blob) {
            const ext = getExtensionFromName(doc.name, doc.mime_type);
            const baseName = doc.name.includes('.') ? doc.name : `${doc.name}.${ext}`;
            const safeName = `${(c.contract_number || c.id).replace(/[^a-zA-Z0-9_-]/g, '_')}_${baseName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            pdfsFolder.file(safeName, blob);
            pdfFiles.push({
              path: `pdfs/${safeName}`,
              name: doc.name,
              mime_type: doc.mime_type || getMimeFromExt(ext),
            });
          }
        }
      }
    } catch (e: any) {
      console.warn(`Erro ao buscar docs do contrato ${c.id}:`, e.message);
    }

    // Download .ots blockchain proof
    if (c.ots_file_url) {
      const otsBlob = await downloadFile(c.ots_file_url);
      if (otsBlob) {
        const otsName = `${(c.contract_number || c.id).replace(/[^a-zA-Z0-9_-]/g, '_')}.ots`;
        otsFolder.file(otsName, otsBlob);
        otsPath = `ots_proofs/${otsName}`;
      }
    }

    const pdfPathsLegacy = pdfFiles.map(p => p.path);

    manifest.push({
      // Basic
      contract_number: c.contract_number,
      subject: c.subject,
      contract_value: c.contract_value,
      start_date: c.start_date,
      end_date: c.end_date,
      contract_html: c.contract_html,
      description: c.description,
      payment_method: c.payment_method,
      document_type: c.document_type || null,
      contract_type: c.contract_type || null,
      contract_type_name: c.contract_type_ref?.name || null,
      template_name: c.contract_template?.name || null,
      // Client lookup
      client_email: c.profile?.email || null,
      client_name: c.profile?.full_name || null,
      brand_name: c.process?.brand_name || null,
      // Signature & forensic
      signature_status: c.signature_status,
      signed_at: c.signed_at,
      signature_token: c.signature_token,
      signature_expires_at: c.signature_expires_at,
      signature_ip: c.signature_ip,
      signature_user_agent: c.signature_user_agent,
      ip_address: c.ip_address,
      user_agent: c.user_agent,
      device_info: c.device_info,
      client_signature_image: c.client_signature_image,
      contractor_signature_image: c.contractor_signature_image,
      signatory_name: c.signatory_name,
      signatory_cpf: c.signatory_cpf,
      signatory_cnpj: c.signatory_cnpj,
      // Blockchain
      blockchain_hash: c.blockchain_hash,
      blockchain_timestamp: c.blockchain_timestamp,
      blockchain_tx_id: c.blockchain_tx_id,
      blockchain_network: c.blockchain_network,
      blockchain_proof: c.blockchain_proof,
      ots_file_url: c.ots_file_url,
      ots_file_path: otsPath,
      // Other
      asaas_payment_id: c.asaas_payment_id,
      penalty_value: c.penalty_value,
      custom_due_date: c.custom_due_date,
      suggested_classes: c.suggested_classes,
      visible_to_client: c.visible_to_client,
      created_at: c.created_at,
      // Files (dual-key compat)
      pdf_files: pdfPathsLegacy,
      attached_pdfs: pdfPathsLegacy,
      pdf_files_detailed: pdfFiles,
    });
  }

  zip.file('contracts_manifest.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

// ─── Import Documents from ZIP ───────────────────────

export async function importDocumentsZip(
  file: File,
  onProgress?: ProgressCallback
): Promise<{ imported: number; updated: number; failed: number; errors: string[] }> {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('Arquivo manifest.json não encontrado no ZIP');

  const rawManifest: any[] = JSON.parse(await manifestFile.async('text'));
  let imported = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  const manifest = rawManifest.map((entry: any) => ({
    name: entry.name,
    document_type: entry.document_type,
    mime_type: entry.mime_type,
    file_size: entry.file_size,
    protocol: entry.protocol ?? null,
    created_at: entry.created_at,
    client_email: entry.client_email,
    brand_name: entry.brand_name,
    contract_number: entry.contract_number ?? null,
    file_path: entry.file_path || entry.zip_filename || '',
    original_file_url: entry.original_file_url || entry.file_url || '',
  }));

  // Process in batches of 50
  const BATCH_SIZE = 50;
  for (let batchStart = 0; batchStart < manifest.length; batchStart += BATCH_SIZE) {
    const batch = manifest.slice(batchStart, batchStart + BATCH_SIZE);

    for (let j = 0; j < batch.length; j++) {
      const i = batchStart + j;
      const entry = batch[j];
      onProgress?.(i + 1, manifest.length, entry.name);

      try {
        let fileBlob: Blob | null = null;

        if (entry.file_path) {
          const fileData = zip.file(entry.file_path);
          if (fileData) fileBlob = await fileData.async('blob');
        }

        if (!fileBlob && entry.original_file_url) {
          fileBlob = await downloadFile(entry.original_file_url);
        }

        if (!fileBlob) {
          errors.push(`Arquivo não encontrado no ZIP: ${entry.name} (path: ${entry.file_path})`);
          failed++;
          continue;
        }

        const ext = getExtensionFromName(entry.name, entry.mime_type);
        const contentType = entry.mime_type || getMimeFromExt(ext);
        const uploadPath = `imported/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(uploadPath, fileBlob, { cacheControl: '3600', upsert: false, contentType });

        if (uploadErr) {
          errors.push(`Falha no upload ${entry.name}: ${uploadErr.message}`);
          failed++;
          continue;
        }

        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(uploadPath);

        const { data: fnData, error: fnErr } = await supabase.functions.invoke('import-documents-zip', {
          body: {
            documents: [{
              name: entry.name,
              file_url: urlData.publicUrl,
              document_type: entry.document_type,
              mime_type: contentType,
              file_size: entry.file_size,
              protocol: entry.protocol,
              created_at: entry.created_at,
              client_email: entry.client_email,
              brand_name: entry.brand_name,
              contract_number: entry.contract_number,
            }],
          },
        });

        if (fnErr) {
          errors.push(`Falha ao registrar no banco: ${entry.name}: ${fnErr.message}`);
          failed++;
        } else {
          if ((fnData as any)?.updated > 0) updated++;
          else imported++;
        }
      } catch (err: any) {
        errors.push(`Erro em ${entry.name}: ${err.message}`);
        failed++;
      }
    }
  }

  return { imported, updated, failed, errors };
}

// ─── Import Contracts from ZIP ───────────────────────

export async function importContractsZip(
  file: File,
  onProgress?: ProgressCallback
): Promise<{ imported: number; updated: number; failed: number; errors: string[] }> {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('contracts_manifest.json');
  if (!manifestFile) throw new Error('Arquivo contracts_manifest.json não encontrado no ZIP');

  const rawManifest: any[] = JSON.parse(await manifestFile.async('text'));
  let imported = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < rawManifest.length; i++) {
    const entry = rawManifest[i];
    onProgress?.(i + 1, rawManifest.length, entry.contract_number || entry.subject || `Contrato ${i + 1}`);

    try {
      // Upload PDFs (preserve mime type)
      const detailedPdfs: { path: string; name: string; mime_type: string }[] =
        entry.pdf_files_detailed ||
        (entry.pdf_files || entry.attached_pdfs || []).map((p: string) => ({
          path: p, name: p.split('/').pop() || 'documento.pdf', mime_type: 'application/pdf',
        }));

      const uploadedPdfs: { name: string; file_url: string; mime_type: string }[] = [];
      for (const pdf of detailedPdfs) {
        const pdfData = zip.file(pdf.path);
        if (pdfData) {
          const blob = await pdfData.async('blob');
          const ext = getExtensionFromName(pdf.name, pdf.mime_type);
          const uploadPath = `imported/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from('documents')
            .upload(uploadPath, blob, { cacheControl: '3600', upsert: false, contentType: pdf.mime_type });

          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('documents').getPublicUrl(uploadPath);
            uploadedPdfs.push({ name: pdf.name, file_url: urlData.publicUrl, mime_type: pdf.mime_type });
          } else {
            errors.push(`Falha upload PDF ${pdf.path}: ${uploadErr.message}`);
          }
        }
      }

      // Upload .ots proof if present
      let otsFileUrl: string | null = entry.ots_file_url || null;
      if (entry.ots_file_path) {
        const otsData = zip.file(entry.ots_file_path);
        if (otsData) {
          const blob = await otsData.async('blob');
          const otsUploadPath = `ots-proofs/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.ots`;
          const { error: otsUpErr } = await supabase.storage
            .from('documents')
            .upload(otsUploadPath, blob, { cacheControl: '3600', upsert: false, contentType: 'application/octet-stream' });
          if (!otsUpErr) {
            const { data: otsUrl } = supabase.storage.from('documents').getPublicUrl(otsUploadPath);
            otsFileUrl = otsUrl.publicUrl;
          }
        }
      }

      const { error: fnErr } = await supabase.functions.invoke('import-contracts-zip', {
        body: {
          contracts: [{
            ...entry,
            ots_file_url: otsFileUrl,
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
      errors.push(`Erro contrato ${entry.contract_number || i}: ${err.message}`);
      failed++;
    }
  }

  return { imported, failed, errors };
}
