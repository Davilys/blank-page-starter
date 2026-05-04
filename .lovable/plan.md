# Auditoria — /admin/contratos

Confirmado: **falta paginação**. A página é a principal causa da lentidão.

## O que está acontecendo hoje (`src/pages/admin/Contratos.tsx`)

1. `fetchContracts` baixa **todos os contratos** em loop de 1.000 em 1.000 (até 50.000). Hoje são 3.251 → 4 round-trips ao Supabase, sempre, no load inicial.
2. Cada linha vem com 4 joins (`contract_types`, `contract_templates`, `profiles`, etc.).
3. Filtros (busca, status, aba, data) rodam **no client**, sobre o array inteiro.
4. A tabela renderiza **todas as linhas filtradas de uma vez**, cada uma com `motion` + animação escalonada e `group-hover` complexo.
5. Realtime em `contracts` dispara `fetchContracts()` completo a cada mudança — recarrega os 3.251 de novo.
6. Não há `LIMIT`, nem `OFFSET`, nem controle de página, nem virtualização.

Resultado: ~3 mil linhas no DOM + animações + refetch total a cada evento realtime. Trava em qualquer máquina.

## Plano de correção

### 1. Paginação server-side (principal)
- Carregar **50 contratos por página** com `.range(from, to)` e `count: 'exact'` do Supabase.
- Estado novo: `page`, `pageSize`, `totalCount`.
- Mover filtros para a query:
  - Busca (`contract_number`, `subject`) via `.or(...ilike...)` no servidor.
  - `signatureFilter` via `.eq('signature_status', ...)`.
  - Filtro de data (`today` / `week` / `month`) via `.gte` / `.lte` em `created_at`.
  - Aba de tipo de contrato via `.ilike` em template/type quando possível; quando depender de combinação textual (ex.: "padrão + registro de marca"), aplicar como filtro adicional sobre a página atual (mantendo paginação).
- Adicionar componente de paginação (`@/components/ui/pagination` já existe) com Anterior / 1 2 3 ... / Próxima e seletor de itens por página (25 / 50 / 100).
- Debounce de 300ms no campo de busca antes de refazer a query.

### 2. Stats reais (não dependentes da página atual)
Hoje os cards "Total / Assinados / Pendentes / Valor Total" usam `filteredContracts` (array completo). Com paginação isso quebra.
- Criar uma query leve agregada (uma única chamada) que retorne, para o conjunto filtrado:
  - `total`, `signed_count`, `pending_count`, `sum(contract_value)`.
- Pode ser feito com um RPC `contracts_stats(filters jsonb)` ou com 4 queries `count` em paralelo (`head: true, count: 'exact'`). Vou usar a opção das 4 queries em paralelo para evitar nova migration.

### 3. Realtime sem refetch total
- Em vez de `fetchContracts()` no evento realtime, apenas:
  - se for `INSERT` ou `DELETE`: refazer só a contagem + a página atual.
  - se for `UPDATE` de um contrato visível na página: atualizar aquela linha localmente via `setContracts(prev => prev.map(...))`.
- Eliminar o "tempestade" de refetch completo.

### 4. Reduzir custo de render
- Tirar a animação escalonada por linha (`animationDelay: index * 0.03`) — com 50 linhas continua suave, mas o custo principal era com milhares.
- Manter `motion` só no container, não em cada `<tr>`.

### 5. Export ZIP continua puxando tudo
O botão "Exportar ZIP" precisa de todos mesmo. Mantém como está (já faz fetch próprio com `select('*')`), só deixar claro no tooltip que pode demorar.

## Arquivos alterados
- `src/pages/admin/Contratos.tsx` — paginação, filtros server-side, stats em paralelo, realtime incremental, remoção da animação por linha.

## Resultado esperado
- Load inicial: 1 query de 50 linhas + 4 counts pequenos em paralelo. Página abre praticamente instantânea mesmo com 10 mil contratos.
- Busca/filtro/aba: 1 query rápida por mudança (com debounce).
- Realtime: sem refetch global.
- DOM: no máximo ~50 linhas, sem travas de rolagem.
