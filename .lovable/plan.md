## Objetivo
Adicionar uma nova coluna **PAGAMENTO** ao lado de **STATUS** na tabela de Contratos (aba "Contratos"), com badge verde "Pago" / vermelho "Não Pago", podendo ser marcada manualmente pelo admin (ex.: pagamento em dinheiro) ou sincronizada automaticamente via Asaas.

## Como funciona
- **Verde "Pago"** quando:
  - O contrato tem fatura Asaas confirmada/recebida (lógica `isContractPaid` já existente — sincronização automática), OU
  - O admin marcou manualmente como pago (novo campo `manually_paid` na tabela `contracts`).
- **Vermelho "Não Pago"** quando nenhum dos dois.
- Clicar no badge "Não Pago" abre confirmação para marcar manualmente como pago. Clicar em "Pago manual" permite reverter (apenas se não veio do Asaas). Se Asaas confirmar depois, prevalece automático (sem perder o manual).

## Mudanças

### 1. Banco (migration)
- Adicionar à tabela `contracts`:
  - `manually_paid boolean DEFAULT false`
  - `manually_paid_at timestamptz`
  - `manually_paid_by uuid` (admin que marcou)

### 2. `src/pages/admin/Contratos.tsx`
- Header: nova coluna **"Pagamento"** logo após "Status".
- Helper `isContractPaid` atualizado: retorna `true` também quando `contract.manually_paid === true`.
- Novo helper `getPaymentSource(contract)` → `'asaas' | 'manual' | 'none'` para exibir tooltip (ex.: "Confirmado via Asaas" ou "Marcado manualmente").
- Nova célula `<TableCell>` com badge:
  - Verde "Pago" (com ícone ✓) — clicável só se fonte for manual (permite desfazer via AlertDialog).
  - Vermelho "Não Pago" — clicável, abre AlertDialog de confirmação "Confirmar pagamento manual?".
- Função `togglePaidManual(contract)`: faz `UPDATE contracts SET manually_paid = ..., manually_paid_at = now(), manually_paid_by = auth.uid()` e dá refresh.
- Métrica "Pagos" do dashboard usa o mesmo `isContractPaid` atualizado, então passa a contar pagos manuais também (já alinhado com o pedido).

### 3. Sem mudanças em edge functions
A sincronização Asaas já existente (`sync-asaas-invoices` + `fetchPaidInvoices`) continua sendo a fonte verde automática. O campo manual é apenas um override aditivo.

## Arquivos
- `supabase/migrations/<nova>.sql` (via tool de migration)
- `src/pages/admin/Contratos.tsx`
