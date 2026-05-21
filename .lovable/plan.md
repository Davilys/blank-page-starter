# Corrigir botão "Excluir" nas três abas de devedores

## Problema
Nas abas **Vencidos até 30 dias**, **Devedores +30 dias** e **Devedores +60 dias**, o ícone da lixeira não remove o registro. O clique aparenta não ter efeito.

## Diagnóstico
- A ação `exclude-debtor` em `supabase/functions/asaas-debtors-api/index.ts` usa `.update(...).select("id", { count: "exact" })`. A opção `count` no `.select()` encadeado após `update` não é confiável no supabase-js — em vários casos retorna `null` e, em outros, falha silenciosamente, sem afetar linhas. Não há `console.log` nem retorno detalhado para diagnosticar.
- A função filtra `status = 'pendente_renegociacao'` rígido, mas quando o cliente tem apenas `asaas_customer_id` (sem CPF/CNPJ na linha) o filtro `cliente_cpf_cnpj` torna a query vazia.
- Na aba "Vencidos até 30 dias", o `Vencidos30DiasTab.excluir` atualiza `invoices.status = 'cancelled'` direto via RLS. Funciona, mas se a fatura voltar do Asaas no próximo sync ela reaparece — precisa de marcador permanente.

## Alterações

### `supabase/functions/asaas-debtors-api/index.ts` (ação `exclude-debtor`)
- Buscar (`select id`) as linhas-alvo **antes** do update, com filtro OR `(cliente_cpf_cnpj = X OR asaas_customer_id = Y)` quando ambos forem enviados.
- Aplicar `update({ status: 'excluido_manual' }).in('id', ids).select('id')` e retornar `updated: data.length`.
- Adicionar `console.log` de entrada/saída e devolver mensagem clara quando `ids.length === 0` (HTTP 200 com `updated: 0` + `reason`).

### `src/pages/admin/Devedores.tsx`
- Após `callApi("exclude-debtor", ...)`, se `updated === 0`, mostrar `toast.warning` em vez de remover otimisticamente da lista, e disparar `load()` para reconciliar.
- Manter remoção otimista quando `updated > 0`.

### `src/components/admin/financeiro/vencidos/Vencidos30DiasTab.tsx`
- Trocar o update direto por chamada à ação `exclude-invoice` (nova) na mesma edge function, garantindo idempotência e log central.
- Nova ação `exclude-invoice` em `asaas-debtors-api/index.ts`: marca `invoices.status = 'cancelled'` **e** insere/atualiza linha em `cobrancas_vencidas` (se existir) para `excluido_manual`, evitando reaparição após sync.

## Validação
1. `supabase--curl_edge_functions` com `action=exclude-debtor` e payload de um devedor real (consulta prévia via `supabase--read_query`) — esperar `{ success: true, updated: N>0 }`.
2. Repetir para `exclude-invoice` com uma fatura vencida real.
3. Conferir nos logs da edge function as linhas de `console.log`.
4. Recarregar a UI e confirmar que o registro some das três abas.