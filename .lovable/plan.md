# Paginação 10 por página com opção "Todos" nas listas de vencidos

## Objetivo
Nas três abas — **Vencidos até 30 dias**, **Devedores +30 dias** e **Devedores +60 dias** — mostrar a lista de clientes em páginas de 10 itens, com um seletor permitindo ao usuário escolher: 10 (padrão), 25, 50 ou Todos.

## Mudanças

### 1. `src/components/admin/financeiro/vencidos/Vencidos30DiasTab.tsx` (aba Vencidos até 30 dias)
- Adicionar estados `page` (1) e `pageSize` (10, valor "all" representa todos).
- Derivar `pagedRows` a partir da lista filtrada.
- Reset de `page = 1` quando filtros (busca, período) ou `pageSize` mudam.
- Abaixo da tabela, renderizar barra de paginação:
  - Esquerda: texto "Mostrando X–Y de N".
  - Centro: `Select` com opções 10 / 25 / 50 / Todos.
  - Direita: botões Anterior / Próximo + indicador "Página A de B" (oculto quando "Todos").

### 2. `src/pages/admin/Devedores.tsx` (abas Devedores +30 e +60 dias)
- Adicionar dois pares de estados independentes (60d e 30d): `page60`/`pageSize60` e `page30`/`pageSize30`.
- Aplicar paginação sobre `filteredDebtors` (60d) e `filteredDebtors30` (30d).
- Resetar página para 1 ao mudar busca, período ou `pageSize`.
- Inserir a mesma barra de paginação ao final de cada `TabsContent="lista"` e `TabsContent="devedor"`.
- Histórico mantém comportamento atual (não pedido).

### 3. Componente compartilhado
Criar `src/components/admin/financeiro/PaginationBar.tsx` recebendo `page`, `pageSize`, `total`, `onPageChange`, `onPageSizeChange`. Reutilizado nos três pontos.

## Detalhes técnicos
- `pageSize` é `number | "all"`. Quando `"all"`, exibe todos os itens e oculta navegação.
- Cards de resumo (totais) continuam baseados na lista filtrada completa, não na página atual.
- Sem mudanças no backend, edge functions, RLS ou schema.
