-- Criar tabela de templates de notificação
CREATE TABLE public.notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  category TEXT NOT NULL DEFAULT 'geral',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Habilitar RLS
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para admins
CREATE POLICY "Admins can manage notification templates"
ON public.notification_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_notification_templates_updated_at
BEFORE UPDATE ON public.notification_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir templates padrão de Cobrança Extrajudicial
INSERT INTO public.notification_templates (name, title, message, type, category) VALUES
('Cobrança - Fatura Vencida', 'Fatura Vencida - Ação Necessária', 'Prezado(a) cliente, identificamos que sua fatura encontra-se vencida. Solicitamos a regularização do pagamento para evitar a suspensão dos serviços. Em caso de dúvidas, entre em contato conosco.', 'warning', 'cobranca'),
('Cobrança - Atraso de Pagamento', 'Aviso de Atraso - Segunda Notificação', 'Prezado(a) cliente, esta é nossa segunda notificação referente ao atraso no pagamento. Pedimos que regularize sua situação financeira o mais breve possível para evitar medidas adicionais.', 'warning', 'cobranca'),
('Cobrança - Protesto', 'Aviso de Protesto - Última Notificação', 'Prezado(a) cliente, informamos que devido ao não pagamento da fatura, seu título será encaminhado para protesto em cartório. Para evitar esta medida, efetue o pagamento imediatamente.', 'error', 'cobranca');

-- Inserir templates padrão de Exigências INPI
INSERT INTO public.notification_templates (name, title, message, type, category) VALUES
('INPI - Prazo 60 dias', 'Exigência INPI - Prazo de 60 dias', 'Prezado(a) cliente, informamos que foi publicada uma exigência do INPI referente ao seu processo de marca. Você tem 60 dias para cumprir a exigência. Nossa equipe já está trabalhando na resposta.', 'info', 'inpi'),
('INPI - Prazo 30 dias', 'Exigência INPI - Restam 30 dias', 'Prezado(a) cliente, lembramos que restam 30 dias para cumprimento da exigência do INPI referente ao seu processo de marca. Por favor, verifique se há pendências de sua parte.', 'warning', 'inpi'),
('INPI - Prazo 15 dias', 'Exigência INPI - Restam 15 dias (Urgente)', 'URGENTE: Prezado(a) cliente, restam apenas 15 dias para cumprimento da exigência do INPI. Caso haja alguma pendência de documentação, solicitamos envio imediato para evitar arquivamento.', 'warning', 'inpi'),
('INPI - Vencimento Hoje', 'Exigência INPI - Prazo Vence Hoje!', 'ATENÇÃO: O prazo para cumprimento da exigência do INPI vence HOJE. Se houver qualquer pendência de sua parte, entre em contato imediatamente. Após esta data, o processo poderá ser arquivado.', 'error', 'inpi');