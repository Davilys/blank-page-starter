## Objetivo
Testar de verdade o envio do lembrete D-0 para **davillys@gmail.com** e **WhatsApp 11989832130**, verificar se chega nos dois canais, e — se algum falhar — corrigir até funcionar.

## Como o teste será feito (sem alterar código de produção)

O `lembrar-fatura-vencendo` só aceita `invoice_id` (busca destinatário do banco). Para testar com o e-mail/telefone específicos que você forneceu **sem criar fatura fake**, vou disparar diretamente a função `send-multichannel-notification` via `supabase--curl_edge_functions`, usando **exatamente o mesmo payload** que o `lembrar-fatura-vencendo` monta:

- `event_type: "manual"`
- `channels: ["whatsapp", "email"]`
- `recipient: { nome: "Davillys (Teste)", email: "davillys@gmail.com", phone: "11989832130" }`
- `custom_message`: template WhatsApp do lembrete D-0 ("Olá, *Davillys*! Passando para lembrar que sua cobrança…")
- `custom_html` + `custom_subject`: template de e-mail do lembrete D-0
- **SEM `whatsapp_webhook_override`** (usa o webhook padrão do BotConversa, igual ao botão "Enviar Notificação + Cobrança")

Isso reproduz 1:1 o que o `lembrar-fatura-vencendo` faz quando o botão "Enviar agora" é clicado no modal Aguardando.

## Passos

1. **Disparar o teste** chamando `send-multichannel-notification` com o payload acima.
2. **Ler a resposta JSON** — ela retorna `results.whatsapp` e `results.email` com `success/error/response`.
3. **Ler logs** de `send-multichannel-notification` e de `send-email` para confirmar o dispatch.
4. **Você confere na caixa de entrada** (davillys@gmail.com) e no WhatsApp (11989832130).

## Diagnóstico e correção

Dependendo do resultado:

- **Email falhou** → checar `send-email` (Resend/SMTP), remetente, quota. Corrigir credenciais/config se necessário.
- **WhatsApp falhou** → checar `system_settings.botconversa` (webhook padrão configurado). Se estiver vazio ou apontando para o webhook errado, ajustar o valor via migration/SQL. Testar novamente.
- **Ambos OK** → confirmado que o pipeline do lembrete funciona; o botão "Enviar agora" produzirá o mesmo resultado em produção.

## O que NÃO muda
- Sem alteração em `lembrar-fatura-vencendo`, `cron-lembretes-vencimento`, UI da aba Aguardando, ou template.
- Correções, se necessárias, ficarão restritas a: `system_settings.botconversa` (config), ou config do `send-email`.
