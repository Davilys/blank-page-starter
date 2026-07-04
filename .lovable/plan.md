## Trocar webhook do WhatsApp nos lembretes

O webhook atual `FINANCEIRO_WEBHOOK` (`.../17504/Z6cCNjvBc9uv/`) é o dedicado a "Devedores/Vencidos". As notificações de nova cobrança criada no ficheiro do cliente usam o webhook **padrão** do CRM, salvo em `system_settings` na chave `botconversa` — quando `send-multichannel-notification` é chamado sem `whatsapp_webhook_override`, ele automaticamente lê essa chave.

### Mudança
- Em `supabase/functions/lembrar-fatura-vencendo/index.ts`:
  - Remover a constante `FINANCEIRO_WEBHOOK` e o campo `whatsapp_webhook_override` do payload enviado a `send-multichannel-notification`.
  - Resultado: os lembretes D-0 / D-3 passam a sair pelo mesmo webhook do BotConversa usado quando uma cobrança é criada no ficheiro do cliente (chave `botconversa` em `system_settings`).

### Sem mudanças em
- Email (Resend continua igual)
- Template da mensagem
- Idempotência de 20h
- `cobrar-fatura-vencida` (esse continua com o webhook dedicado dos vencidos)
