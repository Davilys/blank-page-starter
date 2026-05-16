# Corrigir sincronização IMAP da aba Emails (Hostinger)

## Diagnóstico

A função `sync-imap-inbox` está sendo chamada com sucesso (cron a cada 2 min, HTTP 200, ~3 s), e o watermark `email_sync_state.last_uid` continua avançando — mas **quase nenhum e-mail novo é inserido** em `email_inbox` há dias para `financeiro@`, `juridico@` e `ola@`. Último insert por conta:

- `financeiro@webmarcas.net`: 03/05
- `juridico@webmarcas.net`: 12/05 (UID já em 3593)
- `Ola@webmarcas.net`: 07/05 (UID já em 1885)
- `noreply@`: sem IMAP (não deve mexer — confirmado)

Causas identificadas em `supabase/functions/sync-imap-inbox/index.ts`:

1. **Filtro anti-alias agressivo (linhas 391-398)**: descarta toda mensagem cujo `env.recipients` não contenha o endereço da conta. Como Hostinger entrega muitos e-mails via alias/forward sem incluir o endereço final em `To/Cc/Bcc/Delivered-To`, eles caem fora silenciosamente. Resultado: o watermark avança mas nada é inserido.
2. **Janela de UIDs limitada (`MAX_PER_FOLDER = 40` + `slice(-40)`)**: se em uma rodada chegam mais de 40 mensagens novas, as `N-40` mais antigas são **puladas para sempre** porque o watermark vai para o maior UID processado.
3. **Sem logs úteis**: `console.error` por mensagem rejeitada não diferencia "alias" de "erro real"; as estatísticas retornadas não contam quantas foram filtradas, então o problema fica invisível.
4. **Sincronização parcial / sem backfill**: hoje só se busca `UID > last_uid`. Não há comando para reimportar histórico completo (ex.: tudo dos últimos 90 dias) por conta — o usuário pediu paridade com Outlook.
5. **Sem sincronização de leitura/exclusão para o servidor** (one-way: servidor → CRM). Marcar lido no CRM não marca no Hostinger.
6. **Sem alerta de falha persistente** por conta.

## Correção proposta

### 1. `sync-imap-inbox` — filtro anti-alias mais inteligente

- Manter o filtro apenas como **classificação/log**, não como descarte.
- Inserir a mensagem mesmo quando o endereço não aparece em `recipients`, marcando `is_alias = true` (nova coluna em `email_inbox`).
- Continuar pulando apenas casos onde a mensagem foi claramente entregue a outra conta `@webmarcas.net` cujo INBOX também sincronizamos (evita duplicatas reais).

### 2. `sync-imap-inbox` — não pular UIDs intermediários

- Substituir `slice(-MAX_PER_FOLDER)` por processamento em "chunks crescentes" começando do mais antigo após `last_uid`, avançando o watermark apenas até o último realmente processado naquela rodada. Assim, na próxima rodada o restante é retomado.

### 3. `sync-imap-inbox` — logs e contadores

- Adicionar `console.log` estruturado por conta/pasta: `{uid, action: 'inserted'|'skipped_alias'|'skipped_dup'|'error', from, to}`.
- Retornar no JSON da resposta: `{folder: {synced, skipped_alias, skipped_dup, errors}}`.
- Persistir o último erro de login/select em `email_sync_state.last_error` (nova coluna nullable).

### 4. Backfill manual / histórico completo

- Adicionar action opcional na request: `{ account_id, mode: "backfill", since_uid?: number }`.
- Em `backfill`, ignorar `last_uid` salvo e processar por chunks `UID since_uid:*` (default `1:*`) com limite ampliado por chamada (e.g. 200) e múltiplas execuções até esgotar.
- Expor botão "Reimportar histórico" no painel da conta (em `EmailList` ou um novo `EmailAccountSettings`).

### 5. Sincronização bidirecional (read/unread/trash)

- Hook em `email_inbox` (frontend ou edge function `update-imap-flag`) que, ao alterar `is_read`/`is_archived` no CRM, dispare comando IMAP `UID STORE <uid> +FLAGS (\Seen)` / `+FLAGS (\Deleted) + EXPUNGE` na conta.
- Implementar como nova edge function chamada do `EmailViewer` / `EmailList` quando o usuário marca como lido ou move para a lixeira.

### 6. Alertas

- Em `cron-sync-all-emails`, se `results[account]` retornar `error` 3 vezes seguidas (controle em `email_sync_state.consecutive_errors`), inserir notificação em `notifications` para os admins ("Sincronização de email X com falha: <motivo>").

### 7. Cron / agendamento

- O cron atual roda a cada 2 min (`*/2 * * * *`). O usuário pediu 5 min — manter 2 min (mais responsivo, sem custo extra) ou ajustar para `*/5 * * * *` conforme preferência.

### 8. Conta `noreply@webmarcas.net`

- Confirmado sem `imap_host` — já é ignorada (linha 480 do `index.ts`). Nenhuma mudança.

## Migration necessária

```sql
ALTER TABLE public.email_inbox ADD COLUMN IF NOT EXISTS is_alias BOOLEAN DEFAULT false;
ALTER TABLE public.email_sync_state
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS consecutive_errors INTEGER DEFAULT 0;
```

## Plano de validação

1. Após deploy, executar manualmente "Reimportar histórico" para `juridico@`, `financeiro@` e `ola@`.
2. Confirmar via SQL que `email_inbox` recebe novos rows com `received_at` recente para cada conta.
3. Enviar um e-mail de teste de fora para cada conta; em até 2 min ele deve aparecer na UI.
4. Marcar como lido no CRM → verificar no Webmail Hostinger que o e-mail virou "lido".
5. Conferir contadores (Caixa/Não Lidos/Enviados) por conta.

## Arquivos afetados

- `supabase/functions/sync-imap-inbox/index.ts` — itens 1, 2, 3, 4
- `supabase/functions/cron-sync-all-emails/index.ts` — item 6 (contagem de falhas e alerta)
- `supabase/functions/update-imap-flag/index.ts` — **novo**, item 5
- `src/components/admin/email/EmailList.tsx` / `EmailViewer.tsx` — chamar `update-imap-flag` ao marcar lido/lixeira; botão "Reimportar histórico"
- Migration nova com as 3 colunas acima