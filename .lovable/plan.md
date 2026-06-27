
## Objetivo
Na aba **Contratos**, adicionar dois novos indicadores no painel de métricas:
1. **Contratos Pagos** — quantidade de contratos assinados em que o cliente efetivamente pagou.
2. **Valor Total Pago** — soma do valor desses contratos pagos.

A fonte da verdade do pagamento é o Asaas (status `RECEIVED` / `CONFIRMED`), refletido localmente na tabela `invoices` (status `received` / `confirmed`).

## Como será feito

### 1. Layout dos cards
Hoje existem 4 cards (Total, Assinados, Pendentes, Valor Total). Vou expandir para **6 cards**, mantendo grid `grid-cols-2 lg:grid-cols-3` (ou `lg:grid-cols-6` em telas largas) para manter a leitura limpa no mobile (que é o foco do usuário pela screenshot):

```text
[ Total ]      [ Assinados ]     [ Pendentes ]
[ Pagos ]      [ Valor Total ]   [ Valor Pago ]
```

Novos cards:
- **Pagos** — ícone `BadgeCheck` / `CircleDollarSign`, cor verde-âmbar, valor = `paidCount`, subtítulo `de X assinados`, com ring percentual `paidCount/signedCount`.
- **Valor Pago** — ícone `DollarSign`, gradiente verde, valor = `R$ paidValue`, subtítulo `recebidos via Asaas`. Respeita `canViewFinancialValues` (mesmo padrão do Valor Total).

### 2. Cálculo de pagos
Em `src/pages/admin/Contratos.tsx`:

- Buscar uma única vez, em paralelo ao fetch dos contratos, todos os `invoices` com `status in ('received','confirmed')` e `asaas_invoice_id not null`, projetando `asaas_invoice_id` e `user_id`.
- Construir um `Set<string>` `paidAsaasIds` e um `Set<string>` `paidUserIds` (fallback quando o contrato não tem `asaas_payment_id` mas o cliente tem fatura paga vinculada — útil para contratos antigos importados).
- Derivar:
  - `paidCount = filteredContracts.filter(c => isPaid(c)).length`
  - `paidValue = soma de contract_value dos pagos`
  - onde `isPaid(c) = c.signature_status === 'signed' && (paidAsaasIds.has(c.asaas_payment_id) || (c.user_id && paidUserIds.has(c.user_id)))`
- Os novos valores entram em `useMemo` para não recalcular a cada render.

### 3. Sincronização com Asaas
Já existe a edge function `sync-asaas-invoices` que percorre faturas `pending/overdue` e atualiza status conforme o Asaas. Vou:

- Adicionar um botão discreto **"Sincronizar Pagos"** ao lado de "Expirar Promoções" (ícone `RefreshCw`), que dispara `supabase.functions.invoke('sync-asaas-invoices')` e em seguida refetch dos contratos + faturas. Mostra toast com `synced/total`.
- Disparar a mesma sincronização automaticamente em background quando a aba Contratos é aberta (uma vez por sessão, com guard para evitar repetição) — assim, os números já abrem atualizados sem o usuário precisar clicar.

### 4. Filtro de assinatura
Adicionar a opção **"Pagos"** no `Select` de filtro de assinatura (junto de "Assinados"/"Pendentes"), reaproveitando a função `isPaid` para filtrar a tabela.

## Arquivos alterados
- `src/pages/admin/Contratos.tsx` — novo fetch de invoices pagas, cálculo de `paidCount` / `paidValue`, dois novos `StatCard`, ajuste do grid, botão "Sincronizar Pagos", opção "Pagos" no filtro.

Nenhuma alteração de schema. Nenhuma alteração nas edge functions existentes (apenas chamada da `sync-asaas-invoices`).

## Observações
- Respeita `canViewFinancialValues` no card "Valor Pago" (oculta o valor para não-admins-master, igual ao "Valor Total").
- Mantém compatibilidade com contratos sem `asaas_payment_id` via fallback por `user_id`.
- Não altera o card "Assinados" — assinatura e pagamento continuam sendo métricas distintas.
