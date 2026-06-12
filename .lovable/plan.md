## Objetivo
Mostrar a coluna **Responsável** também na visão de **Histórico** das três abas de Vencidos (até 30d, +30, +60), com o mesmo chip já usado na Lista — clicável para reatribuir.

## Por que é fácil agora
O hook `useResponsaveis` foi refatorado e já carrega **todas** as atribuições da entidade (`invoice` ou `devedor`) sem filtrar por IDs. Então o mapa já tem o responsável de qualquer item — basta consumir nas tabelas de histórico.

## Mudanças

### 1. `src/components/admin/financeiro/vencidos/Vencidos30DiasTab.tsx` (Histórico até 30d)
- Adicionar coluna **Responsável** ao header da tabela do histórico (linhas 365–406).
- Em cada linha, renderizar `<ResponsavelChip entidade="invoice" entidadeId={h.invoice_id} responsavel={responsaveisMap[h.invoice_id]} />`.
- Ajustar `colSpan` do empty state de 5 para 6.

### 2. `src/pages/admin/Devedores.tsx` — Histórico Devedores +60d (`TabsContent value="historico"`, linhas 923–1001)
- Adicionar coluna **Responsável** no header (depois de "Cliente").
- Adicionar a interface `Renegociacao` o campo `asaas_customer_id: string | null` (já vem do `select *`).
- Renderizar o chip na linha usando `responsaveisDevedores[h.asaas_customer_id]`.
- Ajustar `colSpan` do empty state de 6 para 7.

### 3. `src/pages/admin/Devedores.tsx` — Histórico Devedores +30d (`TabsContent value="historico-devedor"`, linhas 1003–1075)
- Mesmo: adicionar coluna **Responsável** no header.
- Renderizar chip com `responsaveisDevedores[h.asaas_customer_id]`.
- Ajustar `colSpan` do empty state de 7 para 8.

### 4. Comportamento

- **Sem nova chamada de banco**: os dados já vêm via `responsaveisMap` / `responsaveisDevedores`.
- O chip permite reatribuir (mesmo popover de admins).
- Realtime continua funcionando — qualquer atribuição feita na Lista aparece automaticamente no Histórico, e vice-versa, porque o histórico não tem um "responsável por renegociação" próprio: ele reflete o responsável atual daquele invoice / devedor.

## Fora do escopo
- Não vou criar "responsável por registro de histórico" (ex.: quem fez aquela cobrança específica naquela data). Hoje o conceito é "responsável atual pelo cliente/fatura", consistente com a Lista. Se você quiser registrar o autor de cada ação de cobrança/renegociação individualmente, é outra feature (precisa coluna no `cobranca_historico` / `renegociacoes` etc.).
- Sem mudanças no banco, edge functions, ou no Publicações (já está OK).

Confirma para eu aplicar?
