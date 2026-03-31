import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate SHA-256 hash
async function generateSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Create timestamp proof using OpenTimestamps calendar servers
async function createBlockchainTimestamp(hash: string): Promise<{
  proof: Uint8Array | null;
  proofBase64: string;
  timestamp: string;
  txId: string;
  network: string;
  serverUsed: string;
}> {
  // Convert hex hash to bytes
  const hashBytes = new Uint8Array(
    hash.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  // Try multiple OpenTimestamps calendar servers for redundancy
  const calendarServers = [
    'https://a.pool.opentimestamps.org',
    'https://b.pool.opentimestamps.org',
    'https://alice.btc.calendar.opentimestamps.org',
    'https://bob.btc.calendar.opentimestamps.org'
  ];
  
  let proofBytes: Uint8Array | null = null;
  let proofBase64 = '';
  let serverUsed = '';
  
  for (const server of calendarServers) {
    try {
      const response = await fetch(`${server}/digest`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/vnd.opentimestamps.v1'
        },
        body: hashBytes
      });
      
      if (response.ok) {
        proofBytes = new Uint8Array(await response.arrayBuffer());
        // Encode proof as base64
        proofBase64 = btoa(String.fromCharCode(...proofBytes));
        serverUsed = server;
        console.log(`Successfully got OTS proof from ${server}`);
        break;
      }
    } catch (error) {
      console.log(`Failed to connect to ${server}:`, error);
      continue;
    }
  }
  
  // Generate unique transaction ID
  const timestamp = new Date().toISOString();
  const txId = `OTS_${Date.now()}_${hash.substring(0, 16).toUpperCase()}`;
  
  return {
    proof: proofBytes,
    proofBase64: proofBase64 || `PENDING_${hash.substring(0, 32)}`,
    timestamp,
    txId,
    network: serverUsed ? `Bitcoin (OpenTimestamps via ${new URL(serverUsed).hostname})` : 'Bitcoin (OpenTimestamps - Pending)',
    serverUsed
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Capture client IP and User Agent
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    const { contractId, contractHtml, deviceInfo, leadId, signatureImage, signatureToken, baseUrl, updatedContractHtml, updatedContractValue } = await req.json();
    
    if (!contractId) {
      return new Response(
        JSON.stringify({ error: 'contractId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If upsell classes were added, update contract_html and contract_value BEFORE signing
    if (updatedContractHtml && updatedContractValue) {
      console.log('Updating contract with upsell data. New value:', updatedContractValue);
      const { error: upsellError } = await supabase
        .from('contracts')
        .update({
          contract_html: updatedContractHtml,
          contract_value: updatedContractValue,
        })
        .eq('id', contractId);

      if (upsellError) {
        console.error('Error updating contract with upsell data:', upsellError);
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar contrato com classes extras', details: upsellError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Generate SHA-256 hash of contract content + signature
    const finalContractHtml = updatedContractHtml || contractHtml || '';
    const hashContent = finalContractHtml + (signatureImage || '');
    const contractHash = await generateSHA256(hashContent);
    console.log('Contract hash generated:', contractHash);

    // Register timestamp in blockchain
    const blockchainData = await createBlockchainTimestamp(contractHash);
    console.log('Blockchain timestamp created:', blockchainData);

    // Save OTS proof file to storage if we got a real proof
    let otsFileUrl: string | null = null;
    if (blockchainData.proof && blockchainData.proof.length > 0) {
      const fileName = `ots-proofs/${contractId}_${Date.now()}.ots`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, blockchainData.proof, {
          contentType: 'application/vnd.opentimestamps.v1',
          upsert: true
        });
      
      if (uploadError) {
        console.error('Error uploading OTS proof:', uploadError);
      } else {
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);
        
        otsFileUrl = urlData?.publicUrl || null;
        console.log('OTS proof saved to:', otsFileUrl);
      }
    }

    // Prepare signature data
    const signatureData: Record<string, any> = {
      signature_status: 'signed',
      signed_at: blockchainData.timestamp,
      signature_ip: clientIP,
      signature_user_agent: userAgent,
      blockchain_hash: contractHash,
      blockchain_timestamp: blockchainData.timestamp,
      blockchain_tx_id: blockchainData.txId,
      blockchain_network: blockchainData.network,
      blockchain_proof: blockchainData.proofBase64,
      ots_file_url: otsFileUrl,
      device_info: {
        ...deviceInfo,
        signed_at: blockchainData.timestamp,
        ip_address: clientIP,
        user_agent: userAgent
      }
    };

    // Add client signature image if provided
    if (signatureImage) {
      signatureData.client_signature_image = signatureImage;
    }

    // Update contract in database and fetch created_by to auto-assign responsible admin
    const { data: contractData, error: contractError } = await supabase
      .from('contracts')
      .update(signatureData)
      .eq('id', contractId)
      .select('*, leads(*), created_by')
      .single();

    if (contractError) {
      console.error('Error updating contract:', contractError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar contrato', details: contractError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // UPDATE DOCUMENT ENTRY - Sync with CRM and Client Area
    // ========================================
    // Update existing document entry with blockchain data and file URL
    const { data: existingDoc, error: docFetchError } = await supabase
      .from('documents')
      .select('id')
      .eq('contract_id', contractId)
      .maybeSingle();

    if (existingDoc) {
      // Update existing document
      const { error: docUpdateError } = await supabase
        .from('documents')
        .update({
          name: `Contrato Assinado - ${contractData?.subject || 'Registro de Marca'}`,
          // file_url will be updated when PDF is uploaded via upload-signed-contract-pdf
        })
        .eq('id', existingDoc.id);

      if (docUpdateError) {
        console.error('Error updating document:', docUpdateError);
      } else {
        console.log('Updated document entry:', existingDoc.id);
      }
    } else {
      console.log('No existing document found for contract, will be created during PDF upload');
    }

    // Update lead status to 'convertido' when contract is signed
    // The person signed → they become a client, no longer just a lead
    if (leadId) {
      await supabase
        .from('leads')
        .update({ 
          status: 'convertido',
          converted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);
      console.log('Lead converted at signature:', leadId);
    }

    // Build verification URL — use production domain, same pattern as generate-signature-link
    const PRODUCTION_DOMAIN = 'https://webmarcas.net';
    const isPreviewUrl = (url: string) =>
      !url || url.includes('lovable.app') || url.includes('lovableproject.com') || url.includes('localhost');
    const rawSiteUrl = Deno.env.get('SITE_URL') || '';
    const verificationBaseUrl = (!isPreviewUrl(rawSiteUrl) ? rawSiteUrl : null)
      || (!isPreviewUrl(baseUrl || '') ? baseUrl : null)
      || PRODUCTION_DOMAIN;

    // Get recipient info
    let recipientEmail = '';
    let recipientName = '';
    let brandName = contractData?.subject || '';
    let recipientCpfCnpj = '';
    let recipientPhone = '';

    // Try to get data from lead first
    if (contractData?.leads) {
      recipientEmail = contractData.leads.email || '';
      recipientName = contractData.leads.full_name || '';
      recipientCpfCnpj = contractData.leads.cpf_cnpj || '';
      recipientPhone = contractData.leads.phone || '';
    }

    // If no email from lead, try profile
    if (!recipientEmail && contractData?.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name, cpf_cnpj, phone')
        .eq('id', contractData.user_id)
        .single();
      
      if (profile) {
        recipientEmail = profile.email || '';
        recipientName = profile.full_name || recipientName;
        recipientCpfCnpj = profile.cpf_cnpj || recipientCpfCnpj;
        recipientPhone = profile.phone || recipientPhone;
      }
    }

    // Get brand name from process if exists
    if (contractData?.process_id) {
      const { data: process } = await supabase
        .from('brand_processes')
        .select('brand_name')
        .eq('id', contractData.process_id)
        .single();
      
      if (process?.brand_name) {
        brandName = process.brand_name;
      }
    }

    // ========================================
    // CREATE CLIENT USER AFTER CONTRACT SIGNATURE
    // ========================================
    let userId: string | null = contractData?.user_id || null;
    let userCreated = false;
    const tempPassword = '123Mudar@';

    if (!userId && recipientEmail) {
      // Check if user already exists by email
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === recipientEmail);

      if (existingUser) {
        userId = existingUser.id;
        console.log('Found existing user:', userId);
        
        // NEW: If user was pre-created (e.g., by admin) and never logged in,
        // enforce default password and send welcome email with credentials.
        if (!existingUser.last_sign_in_at) {
          const { error: pwError } = await supabase.auth.admin.updateUserById(userId, {
            password: tempPassword,
          });

          if (pwError) {
            console.error('Error enforcing default password for existing user:', pwError);
          } else {
            console.log('Default password enforced for existing user');
          }

          userCreated = true; // Flag to send welcome email
          console.log('User exists but never logged in - will send welcome email');
        }
      } else {
        // Create new user with fixed password
        const { data: newUser, error: userError } = await supabase.auth.admin.createUser({
          email: recipientEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: recipientName,
          },
        });

        if (!userError && newUser.user) {
          userId = newUser.user.id;
          userCreated = true;
          console.log('Created new client user:', userId);

          // Assign 'user' role (NOT admin) - this restricts access to client area only
          await supabase.from('user_roles').insert({
            user_id: userId,
            role: 'user',
          });
          console.log('Assigned user role');

          // Create profile with lead data
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: userId,
            email: recipientEmail,
            full_name: recipientName,
            cpf_cnpj: recipientCpfCnpj || null,
            phone: recipientPhone || null,
            origin: 'site',
            priority: 'high',
            last_contact: new Date().toISOString(),
          });

          if (profileError) {
            console.error('Error creating profile:', profileError);
          } else {
            console.log('Created profile for user:', userId);
          }
        } else if (userError) {
          console.error('Error creating user:', userError);
        }
      }

      // Update contract with user_id
      if (userId) {
        await supabase.from('contracts').update({ user_id: userId }).eq('id', contractId);
        console.log('Updated contract with user_id:', userId);

        // Also link lead to converted client
        if (leadId) {
          await supabase
            .from('leads')
            .update({ converted_to_client_id: userId })
            .eq('id', leadId);
          console.log('Linked lead to client user:', leadId, '->', userId);
        }
      }
    }

    // ========================================
    // CAMADA 3: ATRIBUIÇÃO AUTOMÁTICA DE RESPONSÁVEL
    // Se o contrato foi criado por um admin, atribuir esse admin como
    // responsável pelo cliente no momento da assinatura
    // ========================================
    if (userId && contractData?.created_by) {
      const { error: assignError } = await supabase
        .from('profiles')
        .update({
          assigned_to: contractData.created_by,
          created_by: contractData.created_by,
        })
        .eq('id', userId)
        .is('assigned_to', null); // Só atribui se ainda não tiver responsável

      if (assignError) {
        console.error('Error assigning responsible admin to client profile:', assignError);
      } else {
        console.log('Auto-assigned admin as responsible for client:', contractData.created_by, '→ user:', userId);
      }
    } else if (userId && !contractData?.created_by) {
      console.log('Contract has no created_by (signed from site) - skipping auto-assignment');
    }

    // Create client activity log
    if (userId) {
      await supabase
        .from('client_activities')
        .insert({
          user_id: userId,
          activity_type: 'contract_signed',
          description: `Contrato assinado digitalmente com registro em blockchain`,
          metadata: {
            contract_id: contractId,
            blockchain_hash: contractHash,
            blockchain_tx_id: blockchainData.txId,
            ip_address: clientIP,
            ots_file_url: otsFileUrl,
            auto_assigned_to: contractData?.created_by || null,
          }
        });

      // ========================================
      // UPDATE PIPELINE STAGE FOR COMMERCIAL CLIENTS
      // ========================================
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('client_funnel_type')
        .eq('id', userId)
        .single();

      if (clientProfile?.client_funnel_type === 'comercial') {
        const { error: stageError } = await supabase
          .from('brand_processes')
          .update({ pipeline_stage: 'assinou_contrato' })
          .eq('user_id', userId);

        if (stageError) {
          console.error('Error updating pipeline stage:', stageError);
        } else {
          console.log('Updated pipeline stage to assinou_contrato for commercial client');
        }
      }
    }

    const verificationUrl = `${verificationBaseUrl}/verificar-contrato?hash=${contractHash}`;
    const loginUrl = `${verificationBaseUrl}/cliente/login`;

    // ========================================
    // SEND WELCOME EMAIL WITH CREDENTIALS (if user was just created)
    // ========================================
    if (userCreated && recipientEmail) {
      try {
        console.log('Sending welcome email with credentials to:', recipientEmail);
        
        const welcomeEmailResponse = await fetch(`${supabaseUrl}/functions/v1/trigger-email-automation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            trigger_event: 'user_created',
            data: {
              nome: recipientName || 'Cliente',
              email: recipientEmail,
              senha: tempPassword,
              login_url: loginUrl,
              base_url: 'https://webmarcas.net',
            }
          })
        });

        if (welcomeEmailResponse.ok) {
          console.log('Welcome email with credentials sent successfully');
        } else {
          const errorText = await welcomeEmailResponse.text();
          console.error('Error sending welcome email:', errorText);
        }
      } catch (welcomeEmailError) {
        console.error('Error sending welcome email:', welcomeEmailError);
      }
    }

    // ========================================
    // SEND CONTRACT SIGNED CONFIRMATION EMAIL
    // ========================================
    if (recipientEmail) {
      try {
        console.log('Sending contract signed confirmation email to:', recipientEmail);
        
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/trigger-email-automation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            trigger_event: 'contract_signed',
            data: {
              nome: recipientName || contractData?.signatory_name || 'Cliente',
              email: recipientEmail,
              marca: brandName,
              data_assinatura: new Date().toLocaleDateString('pt-BR'),
              hash_contrato: contractHash,
              ip_assinatura: clientIP,
              verification_url: verificationUrl,
              link_area_cliente: `${verificationBaseUrl}/cliente/documentos`,
              ots_file_url: otsFileUrl,
              base_url: 'https://webmarcas.net',
            }
          })
        });

        if (emailResponse.ok) {
          console.log('Contract signed confirmation email sent successfully');
        } else {
          const errorText = await emailResponse.text();
          console.error('Error sending confirmation email:', errorText);
        }
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
      }
    } else {
      console.log('No recipient email found, skipping email notifications');
    }

    console.log('Contract signed successfully:', contractId);

    // ── MONITORING SUBSCRIPTION HOOK ──────────────────────────
    // If contract has payment_method = 'boleto_recorrente', create Asaas subscription
    if (contractData?.payment_method === 'boleto_recorrente') {
      try {
        console.log('[monitoring] Creating recurring subscription for contract:', contractId);
        fetch(`${supabaseUrl}/functions/v1/create-monitoring-subscription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ contractId }),
        }).catch(e => console.error('[monitoring] Subscription dispatch error:', e));
        console.log('[monitoring] Subscription dispatch sent');
      } catch (monErr) {
        console.error('[monitoring] Error dispatching subscription:', monErr);
      }
    }
    // ── END MONITORING SUBSCRIPTION HOOK ──────────────────────

    // ── MULTICHANNEL HOOK: contrato_assinado ──────────────────
    // Fire-and-forget — never blocks the main response
    try {
      if (recipientEmail || recipientPhone || userId) {
        fetch(`${supabaseUrl}/functions/v1/send-multichannel-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            event_type: 'contrato_assinado',
            channels: ['crm', 'sms', 'whatsapp'],
            recipient: {
              nome:    recipientName  || 'Cliente',
              email:   recipientEmail || '',
              phone:   recipientPhone || '',
              user_id: userId         || undefined,
            },
            data: {
              marca: brandName      || '',
              link:  verificationUrl || '',
            },
          }),
        }).catch(e => console.error('[multichannel] contrato_assinado dispatch error:', e));
        console.log('[multichannel] contrato_assinado dispatched for:', recipientEmail || userId);
      }
    } catch (multiErr) {
      console.error('[multichannel] Error dispatching contrato_assinado:', multiErr);
    }
    // ── END MULTICHANNEL HOOK ─────────────────────────────────

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          contractId,
          hash: contractHash,
          timestamp: blockchainData.timestamp,
          txId: blockchainData.txId,
          network: blockchainData.network,
          ipAddress: clientIP,
          verificationUrl,
          otsFileUrl,
          userId,
          userCreated,
          message: 'Contrato assinado com sucesso e registrado em blockchain'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in sign-contract-blockchain:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});