import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadRequest {
  contractId: string;
  documentType: string;
  pdfBase64: string;
  fileName: string;
  userId?: string;
  processId?: string;
  contractHtml?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { 
      contractId, 
      documentType, 
      pdfBase64, 
      fileName, 
      userId, 
      processId,
      contractHtml 
    }: UploadRequest = await req.json();

    if (!contractId || !pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'contractId e pdfBase64 são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Uploading signed PDF for contract:', contractId);

    // Decode base64 PDF
    let pdfData: string = pdfBase64;
    
    // Remove data URL prefix if present
    if (pdfBase64.startsWith('data:')) {
      pdfData = pdfBase64.split(',')[1];
    }

    // Convert base64 to Uint8Array
    const binaryString = atob(pdfData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Generate file path
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = `signed-contracts/${contractId}/${timestamp}_${sanitizedFileName}.pdf`;

    console.log('Uploading to path:', filePath);

    // Upload PDF to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, bytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Erro ao fazer upload do PDF', details: uploadError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('PDF uploaded successfully:', uploadData?.path);

    // Use public URL (bucket is public) - never expires
    const { data: publicData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl || '';
    console.log('Public URL:', publicUrl);

    // Calculate file size
    const fileSize = bytes.length;

    // Check if document already exists for this contract
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id, user_id')
      .eq('contract_id', contractId)
      .maybeSingle();

    let documentId: string;

    // Get contract data to ensure we have the correct user_id
    const { data: contractInfo } = await supabase
      .from('contracts')
      .select('user_id, subject, signatory_name, blockchain_hash')
      .eq('id', contractId)
      .single();

    const effectiveUserId = userId || contractInfo?.user_id || null;
    const documentName = fileName || `Contrato_Assinado_${contractInfo?.subject || contractId}.pdf`;

    if (existingDoc) {
      // Update existing document with the PDF URL
      const { data: updatedDoc, error: updateError } = await supabase
        .from('documents')
        .update({
          file_url: publicUrl,
          file_size: fileSize,
          mime_type: 'application/pdf',
          name: documentName,
          user_id: effectiveUserId, // Ensure user_id is set
        })
        .eq('id', existingDoc.id)
        .select('id')
        .single();

      if (updateError) {
        console.error('Error updating document:', updateError);
      } else {
        documentId = updatedDoc?.id || existingDoc.id;
        console.log('Updated document with PDF URL:', documentId);
      }
    } else {
      // Create new document entry
      const { data: newDoc, error: insertError } = await supabase
        .from('documents')
        .insert({
          name: documentName,
          document_type: documentType || 'contrato',
          file_url: publicUrl,
          file_size: fileSize,
          mime_type: 'application/pdf',
          user_id: effectiveUserId,
          process_id: processId || null,
          contract_id: contractId,
          uploaded_by: 'system',
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating document entry:', insertError);
        // Don't fail - PDF was uploaded successfully
      } else {
        documentId = newDoc?.id || '';
        console.log('Created document entry:', documentId);
      }
    }

    // Update contract with contract_html if provided and not already set
    if (contractHtml) {
      const { data: contract } = await supabase
        .from('contracts')
        .select('contract_html')
        .eq('id', contractId)
        .single();

      if (contract && !contract.contract_html) {
        await supabase
          .from('contracts')
          .update({ contract_html: contractHtml })
          .eq('id', contractId);
        
        console.log('Updated contract_html for contract:', contractId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          contractId,
          documentId: documentId!,
          filePath,
          publicUrl,
          fileSize,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in upload-signed-contract-pdf:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
