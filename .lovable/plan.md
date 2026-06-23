## Objetivo

Na aba **Prazos** (Publicações), adicionar:
1. Filtro por **Responsável** (dropdown com busca por nome) que mostra apenas clientes/prazos vinculados a esse admin.
2. **Atribuição automática de responsável** conforme o estágio do prazo:
   - Novo (60 dias / "No Prazo") → **Caroline**
   - 30 dias para vencer → **João Pedro**
   - Última semana (≤7 dias) → **Camila Ferreira**
   - Só re-atribui se o status NÃO for `cumprido` nem `aguardando_pagamento` (nesses casos mantém o responsável atual).

## Mudanças

### 1. UI — `src/components/admin/publicacao/PublicacaoPrazos.tsx`
- Adicionar um **dropdown "Responsável"** ao lado do campo de busca existente, com:
  - Opção "Todos"
  - Lista de admins (via `useAdminList`)
  - Input de busca interno (Command)
- Aplicar filtro no array de publicações antes de renderizar: mostrar só linhas em que `responsavel.user_id === filtroSelecionado`.
- Contadores das chips (No Prazo, 30 Dias, Última Semana, Vencidos, etc.) recalculados respeitando o filtro de responsável (assim o admin vê só "seus" números).

### 2. Atribuição automática — novo hook/efeito em `PublicacaoPrazos.tsx`
- Constantes com os UUIDs dos 3 admins-alvo:
  - Caroline: `ad9db755-9d8f-4b2c-806b-c9c7245b79bc`
  - João: `e01073ec-5424-4aab-bfb0-bd8b40396349`
  - Camila: `1569b08c-e266-47d0-a384-4b7f29c64dc1`
- Função `bucketOf(pub)` retorna `60d | 30d | 7d` a partir de `proximo_prazo_critico - hoje`.
- Função `expectedOwner(bucket)` retorna o UUID do admin esperado.
- Ao carregar publicações, percorrer cada item e:
  - Se `status_cumprimento ∈ {cumprido, aguardando_pagamento}` → não mexer.
  - Se responsável atual ≠ esperado → chamar `atribuirResponsavel('publicacao', pub.id, { userId: expected, userNome, acao: 'atribuiu' })`.
- Para evitar reatribuir em loop, manter um `Set` de IDs já processados nesta sessão e só re-rodar quando `bucket` mudar.

### 3. Atribuição na criação (Revista INPI) — `supabase/functions/process-rpi/index.ts`
- Quando uma RPI cria/atualiza um `publicacoes_marcas` novo com prazo de 60 dias, fazer `upsert` em `responsavel_atribuicao` com Caroline como responsável padrão (somente se ainda não houver responsável).
- Garante que mesmo antes do admin abrir a tela, a publicação já nasce vinculada à Caroline.

### Detalhes técnicos
- Buckets seguem a mesma regra já usada nas chips de contagem (`No Prazo`, `30 Dias para Vencer`, `Última Semana`).
- O fallback "Última Semana" cobre dias restantes entre 1 e 7 (inclusive).
- Reaproveita `atribuirResponsavel` / `removerResponsavel` de `useResponsaveis.ts` — sem nova tabela.
- Sem migration de schema; apenas dados em `responsavel_atribuicao`.
- Filtro por responsável é client-side (já temos todas as publicações em memória na aba Prazos).

## Fora de escopo
- Não altera lógica de status (`cumprido` / `aguardando_pagamento` continuam manuais).
- Não muda cálculo de prazos (já corrigido na rodada anterior).
- Não cria notificações novas para os admins atribuídos.
