# Reenvio manual do link de assinatura (WhatsApp + e-mail)

## O que encontrei

- **Ao criar o contrato** o WhatsApp chega porque, ao gerar o link, o sistema já dispara a mensagem pelo **BotConversa** (o mesmo canal das outras mensagens do CRM). O e-mail sai em seguida.
- **No envio manual** há dois problemas:
  1. Na lista de Contratos, o item **"Enviar para Assinatura"** do menu (print) **não tem nenhuma ação** — clicar nele não faz nada.
  2. O botão de reenviar dentro do contrato usa um **WhatsApp antigo** (outro serviço, não o BotConversa). Por isso o e-mail pode sair, mas o WhatsApp não chega. Além disso, o aviso mostra "enviado" mesmo quando só um dos canais funcionou.

## O que vou corrigir

1. Fazer o **"Enviar para Assinatura"** do menu funcionar: gera o link (se ainda não houver) e envia por WhatsApp e e-mail, com indicador de carregamento.
2. Fazer o envio manual de WhatsApp usar **o mesmo caminho do BotConversa** usado na criação do contrato, com a mesma mensagem e o link de assinatura.
3. Validar o telefone (55 + DDD + número). Número incompleto (ex.: "(48) 91083-030") mostra **"Telefone inválido — corrija o cadastro"** em vez de fingir que enviou.
4. Mostrar no aviso o resultado de cada canal: "E-mail enviado / WhatsApp enviado" ou qual falhou e por quê.
5. Testar somente com o seu cadastro de teste (Davilys), sem enviar para clientes reais.

Não muda: criação de contrato, texto do e-mail, envio automático, cobranças. uma observacao quando dd e acima de 31 geralmente no brasil os clientes nao coloca o 9 na frente entao nesse caso sistema de forma automatica acrescenta 9 exemplo ex.: "(48) 91083-030" poe ex.: "(48) 99108-3030" okay 

## Detalhes técnicos

- `src/pages/admin/Contratos.tsx`: `DropdownMenuItem` "Enviar para Assinatura" sem `onClick` → chamar `generate-signature-link` quando faltar `signature_token`, depois `send-signature-request` com `channels: ['email','whatsapp']`.
- `supabase/functions/send-signature-request/index.ts`: canal WhatsApp hoje usa `whatsapp_config` (Evolution API). Trocar por `send-multichannel-notification` (BotConversa), igual a `generate-signature-link`; normalizar/validar telefone; retornar `results` por canal e `success` só refletindo o que foi pedido.
- `ContractDetailSheet.tsx` (`sendSignatureRequest`): exibir resultado por canal.
- Publicar `send-signature-request` após a alteração. e para enviar para este webhook [https://new-backend.botconversa.com.br/api/v1/webhooks-automation/catch/9093/dtJVsg4sy39l/](https://new-backend.botconversa.com.br/api/v1/webhooks-automation/catch/9093/dtJVsg4sy39l/)    