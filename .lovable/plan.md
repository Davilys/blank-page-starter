## Mudança

Atualizar a constante `FINANCEIRO_WEBHOOK` em `supabase/functions/cobrar-fatura-vencida/index.ts`:

- **De:** `https://new-backend.botconversa.com.br/api/v1/webhooks-automation/catch/17504/cFE9KA4F5Wtm/`
- **Para:** `https://new-backend.botconversa.com.br/api/v1/webhooks-automation/catch/17504/Z6cCNjvBc9uv/`

Nenhuma outra lógica muda. `send-multichannel-notification` já suporta `whatsapp_webhook_override` desde a iteração anterior — continua intacto. Demais notificações do CRM seguem usando o webhook padrão em `system_settings.botconversa`.

## Teste pós-deploy

1. Redeploy de `cobrar-fatura-vencida`.
2. Disparar uma cobrança real pela aba Financeiro → Vencidos (botão "Cobrar") numa fatura de teste.
3. Verificar nos logs de `send-multichannel-notification` se a URL chamada é a nova (`Z6cCNjvBc9uv`).
4. Confirmar no painel do BotConversa se o webhook recebeu a requisição e mapeou os campos (telefone, nome, mensagem).
5. Conferir registro em `cobranca_historico` com `status='enviada'`.

## Pergunta

Posso disparar o teste com uma fatura real de um devedor existente (vai enviar WhatsApp de verdade ao cliente), ou prefere que eu apenas faça o swap + deploy e você mesmo aciona o botão "Cobrar" em uma fatura de teste para validar?