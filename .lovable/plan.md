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
- Remetente exibido: `noreply@webmarcas.net` (endereço verificado no Resend; "Neroplay@webmarcas.net" não existe como conta de envio).
