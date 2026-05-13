# Sincronizar etapas do Kanban Jurídico em todo o sistema

## Objetivo

Quando uma nova etapa é criada (ou reordenada) no Kanban da aba **Jurídico** (Configurar Etapas), ela deve aparecer automaticamente, na mesma ordem, em todos os pontos onde o usuário escolhe a fase do processo:

- Ficha do cliente -> aba **Serviços** -> "Status" e "Fase do Pipeline"
- Aba **Revista** -> **Processos identificados** (dropdown "Tipo" de Despacho da imagem 1)
- Aba **Revista** -> **Histórico**
- Aba **Publicação** -> Kanban

Auditar a sincronização ida-e-volta entre `brand_processes.pipeline_stage` e `publicacoes_marcas.status` para que funcione com etapas customizadas, sem perder dados.

## Causa raiz

1. `src/lib/pipelineStage.ts` mantém um allowlist fixo (`BRAND_PROCESS_ALLOWED_PIPELINE_STAGES`). `normalizePipelineStageId` retorna `null` para qualquer etapa fora dessa lista, e `sanitizePipelineStagesConfig` descarta etapas customizadas. Resultado: etapas novas criadas no Kanban Jurídico somem do seletor da ficha.
2. Em `src/pages/admin/RevistaINPI.tsx` o array `PIPELINE_STAGES` (linhas ~99-111) e os mapas `PIPELINE_TO_PUB_STATUS` / `PUB_STATUS_TO_PIPELINE` são hard-coded. Etapas novas não aparecem no dropdown "Tipo" de despacho nem no histórico.
3. Em `src/components/admin/PublicacaoTab.tsx` o mapa `PIPELINE_TO_PUB` (linhas ~753-762) também é hard-coded. Etapas novas no Jurídico não geram cards no Kanban da Publicação.

## Mudanças propostas

### 1. Allowlist dinâmico em `pipelineStage.ts`

Manter os aliases (`arquivados -> arquivado`, etc.), mas deixar passar qualquer id normalizado (slug `a-z0-9_`). Assim `distrato`, `oposicao_replica`, etc. sobrevivem à sanitização.

### 2. Hook único `useJuridicoStages`

Novo `src/hooks/useJuridicoStages.ts` que:

- Lê `system_settings` com `key = 'admin_kanban_juridico_stages'`.
- Aplica `sanitizePipelineStagesConfig` preservando ordem.
- Retorna `{ stages, stageById }` com fallback para a lista padrão atual.
- Re-busca quando a configuração muda.

### 3. Consumidores passam a usar o hook

- `RevistaINPI.tsx`: substitui `PIPELINE_STAGES` por `stages` do hook (dropdown "Tipo", badges, label, cor). Mapas `PIPELINE_TO_PUB_STATUS` / `PUB_STATUS_TO_PIPELINE` viram identidade `id -> id` com aliases legados (`certificados <-> certificado`, `notificacao_extrajudicial -> 003`, `distrato -> arquivado` quando o destino não suporta `distrato`).
- `PublicacaoTab.tsx`: `PIPELINE_TO_PUB` derivado das `stages` (id-para-id), preservando aliases legados.
- `ClientDetailSheet.tsx`: passa a usar o hook para garantir que etapas customizadas não sejam filtradas pela sanitização.

### 4. Auditoria das três abas

- **Revista -> Processos identificados**: dropdown "Tipo" mostra todas as etapas Jurídico na ordem. Ao vincular, grava `brand_processes.pipeline_stage` com o id exato.
- **Revista -> Histórico**: badges de fase usam `stages` dinâmicas (label/cor do hook).
- **Publicação -> Kanban**: colunas continuam vindas do enum `PubStatus` (fases de publicação). Regra: mover card -> atualiza `pipeline_stage` do processo via mapa dinâmico; alterar `pipeline_stage` na ficha -> cria/atualiza publicação correspondente.

### 5. Ordem

A ordem definida em `AdminKanbanConfig` (drag-and-drop) é a fonte da verdade. Todos os consumidores renderizam pelo array `stages` na ordem retornada.

## Detalhes técnicos

- Arquivos: `src/lib/pipelineStage.ts`, novo `src/hooks/useJuridicoStages.ts`, `src/pages/admin/RevistaINPI.tsx`, `src/components/admin/PublicacaoTab.tsx`, ajustes em `src/components/admin/clients/ClientDetailSheet.tsx`.
- Sem migração de banco. Sem mudança em `system_settings`.
- Aliases preservam dados antigos (`certificados -> certificado`, `arquivados -> arquivado`, `notificacao_extrajudicial -> notificacao`).
- Fora de escopo: Kanban da área cliente, Edge Functions, importação Perfex.
