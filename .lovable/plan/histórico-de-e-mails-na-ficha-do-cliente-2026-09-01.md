# Histórico de e-mails na ficha do cliente

## O que existe hoje (auditado)

- O botão **Email** da ficha abre direto o compositor (`EmailCompose`) dentro do próprio painel — não há menu nem histórico.
- O envio real acontece na Edge Function `send-email`, que dispara pelo Resend sempre a partir de `noreply@webmarcas.net` (com *reply-to* da conta do admin) e devolve o `id` da mensagem no Resend.
- Já existe a tabela `email_logs` (18.838 registros: 2.249 `sent`, 16.589 `failed`) usada pela aba Emails, pelas notificações e pelo remarketing. O compositor grava nela **depois** que o envio dá certo — se o Resend falhar, ele lança erro e nada é gravado.
- Limitações da tabela hoje: **não tem vínculo com o cliente** (só `related_lead_id`), não guarda anexos nem o `message_id` do provedor, e a falha do compositor não é registrada.
- RLS: só quem tem papel `admin` lê ou escreve `email_logs`.

## O que será feito

### 1. Banco (reutilizando `email_logs`, sem tabela nova)

Adicionar as colunas que faltam:

- `client_id` — vínculo pelo ID interno do cliente (nunca pelo e-mail);
- `attachments` (JSON) — nome, URL e tamanho de cada anexo;
- `provider_message_id` — ID devolvido pelo Resend;
- índice por `client_id` + data para o histórico carregar rápido.

Backfill único: e-mails antigos cujo destinatário bate exatamente com o e-mail de um cliente cadastrado passam a aparecer no histórico dele. Nenhum registro é apagado.

RLS mantida: leitura e escrita apenas para administradores.

### 2. Registro do envio (sem tocar no mecanismo atual)

O compositor continua chamando a mesma função `send-email`, com os mesmos templates, anexos e autenticação. Muda só o registro:

- em caso de sucesso: grava `sent`, com `client_id`, anexos e o ID da mensagem no Resend;
- em caso de falha: grava `failed` com a mensagem de erro — nunca aparece como "Enviado".

### 3. Botão "Email" com duas opções

Ao clicar, abre um menu curto no padrão visual atual:

- **Enviar E-mail** — abre o compositor exatamente como hoje;
- **E-mails Enviados** — abre o histórico daquele cliente.

### 4. Painel de histórico

Dentro da própria ficha (mesma área onde o compositor abre hoje):

- lista ordenada do mais recente para o mais antigo, filtrada pelo `client_id` do cliente aberto;
- cada linha: assunto, destinatário, remetente, data e hora, selo de status (Enviado / Falhou / Pendente) e indicador de anexo;
- campo de busca por assunto e ordenação por data;
- carregamento progressivo ("Carregar mais", 25 por vez) — sem teto artificial;
- clicar em um item abre a mensagem completa: assunto, remetente, destinatário, cópias, data/hora, corpo em HTML e lista de anexos para abrir/baixar;
- botão para voltar à lista e para a ficha.

### 5. Atualização imediata

Depois de enviar, o histórico do cliente é recarregado automaticamente e o e-mail novo já aparece no topo, sem precisar fechar e reabrir a ficha.

## Testes

Serão executados os 10 testes pedidos, com verificação no banco (não só na tela): duas opções no botão, envio aparecendo na hora, abertura do e-mail completo, isolamento entre Cliente A e Cliente B, anexo preservado, falha registrada como "Falhou", paginação com muitos registros, busca por assunto, histórico íntegro após recarregar e bloqueio de acesso para usuário sem permissão de admin.

## Detalhes técnicos

