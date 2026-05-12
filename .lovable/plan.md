## Aba Histórico — Paginação e Status Visual

### 1. Paginação 10 em 10
- Adicionar estado `historicoPage` (default 1) e constante `HISTORICO_PAGE_SIZE = 10` em `RevistaINPI.tsx`.
- Fatiar `uploads` ordenados antes de renderizar os cards do histórico.
- Rodapé com controles "Anterior / Próxima" + indicador "Página X de Y" (componente `Pagination` do shadcn já existe).
- Resetar página ao excluir/limpar duplicados.

### 2. Status real por vinculação de clientes
Substituir o badge atual ("Processada" verde fixo) por lógica baseada nas `rpi_entries` daquele upload:

- Buscar contagens por upload: `total_processes_found`, `total_clients_matched` (já em `rpi_uploads`) e total de entries com `matched_client_id IS NOT NULL`.
- Definir status visual:
  - **Vermelho — "Sem processamento"**: `total_processes_found = 0` OU nenhuma entry vinculada e nenhum match feito (nada iniciado).
  - **Laranja — "Em processamento"**: existem entries, mas `matched_client_id` faltando em parte delas (iniciou mas não concluiu vinculação de todos).
  - **Verde — "Processado"**: todas as entries possuem `matched_client_id` (100% vinculadas aos clientes).
- Aplicar a cor no ícone circular à esquerda, no badge de status e na borda sutil do card.

### 3. Detalhes técnicos
- Arquivo único: `src/pages/admin/RevistaINPI.tsx`.
- Reutilizar query existente de `rpi_uploads`; complementar com `select count` agrupado de `rpi_entries` por `rpi_upload_id` (uma chamada extra agregada) ou derivar de `total_clients_matched / total_processes_found` já persistidos para evitar query nova.
- Helper `getUploadStatus(upload)` retorna `{ kind: 'pending'|'partial'|'done', label, colorClasses }` consumido pelo card.
- Manter botões Excluir e "Limpar duplicados" intactos.

### Fora de escopo
- Lógica de re-vinculação automática, abas Busca Remota e Processos, edge functions.
