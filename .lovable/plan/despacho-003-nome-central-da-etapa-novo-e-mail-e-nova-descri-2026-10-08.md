# Despacho 003: nome central da etapa, novo e-mail e nova descrição no Asaas

## O que já existe (conferido no banco e no código)

- Os nomes das etapas do Jurídico já ficam salvos num único lugar, a tela "Configurar Etapas — Jurídico".
- A etapa do despacho 003 tem um identificador fixo (`003`). Hoje ela se chama "PUBLICAÇÃO 003" e tem a descrição errada "Cumprimento de exigência formal. Documentos adicionais solicitados."
- Algumas telas ainda usam nomes escritos direto no código, como "Publicação para oposição" (Revista INPI e Publicação), "003" (Kanban de Clientes) e o serviço "Cumprimento de Exigência" ligado à etapa 003 na ficha do cliente. Por isso, renomear a etapa não aparece em todo lugar.

## O que será feito

1. **Renomear a etapa 003** para "PUBLICAÇÃO DESPACHO 003", com a descrição: "Pedido publicado na RPI. Acompanhamento do período para apresentação de oposições de terceiros e das movimentações do processo." O identificador, a cor, a ordem e os clientes vinculados continuam iguais. As etapas Oposição e Exigência de Mérito não mudam.
2. **Um nome só em todo o CRM.** Kanban de Clientes, ficha do cliente, aba Serviços, Kanban de Publicação, Revista INPI (campo da etapa interna), detalhes do processo, etiquetas e filtros passam a ler o nome salvo nessa tela. Isso vale para todas as etapas, inclusive as que forem criadas depois. As telas abertas se atualizam sozinhas depois de salvar, inclusive em outras sessões. O texto original das publicações do INPI e dos documentos não muda.
3. **Mensagem de sucesso só depois de salvar de verdade.** Se a gravação falhar, aparece um erro claro e as telas voltam ao nome anterior.
4. **Novo e-mail do serviço do despacho 003**, usado tanto na prévia quanto no envio de verdade. Assunto e corpo seguem exatamente o texto que você mandou. Os campos são preenchidos com o nome atual da etapa, o cliente, a marca e o processo escolhidos, além do valor (R$ 1.621,00), do vencimento e do link do boleto da própria cobrança. Se faltar algum dado, o envio é bloqueado e o campo pendente aparece na tela. Saem todas as menções a exigência, documentos adicionais e taxa do INPI. O WhatsApp continua igual; se hoje ele usa o mesmo texto do e-mail, os dois serão separados.
5. **Nova descrição das próximas cobranças no Asaas** (no boleto e no CRM):
  "Honorários de assessoria e acompanhamento da fase de publicação do despacho 003 — Marca [MARCA] — Processo [NUMERO_PROCESSO]."
   Marca e processo são preenchidos com os dados do serviço escolhido. Valor, vencimento e as demais regras ficam iguais.
6. **Nada é disparado com esta mudança.** As cobranças já emitidas, os e-mails já enviados e o histórico não mudam. Salvar a configuração não gera cobrança nem envia e-mail ou WhatsApp.

Observação: a descrição do item 5 segue o texto principal da sua mensagem. O documento colado dentro dela sugeria outro modelo ("Honorários de assessoria e acompanhamento — [NOME_ETAPA] — Marca... — Processo..."). Se preferir esse outro, me avise.

## Detalhes técnicos

- Atualizar `system_settings.admin_kanban_juridico_stages`, item `id='003'`, pelo `run_sql`, mudando apenas `label` e `description`.
- Usar `useJuridicoStages` como fonte única dos rótulos. Ele já tem realtime; ligar `refreshJuridicoStages` ao salvar no `AdminKanbanConfig`, que ainda deixará de mostrar "salvo" quando houver erro e desfará a mudança.
- Trocar os rótulos fixos por `stageById[id].label` em `ClientKanbanBoard` (DEFAULT continua só como reserva), `ClientDetailSheet` (lista de serviços com `stage: '003'`), `PublicacaoKanban`/`PublicacaoTab`/`PublicacaoDetailPanel` e `RevistaINPI`/`classifyDispatch`, onde a categoria `publicacao_oposicao` passa a exibir o nome da etapa `003`, mantendo os códigos IPAS.
- Não é preciso migrar vínculos: processos e clientes já guardam o identificador da etapa (`pipeline_stage`), e não o nome.
- Encontrar o template usado pelo serviço 003, no front e nas funções `create-admin-invoice` e `send-email` ou na tabela `email_templates`. Criar um template de e-mail próprio, separado do WhatsApp, com validação dos campos, e definir a `description` enviada ao Asaas só para esse serviço.
- Validar com typecheck e testes, e simular a montagem do e-mail e da descrição sem chamar o Asaas nem usar clientes reais. Pode executar o plano apresentado.
  Confirmo esta descrição para as novas cobranças do serviço 003 no Asaas:
  “Honorários de assessoria e acompanhamento da fase de publicação do despacho 003 — Marca [MARCA] — Processo [NUMERO_PROCESSO].”
  O nome da etapa será “PUBLICAÇÃO DESPACHO 003”.
  Garanta que a atualização automática do nome funcione para qualquer etapa editada, em todas as telas relacionadas do CRM.
  No e-mail, carregue o valor efetivo da cobrança: atualmente R$ 1.621,00. Não deixe esse valor fixo no texto caso a cobrança tenha outro valor. Vencimento e link também devem vir da mesma cobrança.
  Preserve o WhatsApp, os vínculos existentes e os registros históricos. A implantação não deve gerar cobranças nem disparar mensagens.
  Execute a implementação completa e, ao finalizar, informe o que foi alterado, os resultados das validações e qualquer pendência real. Diferencie os testes simulados dos testes realizados nas integrações.