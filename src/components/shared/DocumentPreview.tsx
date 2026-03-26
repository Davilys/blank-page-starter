import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, FileText, Image, Video, Music, Loader2, CheckCircle, Shield, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DocumentRenderer, generateDocumentPrintHTML, getLogoBase64ForPDF } from '@/components/contracts/DocumentRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DocumentPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id?: string;
    name: string;
    file_url: string;
    document_type?: string | null;
    mime_type?: string | null;
    isContract?: boolean;
    signature_status?: string;
    blockchain_hash?: string;
  } | null;
}

interface ContractData {
  contract_html: string | null;
  blockchain_hash: string | null;
  blockchain_timestamp: string | null;
  signature_ip: string | null;
  blockchain_tx_id: string | null;
  blockchain_network: string | null;
  document_type: string | null;
  signatory_name: string | null;
  signatory_cpf: string | null;
  signatory_cnpj: string | null;
  client_signature_image: string | null;
}

export function DocumentPreview({ open, onOpenChange, document }: DocumentPreviewProps) {
  const [imageError, setImageError] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [effectiveUrl, setEffectiveUrl] = useState<string>('');
  const [contractData, setContractData] = useState<ContractData | null>(null);

  // Reset states when document changes
  useEffect(() => {
    if (document) {
      setImageError(false);
      setSignedUrl(null);
      setLoading(false);
      setEffectiveUrl(document.file_url);
      setContractData(null);
      
      // If it's a contract without file_url, fetch contract data
      if (document.isContract && !document.file_url && document.id) {
        fetchContractData(document.id);
      }
    }
  }, [document]);

  // Fetch complete contract data for digital contracts
  const fetchContractData = async (contractId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          contract_html, 
          blockchain_hash, 
          blockchain_timestamp, 
          signature_ip, 
          blockchain_tx_id, 
          blockchain_network,
          document_type,
          signatory_name,
          signatory_cpf,
          signatory_cnpj,
          client_signature_image
        `)
        .eq('id', contractId)
        .single();
      
      if (data) {
        setContractData(data);
      }
    } catch (err) {
      console.error('Error fetching contract data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Try to get signed URL as fallback when public URL fails
  const trySignedUrl = async () => {
    if (!document?.file_url || signedUrl) return;
    
    setLoading(true);
    try {
      // Extract path from URL - handle different URL formats
      const url = new URL(document.file_url);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/documents\/(.+)/);
      
      if (pathMatch && pathMatch[1]) {
        const filePath = decodeURIComponent(pathMatch[1]);
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(filePath, 3600); // 1 hour validity
        
        if (data?.signedUrl && !error) {
          setSignedUrl(data.signedUrl);
          setEffectiveUrl(data.signedUrl);
        }
      }
    } catch (err) {
      console.error('Error getting signed URL:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle PDF print (same as admin - with floating action buttons)
  const handlePrintPDF = async () => {
    if (!contractData?.contract_html) return;
    
    try {
      const logoBase64 = await getLogoBase64ForPDF();
      const documentType = (contractData.document_type || 'contract') as 'contract' | 'distrato_multa' | 'distrato_sem_multa' | 'procuracao';
      const printHtml = generateDocumentPrintHTML(
        documentType,
        contractData.contract_html,
        contractData.client_signature_image || undefined,
        contractData.blockchain_hash ? {
          hash: contractData.blockchain_hash,
          timestamp: contractData.blockchain_timestamp || '',
          txId: contractData.blockchain_tx_id || '',
          network: contractData.blockchain_network || '',
          ipAddress: contractData.signature_ip || '',
        } : undefined,
        contractData.signatory_name || undefined,
        contractData.signatory_cpf || undefined,
        contractData.signatory_cnpj || undefined,
        undefined,
        window.location.origin,
        logoBase64
      );
      
      // Inject floating action buttons (standard pattern)
      const enhancedHtml = printHtml
        .replace('</head>', `
          <style>
            @media print { .no-print { display: none !important; } }
            .action-buttons {
              position: fixed;
              top: 20px;
              right: 20px;
              z-index: 9999;
              display: flex;
              gap: 8px;
            }
            .action-buttons button {
              padding: 12px 20px;
              border-radius: 8px;
              font-weight: 600;
              cursor: pointer;
              border: none;
              font-size: 14px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .btn-primary {
              background: linear-gradient(135deg, #f97316, #ea580c);
              color: white;
            }
            .btn-secondary {
              background: #f1f5f9;
              color: #334155;
            }
          </style>
        </head>`)
        .replace('<body', `<body><div class="action-buttons no-print">
          <button class="btn-primary" onclick="window.print()">Salvar como PDF</button>
          <button class="btn-secondary" onclick="window.close()">Fechar</button>
        </div><body`.slice(0, -5));
      
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(enhancedHtml);
        newWindow.document.close();
        newWindow.onload = () => setTimeout(() => newWindow.print(), 500);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  if (!document) return null;

  const url = effectiveUrl || document.file_url;

  // Detect file type from mime_type or URL extension
  const isImage = document.mime_type?.startsWith('image/') || 
    /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|ico)$/i.test(url);
  const isPDF = document.mime_type === 'application/pdf' || 
    /\.pdf$/i.test(url);
  const isVideo = document.mime_type?.startsWith('video/') ||
    /\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/i.test(url);
  const isAudio = document.mime_type?.startsWith('audio/') ||
    /\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i.test(url);

  const handleDownload = async () => {
    try {
      const downloadUrl = signedUrl || document.file_url;
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.download = document.name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      // Fallback to direct link
      const link = window.document.createElement('a');
      link.href = signedUrl || document.file_url;
      link.download = document.name;
      link.target = '_blank';
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    }
  };

  const openInNewTab = () => {
    window.open(signedUrl || document.file_url, '_blank');
  };

  const handleMediaError = () => {
    if (!signedUrl) {
      setImageError(true);
      trySignedUrl();
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-12 w-12 mb-4 animate-spin opacity-50" />
          <p className="text-lg font-medium">Carregando...</p>
        </div>
      );
    }

    // Digital contract with HTML content (no PDF file) - using DocumentRenderer like admin
    if (document.isContract && contractData?.contract_html) {
      const isSigned = document.signature_status === 'signed';
      const blockchainSignature = contractData.blockchain_hash ? {
        hash: contractData.blockchain_hash,
        timestamp: contractData.blockchain_timestamp || '',
        txId: contractData.blockchain_tx_id || '',
        network: contractData.blockchain_network || '',
        ipAddress: contractData.signature_ip || '',
      } : undefined;

      return (
        <ScrollArea className="h-[60vh]">
          <div className="p-4 bg-white rounded-lg">
            {isSigned && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-green-800 font-medium">Contrato Assinado Digitalmente</span>
                {contractData.blockchain_hash && (
                  <Shield className="h-4 w-4 text-blue-600 ml-2" />
                )}
              </div>
            )}
            <DocumentRenderer 
              documentType={(contractData.document_type || 'contract') as 'contract' | 'distrato_multa' | 'distrato_sem_multa' | 'procuracao'}
              content={contractData.contract_html}
              clientSignature={contractData.client_signature_image || undefined}
              blockchainSignature={blockchainSignature}
              showCertificationSection={isSigned}
              signatoryName={contractData.signatory_name || undefined}
              signatoryCpf={contractData.signatory_cpf || undefined}
              signatoryCnpj={contractData.signatory_cnpj || undefined}
            />
          </div>
        </ScrollArea>
      );
    }

    // Digital contract without HTML - show message
    if (document.isContract && !contractData?.contract_html && !url) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="h-16 w-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">Contrato Digital</p>
          <p className="text-sm mt-2">O PDF está sendo gerado. Tente novamente em alguns segundos.</p>
        </div>
      );
    }

    if (isImage && !imageError) {
      return (
        <img
          src={url}
          alt={document.name}
          className="max-w-full h-auto mx-auto rounded-lg"
          onError={handleMediaError}
        />
      );
    }

    if (isPDF) {
      return (
        <iframe
          src={url}
          className="w-full h-[60vh] rounded-lg"
          title={document.name}
          onError={handleMediaError}
        />
      );
    }

    if (isVideo) {
      return (
        <video
          src={url}
          controls
          className="max-w-full h-auto mx-auto rounded-lg"
          onError={handleMediaError}
        >
          Seu navegador não suporta vídeo HTML5.
        </video>
      );
    }

    if (isAudio) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Music className="h-16 w-16 mb-4 text-primary opacity-70" />
          <p className="text-lg font-medium mb-4">{document.name}</p>
          <audio
            src={url}
            controls
            className="w-full max-w-md"
            onError={handleMediaError}
          >
            Seu navegador não suporta áudio HTML5.
          </audio>
        </div>
      );
    }

    // Fallback for unsupported file types
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-16 w-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">Pré-visualização não disponível</p>
        <p className="text-sm mt-2">Clique em "Baixar" para ver o arquivo</p>
        <Button onClick={handleDownload} className="mt-4">
          <Download className="h-4 w-4 mr-2" />
          Baixar Arquivo
        </Button>
      </div>
    );
  };

  const getIcon = () => {
    if (isImage) return <Image className="h-5 w-5" />;
    if (isVideo) return <Video className="h-5 w-5" />;
    if (isAudio) return <Music className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  // Check if we should show the print button (only for digital contracts)
  const showPrintButton = document.isContract && contractData?.contract_html;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {getIcon()}
              <span className="truncate max-w-[300px]">{document.name}</span>
            </DialogTitle>
            <div className="flex items-center gap-2">
              {showPrintButton && (
                <Button variant="outline" size="sm" onClick={handlePrintPDF}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir/PDF
                </Button>
              )}
              {!showPrintButton && (
                <Button variant="outline" size="sm" onClick={openInNewTab}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 overflow-auto max-h-[70vh] rounded-lg border bg-muted/30 p-4">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
