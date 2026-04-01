import { useMemo, useRef, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import webmarcasLogo from '@/assets/webmarcas-logo-mark.png';
import davilysSignature from '@/assets/davilys-signature.png';
import { ContractRenderer } from '@/components/contracts/ContractRenderer';

// Função para gerar URL de verificação dinâmica baseada no domínio atual
const getVerificationUrl = (hash: string) => {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://webpatentes.com.br';
  return `${base}/verificar-contrato?hash=${hash}`;
};

// Função para obter o host atual para exibição
const getCurrentHost = () => {
  return typeof window !== 'undefined' ? window.location.host : 'webpatentes.com.br';
};

interface BlockchainSignature {
  hash: string;
  timestamp: string;
  txId: string;
  network: string;
  ipAddress: string;
}

interface DocumentRendererProps {
  documentType: 'procuracao' | 'distrato_multa' | 'distrato_sem_multa' | 'contract';
  content: string;
  clientSignature?: string | null;
  blockchainSignature?: BlockchainSignature;
  showCertificationSection?: boolean;
  signatoryName?: string;
  signatoryCpf?: string;
  signatoryCnpj?: string;
}

/** Detecta documento HTML completo (com DOCTYPE ou <html>) */
function isFullHtmlDocument(content: string): boolean {
  const t = content.trim();
  return t.startsWith('<!DOCTYPE') || t.startsWith('<html') || t.startsWith('<HTML');
}

/** Detecta HTML parcial (tags HTML mas sem documento completo) */
function isPartialHtml(content: string): boolean {
  const t = content.trim();
  return t.startsWith('<') && t.includes('</') && !isFullHtmlDocument(t);
}

/**
 * Renderiza documentos HTML completos via iframe sandboxed.
 * Isso garante que o CSS do documento não vaze para fora como texto visível.
 */
function FullHtmlDocumentViewer({ htmlContent, blockchainSignature }: { htmlContent: string; blockchainSignature?: BlockchainSignature }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(900);
  const [resolvedHtml, setResolvedHtml] = useState<string | null>(null);

  // Pre-load all images referenced in the HTML as base64 so they render inside the sandboxed iframe
  // Also inject blockchain certification if present
  useEffect(() => {
    const resolveImages = async (html: string): Promise<string> => {
      const imgRegex = /src="([^"]+)"/g;
      const origin = window.location.origin;

      const toAbsolute = (src: string): string | null => {
        if (src.startsWith('data:')) return null;
        if (src.startsWith('http://') || src.startsWith('https://')) {
          if (!src.startsWith(origin)) return null;
          return src;
        }
        if (src.startsWith('/')) return `${origin}${src}`;
        return null;
      };

      const fetchAsBase64 = async (url: string): Promise<string | null> => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const blob = await res.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch { return null; }
      };

      const urlMap = new Map<string, string | null>();
      let match: RegExpExecArray | null;
      const imgRegexCopy = new RegExp(imgRegex.source, imgRegex.flags);
      while ((match = imgRegexCopy.exec(html)) !== null) {
        const abs = toAbsolute(match[1]);
        if (abs && !urlMap.has(match[1])) urlMap.set(match[1], abs);
      }

      await Promise.all(
        Array.from(urlMap.entries()).map(async ([original, absolute]) => {
          if (!absolute) return;
          const b64 = await fetchAsBase64(absolute);
          urlMap.set(original, b64);
        })
      );

      let resolved = html;
      urlMap.forEach((b64, original) => {
        if (b64) resolved = resolved.split(original).join(b64);
      });

      // Inject blockchain certification if signed and not already present
      if (blockchainSignature?.hash && !resolved.includes('CERTIFICAÇÃO DIGITAL E VALIDADE JURÍDICA') && resolved.includes('</body>')) {
        const certSection = buildBlockchainCertificationHtml(blockchainSignature, origin);
        resolved = resolved.replace('</body>', `${certSection}</body>`);
      }

      return resolved;
    };

    resolveImages(htmlContent).then(setResolvedHtml);
  }, [htmlContent, blockchainSignature]);

  useEffect(() => {
    if (!resolvedHtml) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(resolvedHtml);
    doc.close();

    const adjustHeight = () => {
      try {
        const body = doc.body;
        if (body) {
          const height = Math.max(body.scrollHeight, body.offsetHeight, 600);
          setIframeHeight(height + 60);
        }
      } catch {
        // cross-origin fallback
      }
    };

    iframe.onload = adjustHeight;
    setTimeout(adjustHeight, 400);
    setTimeout(adjustHeight, 1200);
  }, [resolvedHtml]);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {!resolvedHtml && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span className="text-sm">Carregando documento...</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Visualização do Documento"
        style={{ width: '100%', height: resolvedHtml ? `${iframeHeight}px` : '0px', border: 'none', display: 'block' }}
        sandbox="allow-same-origin"
      />
    </div>
  );
}

