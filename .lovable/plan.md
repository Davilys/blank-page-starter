# Corrigir erro ao salvar processo com etapa customizada

## Problema
Ao tentar salvar um `brand_processes` com uma etapa customizada do Kanban Jurídico (ex.: `sobrestamento`), o banco retorna:

```
new row for relation "brand_processes" violates check constraint "brand_processes_status_check"
```

A causa é uma `CHECK constraint` antiga em `brand_processes` que só aceita um conjunto fixo de slugs de `pipeline_stage` (protocolado, 003, oposicao, etc.). Etapas novas criadas pelo admin no Kanban não passam por essa lista — por isso o salvamento falha.

Isso contradiz a refatoração já feita no front (hook `useJuridicoStages` + `normalizePipelineStageId` aceitando qualquer slug `[a-z0-9_]+`).

## Solução
Substituir o CHECK por uma validação de **formato de slug**, mantendo segurança (sem aceitar lixo) mas permitindo qualquer etapa válida criada no Kanban.

### Migration
```sql
ALTER TABLE public.brand_processes
  DROP CONSTRAINT IF EXISTS brand_processes_status_check;

ALTER TABLE public.brand_processes
  ADD CONSTRAINT brand_processes_pipeline_stage_format_check
  CHECK (pipeline_stage IS NULL OR pipeline_stage ~ '^[a-z0-9_]+$');
```

## Impacto
- Nenhum dado existente é alterado (todos os slugs atuais já casam com `^[a-z0-9_]+$`).
- Nenhum código de aplicação muda — o front já normaliza com a mesma regex.
- Etapas customizadas (ex.: `sobrestamento`) passam a ser salvas normalmente.

## Arquivos
- Nova migration Supabase (apenas DDL).
