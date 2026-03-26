import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, Zap, Edit, Eye, Save, Copy, CheckCircle2, 
  Clock, FileSignature, UserPlus, CreditCard, AlertCircle,
  Variable, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmailAnalyticsDashboard } from './EmailAnalyticsDashboard';
import { BarChart3 } from 'lucide-react';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  trigger_event: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

const triggerConfig: Record<string, { label: string; description: string; icon: any; color: string }> = {
  form_started: {
    label: 'Boas-Vindas',
    description: 'Enviado quando um lead preenche o formulário',
    icon: Mail,
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
  },
  form_abandoned: {
    label: 'Follow-up 24h',
    description: 'Enviado após 24h se o formulário não foi concluído',
    icon: Clock,
    color: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
  },
  contract_signed: {
    label: 'Confirmação de Contrato',
    description: 'Enviado imediatamente após assinatura do contrato',
    icon: FileSignature,
    color: 'bg-green-500/10 text-green-500 border-green-500/20'
  },
  user_created: {
    label: 'Credenciais de Acesso',
    description: 'Enviado quando o usuário é criado no sistema',
    icon: UserPlus,
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
  },
  payment_received: {
    label: 'Confirmação de Pagamento',
    description: 'Enviado quando o pagamento é confirmado',
    icon: CreditCard,
    color: 'bg-sky-500/10 text-sky-500 border-sky-500/20'
  },
  signature_request: {
    label: 'Link de Assinatura',
    description: 'Enviado quando o link de assinatura é gerado para o cliente',
    icon: FileSignature,
    color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
  }
};

const availableVariables = [
  { key: '{{nome}}', alias: '{{nome_cliente}}', description: 'Nome do cliente/lead' },
  { key: '{{email}}', alias: null, description: 'E-mail do cliente' },
  { key: '{{marca}}', alias: '{{nome_marca}}', description: 'Nome da marca' },
  { key: '{{data_assinatura}}', alias: null, description: 'Data de assinatura do contrato' },
  { key: '{{hash_contrato}}', alias: null, description: 'Hash blockchain do contrato' },
  { key: '{{link_area_cliente}}', alias: '{{login_url}}', description: 'Link para área do cliente' },
  { key: '{{senha}}', alias: null, description: 'Senha temporária (apenas user_created)' },
  { key: '{{numero_processo}}', alias: null, description: 'Número do processo INPI' },
  { key: '{{link_assinatura}}', alias: null, description: 'Link para assinatura do documento' },
  { key: '{{data_expiracao}}', alias: null, description: 'Data de expiração do link' },
  { key: '{{documento_tipo}}', alias: null, description: 'Tipo do documento (Contrato, Procuração, etc.)' },
];

