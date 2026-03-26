import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Upload, X, FileText, FileSpreadsheet, Loader2, Wand2, CheckCircle, AlertCircle, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ContractType {
  id: string;
  name: string;
}

interface TemplateUploaderProps {
  contractTypes: ContractType[];
  onTemplateCreated: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_VARIABLES = [
  { key: '{{nome_cliente}}', label: 'Nome do Cliente' },
  { key: '{{cpf_cnpj}}', label: 'CPF/CNPJ' },
  { key: '{{endereco}}', label: 'Endereço' },
  { key: '{{cidade}}', label: 'Cidade' },
  { key: '{{estado}}', label: 'Estado' },
  { key: '{{cep}}', label: 'CEP' },
  { key: '{{email}}', label: 'E-mail' },
  { key: '{{telefone}}', label: 'Telefone' },
  { key: '{{marca}}', label: 'Nome da Marca' },
  { key: '{{valor}}', label: 'Valor do Contrato' },
  { key: '{{data}}', label: 'Data Atual' },
  { key: '{{data_inicio}}', label: 'Data de Início' },
  { key: '{{data_fim}}', label: 'Data Final' },
  { key: '{{numero_contrato}}', label: 'Número do Contrato' },
];

type Step = 'upload' | 'processing' | 'edit' | 'saving';

export function TemplateUploader({ contractTypes, onTemplateCreated, open, onOpenChange }: TemplateUploaderProps) {
  const [step, setStep] = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    contract_type_id: '',
    is_active: true,
  });
  
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setProgress(0);
    setProcessingStatus('');
    setFormData({
      name: '',
      content: '',
      contract_type_id: '',
      is_active: true,
    });
    setDetectedVariables([]);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  }, []);

  const validateAndSetFile = (file: File) => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    
    const validExtensions = ['.pdf', '.xlsx', '.xls', '.docx', '.doc'];
    const fileName = file.name.toLowerCase();
    const isValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!validTypes.includes(file.type) && !isValidExtension) {
      toast.error('Formato inválido. Use PDF, Excel (.xlsx, .xls) ou Word (.docx, .doc)');
      return;
    }

    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeBytes) {
      toast.error('Arquivo muito grande. Máximo: 10MB');
      return;
    }

    setFile(file);
    // Set default name from file name
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    setFormData(prev => ({ ...prev, name: baseName }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setStep('processing');
    setProgress(10);
    setProcessingStatus('Enviando arquivo...');

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      setProgress(30);
      setProcessingStatus('Extraindo conteúdo do documento...');

      const { data, error } = await supabase.functions.invoke('extract-document-content', {
        body: formDataUpload,
      });

      if (error) throw error;

      setProgress(70);
      setProcessingStatus('Processando com IA...');

      await new Promise(resolve => setTimeout(resolve, 500));

      setProgress(90);
      setProcessingStatus('Finalizando...');

      if (data.success) {
        setFormData(prev => ({
          ...prev,
          content: data.content,
        }));
        setDetectedVariables(data.variables || []);
        
        setProgress(100);
        setProcessingStatus('Documento processado!');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        setStep('edit');
        toast.success('Documento processado! Revise e edite o modelo.');
      } else {
        throw new Error(data.error || 'Erro ao processar documento');
      }

    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Erro ao processar o arquivo. Tente novamente.');
      setStep('upload');
      setProgress(0);
    }
  };

  const insertVariable = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      content: prev.content + variable,
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.content) {
      toast.error('Preencha o nome e conteúdo do modelo');
      return;
    }

    setStep('saving');

    try {
      // Extract variables used in content
      const usedVariables = AVAILABLE_VARIABLES
        .filter(v => formData.content.includes(v.key))
        .map(v => v.key);

      const templateData = {
        name: formData.name,
        content: formData.content,
        contract_type_id: formData.contract_type_id || null,
        is_active: formData.is_active,
        variables: usedVariables,
      };

      const { error } = await supabase
        .from('contract_templates')
        .insert(templateData);

      if (error) throw error;

      toast.success('Modelo criado com sucesso!');
      onTemplateCreated();
      handleClose();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Erro ao salvar modelo');
      setStep('edit');
    }
  };

  const getFileIcon = () => {
    if (!file) return null;
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.pdf')) {
      return <FileText className="h-12 w-12 text-red-500" />;
    }
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return <FileSpreadsheet className="h-12 w-12 text-green-500" />;
    }
    return <FileText className="h-12 w-12 text-blue-500" />;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Modelo de Documento
          </DialogTitle>
          <DialogDescription>
            Faça upload de um PDF ou Excel e o sistema criará um modelo de contrato editável
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "relative flex flex-col items-center justify-center w-full h-48 px-4 transition-all duration-200 border-2 border-dashed rounded-xl cursor-pointer",
                  isDragging 
                    ? "border-primary bg-primary/5 scale-[1.02]" 
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <input
                  type="file"
                  accept=".pdf,.xlsx,.xls,.docx,.doc"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className={cn(
                  "flex flex-col items-center gap-3 transition-transform duration-200",
                  isDragging && "scale-110"
                )}>
                  <div className={cn(
                    "p-4 rounded-full transition-colors",
                    isDragging ? "bg-primary/20" : "bg-muted"
                  )}>
                    <Upload className={cn(
                      "h-8 w-8 transition-colors",
                      isDragging ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-medium">
                      {isDragging ? "Solte o arquivo aqui" : "Arraste um arquivo ou clique para selecionar"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      PDF, Excel (.xlsx, .xls) ou Word (.docx, .doc) - máx. 10MB
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 border rounded-xl bg-muted/30">
                <div className="flex items-center gap-4">
                  {getFileIcon()}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-lg">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="mt-6 flex gap-3">
                  <Button variant="outline" onClick={() => setFile(null)} className="flex-1">
                    Escolher outro arquivo
                  </Button>
                  <Button onClick={processFile} className="flex-1">
                    <Wand2 className="h-4 w-4 mr-2" />
                    Processar com IA
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Processing */}
        {step === 'processing' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              {progress >= 100 && (
                <CheckCircle className="absolute inset-0 h-16 w-16 text-green-500 animate-in fade-in" />
              )}
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">{processingStatus}</p>
              <p className="text-sm text-muted-foreground">
                Aguarde enquanto processamos seu documento
              </p>
            </div>
            <Progress value={progress} className="w-64 h-2" />
          </div>
        )}

        {/* Step: Edit */}
        {step === 'edit' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm text-green-700 dark:text-green-300">
                Documento processado! Revise e edite o modelo abaixo.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Modelo *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Contrato Registro de Marca Padrão"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Contrato</Label>
                <Select
                  value={formData.contract_type_id}
                  onValueChange={(value) => setFormData({ ...formData, contract_type_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {detectedVariables.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                  Variáveis detectadas no documento:
                </p>
                <div className="flex flex-wrap gap-1">
                  {detectedVariables.map(v => (
                    <Badge key={v} variant="secondary" className="text-xs">
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Edit3 className="h-4 w-4" />
                Inserir Variáveis
              </Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARIABLES.map(v => (
                  <Button
                    key={v.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(v.key)}
                  >
                    {v.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Conteúdo do Contrato *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={15}
                placeholder="Conteúdo do modelo de contrato..."
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Modelo ativo</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Salvar Modelo
              </Button>
            </div>
          </div>
        )}

        {/* Step: Saving */}
        {step === 'saving' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Salvando modelo...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
