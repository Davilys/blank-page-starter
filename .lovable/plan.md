

## Plano: Exportar/Importar Documentos e Contratos com Arquivos (ZIP)

### Resumo
Substituir o export JSON atual de Documentos por export/import ZIP com arquivos reais, e adicionar export/import ZIP para Contratos. Usa JSZip no browser para compactacao e uma edge function para import com service_role.

### Alteracoes

#### 1. Instalar JSZip
- `npm install jszip` + tipos

#### 2. `src/lib/zipExportImport.ts` — Utilitarios compartilhados
- `exportDocumentsZip(documents)`: busca cada `file_url` via fetch, adiciona ao ZIP em pasta `files/`, gera `manifest.json` com metadados (name, document_type, mime_type, file_size, protocol, user_id, process_id, created_at, client_email, brand_name), retorna blob ZIP
- `exportContractsZip(contracts)`: gera `contracts_manifest.json` com todos os campos do contrato + `contract_html`, busca PDFs associados na tabela `documents` (onde `contract_id`), adiciona ao ZIP em pasta `pdfs/`, retorna blob ZIP
- Helper `downloadBlob(blob, filename)` para trigger de download
- Callback `onProgress(current, total, label)` para barra de progresso

#### 3. `src/pages/admin/Documentos.tsx` — Substituir botoes Export/Import
- **Exportar ZIP**: Substitui o export JSON inline pelo novo `exportDocumentsZip()` com dialog de progresso
- **Importar ZIP**: Aceita `.zip`, le manifest.json, para cada arquivo faz upload ao Storage bucket `documents` e chama edge function `import-documents-zip` que cria registros com service_role
- Associa `user_id` via `client_email` → busca `profiles.email`
- Associa `process_id` via `brand_name` → busca `brand_processes`

#### 4. `src/pages/admin/Contratos.tsx` — Adicionar botoes Export/Import
- **Exportar Contratos ZIP**: Novo botao que chama `exportContractsZip()` com progresso
- **Importar Contratos ZIP**: Aceita `.zip`, le `contracts_manifest.json`, cria contratos via edge function `import-contracts-zip` com service_role, faz upload de PDFs associados

#### 5. `supabase/functions/import-documents-zip/index.ts` — Nova edge function
- Recebe JSON body com array de documentos (metadados + `storage_path` do arquivo ja uploadado)
- Resolve `user_id` por email e `process_id` por brand_name
- Insere registros na tabela `documents` com service_role (bypassa RLS)
- Retorna contagem de importados/falhados

#### 6. `supabase/functions/import-contracts-zip/index.ts` — Nova edge function
- Recebe JSON body com array de contratos (todos os campos)
- Resolve `user_id` por email
- Insere registros na tabela `contracts` com service_role
- Cria registros em `documents` para PDFs associados
- Retorna contagem de importados/falhados

### Limites
- ~500MB por ZIP (limite browser). Exibe aviso para volumes grandes.
- Arquivos sao baixados sequencialmente com retry (1 tentativa) para URLs inacessiveis.

### Resultado
- Documentos e Contratos podem ser transferidos entre instancias CRM com arquivos reais
- Associacoes user_id e process_id sao resolvidas automaticamente por email/brand_name
- Progresso visivel durante export e import

