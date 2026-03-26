import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Trash2, Layout, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  trigger_event: string | null;
  is_active: boolean;
}

const triggerEvents = [
  { value: 'form_started', label: 'Formulário Iniciado' },
  { value: 'form_abandoned', label: 'Formulário Abandonado (24h)' },
  { value: 'form_completed', label: 'Formulário Concluído' },
  { value: 'contract_signed', label: 'Contrato Assinado' },
  { value: 'payment_received', label: 'Pagamento Recebido' },
  { value: 'manual', label: 'Envio Manual' },
];

export function EmailTemplates() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState({
    name: '',
    subject: '',
    body: '',
    trigger_event: 'manual',
    is_active: true,
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  const saveTemplate = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (editingTemplate) {
        const { error } = await supabase
          .from('email_templates')
          .update({
            name: form.name,
            subject: form.subject,
            body: form.body,
            trigger_event: form.trigger_event === 'manual' ? null : form.trigger_event,
            is_active: form.is_active,
          })
          .eq('id', editingTemplate.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert({
            name: form.name,
            subject: form.subject,
            body: form.body,
            trigger_event: form.trigger_event === 'manual' ? null : form.trigger_event,
            is_active: form.is_active,
            created_by: user?.id,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingTemplate ? 'Template atualizado!' : 'Template criado!');
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      handleCloseDialog();
    },
    onError: () => {
      toast.error('Erro ao salvar template');
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Template excluído!');
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    },
    onError: () => {
      toast.error('Erro ao excluir template');
    },
  });

  const handleOpenDialog = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setForm({
        name: template.name,
        subject: template.subject,
        body: template.body,
        trigger_event: template.trigger_event || 'manual',
        is_active: template.is_active,
      });
    } else {
      setEditingTemplate(null);
      setForm({
        name: '',
        subject: '',
        body: '',
        trigger_event: 'manual',
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
    setForm({
      name: '',
      subject: '',
      body: '',
      trigger_event: 'manual',
      is_active: true,
    });
  };

  const getTriggerLabel = (event: string | null) => {
    return triggerEvents.find(e => e.value === event)?.label || 'Envio Manual';
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Templates de Email
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? 'Editar Template' : 'Novo Template'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid gap-2">
                  <Label>Nome do Template</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Boas-vindas, Follow-up..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Assunto</Label>
                  <Input
                    value={form.subject}
                    onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="Assunto do email"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Gatilho Automático</Label>
                  <Select
                    value={form.trigger_event}
                    onValueChange={(value) => setForm(f => ({ ...f, trigger_event: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {triggerEvents.map((event) => (
                        <SelectItem key={event.value} value={event.value}>
                          {event.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Selecione quando este template será enviado automaticamente
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>Corpo do Email</Label>
                  <Textarea
                    value={form.body}
                    onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))}
                    placeholder="Escreva o conteúdo do email..."
                    className="min-h-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Variáveis disponíveis: {"{{nome}}"}, {"{{email}}"}, {"{{marca}}"}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Template Ativo</Label>
                    <p className="text-xs text-muted-foreground">
                      Templates inativos não são enviados automaticamente
                    </p>
                  </div>
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm(f => ({ ...f, is_active: checked }))}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button onClick={() => saveTemplate.mutate()}>
                    {editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : templates && templates.length > 0 ? (
            <div className="divide-y">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{template.name}</h3>
                        <Badge variant={template.is_active ? 'default' : 'secondary'}>
                          {template.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                        {template.trigger_event && (
                          <Badge variant="outline" className="gap-1">
                            <Zap className="h-3 w-3" />
                            {getTriggerLabel(template.trigger_event)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Assunto: {template.subject}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {template.body.slice(0, 150)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(template)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteTemplate.mutate(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Layout className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum template criado</p>
              <p className="text-sm">Crie templates para agilizar o envio de emails</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
