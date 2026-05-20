# Botão de excluir em Devedores 30 e 60 dias

Replicar o botão de remover (lixeira) que existe na aba "Vencidos até 30 dias" também nas listas de Devedores +30 dias e Devedores +60 dias.

## Backend
- `supabase/functions/asaas-debtors-api/index.ts`: nova ação `exclude-debtor` que recebe `asaas_customer_id`, `cliente_cpf_cnpj` e `bucket` (`d30` ou `d60`) e atualiza `cobrancas_vencidas` para `status = 'excluido_manual'` (some das listas que filtram `pendente_renegociacao`).

## Frontend
- `src/pages/admin/Devedores.tsx`:
  - Estado `deletingKey` e função `excluir(debtor, bucket)` com confirmação.
  - Novo botão lixeira nas colunas de Ação das abas `lista` (60d) e `devedor` (30d).
