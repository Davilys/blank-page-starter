# Integração do agente de processos — BotConversa FINANCEIRO (8572)

## Objetivo

A ação de serviço no ficheiro do cliente continua a criar a cobrança quando aplicável e a enviar e-mail/notificação do CRM com o tipo original. O WhatsApp dessa ação usa um destino separado, configurado para a companhia BotConversa **FINANCEIRO, ID 8572**. Os demais eventos permanecem na integração BotConversa já existente.

O evento leva apenas o contexto do processo selecionado: nome do cliente, marca, número e etapa do processo, publicação RPI e prazos disponíveis no CRM, além das faturas vinculadas àquele processo. A automação não deve receber todos os dados cadastrais do cliente por padrão.

## Payload do evento

A tela CRM salva o webhook dedicado na configuração `botconversa_service_agent`. Ao acionar “Serviços”, o endpoint envia ao webhook:

- `telefone`, `nome`, `mensagem`: compatíveis com o envelope usado hoje;
- `event_type`, `company_id: "8572"`, `agent_flow: "inpi_process_update"`;
- `process_context`: objeto completo do processo, publicação e faturas vinculadas;
- `conversation_key` e `processo_id`: correlação da conversa com o processo selecionado;
- campos simples para mapear nos campos personalizados do BotConversa: `processo_marca`, `processo_numero`, `processo_etapa`, `processo_data_pub`, `processo_prazo`, `processo_resumo` e `faturas_processo`;
- `next_action`: orientar sobre a movimentação real e propor conversa com o jurídico.

O webhook deve iniciar o fluxo duplicado em FINANCEIRO. O fluxo original “Publicação inicial” e o webhook da outra companhia não devem ser alterados.

## Comportamento do agente

1. Cumprimentar pelo primeiro nome e mencionar somente a movimentação real, marca, número do processo, data da publicação e prazo quando esses dados vierem preenchidos.
2. Responder perguntas do cliente com base no contexto vinculado. Se o dado não estiver disponível, reconhecer isso e encaminhar para o jurídico, sem inventar status, prazo ou valor.
3. Conduzir a conversa para uma reunião obrigatória de orientação jurídica. Oferecer Google Meet ou ligação, registrar o assunto e o horário escolhido.
4. Se houver resposta, adaptar o diálogo ao contexto existente; parar follow-ups após confirmação, recusa definitiva, pedido de atendimento humano, opt-out ou conclusão.
5. Reagendar atualizando o evento de calendário e substituindo lembretes antigos. Confirmar a reunião uma hora antes; a mensagem deve refletir a data e modalidade atuais.
6. Se não houver resposta, programar tentativas para 1h, 3h, 24h (somente em horário comercial), 3 dias, 5 dias e 15 dias. Cada tentativa deve usar a etapa e o histórico atual da conversa, sem reiniciar com mensagem genérica. Aplicar a janela e os limites de envio aprovados para WhatsApp.
7. No marco de 15 dias, criar uma minuta de notificação extrajudicial e encaminhar para revisão humana. Não enviar automaticamente documento jurídico sem validação do responsável.

## Pré-requisitos de configuração

- A URL configurada no CRM deve pertencer ao webhook do fluxo duplicado em FINANCEIRO 8572.
- O fluxo BotConversa deve mapear telefone/nome, dados de processo e contexto para o agente de IA.
- A integração deve oferecer ações confiáveis para criar, atualizar e cancelar eventos no Google Calendar/Meet. O endpoint atual do CRM cria eventos, mas ainda não implementa atualização/cancelamento; isso precisa estar pronto antes de ativar reagendamento automatizado.
- Configurar `BOTCONVERSA_FINANCEIRO_API_KEY` como segredo da Edge Function Supabase. A chave não pode ser guardada em `system_settings` nem exposta na tela administrativa.
- Para envio ordenado dos documentos, o contato precisa existir na companhia FINANCEIRO e cada URL pública precisa terminar na extensão real do arquivo. A Edge Function envia os arquivos pela API do BotConversa em sequência e só depois chama o webhook do agente.
- Configurar os templates aprovados necessários para iniciar ou retomar conversas fora da janela de atendimento do WhatsApp.
- O telefone interno autorizado para teste está definido como `5511993110193`; a configuração `botconversa_service_agent` permanece desativada até validar a companhia 8572. Em Modo Teste do BotConversa, o webhook só captura a amostra e não envia mensagens.
- Testar primeiro com número interno, confirmar que o webhook chega somente à companhia 8572 e validar anexos, fluxo, e-mail e notificação do CRM separadamente.
- Só depois da validação, ativar o fluxo duplicado como principal. Manter reversão para a URL anterior até a aprovação dos testes.
