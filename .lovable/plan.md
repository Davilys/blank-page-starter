## Entendimento

Hoje todas as notificações WhatsApp do sistema passam por:

`cobrar-fatura-vencida` → `send-multichannel-notification` → `sendWhatsApp()` → webhook único do BotConversa salvo em `system_settings.botconversa.webhook_url`.

Você quer que **apenas** as cobranças do Financeiro (Devedores ≤30, +30, +60) sejam enviadas para um webhook BotConversa **diferente e dedicado**:

`https://new-backend.botconversa.com.br/api/v1/webhooks-automation/catch/17504/cFE9KA4F5Wtm/`

Todas as outras notificações WhatsApp do CRM (assinatura, contratos, lembretes, etc.) continuam usando o webhook atual em `system_settings.botconversa` sem nenhuma alteração.

## Mudanças

### 1. `supabase/functions/send-multichannel-notification/index.ts`
- Adicionar um campo opcional no payload: `whatsapp_webhook_override?: string`.
- Em `sendWhatsApp(...)`, se `override` vier preenchido, usar essa URL em vez de `settings.webhook_url`. Mantém `auth_token` e formato de payload (telefone/nome/mensagem/extra) idênticos — nenhuma outra regra muda.
- Se `override` estiver vazio/ausente → comportamento atual (webhook do CRM).

### 2. `supabase/functions/cobrar-fatura-vencida/index.ts`
- Definir constante interna:
  ```ts
  const FINANCEIRO_WEBHOOK = "https://new-backend.botconversa.com.br/api/v1/webhooks-automation/catch/17504/cFE9KA4F5Wtm/";
  ```
- Na chamada `supabase.functions.invoke('send-multichannel-notification', { body: { ... } })`, incluir `whatsapp_webhook_override: FINANCEIRO_WEBHOOK`.
- Toda a lógica de mensagem (texto WhatsApp, e-mail HTML, PIX, idempotência 24h, histórico em `cobranca_historico`) permanece igual.

### 3. Nenhuma mudança em
- `system_settings.botconversa` (continua sendo o webhook padrão do CRM).
- Regras de sincronização Asaas (≤30 / +30 / +60) — intocadas.
- Templates, dashboard, demais edge functions de notificação.
- Frontend (Devedores, FinanceiroVencidos): o botão "Cobrar" já invoca `cobrar-fatura-vencida`; passa a usar o novo webhook automaticamente.

## Teste pós-deploy
1. Disparar uma cobrança real (ou de teste) em Devedores +60 → verificar nos logs de `send-multichannel-notification` se a URL chamada foi a nova.
2. Disparar uma notificação não-financeira (ex.: assinatura) → confirmar que ainda vai para o webhook antigo do `system_settings`.
3. Conferir `cobranca_historico` registrando `enviada` com sucesso.

## Pergunta antes de implementar
Confirma esses 2 pontos:
- (a) Posso deixar a URL **hardcoded** na função `cobrar-fatura-vencida` (mais simples), ou prefere que eu salve como **secret** `BOTCONVERSA_FINANCEIRO_WEBHOOK` para poder trocar depois sem deploy?
- (b) O `auth_token` (Bearer) configurado hoje em `system_settings.botconversa` também deve ser usado nesse novo webhook, ou ele é público (sem token)?