## Diagnóstico

A página `/admin/contratos` realmente **não tem paginação visual**. O `.range()` que existe no código (linha 360) só serve para contornar o limite de 1000 linhas do Supabase — ele baixa **todos os contratos** (até 50.000) em loop e renderiza **todas as linhas** ao mesmo tempo na tabela, com animações Framer Motion por linha. Isso é a causa direta da lentidão.

Confirmado:
- `fetchContracts` faz loop `for (page = 0; page < 50)` puxando 1000 em 1000 (linhas 327-367).
- `filteredContracts.map(...)` renderiza tudo de uma vez (linha 923).
- Cada `<TableRow>` tem `animationDelay` calculado por índice (linha 927-931).

## Plano de correção

Manter o fetch atual (já funciona e alimenta os filtros/stats no cliente), mas adicionar **paginação client-side** sobre `filteredContracts` — solução mais leve e sem risco de quebrar busca, abas, filtros de data, status cards e realtime.

### Mudanças em `src/pages/admin/Contratos.tsx`

1. **Estado de paginação**
   - `const [currentPage, setCurrentPage] = useState(1)`
   - `const PAGE_SIZE = 50`

2. **Slice da lista filtrada**
   - `paginatedContracts = filteredContracts.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE)`
   - `totalPages = Math.ceil(filteredContracts.length / PAGE_SIZE)`
   - Trocar `filteredContracts.map(...)` por `paginatedContracts.map(...)` apenas no render da tabela (mantém stats agregadas usando a lista completa).

3. **Reset automático**
   - `useEffect(() => setCurrentPage(1), [search, signatureFilter, dateFilter, activeTab, selectedMonth])` — volta para página 1 sempre que filtros mudam.
   - Clamp se `currentPage > totalPages` após filtro.

4. **UI de paginação** (rodapé da tabela)
   - Usar componentes `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationPrevious`, `PaginationNext`, `PaginationLink`, `PaginationEllipsis` já existentes em `src/components/ui/pagination.tsx`.
   - Mostrar: "Exibindo X–Y de Z contratos" + Anterior / 1 … N / Próximo.
   - Janela inteligente: primeira, última, atual ±2.

5. **Performance de render**
   - Remover o `animationDelay` por índice no `<TableRow>` (linhas 927-931). Manter só transição de hover. Com 50 linhas por página o ganho de remover o cálculo escalonado é significativo.

6. **Não mexer**
   - Mantém o loop de fetch (necessário para filtros e contadores corretos).
   - Mantém realtime e refetch.
   - Não altera `ContractDetailSheet`, `EditContractDialog` nem stats cards.

### Resultado esperado
- DOM cai de ~3.250 linhas para 50 por vez.
- Renderização inicial e troca de aba/filtro ficam instantâneas.
- Stats no topo continuam refletindo o conjunto filtrado completo.

### Arquivos alterados
- `src/pages/admin/Contratos.tsx` (única alteração)

Posso implementar?