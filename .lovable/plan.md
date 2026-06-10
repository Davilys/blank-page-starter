# Aba "Prazos" em Publicação + Automação de Arquivamento

## 1. Nova sub-aba "Prazos" em `PublicacaoTab.tsx`

Adicionar `'prazos'` ao `ViewMode` (hoje `'lista' | 'kanban'`) e um botão na toolbar ao lado de Lista/Kanban.

Conteúdo do novo componente `PublicacaoPrazos.tsx` (em `src/components/admin/publicacao/`):

- 4 tabs (filtros segmentados) com contagem em badges:
  1. **No Prazo** — verde — `> 30 dias` restantes
  2. **30 Dias para Vencer** — amarelo — `8–30 dias`
  3. **Última Semana** — laranja — `0–7 dias`
  4. **Vencidos** — vermelho — `< 0 dias` (ainda não marcados como cumpridos/arquivados)
- Cálculo do prazo: usa `proximo_prazo_critico`; se nulo, calcula `data_publicacao_rpi + 60 dias`.
- Exclui publicações com `status = 'certificado'` ou `cumprimento_ok = true`.

Cada linha exibe: Cliente, Marca, Nº processo, Data publicação RPI, Prazo final, Dias restantes (contador colorido), Status atual e badge do estágio Kanban. Ações:
- **Confirmar Cumprimento** (botão verde, ícone CheckCircle2): seta `cumprimento_ok = true`, `cumprimento_at = now()`, `cumprimento_by = admin.id` em `publicacoes_marcas`. Remove a linha da lista de prazos.
- **Ver detalhe** (abre o `PublicacaoDetailPanel` já existente).
- **Arquivar agora** (somente em "Vencidos") — arquiva manualmente.

Busca por marca/cliente e ordenação por dias restantes (asc).

## 2. Migration (SQL)

Adicionar em `publicacoes_marcas`:
- `cumprimento_ok boolean not null default false`
- `cumprimento_at timestamptz`
- `cumprimento_by uuid`
- índice em `(cumprimento_ok, proximo_prazo_critico)`

## 3. Lógica de prazo de 60 dias

No `handleAutoPopulateFromRPI` e no fluxo de criação manual: garantir que `proximo_prazo_critico = data_publicacao_rpi + 60` quando ainda não houver descrição específica de prazo (a função `calcAutoFields` já trata isso — apenas reforçar o default para 60 quando o dispatch não mapeia para nada).

## 4. Auto-arquivamento (ajustar bloco já existente, linhas 482–519)

Alterar o filtro para também respeitar `cumprimento_ok`:

```ts
if (p.status === 'arquivado' || p.status === 'certificado' || p.cumprimento_ok) return false;
```

Ao arquivar publicação vencida, além de já atualizar `pipeline_stage = 'arquivado'` em `brand_processes`, também atualizar `status = 'arquivado'` (campo lido pelo `ClientProcessKanban`), gravar `descricao_prazo = 'Arquivado por decurso de prazo'` e inserir entrada em `publicacao_logs`.

## 5. Vínculo inicial (Revista → Cliente)

Em `handleAutoPopulateFromRPI` (PublicacaoTab.tsx), após criar a publicação atualizar `brand_processes` do processo vinculado:
- `pipeline_stage` = mapeamento do status detectado (já existe `PIPELINE_TO_PUB` reverso; criar `PUB_TO_PIPELINE`).
- `status` = mesmo id do estágio do Kanban do cliente (`em_andamento`, `publicado_rpi`, `em_exame`, `deferido`, `indeferido`, `arquivado`), derivado do status da publicação:
  - `003`/`oposicao`/`exigencia_merito` → `publicado_rpi`
  - `deferimento` → `deferido`
  - `indeferimento` → `indeferido`
  - `certificado` → `concedido`
  - `arquivado` → `arquivado`

## 6. Dashboard — Alerta de Prazos Críticos

No `Dashboard.tsx` admin, adicionar card "Prazos Críticos (< 7d)" com contagem clicável que leva a `/admin/publicacao?view=prazos&tab=ultima-semana` (via query string lido no PublicacaoTab para preselecionar view/tab).

## 7. Cores e UX

Seguir tokens semânticos do `index.css` (`bg-emerald-*`, `bg-amber-*`, `bg-orange-*`, `bg-destructive`). Sem cores hardcoded fora do esquema.

## Arquivos afetados

- `src/components/admin/PublicacaoTab.tsx` — ViewMode, render, auto-archive filter, sync Kanban no vínculo, leitura de query string.
- `src/components/admin/publicacao/PublicacaoPrazos.tsx` — novo.
- `src/components/admin/publicacao/types.ts` — `ViewMode` + novos campos opcionais.
- `src/pages/admin/Dashboard.tsx` — card de prazos críticos.
- Nova migration em `supabase/migrations/` com colunas de cumprimento.

## Validação

- Confirmar que ao expirar 60 dias a marca aparece como "Arquivado" no Kanban do cliente (`ClientProcessKanban` lê `brand_processes.status`).
- Confirmar Cumprimento remove da lista e impede o auto-archive.
- Ao vincular publicação na Revista, processo já abre na fase correta no Kanban do cliente.
