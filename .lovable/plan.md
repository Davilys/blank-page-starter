# Unificação do Ficheiro do Cliente e do Kanban

## Diagnóstico

### 1. Kanban de Publicações tem cores, ordem e labels DIFERENTES do Kanban Jurídico de Clientes

**Clientes / Jurídico** (`src/components/admin/clients/ClientKanbanBoard.tsx` → `PIPELINE_STAGES`):
12 fases com ordem: protocolado → 003 → oposicao → exigencia_merito → indeferimento → notificacao → deferimento → **certificados** (plural) → renovacao → arquivado → distrato. Cada uma com `color`, `bgColor`, `textColor`, `description`.

**Publicações** (`src/components/admin/publicacao/PublicacaoKanban.tsx` → `STATUS_CONFIG`):
Apenas 8 fases: 003 → oposicao → exigencia_merito → indeferimento → deferimento → **certificado** (singular) → renovacao → arquivado. Define seu próprio `accent` e `icon` (emoji), ignorando a paleta canônica.

Resultado: o card "CERTIFICADO" aparece teal em uma aba e diferente na outra; "EXIGÊNCIA DE MÉRITO" aparece violet/orange dependendo da aba; faltam `protocolado`, `notificacao`, `distrato`.

### 2. Ficheiro do cliente abre em todas as abas, mas a aba "Serviços" só renderiza se `client.process_id` existe

`ClientDetailSheet.tsx` linha 2313: `{client.process_id ? (...serviços...) : (...placeholder...)}`.

- **Clientes**: `process_id` vem do `brand_processes` na query da listagem. OK.
- **Publicações**: `fetchClientForSheet` em `PublicacaoTab.tsx` busca brand_processes, mas se a publicação não estiver vinculada a um processo do cliente (`mainProcess` = null → `process_id` = null), a aba Serviços fica vazia.
- **Financeiro**: `openClientFile` faz a mesma busca. Mesma falha quando o cliente não tem `brand_processes` ainda (somente fatura).
- **Devedores**: usa `find-or-create-client-from-asaas` que pode retornar sem processo.

### 3. Confirmação positiva
Todas as 4 abas já chamam o mesmo componente `@/components/admin/clients/ClientDetailSheet`. O problema é só (a) cores/colunas do kanban e (b) `process_id` ausente esconder a seção de serviços.

---

## Mudanças

### A. Kanban unificado (Publicações usar a mesma fonte de cores do Jurídico)

Em `src/components/admin/publicacao/PublicacaoKanban.tsx`:
- Remover o `STATUS_CONFIG` local.
- Importar `PIPELINE_STAGES` de `@/components/admin/clients/ClientKanbanBoard` (já é `export const`).
- Filtrar apenas as fases relevantes a publicações INPI (excluir `distrato` e `notificacao` que não vêm do RPI), preservando: `003`, `oposicao`, `exigencia_merito`, `indeferimento`, `deferimento`, `certificados`, `renovacao`, `arquivado`. Mapear `certificado` (status atual da publicação) → coluna `certificados`.
- Usar o mesmo gradiente (`color`), `bgColor`, `textColor` e label do PIPELINE_STAGES nos cabeçalhos das colunas e nos cards (cor da borda lateral).
- Manter os emojis em uma constante separada `PUB_STAGE_ICONS` indexada pelo `id` para conservar o visual atual.

Isso garante que `CERTIFICADO`, `OPOSIÇÃO`, `003`, `EXIGÊNCIA DE MÉRITO` etc. apareçam com **exatamente as mesmas cores** em Clientes, Publicações e dentro do ficheiro do cliente.

### B. Tipo do status na publicação

Atualizar `PubStatus` em `PublicacaoKanban.tsx` (e no `helpers.tsx` se necessário) para incluir `certificados` como alias de `certificado`. Ao gravar, preferir gravar `certificados` (alinhado ao PIPELINE_STAGES). Manter compatibilidade lendo ambos.

### C. Ficheiro: garantir que a aba "Serviços" sempre apareça

Em `ClientDetailSheet.tsx`:

1. **Mostrar a seção mesmo sem `process_id`**: substituir a guarda `{client.process_id ? ... : placeholder}` por uma renderização que:
   - Sempre exibe o seletor de marca (mostrando "Sem marca cadastrada — criar nova" quando `clientBrands.length === 0`).
   - Sempre exibe os botões "Tipo de Serviço" (lista de `activeStages`).
   - Permite criar uma `brand_processes` na hora ao clicar num estágio quando não há nenhuma — usa o `client.id` + `brand_name` do cliente (ou string "Marca principal") + `pipeline_stage` selecionado, depois recarrega `clientBrands`.

2. **Hidratação automática**: dentro de `fetchClientData`, quando `brandsRes.data` for vazio mas existir alguma `publicacoes_marcas` para o cliente, criar/usar a publicação como brand virtual (já existe lógica para "isOrphan"; replicar para clientes "magros").

### D. Padronizar `openClientFile` em Financeiro / Devedores / Publicações

Extrair a função `fetchClientForSheet` de `PublicacaoTab.tsx` para um helper compartilhado (`src/lib/clientSheet.ts` → `loadClientForSheet(clientId): Promise<ClientWithProcess>`). Reutilizar em:
- `src/pages/admin/Financeiro.tsx` (substitui o `openClientFile` local)
- `src/pages/admin/Devedores.tsx` (substitui o caminho atual via edge function quando o cliente já existe; só usa `find-or-create-client-from-asaas` quando o `clientId` não estiver no `profiles`).
- `src/components/admin/PublicacaoTab.tsx` (substitui pela chamada ao helper).
- `src/pages/admin/Clientes.tsx` (opcional, usa o mesmo helper para garantir shape idêntico).

Resultado: o objeto `ClientWithProcess` é construído pelo mesmo código em qualquer aba — ficheiro idêntico em Clientes, Publicações, Financeiro e Devedores.

### E. Detalhe visual do header do ficheiro

`ClientDetailSheet` já tem `currentStage` derivado de `PIPELINE_STAGES`/`dynamicServiceStages`. Após (A), as cores do badge no topo do ficheiro casarão com a cor do card do Kanban (Publicações e Clientes).

---

## Arquivos editados

- `src/components/admin/publicacao/PublicacaoKanban.tsx` — usar `PIPELINE_STAGES` e remover `STATUS_CONFIG` local; mapear `certificado`↔`certificados`.
- `src/components/admin/PublicacaoTab.tsx` — chamar helper compartilhado; ajustes de tipo se necessário.
- `src/components/admin/clients/ClientDetailSheet.tsx` — sempre renderizar aba Serviços; criação on-the-fly de `brand_processes` quando inexistente.
- `src/pages/admin/Financeiro.tsx` — usar helper compartilhado.
- `src/pages/admin/Devedores.tsx` — preferir helper local quando `clientId` existe em `profiles`.
- `src/lib/clientSheet.ts` (novo) — `loadClientForSheet(clientId)`.

Sem mudanças de banco, sem nova edge function.

## Resultado esperado

1. Kanban de Publicações exibe as mesmas colunas (mesmas cores, mesmos labels, mesma ordem) que o Kanban Jurídico em Clientes.
2. Clicar no nome do cliente em Clientes, Publicações, Financeiro ou Devedores abre o **mesmo** `ClientDetailSheet`, com header, abas e cores idênticas.
3. A aba "Serviços" aparece em qualquer cliente, mesmo sem `brand_processes` cadastrado, permitindo escolher o tipo de serviço e enviar notificação/cobrança como em Clientes.
