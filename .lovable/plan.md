## Editar nome da marca quando não identificado

Quando o sistema importa uma publicação RPI e não consegue identificar o nome da marca (mostra "—"), o usuário precisa poder editar manualmente e inserir o nome correto.

### O que será feito

Na aba **Prazos** (`PublicacaoPrazos.tsx`), na coluna **Marca / Processo**:

1. Adicionar um pequeno botão de lápis (ícone `Pencil`) ao lado do nome da marca, visível em hover.
2. Ao clicar, abrir um diálogo simples (`EditarMarcaDialog`) com:
   - Campo de texto pré-preenchido com o nome atual (ou vazio se "—")
   - Exibição do processo nº como referência (read-only)
   - Botões **Cancelar** e **Salvar**
3. Ao salvar, atualizar `brand_name_rpi` na tabela `publicacoes_marcas` para a publicação em questão.
4. Quando a publicação já tem `process_id` vinculado, também oferecer (checkbox) atualizar o `brand_name` do processo correspondente em `brand_processes`.
5. Invalidar as queries `['publicacoes-marcas']` e `['brand-processes-pub']` para refletir na UI.

### Onde aparece

- **Sempre** na coluna Marca/Processo da aba Prazos (todas as faixas: No Prazo, 30 dias, Última Semana, Vencidos, Cumpridos, Desistiu).
- O destaque visual fica mais evidente quando o nome está vazio ("—"): nesse caso o botão aparece como link "Editar nome da marca" em vez de só o ícone.

### Detalhes técnicos

- Novo componente: `src/components/admin/publicacao/EditarMarcaDialog.tsx`.
- Update SQL: `update publicacoes_marcas set brand_name_rpi = ? where id = ?` via cliente Supabase (sem migration — coluna já existe).
- Update opcional do processo: `update brand_processes set brand_name = ? where id = ?`.
- Sem alteração de schema, sem mudanças no backend.
