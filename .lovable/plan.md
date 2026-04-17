
## Auditoria Final ZIP Export/Import — Resultado

### ✅ O que está 100% funcional
- **Download de arquivos**: SDK Supabase + fallback fetch — funciona para storage público e privado
- **Manifest dual-key**: `file_path`/`zip_filename`, `pdf_files`/`attached_pdfs`, `original_file_url`/`file_url` — compatível cross-project
- **Contratos**: exporta e importa todos os 30+ campos (blockchain hash/proof/tx_id/timestamp, OTS file, assinaturas visuais, IP/device forense, signatário, valores, datas)
- **Documentos**: MIME type preservado no upload (`contentType`), extensão resolvida via mapa MIME→ext quando nome não tem extensão — arquivos abrem direto no navegador
- **Upsert**: contratos casam por `contract_number`, documentos por `protocol` ou `(user_id+name+document_type)` — reimportação não duplica
- **Vínculos**: `contract_id` reconectado em documentos via lookup por `contract_number`
- **Batching**: 50 itens/batch para documentos
- **OTS proof blockchain**: baixado em `ots_proofs/` e re-uploaded no destino, atualizando `ots_file_url`

### ⚠️ Pontos a corrigir (3 issues reais)

**1. Contagem `updated` errada na UI de documentos** (`zipExportImport.ts` linha 398)
A função client-side faz 1 chamada por documento, e o edge function retorna `updated:1` ou `imported:1`. O código atual (`(fnData as any)?.updated > 0`) está correto, mas o bug é que **um único item nunca pode contar simultaneamente** — está OK na verdade. ✅ (falso alarme)

**2. PDFs anexos do contrato não são reuploadados quando contrato é UPDATE**
No edge function, ao fazer UPDATE, deletamos `documents` antigos com `contract_id`, mas reinserimos os novos só se `c.pdf_files.length > 0`. Se o ZIP veio sem PDFs anexos (ex: contrato sem assinatura), os antigos são apagados sem reposição. Risco: re-import "vazio" deletaria PDFs já existentes no destino.
**Fix**: só deletar antigos se `c.pdf_files?.length > 0` (substituir só quando há novos).

**3. Match de documento por `(user_id + name + document_type)` é frágil para PDFs de contrato**
PDFs assinados de contrato são todos `name: "Documento do Contrato"` + `document_type: "contrato"` para o mesmo `user_id`. Múltiplos contratos do mesmo cliente colidiriam no upsert.
**Fix**: priorizar match por `(contract_id + name)` quando `contract_id` está resolvido, antes de cair no match por `user_id+name+document_type`.

**4. UI: avisos de substituição não mostram nas telas de import**
`Documentos.tsx` e `Contratos.tsx` não exibem o aviso "registros existentes serão substituídos" antes do usuário clicar importar. Plano anterior previa isso mas ficou só no toast final.
**Fix**: adicionar `<Alert>` no AlertDialog de confirmação de import.

### 🔧 Correções a aplicar

**A. `supabase/functions/import-contracts-zip/index.ts`**
- Linha 138: condicionar `delete documents` a `Array.isArray(c.pdf_files) && c.pdf_files.length > 0`

**B. `supabase/functions/import-documents-zip/index.ts`**
- Adicionar 3º critério de match (prioridade máxima): se `contractId` resolvido, buscar `documents` por `(contract_id + name)` antes dos outros critérios

**C. `src/pages/admin/Documentos.tsx` e `src/pages/admin/Contratos.tsx`**
- Adicionar Alert visual no diálogo de confirmação: "⚠️ Registros existentes (mesmo número de contrato / mesmo nome) serão SUBSTITUÍDOS pelos dados do ZIP"

### Resultado
- Reimportar ZIP sem PDFs não apaga PDFs antigos do contrato
- PDFs de múltiplos contratos do mesmo cliente não colidem no upsert
- Usuário vê aviso explícito antes de confirmar substituição
- Sistema fica 100% confiável para sincronização entre instâncias
