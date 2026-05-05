## Objetivo

1. Toda notificação enviada pelo canal **E-mail** (na aba Notificações ou em qualquer chamada do `send-multichannel-notification`) deve sair do `noreply@webmarcas.net` e aparecer em **Email → Enviados**.
2. Adicionar **botões de filtro (funil)** na aba **Histórico** da Central de Notificações, separando o que foi enviado por **WhatsApp**, **E-mail** e **Plataforma (área do cliente / CRM)**.

---

## 1. Envio real do canal E-mail nas notificações

### Problema atual
Em `supabase/functions/send-multichannel-notification/index.ts` (linha 291), o canal `email` é **filtrado e ignorado**:
```ts
const channels = rawChannels.filter(c => ['crm', 'sms', 'whatsapp'].includes(c));
```
Por isso, quando o admin marca "E-mail (Resend)" na Central de Notificações, nada é enviado e nada aparece em Enviados.

### Mudanças
**`supabase/functions/send-multichannel-notification/index.ts`**
- Incluir `'email'` na lista permitida de canais.
- Após blocos SMS/WhatsApp, adicionar bloco `if (channels.includes('email'))`:
  - Se faltar `resolvedEmail`: marcar skipped e logar.
  - Caso contrário, invocar a função `send-email` com:
    - `to: [resolvedEmail]`
    - `subject: getTitulo(event_type, safeData)`
    - `html`: corpo gerado a partir de `message` (texto + link clicável quando `safeData.link` existir), com `<br/>` para quebras.
  - Registrar em `notification_dispatch_logs` (channel `email`, status sent/failed).
  - Registrar também em `email_logs` (insert) com `from_email = 'noreply@webmarcas.net'`, `to_email`, `subject`, `body`, `html_body`, `status = 'sent'|'failed'`, `trigger_type = 'notification:'+event_type`, `sent_at = now()`. Isso é o que faz aparecer na aba **Enviados** do módulo Email (que filtra `email_logs` por `status='sent'` e `from_email`).

**`supabase/functions/send-email/index.ts`**
- Já envia a partir de `noreply@webmarcas.net` (constante `VERIFIED_FROM_EMAIL`). Sem mudança.
- Confirmação: nenhum outro from-address é usado.

### Consequência
- Notificações por E-mail passam a ser realmente entregues.
- Aparecem automaticamente em **Email → Enviados** filtrando pela conta `noreply@webmarcas.net` (admin pode selecioná-la no seletor de contas; se não existir, será necessário adicioná-la em `email_accounts` — incluir um insert idempotente na migração se ela ainda não estiver cadastrada).

---

## 2. Filtros de canal na aba Histórico (Notificações)

### Estado atual
`src/pages/admin/Notificacoes.tsx` lista apenas a tabela `notifications` (canal CRM). A tabela `notification_dispatch_logs` já guarda envios por canal (`crm | sms | whatsapp | email`) e já é carregada (`dispatchLogs`).

### Mudanças em `src/pages/admin/Notificacoes.tsx`
- Novo estado `channelFilter: 'all' | 'plataforma' | 'whatsapp' | 'email'` (default `'all'`).
- Acima da lista do Histórico, adicionar uma barra de **botões de funil** com os ícones já disponíveis (`Bell` para Plataforma, `MessageSquare` para WhatsApp, `Mail` para E-mail) — visual coerente com os filtros de tipo já existentes (linha 1148).
- Quando `channelFilter === 'all'`: comportamento atual (lista `notifications`).
- Quando filtro específico: exibir itens de `dispatchLogs` filtrados por `channel` (`plataforma` ↔ `crm`), mostrando destinatário (`recipient_email`/`recipient_phone`), evento, status (sent/failed badge), timestamp e mensagem (do `payload`). Reaproveitar o card de notificação (componente `NotificationCard`) adaptando-o para aceitar entradas de log.
- Atualizar contadores do header ("Histórico 200") para refletir o total filtrado.
- Manter a busca textual existente operando também sobre logs (matching em `recipient_email`/`recipient_phone`/`event_type`).

### Filtro de busca
- Aplicar `search` também em `dispatch_logs` (nome do cliente via join com `profiles` por `recipient_user_id` — já carregado em `clients`).

---

## 3. Conta de e-mail "noreply@webmarcas.net" visível em Enviados

- Conferir se já existe linha em `email_accounts` com `email_address = 'noreply@webmarcas.net'`. Se não, criar via migração (idempotente: `on conflict do nothing`), com `display_name = 'WebMarcas'`, `is_default = true`.
- Sem isso, o seletor de contas em `Emails.tsx` não mostra a conta e a aba Enviados fica vazia mesmo com `email_logs` populados.

---

## Arquivos alterados
- `supabase/functions/send-multichannel-notification/index.ts` — adicionar canal email + log em `email_logs`.
- `src/pages/admin/Notificacoes.tsx` — filtros de canal (Plataforma / WhatsApp / E-mail) na aba Histórico.
- Migração SQL: garantir conta `noreply@webmarcas.net` em `email_accounts`.

## Fora de escopo
- Não mexer em SMS, BotConversa, ou no fluxo de Devedores.
- Não alterar templates de e-mail nem o domínio remetente.
- Não criar nova função; tudo reaproveita `send-email` e `email_logs`.
