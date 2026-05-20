# Plan: Adicionar botão de excluir em Devedores +30 e +60 dias

## Objetivo
Replicar o botão de excluir (remover da lista) que existe na aba "Vencidos até 30 dias" também nas abas de Devedores +30 dias e Devedores +60 dias.

## Backend
1. **Edge Function `asaas-debtors-api`** — Adicionar ação `exclude-debtor`.
   - Recebe `cliente_cpf_cnpj` ou `asaas_customer_id` + `bucket` (`d30` ou `d60`).
   - Atualiza todas as linhas de `cobrancas_vencidas` do cliente no bucket informado para `status = "excluido_manual"`.
   - Retorna `{ success: true, updated: N }`.

## Frontend
2. **`src/pages/admin/Devedores.tsx`**
   - Adicionar estado `deletingId`.
   - Criar função `excluir(cliente: Debtor, bucket: 'd30' | 'd60')` que:
     - Confirma com `window.confirm`
     - Chama `callApi('exclude-debtor', { ... })`
     - Remove o item localmente da lista (`filteredDebtors` ou `filteredDebtors30`)
   - Adicionar botão `<Trash2 />` com `variant="ghost"` ao lado dos botões de ação em:
     - Tab `lista` (devedores 60+) — coluna "Ação"
     - Tab `devedor` (devedores 30) — coluna "Ações"

3. **Deploy** da edge function após alteração.

## Notas
- As listas do edge function já filtram por `status = "pendente_renegociacao"`, então itens com `excluido_manual` somem automaticamente.
- Não é necessária nova tabela ou migração SQL.
