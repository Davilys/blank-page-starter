# Cobrança pelo WhatsApp (Cobrar cliente / Fazer acordo)

## O que encontrei

- O CRM **está enviando** a cobrança ao BotConversa. Nos registros das últimas cobranças (ex.: Helen Milena hoje às 14:19, Adamastor às 14:17) o BotConversa respondeu "recebido" em todas.
- A cobrança vai para um **fluxo separado do financeiro** no BotConversa (webhook `.../catch/17504/Z6cCNjvBc9uv/`), diferente do fluxo usado pelas outras mensagens do CRM, que chegam normalmente.
- Então a mensagem chega no BotConversa, mas **o fluxo financeiro não repassa para o WhatsApp do cliente**. As causas mais prováveis são: o fluxo está desligado ou incompleto, ou os campos não estão mapeados (`telefone`, `nome`, `mensagem`, `link`).
- Alguns telefones estão com dígitos faltando (ex.: "(69) 92280-061", "(66) 96019-089"). Esses nunca chegariam ao cliente.

## Mensagem enviada hoje pelo WhatsApp

```text
Olá, *{primeiro nome}*, tudo bem?

Identificamos que sua fatura no valor de *{valor}* com vencimento em *{data}* encontra-se em aberto.

Você consegue realizar o pagamento hoje?
Preciso apenas da sua confirmação para atualizar nosso sistema.

✅ Pagando hoje via PIX, conseguimos retirar multas e juros.

🔑 Chave PIX (CNPJ):
*39.528.012/0001-29*

🔗 Link da fatura: {link do Asaas}

Após o pagamento, me envie o comprovante por aqui para que eu possa dar baixa no sistema, tudo bem?

Atenciosamente,
Equipe WebMarcas
```

## O que vou corrigir (após sua confirmação do texto)

1. Enviar a cobrança e o acordo pelo **mesmo fluxo do BotConversa que já funciona** para as outras mensagens do CRM. Se você preferir manter o fluxo financeiro separado, eu mantenho e indico o que ajustar nele.
2. Formatar o telefone antes de enviar (55 + DDD + número). Bloquear o envio quando o número estiver incompleto, com o aviso "Telefone inválido — corrija o cadastro", em vez de mostrar como enviado.
3. Mostrar no aviso de sucesso se o WhatsApp foi realmente aceito ou falhou, separado do e-mail.
4. Aplicar o texto que você mandar, se for diferente do atual, também na mensagem do acordo.
5. Fazer um teste somente com o seu cadastro de teste (Davilys), sem enviar nada para clientes reais.

## Detalhes técnicos

- `cobrar-fatura-vencida` chama `send-multichannel-notification` com `whatsapp_webhook_override = FINANCEIRO_WEBHOOK`. O resultado gravado em `notification_dispatch_logs` é HTTP 200 com corpo `{}`, ou seja, o BotConversa aceitou a chamada.
- A correção remove o override (ou o torna configurável), normaliza e valida o telefone e expõe `results.whatsapp` na resposta ao painel.
- O mesmo ajuste vale para o envio do acordo (`FazerAcordoDialog`/`CobrarParcelaAcordoDialog`).
