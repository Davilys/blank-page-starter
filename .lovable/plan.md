
## Plano: Substituir Contratos e Documentos Existentes na Importação ZIP

### Comportamento Atual
- **Contratos**: ao detectar `contract_number` duplicado, renomeia com sufixo `_imp_<timestamp>` (cria duplicata)
- **Documentos**: sempre cria novo registro com novo path no Storage (duplica arquivo + registro)

### Novo Comportamento (Upsert / Substituição)

#### 1. `supabase/functions/import-contracts-zip/index.ts`
- Ao processar cada contrato do ZIP:
  - Buscar contrato existente pelo `contract_number`
  - Se existir: **UPDATE** com todos os campos do manifest (HTML, assinaturas, blockchain, OTS, signatário, IP/device, etc.)
  - Se não existir: **INSERT** normalmente
- PDFs anexos do contrato:
  - Antes de inserir, deletar registros antigos em `documents` com `contract_id` igual ao contrato atualizado (limpa anexos antigos)
  - Inserir os novos PDFs do ZIP
- Remover lógica de sufixo `_imp_<timestamp>`

#### 2. `supabase/functions/import-documents-zip/index.ts`
- Ao processar cada documento do ZIP:
  - Buscar documento existente pela combinação **(`user_id` + `name` + `document_type`)** ou pelo `protocol` quando presente
  - Se existir: 
    - Fazer upload do novo arquivo no Storage (novo path)
    - **UPDATE** o registro existente com novo `file_url`, `mime_type`, `file_size`, `contract_id`, `process_id`
    - Opcionalmente remover o arquivo antigo do Storage (best-effort)
  - Se não existir: **INSERT** normalmente

#### 3. `src/lib/zipExportImport.ts`
- Adicionar contagem `updated` além de `imported`/`failed` no resultado retornado pelas edge functions
- Atualizar UI de progresso para mostrar "X criados, Y atualizados"

#### 4. UI (`Documentos.tsx` e `Contratos.tsx`)
- Aviso na confirmação de import: "Registros existentes (mesmo número de contrato / mesmo nome+tipo) serão **substituídos** com os dados do ZIP"
- Toast final mostra criados vs atualizados

### Critérios de Match
- **Contratos**: `contract_number` (campo único e estável entre instâncias)
- **Documentos**: `user_id + name + document_type` (combinação razoável; arquivos com mesmo nome para o mesmo cliente são tratados como atualização)

### Resultado
- Reimportar o mesmo ZIP não cria duplicatas
- Atualizações no projeto A podem ser propagadas ao B simplesmente reexportando e reimportando
- Assinaturas, blockchain e PDFs são sempre os mais recentes do ZIP
