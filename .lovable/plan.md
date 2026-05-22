## Diagnóstico

Na página **Central de Vencidos** (`src/pages/admin/FinanceiroVencidos.tsx`):

- Aba **Vencidos até 30 dias** → renderiza `<Vencidos30DiasTab>`, que possui o botão "Sincronizar Asaas" (linhas 122-125 chamam `sync-asaas-invoices` + `asaas-debtors-api/sync-overdue-30` + `sync-overdue`).
- Abas **Devedores +30 dias** e **+60 dias** → renderizam `<Devedores embedded …>`. O componente `Devedores.tsx` já tem `handleSync` e o botão "Sincronizar com Asaas" (linha 655), mas ele está dentro de `{!embedded && (…)}` (linha 633), então fica escondido quando vem das abas.

## Correção (apenas UI, sem mexer nas regras de sync já existentes)

### `src/pages/admin/Devedores.tsx`
- Extrair o trio de botões "Atualizar + Sincronizar com Asaas" para fora do bloco `{!embedded && …}`, mantendo o cabeçalho (título + breadcrumb) ainda condicionado a `!embedded`.
- Quando `embedded=true`, renderizar um pequeno `<div>` no topo (acima dos `SummaryCard`s) com apenas o botão "Sincronizar com Asaas" (mesmo `handleSync` e mesmo estado `syncing` já existentes — nenhuma mudança na lógica).
- Botão alinhado à direita (`flex justify-end`) para combinar visualmente com as outras abas.

### Sem mudanças em
- `handleSync` (já chama exatamente as mesmas Edge Functions usadas hoje na aba de 30 dias).
- Edge Functions (`sync-asaas-invoices`, `asaas-debtors-api`).
- `FinanceiroVencidos.tsx` (continua passando `embedded`).

## Resultado
- Aba **Devedores +30 dias** e **Devedores +60 dias** passam a ter o mesmo botão "Sincronizar com Asaas" da aba de 30 dias.
- Regras de sincronização preservadas — apenas exposição do botão.
