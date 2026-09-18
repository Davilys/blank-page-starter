# Liberar a aba "Vencidas" para usuários não master

## O que muda

Hoje um usuário comum só enxerga cobranças de clientes atribuídos a ele — por isso o card "Vencidas" mostra 0 e a lista fica vazia.

Passa a valer:

- O card **Vencidas** mostra a contagem real de clientes e cobranças vencidas de toda a base (igual ao master).
- Ao clicar em **Vencidas**, a lista traz todas as cobranças vencidas, com cliente, vencimento, status e as ações de cobrança.
- **Recebidas** e **Aguardando pagamento** continuam exatamente como estão: contagem restrita aos clientes do usuário.
- **Nenhum valor em R$** é exibido para usuário não master: o card "Vencidas" segue mostrando "Restrito" e a coluna Valor da lista segue "Restrito".
- Para o usuário master nada muda.

## Detalhes técnicos

Arquivo único: `src/pages/admin/Financeiro.tsx`. Sem migração de banco — as funções `admin_billing_situation` e `admin_invoices_list_filtered` já aceitam qualquer admin e recebem o dono como parâmetro.

1. Lista de cobranças (`fetchInvoices`): passar `p_owner: null` quando `!isMasterAdmin && filterStatus === 'vencidas'`; nos demais filtros mantém `ownerFilter`.
2. Totais (`fetchTotals`): manter a chamada atual com `ownerFilter` e, para não master, fazer uma segunda chamada a `admin_billing_situation` com `p_owner: null`, aproveitando apenas `categories.vencidas` (clients_count / invoices_count / composition) no estado de `billingData`. Demais categorias e a série do gráfico permanecem com o escopo do usuário.
3. `canViewFinancialValues` não é alterado — valores continuam mascarados como "Restrito" para não master, inclusive no card Vencidas e na coluna Valor.
4. Verificação: typecheck e conferência de que os filtros Recebidas/Aguardando/Todos seguem restritos ao usuário.
