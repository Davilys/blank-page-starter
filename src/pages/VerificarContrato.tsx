import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle, XCircle, Search, Hash, Lock, Globe, Clock, FileText, ExternalLink, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import webmarcasLogo from '@/assets/webmarcas-logo-new.png';
import { supabase } from '@/integrations/supabase/client';

interface ContractVerification {
  found: boolean;
  contractNumber?: string;
  signedAt?: string;
  network?: string;
  brandName?: string;
}

interface VerifyResult {
  contract_number: string | null;
  blockchain_hash: string | null;
  blockchain_tx_id: string | null;
  blockchain_network: string | null;
  blockchain_timestamp: string | null;
  signed_at: string | null;
  subject: string | null;
}

export default function VerificarContrato() {
  const [searchParams] = useSearchParams();
  const [hash, setHash] = useState(searchParams.get('hash') || '');
  const [isSearching, setIsSearching] = useState(false);
  const [verification, setVerification] = useState<ContractVerification | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Auto-search if hash is in URL
  useEffect(() => {
    const urlHash = searchParams.get('hash');
    if (urlHash && urlHash.length === 64) {
      setHash(urlHash);
      handleVerify(urlHash);
    }
  }, [searchParams]);

  const handleVerify = async (searchHash?: string) => {
    const hashToSearch = searchHash || hash;
    if (!hashToSearch || hashToSearch.length !== 64) {
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      // Use security definer function to verify without exposing sensitive data
      const { data, error } = await supabase
        .rpc('verify_contract_by_hash', { p_hash: hashToSearch });

      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setVerification({ found: false });
      } else {
        const contract = Array.isArray(data) ? data[0] : data;
        setVerification({
          found: true,
          contractNumber: contract.contract_number || undefined,
          signedAt: contract.blockchain_timestamp || contract.signed_at || undefined,
          network: contract.blockchain_network || 'Bitcoin (OpenTimestamps)',
          brandName: contract.subject || undefined,
        });
      }
    } catch (err) {
      console.error('Verification error:', err);
      setVerification({ found: false });
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownloadOTS = () => {
    if (verification?.otsFileUrl) {
      window.open(verification.otsFileUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100">
      {/* Header */}
      <header className="bg-white border-b border-sky-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src={webmarcasLogo} alt="WebMarcas" className="h-10" />
          </a>
          <span className="text-sm text-sky-600 font-medium">
            Verificação de Contratos
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Title Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-sky-100 rounded-full mb-4">
            <Shield className="h-10 w-10 text-sky-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Verificação de Autenticidade de Contrato
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Insira o hash SHA-256 do contrato para verificar sua autenticidade e integridade. 
            Contratos assinados digitalmente pelo sistema WebMarcas são registrados em blockchain 
            para garantir prova irrefutável de existência e data.
          </p>
        </div>

        {/* Search Card */}
        <Card className="mb-8 border-sky-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sky-800">
              <Search className="h-5 w-5" />
              Verificar Contrato
            </CardTitle>
            <CardDescription>
              Digite ou cole o hash SHA-256 de 64 caracteres do contrato
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Ex: a1b2c3d4e5f6..."
                  value={hash}
                  onChange={(e) => setHash(e.target.value.toLowerCase().replace(/[^a-f0-9]/g, ''))}
                  className="pl-10 font-mono text-sm"
                  maxLength={64}
                />
              </div>
              <Button 
                onClick={() => handleVerify()}
                disabled={hash.length !== 64 || isSearching}
                className="bg-sky-600 hover:bg-sky-700"
              >
                {isSearching ? 'Verificando...' : 'Verificar'}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {hash.length}/64 caracteres
            </p>
          </CardContent>
        </Card>

        {/* Results */}
        {hasSearched && verification && (
          <Card className={`border-2 ${verification.found ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
            <CardContent className="pt-6">
              {verification.found ? (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-green-100 rounded-full">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-green-800">Contrato Verificado!</h3>
                      <p className="text-green-700">Este documento é autêntico e está registrado em nosso sistema.</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-5 border border-green-200 space-y-4">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Informações do Contrato
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {verification.contractNumber && (
                        <div>
                          <span className="text-gray-500">Número do Contrato:</span>
                          <p className="font-medium">{verification.contractNumber}</p>
                        </div>
                      )}
                      {verification.brandName && (
                        <div>
                          <span className="text-gray-500">Marca:</span>
                          <p className="font-medium">{verification.brandName}</p>
                        </div>
                      )}
                      {verification.clientName && (
                        <div>
                          <span className="text-gray-500">Cliente:</span>
                          <p className="font-medium">{verification.clientName}</p>
                        </div>
                      )}
                      {verification.signedAt && (
                        <div>
                          <span className="text-gray-500">Data/Hora da Assinatura:</span>
                          <p className="font-medium">{new Date(verification.signedAt).toLocaleString('pt-BR')}</p>
                        </div>
                      )}
                      {verification.ipAddress && (
                        <div>
                          <span className="text-gray-500">IP do Signatário:</span>
                          <p className="font-medium font-mono text-xs">{verification.ipAddress}</p>
                        </div>
                      )}
                      {verification.network && (
                        <div>
                          <span className="text-gray-500">Rede Blockchain:</span>
                          <p className="font-medium">{verification.network}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t">
                      <span className="text-gray-500 text-sm">Hash SHA-256:</span>
                      <p className="font-mono text-xs break-all bg-gray-100 p-2 rounded mt-1">{hash}</p>
                    </div>

                    {verification.signedPdfUrl && (
                      <div className="pt-4 border-t">
                        <a 
                          href={verification.signedPdfUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                            <Download className="h-4 w-4 mr-2" />
                            Baixar Contrato Assinado (PDF)
                          </Button>
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 p-4 bg-sky-50 rounded-lg border border-sky-200">
                    <h4 className="font-semibold text-sky-800 mb-3 flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Camadas de Segurança Aplicadas
                    </h4>
                    <ul className="text-sm text-sky-700 space-y-2">
                      <li className="flex items-start gap-2">
                        <Hash className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span><strong>Hash SHA-256</strong> – Integridade do documento verificada</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span><strong>Registro em Blockchain</strong> – Prova imutável via OpenTimestamps</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Globe className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span><strong>Rastreamento de IP</strong> – Dispositivo identificado</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span><strong>Timestamp</strong> – Data e hora registradas com precisão</span>
                      </li>
                    </ul>
                  </div>

                  {/* OTS File Download and OpenTimestamps Verification */}
                  <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Verificação Independente no Blockchain
                    </h4>
                    <p className="text-sm text-amber-700 mb-4">
                      Você pode verificar a autenticidade deste documento de forma independente no site oficial do OpenTimestamps:
                    </p>
                    
                    <div className="space-y-3">
                      {verification.otsFileUrl && (
                        <Button 
                          variant="outline" 
                          className="w-full border-amber-400 text-amber-700 hover:bg-amber-100"
                          onClick={handleDownloadOTS}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Baixar Arquivo de Prova (.ots)
                        </Button>
                      )}
                      
                      <a 
                        href="https://opentimestamps.org" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Button 
                          variant="default" 
                          className="w-full bg-amber-600 hover:bg-amber-700"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Verificar no OpenTimestamps.org
                        </Button>
                      </a>
                      
                      <p className="text-xs text-amber-600 text-center">
                        {verification.otsFileUrl 
                          ? "Baixe o arquivo .ots e arraste-o para o site OpenTimestamps para verificação independente"
                          : "A prova blockchain está pendente de confirmação. Tente novamente em alguns minutos."
                        }
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center p-3 bg-red-100 rounded-full mb-4">
                    <XCircle className="h-10 w-10 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-red-800 mb-2">Contrato Não Encontrado</h3>
                  <p className="text-red-700 max-w-md mx-auto">
                    Não foi possível localizar um contrato com este hash em nosso sistema. 
                    Verifique se o hash foi digitado corretamente.
                  </p>
                  <p className="text-sm text-red-600 mt-4">
                    Se você acredita que isso é um erro, entre em contato: juridico@webmarcas.net
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info Section */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p className="mb-2">
            Este sistema de verificação utiliza tecnologia blockchain para garantir a autenticidade dos contratos.
          </p>
          <p>
            Dúvidas? Entre em contato: <a href="mailto:juridico@webmarcas.net" className="text-sky-600 hover:underline">juridico@webmarcas.net</a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-sky-200 py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} WebMarcas. Todos os direitos reservados.</p>
          <p className="mt-1">
            <a href="https://www.webmarcas.net" className="text-sky-600 hover:underline">www.webmarcas.net</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
