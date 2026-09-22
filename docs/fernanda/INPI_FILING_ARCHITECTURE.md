# Fluxo futuro de pedido no INPI

Somente arquitetura offline/preview. Nesta etapa não se acessa o INPI, não se usa credencial, não se gera contrato, GRU ou procuração, não se cobra e não se protocola.

## Sequência e gates

1. Contrato criado e enviado são estados distintos.
2. Assinatura do contrato só é confirmada por notificação idempotente do CRM.
3. Antes da GRU: autorização do cliente, dados finais, marca/classe e valor vigente da GRU revisados.
4. GRU criada e enviada são estados distintos.
5. Procuração criada no CRM e enviada são estados distintos.
6. Assinatura da procuração só é confirmada por notificação idempotente do CRM.
7. Comprovante recebido não equivale a pagamento verificado.
8. Com todos os gates, o pacote fica apto para revisão final.
9. Protocolo exige autorização específica e continua separado de `ready_to_file`.

Cada notificação CRM tem ID único. Repetir o mesmo ID não duplica efeito; um segundo ID conflitante bloqueia para revisão. Credenciais ficam somente no cofre e nunca entram em estado, logs ou mensagens.

## Homologação

- fixtures sintéticas e transações com rollback;
- teste de cada gate ausente;
- eventos CRM repetidos;
- estados `created`, `sent`, `confirmed` e `paid` separados;
- nenhum acesso a INPI, BotConversa externo, cobrança ou protocolo;
- `1- AT FINAL SEMANA` permanece controle negativo intacto.