export function AutomatedEmailSettings() {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    is_active: true
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ['automated-email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .not('trigger_event', 'is', null)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as EmailTemplate[];
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (template: Partial<EmailTemplate> & { id: string }) => {
      const { error } = await supabase
        .from('email_templates')
        .update({
          name: template.name,
          subject: template.subject,
          body: template.body,
          is_active: template.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', template.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automated-email-templates'] });
      toast.success('Template atualizado com sucesso!');
      setEditingTemplate(null);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar template: ' + error.message);
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('email_templates')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automated-email-templates'] });
      toast.success('Status atualizado!');
    }
  });

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      is_active: template.is_active ?? true
    });
  };

  const handleSave = () => {
    if (!editingTemplate) return;
    updateMutation.mutate({
      id: editingTemplate.id,
      ...formData
    });
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = formData.body.substring(0, start) + variable + formData.body.substring(end);
      setFormData({ ...formData, body: newBody });
    } else {
      setFormData({ ...formData, body: formData.body + variable });
    }
  };

  const copyVariable = (variable: string) => {
    navigator.clipboard.writeText(variable);
    toast.success(`Variável ${variable} copiada!`);
  };

  const renderPreview = (html: string) => {
    // Replace variables with sample data for preview
    const sampleData: Record<string, string> = {
      '{{nome}}': 'João Silva',
      '{{nome_cliente}}': 'João Silva',
      '{{email}}': 'joao@email.com',
      '{{marca}}': 'Minha Marca®',
      '{{nome_marca}}': 'Minha Marca®',
      '{{data_assinatura}}': new Date().toLocaleDateString('pt-BR'),
      '{{hash_contrato}}': 'abc123def456789...',
      '{{link_area_cliente}}': 'https://webmarcas.com/cliente/login',
      '{{login_url}}': 'https://webmarcas.com/cliente/login',
      '{{senha}}': 'Senha@123',
      '{{numero_processo}}': '123456789',
      '{{link_assinatura}}': 'https://webmarcas.net/assinar/abc-123-def',
      '{{data_expiracao}}': new Date(Date.now() + 7 * 86400000).toLocaleDateString('pt-BR'),
      '{{documento_tipo}}': 'Contrato',
    };

    let preview = html;
    Object.entries(sampleData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });
    return preview;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">E-mails Relatórios</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os templates e acompanhe o desempenho dos e-mails automáticos
          </p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <Mail className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <EmailAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="templates">
          <div className="space-y-6">

      {/* Resend Info Card */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-primary">Serviço de Envio: Resend</p>
          <p className="text-muted-foreground mt-1">
            Os e-mails automáticos são enviados pelo serviço <strong>Resend</strong>, configurado na aba{' '}
            <strong>Configurações → Integrações</strong>. O remetente é sempre{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">noreply@webmarcas.net</code>{' '}
            (domínio verificado no Resend).
          </p>
        </div>
      </div>

      {/* Info Alert */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-blue-500">Sincronização Automática</p>
          <p className="text-blue-500/80 mt-1">
            Todas as alterações são aplicadas imediatamente. O próximo e-mail enviado já utilizará o novo conteúdo.
          </p>
        </div>
      </div>

      {/* Templates List */}
      <div className="grid gap-4">
        {templates?.map((template, index) => {
          const config = triggerConfig[template.trigger_event || ''];
          const TriggerIcon = config?.icon || Mail;

          return (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="group hover:shadow-lg transition-all duration-300 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Icon */}
                      <div className={cn(
                        "p-3 rounded-xl border shrink-0",
                        config?.color || "bg-muted text-muted-foreground"
                      )}>
                        <TriggerIcon className="h-5 w-5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{template.name}</h3>
                          <Badge 
                            variant={template.is_active ? "default" : "secondary"}
                            className={cn(
                              "text-[10px] h-5",
                              template.is_active 
                                ? "bg-green-500/10 text-green-500 border-green-500/20" 
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {template.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {config?.description || 'Gatilho automático'}
                        </p>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Assunto:</span>{' '}
                          <span className="font-medium">{template.subject}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={template.is_active ?? false}
                        onCheckedChange={(checked) => 
                          toggleActiveMutation.mutate({ id: template.id, is_active: checked })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPreviewTemplate(template)}
                        className="h-9 w-9"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(template)}
                        className="gap-1.5"
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {(!templates || templates.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum template de e-mail automático encontrado.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Editar Template: {editingTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate?.trigger_event && triggerConfig[editingTemplate.trigger_event]?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <div className="grid md:grid-cols-3 gap-6 h-full">
              {/* Form */}
              <div className="md:col-span-2 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Nome do Template</Label>
                  <Input
                    id="template-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-subject">Assunto do E-mail</Label>
                  <Input
                    id="template-subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Use variáveis como {{nome}} ou {{marca}}"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-body">Corpo do E-mail (HTML)</Label>
                  <Textarea
                    id="template-body"
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="Digite o HTML do e-mail..."
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="template-active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label htmlFor="template-active">Template ativo</Label>
                  </div>

                  <Button onClick={handleSave} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar Alterações
                  </Button>
                </div>
              </div>

              {/* Variables Panel */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <Variable className="h-4 w-4" />
                    Variáveis Disponíveis
                  </h4>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-2">
                      {availableVariables.map((v) => (
                        <div
                          key={v.key}
                          className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              {v.key}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyVariable(v.key)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => insertVariable(v.key)}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                            </Button>
                          </div>
                          {v.alias && (
                            <p className="text-[10px] text-muted-foreground mb-1">
                              Alias: <code>{v.alias}</code>
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">{v.description}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Prévia: {previewTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Visualize como o e-mail será exibido para o cliente (com dados de exemplo)
            </DialogDescription>
          </DialogHeader>

          <Separator />

          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/30 border">
              <p className="text-sm">
                <strong>Assunto:</strong>{' '}
                {previewTemplate && renderPreview(previewTemplate.subject)}
              </p>
            </div>

            <ScrollArea className="h-[500px] border rounded-lg">
              {previewTemplate && (
                <div 
                  className="p-4"
                  dangerouslySetInnerHTML={{ 
                    __html: renderPreview(previewTemplate.body) 
                  }} 
                />
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
