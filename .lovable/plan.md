# Vencimento de cobrança no ficheiro do cliente: 10 dias corridos

## Objetivo
Ao criar uma cobrança pela aba "Serviços" (ficheiro do cliente), o vencimento deve ser sempre **hoje + 10 dias corridos**, em vez da próxima segunda-feira.

## Alterações
- `src/components/admin/clients/ServiceActionPanel.tsx`
  - Substituir a função `getNextMonday()` por `getDueDateIn10Days()` que retorna `new Date()` somado de 10 dias corridos.
  - Atualizar `const dueDate = getNextMonday()` para usar a nova função.
  - Atualizar qualquer texto/label que mencione "próxima segunda-feira" para "vencimento em 10 dias", se existir.

Nenhuma outra tela é afetada (CreateInvoiceDialog continua usando data manual).
