## Objetivo
Identificar e exibir o **usuário responsável** por cada cobrança/negociação em Vencidos (Financeiro) e Prazos (Publicações), permitindo também reatribuir manualmente para outro admin.

## 1. Banco de dados (migration)

### a) Tabela `cobrancas_vencidas` (já existe)
Adicionar colunas:
- `responsavel_user_id` (uuid, FK auth.users, nullable)
- `responsavel_nome` (text, snapshot do nome)
- `responsavel_atribuido_em` (timestamptz)

### b) Tabela `publicacoes_marcas` (já existe)
Adicionar as mesmas 3 colunas:
- `responsavel_user_id`, `responsavel_nome`, `responsavel_atribuido_em`

### c) Tabela nova `responsavel_historico` (auditoria)
- `entidade` ('cobranca' | 'publicacao')
- `entidade_id` (uuid)
- `user_id`, `user_nome`, `acao` ('cobrou' | 'negociou' | 'atribuiu' | 'assumiu')
- `created_at`
- Com RLS para admins (SELECT/INSERT) e GRANTs para `authenticated` e `service_role`.

## 2. Lógica de atribuição automática
- Ao clicar em **Cobrar** (handler do botão na aba Vencidos / Prazos): antes/depois da chamada à edge function, gravar `responsavel_user_id = auth.user.id` na linha correspondente + INSERT no histórico com `acao='cobrou'`.
- Ao clicar em **Negociar** (abrir negociação): mesma coisa com `acao='negociou'`.
- Só sobrescreve responsável se estiver vazio; se já existe outro, mantém (a menos que reatribua manualmente).

## 3. UI — Financeiro / Central de Vencidos
Em cada linha das 3 abas (`Vencidos30DiasTab`, `Devedores` lista +30 e +60):
- Nova coluna/badge **"Responsável"** ao lado de "Última cobrança":
  - Se vazio: chip cinza "Sem responsável" (clicável).
  - Se preenchido: chip com avatar/iniciais + primeiro nome (ex. "👤 João S.")
- Clicar no chip abre um **Popover** com lista de admins (busca `user_roles` + `profiles`) → selecionar para reatribuir → grava em `cobrancas_vencidas.responsavel_*` + histórico `acao='atribuiu'`.

## 4. UI — Publicações / Prazos
Mesmo padrão dentro do componente `PublicacaoPrazos.tsx`:
- Chip de responsável na linha/card de cada publicação.
- Mesmo popover de reatribuição.

## 5. Realtime
Subscrever realtime nas duas tabelas (`postgres_changes`) para que, quando um admin clica "cobrar", o badge do responsável apareça na tela dos outros admins em segundos.

## 6. Detalhes técnicos
- Hook novo `useResponsavel(entidade, entidadeId)` para ler/atualizar.
- Componente compartilhado `ResponsavelChip` reutilizado em Vencidos e Prazos.
- Lista de admins via query: `user_roles` join `profiles` filtrando `role='admin'`.
- Sem mudanças em edge functions de cobrança (já existentes) — atribuição é client-side com update direto via RLS (admin only).

## Fora do escopo
- Notificações para o responsável (pode ser próxima iteração).
- Métricas/ranking de cobranças por usuário (futuro).

Confirma para eu seguir com a implementação?
