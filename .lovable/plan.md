

## Plano: Corrigir Export/Import ZIP de Documentos

### Problema
O `fetch(doc.file_url)` no export falha silenciosamente por CORS ao tentar baixar arquivos do Supabase Storage. Os arquivos nunca sao adicionados ao ZIP — o manifest fica com `file_path: ""` para todos. Na importacao, como nao ha arquivos no ZIP, todos falham com "Sem arquivo para ...".

### Causa Raiz
URLs publicas do Supabase Storage (`https://scpbqsvwojhbxihyqbdz.supabase.co/storage/v1/object/public/documents/...`) podem bloquear `fetch()` do browser por CORS. O `catch` silencioso esconde o erro.

### Solucao
Usar `supabase.storage.from('documents').download(path)` em vez de `fetch(url)`. O SDK do Supabase autentica a requisicao e usa o endpoint correto, evitando CORS.

### Alteracoes

#### 1. `src/lib/zipExportImport.ts` — Corrigir `exportDocumentsZip`
- Extrair o path relativo do `file_url` (parte apos `/storage/v1/object/public/documents/`)
- Usar `supabase.storage.from('documents').download(path)` em vez de `fetch(doc.file_url)`
- Se o download via SDK falhar, tentar `fetch(doc.file_url)` como fallback
- Adicionar log de erro visivel (nao silencioso) quando ambos falham

#### 2. `src/lib/zipExportImport.ts` — Corrigir `exportContractsZip`
- Mesma correcao: usar `supabase.storage.from('documents').download(path)` para PDFs associados

#### 3. `src/lib/zipExportImport.ts` — Melhorar `importDocumentsZip`
- Quando `file_path` esta vazio mas o manifest tem `file_url` original, tentar re-baixar o arquivo da URL original como fallback
- Isso permite importar ZIPs que foram exportados antes da correcao

### Resultado
- Export ZIP inclui os arquivos reais (via SDK download autenticado)
- Import funciona corretamente com os arquivos do ZIP
- Fallback para fetch direto garante compatibilidade com URLs externas