export function DocumentRenderer({
  documentType,
  content,
  clientSignature,
  blockchainSignature,
  showCertificationSection = false,
  signatoryName,
  signatoryCpf,
  signatoryCnpj,
}: DocumentRendererProps) {
  // All hooks must be called unconditionally at the top level
  const formattedContent = useMemo(() => {
    return content.replace(/\{contract_signature\}/g, '').trim();
  }, [content]);

  const isFullHtml = useMemo(() => isFullHtmlDocument(formattedContent), [formattedContent]);
  const isHtml = useMemo(() => isPartialHtml(formattedContent), [formattedContent]);
  const isPureText = !isFullHtml && !isHtml;
  const isContractPureText = documentType === 'contract' && isPureText;

  const documentTitle = useMemo(() => {
    switch (documentType) {
      case 'procuracao': return 'PROCURAÇÃO PARA REPRESENTAÇÃO JUNTO AO INPI';
      case 'distrato_multa': return 'Acordo de Distrato de Parceria - Anexo I';
      case 'distrato_sem_multa': return 'Acordo de Distrato de Parceria - Anexo I';
      default: return 'DOCUMENTO';
    }
  }, [documentType]);

  const documentSubtitle = documentType === 'procuracao'
    ? 'Instrumento Particular de Procuração para fins de Registro de Marca'
    : null;

  const legalNotice = useMemo(() => {
    if (documentType === 'procuracao') {
      return 'Pelo presente instrumento particular de PROCURAÇÃO, o(a) outorgante abaixo identificado(a) nomeia e constitui como seu bastante PROCURADOR o(a) Sr(a). Davilys Danques de Oliveira Cunha, para representá-lo(a) de forma exclusiva junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL – INPI, podendo praticar todos os atos necessários, legais e administrativos relacionados ao pedido, acompanhamento, defesa e manutenção do registro de marca, inclusive apresentação de requerimentos, cumprimento de exigências, interposição de recursos e recebimento de notificações.';
    }
    if (documentType === 'distrato_multa' || documentType === 'distrato_sem_multa') {
      return `Os termos deste instrumento aplicam-se exclusivamente à formalização do cancelamento de contratações realizadas mediante negociações personalizadas, conduzidas diretamente com a equipe comercial da WebMarcas Intelligence PI.\n\nO presente distrato estabelece as condições para encerramento da relação contratual anteriormente firmada, estando vinculado ao "Contrato de Prestação de Serviços e Gestão de Pagamentos e Outras Avenças", cujo aceite integral ocorreu no momento do envio da Proposta.`;
    }
    return null;
  }, [documentType]);

  const verificationUrl = blockchainSignature?.hash ? getVerificationUrl(blockchainSignature.hash) : '';
  const showCertSection = (showCertificationSection || !!blockchainSignature?.hash) && !!blockchainSignature;

  // CASO 1: Documento HTML completo → renderizar via iframe (injeta certificação se assinado)
  if (isFullHtml) {
    return <FullHtmlDocumentViewer htmlContent={formattedContent} blockchainSignature={blockchainSignature} />;
  }

  // CASO 2: Contrato em texto puro → usar ContractRenderer (renderização React nativa, visual perfeito)
  if (isContractPureText) {
    return (
      <ContractRenderer
        content={formattedContent}
        showLetterhead
        className="rounded-lg shadow-lg overflow-hidden"
        showCertificationSection={showCertificationSection || !!blockchainSignature?.hash}
        blockchainSignature={
          blockchainSignature?.hash
            ? {
                hash: blockchainSignature.hash,
                timestamp: blockchainSignature.timestamp,
                txId: blockchainSignature.txId,
                network: blockchainSignature.network,
                ipAddress: blockchainSignature.ipAddress,
              }
            : undefined
        }
        documentType={documentType}
      />
    );
  }

  // CASO 3: Procuração / Distrato em texto puro ou HTML parcial → layout completo com cabeçalho padrão
  return (
    <div className="bg-white text-black rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-white p-6 border-b">
        <div className="flex items-center justify-between pb-3">
          <img src={webmarcasLogo} alt="WebMarcas" className="h-12 object-contain" onError={(e) => { e.currentTarget.src = WEBMARCAS_LOGO_FALLBACK; }} />
          <a href="https://www.webpatentes.com.br" className="text-sm font-medium" style={{ color: '#0EA5E9' }}>
            www.webpatentes.com.br
          </a>
        </div>
        <div className="h-2 w-full rounded-sm" style={{ background: 'linear-gradient(90deg, #f97316, #fbbf24)' }} />
      </div>

      <div className="px-8 py-6">
        {/* Document Title */}
        <h1 className="text-2xl font-bold text-blue-700 text-center mb-2">{documentTitle}</h1>
        {documentSubtitle && (
          <p className="text-base text-gray-600 text-center mb-6 italic">{documentSubtitle}</p>
        )}

        {/* Legal Notice Box */}
        {legalNotice && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6 text-sm text-gray-700 italic">
            {legalNotice.split('\n\n').map((paragraph, idx) => (
              <p key={idx} className={idx > 0 ? 'mt-3' : ''}>{paragraph}</p>
            ))}
          </div>
        )}

        {/* Document Content */}
        {isHtml ? (
          <div
            className="prose prose-sm max-w-none text-justify leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formattedContent }}
          />
        ) : (
          <div className="prose prose-sm max-w-none text-justify leading-relaxed">
            {formattedContent.split('\n\n').map((paragraph, idx) => (
              <p key={idx} className="mb-4 text-gray-800">{paragraph}</p>
            ))}
          </div>
        )}

        {/* Signatures Section */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-8">
            Por estarem justas e contratadas, as partes assinam o presente de igual teor e forma, de forma digital válido juridicamente.
          </p>
          <div className="grid grid-cols-2 gap-8">
            {/* Contractor Signature */}
            <div className="text-center">
              <p className="text-sm font-semibold mb-2">Assinatura autorizada:</p>
              <p className="text-sm text-gray-700 mb-4">
                WebMarcas Intelligence PI - CNPJ/MF sob o nº 39.528.012/0001-29
              </p>
              <div className="border-b-2 border-black mx-auto w-64 pb-2 min-h-[4rem]">
                {documentType === 'procuracao' ? (
                  <img src={davilysSignature} alt="Assinatura WebMarcas" className="h-16 mx-auto object-contain" />
                ) : (
                  <div className="flex items-center justify-center h-16">
                    <span className="text-blue-600 font-medium text-sm">✓ Assinado Digitalmente</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {documentType === 'procuracao' ? 'Davilys Danques de Oliveira Cunha' : 'Certificação Digital - Lei 14.063/2020'}
              </p>
            </div>

            {/* Client Signature */}
            <div className="text-center">
              <p className="text-sm font-semibold mb-2">Contratante:</p>
              <p className="text-sm text-gray-700 mb-4">
                {signatoryName || 'Nome do Representante'}
                {signatoryCnpj && ` - CNPJ sob o nº ${signatoryCnpj}`}
                {signatoryCpf && `, CPF sob o n⁰ ${signatoryCpf}`}
              </p>
              <div className="border-b-2 border-black mx-auto w-64 pb-2 min-h-[4rem]">
                {clientSignature ? (
                  <img src={clientSignature} alt="Assinatura do Cliente" className="h-16 mx-auto object-contain" />
                ) : blockchainSignature?.hash ? (
                  <div className="flex items-center justify-center h-16">
                    <span className="text-blue-600 font-medium text-sm">✓ Assinado Digitalmente</span>
                  </div>
                ) : (
                  <p className="text-gray-400 italic text-sm py-4">Aguardando assinatura...</p>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {blockchainSignature?.hash ? 'Certificação Digital - Lei 14.063/2020' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Digital Certification Section */}
        {showCertSection && blockchainSignature && (
          <div className="mt-12 pt-8 border-t-2 border-blue-600">
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                CERTIFICAÇÃO DIGITAL E VALIDADE JURÍDICA
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">Hash SHA-256</p>
                    <p className="text-xs font-mono bg-white p-2 rounded border break-all">{blockchainSignature.hash}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">Data/Hora da Assinatura</p>
                    <p className="text-sm">{blockchainSignature.timestamp}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">ID da Transação</p>
                    <p className="text-xs font-mono">{blockchainSignature.txId}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">Rede Blockchain</p>
                    <p className="text-sm">{blockchainSignature.network}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">IP do Signatário</p>
                    <p className="text-sm">{blockchainSignature.ipAddress}</p>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center p-4 bg-white rounded border">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-3">QR Code de Verificação</p>
                  <QRCodeSVG value={verificationUrl} size={120} level="M" includeMargin={true} />
                  <p className="text-xs text-gray-500 mt-2 text-center">Escaneie para verificar</p>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-4 italic text-center">
                Este documento foi assinado eletronicamente e possui validade jurídica conforme Lei 14.063/2020 e MP 2.200-2/2001.
              </p>
              <p className="text-xs text-blue-700 mt-2 text-center font-medium">
                Verifique a autenticidade em: {getCurrentHost()}/verificar-contrato
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-100 px-8 py-4 border-t text-center text-xs text-gray-500">
        <p>WebMarcas Intelligence PI - CNPJ: 39.528.012/0001-29</p>
        <p>Av. Brigadeiro Luís Antônio, 2696 - São Paulo - SP, CEP: 01402-000</p>
        <p>Tel: (11) 91112-0225 | juridico@webpatentes.com.br</p>
      </div>
    </div>
  );
}

// Convert image to base64 for PDF generation
export async function getSignatureBase64(): Promise<string> {
  try {
    const response = await fetch(davilysSignature);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

// Helper function to convert imported logo to base64
export async function getLogoBase64ForPDF(): Promise<string> {
  try {
    const response = await fetch(webmarcasLogo);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result && result.startsWith('data:')) {
          resolve(result);
        } else {
          reject(new Error('Invalid base64 result'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

// Embedded fallback logo SVG
const WEBMARCAS_LOGO_FALLBACK = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgNTAiPjxyZWN0IGZpbGw9IiMxZTNhNWYiIHdpZHRoPSIyMDAiIGhlaWdodD0iNTAiLz48dGV4dCB4PSIxMCIgeT0iMzUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNmZmYiPldlYk1hcmNhczwvdGV4dD48L3N2Zz4=';

/** Gera o bloco HTML de certificação blockchain para injetar em qualquer contrato */
function buildBlockchainCertificationHtml(sig: BlockchainSignature, verificationBase: string): string {
  const verifyUrl = `${verificationBase}/verificar-contrato?hash=${sig.hash}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(verifyUrl)}`;
  return `
  <div style="margin-top:32px;page-break-inside:avoid;">
    <div style="text-align:center;padding:16px 0;border-top:1px solid #e5e7eb;font-size:10px;color:#6b7280;">
      <p>Contrato gerado e assinado eletronicamente pelo sistema WebMarcas</p>
      <p>www.webpatentes.com.br | juridico@webpatentes.com.br</p>
      <p>Data e hora da geração: ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    <div style="height:4px;background:#0284c7;margin:16px 0;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
    <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <div style="width:32px;height:32px;background:#0284c7;border-radius:50%;display:flex;align-items:center;justify-content:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <h3 style="font-size:18px;font-weight:bold;color:#0284c7;margin:0;">CERTIFICAÇÃO DIGITAL E VALIDADE JURÍDICA</h3>
      </div>
      <div style="display:flex;gap:24px;align-items:flex-start;">
        <div style="flex:1;">
          <p style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:#1e293b;margin-bottom:6px;">HASH SHA-256</p>
          <div style="background:white;padding:12px;border-radius:4px;border:1px solid #e2e8f0;font-family:monospace;font-size:10px;word-break:break-all;color:#1e293b;margin-bottom:16px;">${sig.hash}</div>
          ${sig.timestamp ? `<p style="font-size:11px;font-weight:bold;text-transform:uppercase;color:#1e293b;margin-bottom:4px;">DATA/HORA DA ASSINATURA</p><p style="font-size:13px;color:#1e293b;margin-bottom:16px;">${sig.timestamp}</p>` : ''}
          ${sig.txId ? `<p style="font-size:11px;font-weight:bold;text-transform:uppercase;color:#1e293b;margin-bottom:4px;">ID DA TRANSAÇÃO</p><p style="font-size:12px;font-family:monospace;color:#1e293b;word-break:break-all;margin-bottom:16px;">${sig.txId}</p>` : ''}
          <p style="font-size:11px;font-weight:bold;text-transform:uppercase;color:#1e293b;margin-bottom:4px;">REDE BLOCKCHAIN</p>
          <p style="font-size:13px;color:#1e293b;margin-bottom:16px;">${sig.network || 'Bitcoin (OpenTimestamps via a.pool.opentimestamps.org)'}</p>
          ${sig.ipAddress ? `<p style="font-size:11px;font-weight:bold;text-transform:uppercase;color:#1e293b;margin-bottom:4px;">IP DO SIGNATÁRIO</p><p style="font-size:13px;color:#1e293b;">${sig.ipAddress}</p>` : ''}
        </div>
        <div style="flex-shrink:0;text-align:center;padding:16px;background:white;border-radius:8px;border:1px solid #e2e8f0;">
          <p style="font-size:11px;font-weight:bold;text-transform:uppercase;color:#1e293b;margin-bottom:12px;">QR CODE DE VERIFICAÇÃO</p>
          <img src="${qrUrl}" alt="QR Code" style="width:140px;height:140px;" />
          <p style="font-size:10px;color:#64748b;margin-top:8px;">Escaneie para verificar</p>
        </div>
      </div>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="font-size:11px;color:#64748b;font-style:italic;">Este documento foi assinado eletronicamente e possui validade jurídica conforme Lei 14.063/2020 e MP 2.200-2/2001.</p>
        <p style="font-size:11px;color:#0284c7;margin-top:8px;">Verifique a autenticidade em: ${verifyUrl}</p>
      </div>
    </div>
  </div>`;
}

export function generateDocumentPrintHTML(
  documentType: 'procuracao' | 'distrato_multa' | 'distrato_sem_multa' | 'contract',
  content: string,
  clientSignature: string | null,
  blockchainSignature?: BlockchainSignature,
  signatoryName?: string,
  signatoryCpf?: string,
  signatoryCnpj?: string,
  davilysSignatureBase64?: string,
  baseUrl?: string,
  logoBase64?: string
): string {
  const verificationBase = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://webpatentes.com.br');

  // Se for um HTML completo salvo, injetar a seção de certificação se o contrato estiver assinado
  const trimmed = content.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
    if (blockchainSignature?.hash) {
      const certificationSection = buildBlockchainCertificationHtml(blockchainSignature, verificationBase);
      // Check if certification already exists in the HTML to avoid duplicates
      if (!trimmed.includes('CERTIFICAÇÃO DIGITAL E VALIDADE JURÍDICA') && trimmed.includes('</body>')) {
        return trimmed.replace('</body>', `${certificationSection}</body>`);
      }
    }
    return trimmed;
  }

  // Format plain text content as HTML
  const cleanedContent = content.replace(/\{contract_signature\}/g, '').trim();
  const isHtmlContent = cleanedContent.includes('<') && cleanedContent.includes('>') &&
    (cleanedContent.includes('<p') || cleanedContent.includes('<div') || cleanedContent.includes('<span'));

  const formatAsHtml = (text: string): string => {
    return text.split('\n').map(line => {
      const t = line.trim();
      if (!t) return '<div style="height: 8px;"></div>';
      if (t.includes('CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS')) return '';
      if (/^\d+\.\s*CLÁUSULA/.test(t)) return `<h2 style="font-weight:bold;font-size:12px;color:#0284c7;margin-top:20px;margin-bottom:8px;">${t}</h2>`;
      if (/^\d+\.\d+\s/.test(t)) return `<p style="font-size:11px;margin-bottom:8px;padding-left:16px;">${t}</p>`;
      if (/^[a-z]\)/.test(t)) return `<p style="font-size:11px;margin-bottom:4px;padding-left:32px;">${t}</p>`;
      if (t.startsWith('•')) return `<p style="font-size:11px;margin-bottom:8px;padding-left:16px;">${t}</p>`;
      if (/^I+\)/.test(t)) return `<p style="font-size:11px;margin-bottom:12px;font-weight:500;">${t}</p>`;
      if (t.match(/^_+$/)) return '';
      if (t === 'CONTRATADA:' || t === 'CONTRATANTE:') return `<p style="font-size:11px;font-weight:bold;text-align:center;margin-top:24px;margin-bottom:4px;">${t}</p>`;
      if (t.startsWith('São Paulo,')) return `<p style="font-size:11px;margin-top:24px;margin-bottom:24px;">${t}</p>`;
      return `<p style="font-size:11px;margin-bottom:12px;line-height:1.6;">${t}</p>`;
    }).join('\n');
  };

  const htmlContent = isHtmlContent ? cleanedContent : formatAsHtml(cleanedContent);
  const logoSrc = logoBase64 || WEBMARCAS_LOGO_FALLBACK;

  // Build the header section per document type (matching ContractRenderer standard templates)
  let headerSection = '';
  if (documentType === 'procuracao') {
    headerSection = `
    <h1 class="main-title" style="text-decoration: none;">PROCURAÇÃO PARA REPRESENTAÇÃO JUNTO AO INPI</h1>
    <p style="text-align: center; color: #4B5563; font-size: 14px; font-style: italic; margin-bottom: 24px;">Instrumento Particular de Procuração para fins de Registro de Marca</p>
    <div class="highlight-box">
      <p>Pelo presente instrumento particular de PROCURAÇÃO, o(a) outorgante abaixo identificado(a) nomeia e constitui como seu bastante PROCURADOR o(a) Sr(a). Davilys Danques de Oliveira Cunha, para representá-lo(a) de forma exclusiva junto ao INSTITUTO NACIONAL DA PROPRIEDADE INDUSTRIAL – INPI, podendo praticar todos os atos necessários, legais e administrativos relacionados ao pedido, acompanhamento, defesa e manutenção do registro de marca, inclusive apresentação de requerimentos, cumprimento de exigências, interposição de recursos e recebimento de notificações.</p>
    </div>`;
  } else if (documentType === 'distrato_multa' || documentType === 'distrato_sem_multa') {
    headerSection = `
    <h1 class="main-title">DISTRATO</h1>
    <div class="contract-title-box">
      <p>DISTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORAMENTO<br/>PARA REGISTRO DE MARCA JUNTO AO INPI</p>
    </div>
    <div class="highlight-box">
      <p>Os termos deste instrumento aplicam-se exclusivamente à formalização do cancelamento de contratações realizadas mediante negociações personalizadas, conduzidas diretamente com a equipe comercial da WebMarcas Intelligence PI.</p>
      <p style="margin-top: 12px;">O presente distrato estabelece as condições para encerramento da relação contratual anteriormente firmada, estando vinculado ao "Contrato de Prestação de Serviços e Gestão de Pagamentos e Outras Avenças", cujo aceite integral ocorreu no momento do envio da Proposta.</p>
    </div>`;
  } else {
    // contract (default)
    headerSection = `
    <h1 class="main-title">CONTRATO</h1>
    <div class="contract-title-box">
      <p>CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS DE ASSESSORAMENTO<br/>PARA REGISTRO DE MARCA JUNTO AO INPI</p>
    </div>
    <div class="highlight-box">
      <p>Os termos deste instrumento aplicam-se apenas a contratações com negociações personalizadas, tratadas diretamente com a equipe comercial da Web Marcas e Patentes Eireli.</p>
      <p style="margin-top: 12px;">Os termos aqui celebrados são adicionais ao "Contrato de Prestação de Serviços e Gestão de Pagamentos e Outras Avenças" com aceite integral no momento do envio da Proposta.</p>
    </div>`;
  }

  const documentTitle = documentType === 'procuracao'
    ? 'PROCURAÇÃO PARA REPRESENTAÇÃO JUNTO AO INPI'
    : documentType === 'distrato_multa' || documentType === 'distrato_sem_multa'
    ? 'DISTRATO'
    : 'CONTRATO';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${documentTitle} - WebMarcas</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 210mm; min-height: 297mm; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1f2937; background: white; padding: 30px; font-size: 11px; max-width: 210mm; margin: 0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; }
    .header-logo { height: 48px; width: auto; object-fit: contain; }
    .header-url { color: #0284c7; font-weight: 600; font-size: 14px; }
    .gradient-bar { height: 8px; width: 100%; background: linear-gradient(90deg, #f97316, #fbbf24); border-radius: 3px; margin-bottom: 24px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .main-title { text-align: center; color: #0284c7; font-size: 20px; font-weight: bold; margin-bottom: 16px; text-decoration: underline; }
    .contract-title-box { background-color: #1e3a5f; color: white; text-align: center; padding: 14px 20px; border-radius: 6px; margin-bottom: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .contract-title-box p { font-weight: 600; font-size: 13px; line-height: 1.5; margin: 0; color: white; }
    .highlight-box { background-color: #FEF9E7; padding: 16px 20px; margin-bottom: 24px; border-left: 4px solid #F59E0B; font-size: 12px; line-height: 1.6; color: #374151; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .content { margin-top: 20px; color: #1f2937; }
    .content h2 { color: #0284c7; font-size: 13px; font-weight: bold; margin-top: 24px; margin-bottom: 10px; }
    .content p { color: #1f2937; font-size: 11px; line-height: 1.7; margin-bottom: 10px; text-align: justify; }
    .signatures-section { margin-top: 48px; padding-top: 32px; border-top: 1px solid #e5e7eb; page-break-inside: avoid; }
    .signatures-intro { font-size: 11px; color: #4b5563; margin-bottom: 32px; }
    .signatures-grid { display: flex; gap: 32px; justify-content: center; }
    .signature-col { flex: 1; text-align: center; max-width: 280px; }
    .signature-col .sig-label { font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #1f2937; }
    .signature-col .sig-details { font-size: 10px; color: #4b5563; margin-bottom: 16px; min-height: 32px; }
    .signature-col .sig-box { border-bottom: 2px solid #1f2937; padding-bottom: 8px; min-height: 64px; display: flex; align-items: center; justify-content: center; margin: 0 auto; width: 240px; }
    .signature-col .sig-box img { max-height: 56px; object-fit: contain; }
    .sig-digital { color: #0284c7; font-weight: 500; font-size: 12px; }
    .sig-waiting { color: #9ca3af; font-style: italic; font-size: 11px; }
    .sig-footnote { font-size: 9px; color: #6b7280; margin-top: 8px; }
    .footer { margin-top: 40px; text-align: center; color: #6b7280; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    @media print {
      .gradient-bar { background: linear-gradient(90deg, #f97316, #fbbf24) !important; }
      .contract-title-box { background-color: #1e3a5f !important; }
      .highlight-box { background-color: #FEF9E7 !important; border-left: 4px solid #F59E0B !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="${logoSrc}" alt="WebMarcas" class="header-logo" />
    <span class="header-url">www.webpatentes.com.br</span>
  </div>
  <div class="gradient-bar"></div>
  ${headerSection}
  <div class="content">
    ${htmlContent}
  </div>
  
  <!-- Seção de Assinaturas -->
  <div class="signatures-section">
    <p class="signatures-intro">Por estarem justas e contratadas, as partes assinam o presente de igual teor e forma, de forma digital válido juridicamente.</p>
    <div class="signatures-grid">
      <div class="signature-col">
        <p class="sig-label">Assinatura autorizada:</p>
        <p class="sig-details">WebMarcas Intelligence PI - CNPJ/MF sob o nº 39.528.012/0001-29</p>
        <div class="sig-box">
          ${documentType === 'procuracao' && davilysSignatureBase64
            ? `<img src="${davilysSignatureBase64}" alt="Assinatura WebMarcas" />`
            : `<span class="sig-digital">✓ Assinado Digitalmente</span>`
          }
        </div>
        <p class="sig-footnote">${documentType === 'procuracao' ? 'Davilys Danques de Oliveira Cunha' : 'Certificação Digital - Lei 14.063/2020'}</p>
      </div>
      <div class="signature-col">
        <p class="sig-label">Contratante:</p>
        <p class="sig-details">${signatoryName || 'Nome do Representante'}${signatoryCnpj ? ` - CNPJ sob o nº ${signatoryCnpj}` : ''}${signatoryCpf ? `, CPF sob o nº ${signatoryCpf}` : ''}</p>
        <div class="sig-box">
          ${clientSignature
            ? `<img src="${clientSignature}" alt="Assinatura do Cliente" />`
            : blockchainSignature?.hash
              ? `<span class="sig-digital">✓ Assinado Digitalmente</span>`
              : `<span class="sig-waiting">Aguardando assinatura...</span>`
          }
        </div>
        <p class="sig-footnote">${blockchainSignature?.hash ? 'Certificação Digital - Lei 14.063/2020' : ''}</p>
      </div>
    </div>
  </div>

  ${blockchainSignature?.hash ? buildBlockchainCertificationHtml(blockchainSignature, verificationBase) : `
  <div class="footer">
    <p>WebMarcas Intelligence PI - CNPJ: 39.528.012/0001-29</p>
    <p>Av. Brigadeiro Luís Antônio, 2696 - São Paulo - SP | Tel: (11) 91112-0225 | juridico@webmarcas.net</p>
  </div>
  `}
</body>
</html>`;
}

export default DocumentRenderer;
