# Não ressincronizar devedores que já estão no histórico

## Problema
Ao rodar "Sincronizar Asaas" nas abas 30 dias / +30 dias / +60 dias, devedores que já tiveram cobrança enviada ou acordo registrado (presentes em `cobranca_historico`) voltam a aparecer porque o Asaas ainda os marca como OVERDUE.

## Regra de negócio
Se um pagamento já possui qualquer registro em `cobranca_historico` (independente do canal ou status), ele NÃO deve ser reinserido em `cobrancas_vencidas` durante a sincronização — significa que já foi tratado (cobrado, em acordo, ou aguardando próxima ação).

## Mudanças

### `supabase/functions/asaas-debtors-api/index.ts`
Nas actions `sync-overdue` (bucket d60) e `sync-overdue-30` (bucket d30):

1. Para cada página retornada do Asaas, montar a lista de `asaas_payment_id`.
2. Buscar em `invoices` os pares `(asaas_invoice_id, id)` correspondentes a esses IDs.
3. Buscar em `cobranca_historico` quais `invoice_id` (da etapa 2) já têm histórico.
4. Criar um `Set<asaas_payment_id>` dos que já estão no histórico.
5. No loop de itens: se o `p.id` está nesse Set E ainda não existe linha em `cobrancas_vencidas` para ele, pular (incrementar contador `skipped_in_history`). Se já existe linha, manter o comportamento atual (não regredir status).
6. Retornar `skipped_in_history` na resposta para diagnóstico.

A lógica de upsert atual continua aplicável apenas para pagamentos genuinamente novos (sem histórico e sem linha anterior).

## Detalhes técnicos
- Join lógico: `invoices.asaas_invoice_id = p.id` → pega `invoices.id` → consulta `cobranca_historico.invoice_id IN (...)`.
- Faturas sem `invoices.asaas_invoice_id` (cobranças avulsas do Asaas que nunca viraram invoice local) seguem fluxo atual — não há histórico possível a verificar.
- Sem mudanças no frontend nem em outras tabelas.
