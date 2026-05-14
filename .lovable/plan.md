# Corrigir sincronização de vencidos com Asaas

## Problema identificado

A cliente com vencimento `11/05/2026` aparece como vencida (3d) na Central de Vencidos, mas no Asaas a fatura foi reagendada para `31/05/2026` e ainda não está vencida. Causas:

1. `**sync-asaas-invoices` ignora faturas `PENDING` no Asaas** (linha 71-74) e **nunca atualiza `due_date` nem `value**`. Se o cliente/admin altera a data no Asaas, o CRM continua com a data antiga e a fatura "envelhece" sozinha localmente.
2. **A lista de vencidos** (`Vencidos30DiasTab`) trata como vencida qualquer fatura `pending` cuja `due_date` local seja menor que hoje — ou seja, baseia-se 100% na data desatualizada do CRM, sem cruzar com o Asaas.
3. As abas **Devedores +30 / +60** (`asaas-debtors-api`) usam o mesmo `invoices.due_date`, herdando o mesmo problema.

## Correção

### 1. Edge function `sync-asaas-invoices`

- Remover o `if (asaasStatus === 'PENDING') continue;` — passar a sincronizar SEMPRE:
  - `due_date` ← `asaasPayment.dueDate`
  - `amount` ← `asaasPayment.value`
  - `status` ← mapeado (incluindo voltar para `pending` quando o Asaas reagendar uma `OVERDUE` para o futuro).
- Para faturas `pending` com `dueDate > hoje`, garantir `status = 'pending'` (não `overdue`) mesmo que antes estivesse marcada como vencida.
- Manter o delay e tratamento de erros atuais.
- Ampliar o filtro inicial: buscar invoices com `status IN ('pending','overdue')` (hoje só pega `pending`), para que vencidas reagendadas voltem a `pending`.

### 2. `Vencidos30DiasTab` (frontend)

- Após `sync()`, recarregar normalmente (já faz).
- No filtro local de "vencidos", exigir AMBAS as condições:
  - `status === 'overdue'` **OU** (`status === 'pending'` E `due_date < hoje`)
  - E **descartar** itens cujo `due_date` (já atualizado pela sync) seja `>= hoje`.
- Isso elimina o caso da imagem: após a sync trazer 31/05/2026, a fatura sai da lista.

### 3. Devedores +30 / +60 (`asaas-debtors-api`)

- Garantir que a rotina `sync-overdue-30 / sync-overdue` chame primeiro a atualização de `due_date`/`value` por fatura (reaproveitar a mesma lógica) antes de classificar 30/60+ dias. Caso já o faça, apenas confirmar; senão, adicionar o passo de atualização in-place.
- Reclassificar baseado no `due_date` recém-sincronizado.

### 4. Validação

- Após deploy, clicar "Sincronizar Asaas" na aba "Vencidos até 30 dias".
- Confirmar via SQL que a fatura da Luanna (`(66) 99086-120`) passou de `due_date 2026-05-11` → `2026-05-31` e `status pending`.
- Confirmar que ela sai da lista de Vencidos e também não aparece em Devedores +30 / +60.
- Repetir o teste com 2-3 outras faturas para validar amostra.

## Arquivos afetados

- `supabase/functions/sync-asaas-invoices/index.ts` — sincronizar `due_date`/`value` sempre, não pular `PENDING`, ampliar filtro inicial.
- `supabase/functions/asaas-debtors-api/index.ts` — incluir refresh de `due_date`/`value` antes da classificação 30/60+.
- `src/components/admin/financeiro/vencidos/Vencidos30DiasTab.tsx` — filtro local mais estrito (exigir vencimento real `< hoje`).

Sem mudanças de schema; nenhuma migration necessária. 