- Migração em `email_logs`: `client_id uuid references profiles(id)`, `attachments jsonb default '[]'`, `provider_message_id text`, índice `(client_id, sent_at desc)`.
- `send-email` passa a devolver também o `id` do Resend já exposto hoje; nenhuma alteração de comportamento de envio.
- `EmailCompose`: novo prop `clientId`; `try/catch` no envio grava `failed` com `error_message`; anexos serializados no log; `queryClient.invalidateQueries(['client-emails', clientId])`.
- Novos componentes em `src/components/admin/clients/`: `ClientEmailHistory.tsx` (lista + busca + paginação por `range`) e `ClientEmailViewer.tsx` (visualização completa, HTML sanitizado).
- `ClientDetailSheet.tsx`: ação `email` passa a abrir um `DropdownMenu` com as duas opções e um novo estado `showEmailHistory`.
- Remetente exibido: `noreply@webmarcas.net` (endereço verificado no Resend; "[Neroplay@webmarcas.net](mailto:Neroplay@webmarcas.net)" não existe como conta de envio). AUDITORIA FINAL DE ACEITE — HISTÓRICO DE E-MAILS DO CLIENTE
  A implementação foi concluída segundo o relatório apresentado.
  Agora NÃO faça alterações inicialmente.
  Realize uma auditoria técnica completa para confirmar se o recurso está realmente 100% funcional no banco, backend, Edge Function e frontend.
  Somente aprovar se todos os critérios abaixo forem comprovados.
  ==================================================
  1. BANCO
  ==================================================
  Confirmar que a tabela email_logs possui:
  - client_id
  - attachments
  - provider_message_id
  - error_message
  - índice adequado para client_id + data
  Confirmar que não foi criada uma tabela paralela desnecessária.
  Confirmar que os registros antigos permanecem intactos.
  ==================================================
  2. VÍNCULO COM CLIENTE
  ==================================================
  Confirmar que o histórico utiliza EXCLUSIVAMENTE o client_id interno.
  NÃO utilizar e-mail como chave principal.
  No backfill dos registros antigos:
  Se existir exatamente um cliente correspondente ao destinatário, vincular.
  Se existirem dois ou mais clientes com o mesmo e-mail, NÃO escolher automaticamente.
  Esses registros devem permanecer sem vínculo até tratamento seguro.
  ==================================================
  3. REMETENTE
  ==================================================
  Auditar qual é REALMENTE o remetente utilizado pelo Resend.
  O relatório informou:
  [noreply@webmarcas.net](mailto:noreply@webmarcas.net)
  e que:
  [Neroplay@webmarcas.net](mailto:Neroplay@webmarcas.net)
  não existe como conta de envio.
  Confirmar tecnicamente essa informação.
  O CRM NÃO deve apresentar um remetente diferente daquele efetivamente utilizado pelo serviço de envio.
  Se o remetente real for [noreply@webmarcas.net](mailto:noreply@webmarcas.net), manter esse endereço.
  NÃO alterar o mecanismo de envio apenas para atender a uma informação incorreta.
  ==================================================
  4. ENVIO COM SUCESSO
  ==================================================
  Realizar teste real/controlado:
  Cliente A
  → enviar e-mail
  → Resend aceita
  → receber provider_message_id
  → gravar email_logs
  → client_id correto
  → status sent
  Confirmar no banco que:
  - assunto está correto;
  - destinatário está correto;
  - remetente está correto;
  - conteúdo está correto;
  - client_id está correto;
  - provider_message_id foi armazenado;
  - data/hora foram registradas.
  ==================================================
  5. FALHA DE ENVIO
  ==================================================
  Simular uma falha real do envio.
  Confirmar que:
  - o erro é capturado;
  - email_logs recebe o registro;
  - status = failed;
  - error_message é salvo;
  - client_id é salvo;
  - NÃO aparece como "Enviado".
  Esse teste é obrigatório.
  ==================================================
  6. ANEXOS
  ==================================================
  Enviar e-mail com anexo.
  Confirmar:
  - nome;
  - URL/referência;
  - tamanho;
  - vínculo com o cliente;
  - visualização/abertura;
  - download quando aplicável.
  Confirmar que o histórico não perde o anexo.
  ==================================================
  7. BOTÃO EMAIL
  ==================================================
  Abrir ficha do Cliente A.
  Clicar em Email.
  Confirmar exatamente duas opções:
  ENVIAR E-MAIL
  E
  E-MAILS ENVIADOS
  "Enviar E-mail" deve continuar funcionando como anteriormente.
  "E-mails Enviados" deve abrir o histórico do Cliente A.
  ==================================================
  8. ISOLAMENTO ENTRE CLIENTES
  ==================================================
  Cliente A possui 5 e-mails.
  Cliente B possui 3 e-mails.
  Abrir Cliente A.
  Confirmar que aparecem somente os 5.
  Abrir Cliente B.
  Confirmar que aparecem somente os 3.
  Nenhum e-mail pode vazar entre clientes.
  ==================================================
  9. HISTÓRICO
  ==================================================
  Confirmar ordenação:
  mais recente → mais antigo.
  Cada registro deve apresentar:
  - assunto;
  - destinatário;
  - remetente;
  - data;
  - horário;
  - status;
  - indicador de anexo.
  ==================================================
  10. VISUALIZAÇÃO COMPLETA
  ==================================================
  Abrir um e-mail.
  Confirmar:
  - assunto;
  - remetente;
  - destinatário;
  - cópias;
  - data/hora;
  - corpo HTML sanitizado;
  - anexos.
  Testar HTML malicioso/XSS.
  Confirmar que o conteúdo é sanitizado antes de renderizar.
  ==================================================
  11. PAGINAÇÃO
  ==================================================
  Criar/testar cliente com mais de 25 e-mails.
  Confirmar:
  Carregar mais
  funciona corretamente.
  Testar cliente com quantidade superior ao limite padrão do Supabase.
  Confirmar que o histórico completo pode ser carregado progressivamente.
  NÃO existir limite artificial que faça registros desaparecerem.
  ==================================================
  12. BUSCA
  ==================================================
  Pesquisar por diferentes assuntos.
  Confirmar que:
  - resultados corretos aparecem;
  - resultados de outros clientes não aparecem;
  - busca funciona com paginação.
  ==================================================
  13. ATUALIZAÇÃO IMEDIATA
  ==================================================
  Enviar novo e-mail.
  Confirmar que ele aparece imediatamente no topo do histórico sem fechar/reabrir a ficha.
  Depois:
  - atualizar página;
  - sair da ficha;
  - entrar novamente.
  Confirmar que continua registrado.
  ==================================================
  14. PROVIDER MESSAGE ID
  ==================================================
  Confirmar que o ID retornado pelo Resend é armazenado corretamente.
  Executar envio.
  Comparar:
  ID retornado pelo Resend
  VERSUS
  provider_message_id salvo no banco.
  Devem ser iguais.
  ==================================================
  15. DUPLICIDADE
  ==================================================
  Executar o mesmo fluxo mais de uma vez.
  Confirmar que não ocorre duplicação indevida.
  Verificar especialmente:
  - refresh;
  - reenvio;
  - resposta repetida;
  - webhook/evento repetido;
  - falha seguida de nova tentativa.
  ==================================================
  16. RLS E SEGURANÇA
  ==================================================
  Confirmar que somente usuários autorizados podem consultar email_logs.
  Testar usuário sem permissão de administrador.
  Ele NÃO pode acessar o histórico.
  Confirmar que nenhum conteúdo de e-mail pode ser obtido diretamente por requisição não autorizada.
  ==================================================
  17. BACKFILL
  ==================================================
  Auditar os 18.838 registros existentes.
  Confirmar:
  - nenhum registro apagado;
  - registros continuam íntegros;
  - somente correspondências seguras foram vinculadas;
  - correspondências ambíguas não foram vinculadas incorretamente.
  Apresentar:
  total de registros;
  quantidade vinculada;
  quantidade sem vínculo;
  quantidade ambígua.
  ==================================================
  18. REGRESSÃO
  ==================================================
  Confirmar que a alteração não quebrou:
  - envio de e-mail;
  - templates;
  - anexos;
  - notificações;
  - remarketing;
  - aba Emails;
  - autenticação;
  - permissões.
  ==================================================
  19. CHECKLIST FINAL
  ==================================================
  [ ] email_logs funcionando
  [ ] client_id persistente
  [ ] vínculo por ID interno
  [ ] backfill seguro
  [ ] remetente real confirmado
  [ ] provider_message_id salvo
  [ ] sucesso registrado
  [ ] falha registrada
  [ ] error_message salvo
  [ ] anexos preservados
  [ ] Enviar E-mail funcionando
  [ ] E-mails Enviados funcionando
  [ ] isolamento por cliente
  [ ] busca funcionando
  [ ] paginação funcionando
  [ ] visualização completa
  [ ] HTML sanitizado
  [ ] atualização imediata
  [ ] RLS validado
  [ ] duplicidade impedida
  [ ] regressão aprovada
  ==================================================
  20. CRITÉRIO ABSOLUTO
  ==================================================
  Somente retornar:
  APROVADO — 100%
  se TODOS os itens estiverem comprovadamente funcionando.
  Se qualquer item falhar:
  REPROVADO
  Não utilizar "aparentemente", "provavelmente" ou "praticamente".
  Se houver falha, informar:
  - problema;
  - arquivo;
  - função;
  - tabela;
  - causa;
  - impacto;
  - correção necessária.
  NÃO alterar o sistema durante a auditoria inicial.
  Se encontrar falha, primeiro apresentar o diagnóstico.
  Depois da correção, executar novamente o teste correspondente.
  ==================================================
  21. RELATÓRIO FINAL
  ==================================================
  Apresentar:
  STATUS FINAL:
  APROVADO — 100%
  ou
  REPROVADO
  TESTES:
  Total:
  Aprovados:
  Reprovados:
  BANCO:
  resultado
  BACKEND:
  resultado
  RESEND:
  resultado
  FRONTEND:
  resultado
  RLS:
  resultado
  PAGINAÇÃO:
  resultado
  BACKFILL:
  resultado
  REGRESSÃO:
  resultado
  EVIDÊNCIAS:
  arquivos, funções, tabelas, queries e testes executados.
  A aprovação somente pode ocorrer mediante validação real de ponta a ponta:
  CLIENTE
  → FICHA
  → EMAIL
  → ENVIAR E-MAIL
  → RESEND
  → REGISTRO NO EMAIL_LOGS
  → CLIENT_ID
  → HISTÓRICO
  → VISUALIZAÇÃO
  → ANEXOS
  → STATUS
  → SEGURANÇA.