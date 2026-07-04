## Problema identificado

Hoje o lembrete de vencimento (D-0 e D-3) envia via WhatsApp usando um webhook **dedicado ao financeiro/devedores**:

```
FINANCEIRO_WEBHOOK = https://new-backend.botconversa.com.br/api/v1/webhooks-automation/catch/17504/Z6cCNjvBc9uv/
```

Já o botão **"Enviar Notificação + Cobrança"** da aba **Serviços** do cliente (`ServiceActionPanel.tsx`) chama `send-multichannel-notification` **sem** `whatsapp_webhook_override` — portanto usa o webhook padrão configurado em `system_settings.botconversa` (o mesmo usado pelas demais notificações do CRM).

Por isso os fluxos disparam por webhooks diferentes.

## Correção

Alinhar o lembrete de vencimento ao mesmo webhook do botão da aba Serviços — ou seja, **remover o override** e deixar a função usar o webhook padrão do BotConversa (`system_settings.botconversa`), exatamente como o ServiceActionPanel faz.

### Arquivo alterado
- `supabase/functions/lembrar-fatura-vencendo/index.ts`
  - Remover a constante `FINANCEIRO_WEBHOOK`.
  - Remover a chave `whatsapp_webhook_override` do payload do `send-multichannel-notification`.
  - Manter todo o resto (template, idempotência 20h, canais Email+WhatsApp, log em `cobranca_historico`).

### Não muda
- `cobrar-fatura-vencida` (cobrança de vencidos) **continua** com o `FINANCEIRO_WEBHOOK` dedicado — este fluxo é o de devedores e o usuário só pediu alinhamento do lembrete de vencimento.
- Cron `cron-lembretes-vencimento` não muda: ele apenas invoca `lembrar-fatura-vencendo`.
- UI da aba "Aguardando" não muda.

## Resultado esperado
Ao clicar em "Enviar agora" no modal de lembretes (Vence hoje / Vence em 3 dias), o WhatsApp sai pelo **mesmo webhook** usado pelo botão "Enviar Notificação + Cobrança" da ficha do cliente.
