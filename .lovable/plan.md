

## Plano: Exportar CRM com campos separados + Importar com pipeline_stage no Kanban

### Problema
1. O CSV exportado nao inclui `cpf` e `cnpj` como campos separados (so tem `cpf_cnpj`)
2. O `clientParser.ts` nao reconhece `pipeline_stage`, `client_funnel_type`, `process_number`, `cpf`, `cnpj` como campos mapeáveis
3. O edge function `import-clients` ignora o `pipeline_stage` do arquivo e sempre coloca o cliente em `protocolado`

### Alteracoes

#### 1. `src/lib/clientExporter.ts` — Adicionar `cpf` e `cnpj` separados
- Adicionar `cpf` e `cnpj` na interface `CRMExportableClient` e em `CRM_COLUMNS`
- Exportar esses campos separados alem de `cpf_cnpj`

#### 2. `src/lib/clientParser.ts` — Novos campos no mapeamento
- Adicionar a `SYSTEM_FIELDS`: `pipeline_stage`, `client_funnel_type`, `process_number`, `cpf`, `cnpj`
- Adicionar aliases em `FIELD_ALIASES` para cada um desses campos
- Adicionar esses campos na interface `ParsedClient`

#### 3. `supabase/functions/import-clients/index.ts` — Usar pipeline_stage do arquivo
- Adicionar `pipeline_stage`, `client_funnel_type`, `process_number` na interface `ClientToImport`
- Ao criar/atualizar `brand_processes`, usar `client.pipeline_stage` se fornecido (com fallback para `protocolado`)
- Validar o `pipeline_stage` contra os valores permitidos (usar lista similar ao `pipelineStage.ts`)
- Ao criar perfil, usar `client.client_funnel_type` se fornecido (com fallback para `juridico`)

#### 4. `src/pages/admin/Clientes.tsx` — Incluir `cpf` e `cnpj` na exportacao
- No handler `handleExportCRM`, buscar tambem os campos `cpf` e `cnpj` do profiles e incluir no CSV

### Resultado
- O CSV exportado tera todos os campos listados pelo usuario (incluindo `cpf`, `cnpj` separados)
- Ao reimportar, o auto-mapper reconhece `pipeline_stage`, `client_funnel_type`, `cpf`, `cnpj` etc.
- O cliente importado sera colocado na fase correta do kanban (ex: `deferido`, `exigencia_merito`) em vez de sempre ir para `protocolado`

