

## Auditoria Completa Final — Sistema ZIP Export/Import

Revisei `src/lib/zipExportImport.ts` (500 linhas), as duas edge functions e o estado real do banco (336 contratos, 285 assinados, 105 com blockchain/OTS, 1.420 documentos, 192 vinculados a contratos).

### ✅ Status Geral: 100% Funcional

Não há issues críticos. Todas as correções dos planos anteriores foram aplicadas e o sistema está pronto para produção.

### Validações confirmadas

**Export de Contratos** (`zipExportImport.ts` 178-301)
- Hidrata contrato completo via `select *` antes de exportar — captura TODOS os campos do banco
- Inclui blockchain (`blockchain_hash/timestamp/tx_id/network/proof`), OTS proof baixado para `ots_proofs/`, assinaturas visuais (client/contractor_signature_image), forensics (signature_ip, user_agent, device_info), signatário (CPF/CNPJ/nome), valores e datas
- PDFs anexos com mime_type preservado em `pdf_files_detailed`
- Manifest dual-key (`pdf_files`/`attached_pdfs`) → compatível com versões antigas

**Export de Documentos** (97-152)
- Resolve `contract_number` antes do export → permite reconectar vínculo no destino
- Manifest dual-key (`file_path`/`zip_filename`, `original_file_url`/`file_url`)

**Import de Contratos** (edge function)
- Upsert por `contract_number` → atualiza em vez de duplicar
- Re-resolve user_id por email, process_id por brand_name+user, contract_type_id e template_id por nome
- Delete de PDFs antigos só ocorre se ZIP traz novos (linha 138) — não destrói anexos existentes em re-imports vazios
- Insere todos os 30+ campos incluindo blockchain e forensics

**Import de Documentos** (edge function)
- Match prioritário por `(contract_id + name)` → resolve colisão de PDFs com nome genérico
- Fallback para `protocol`, depois `(user_id + name + document_type)`
- Delete best-effort do arquivo antigo no Storage após update
- `uploaded_by: 'system'` válido (coluna é `text`, não `uuid` — confirmado no schema)

**MIME types e abertura no navegador**
- `MIME_TO_EXT` cobre PDF, imagens, Office, texto
- Upload sempre passa `contentType` correto → arquivos abrem inline no browser
- Extensão resolvida via mime_type quando o nome não tem `.ext`

**Download resiliente**
- SDK Supabase primeiro, fallback para `fetch()` direto na URL pública
- Funciona para storage público e privado

### Pontos de atenção (não-bloqueantes)

1. **185 documentos no banco sem `mime_type`** — ao exportar, o helper `getExtensionFromName` cai no fallback `'bin'` se o nome também não tiver extensão. **Já é tratado**, mas seria útil avisar o usuário no toast pós-export quando há docs sem mime.
2. **Performance**: contratos não rodam em batch (loop sequencial). 336 contratos × ~2s cada = ~10 min. Aceitável para export pontual, mas se o usuário pedir exports recorrentes, considerar paralelizar com `Promise.all` em chunks de 5.

### Conclusão

**Nenhuma correção necessária.** O sistema está:
- Juridicamente íntegro (assinaturas, blockchain e OTS preservados)
- Idempotente (reimportar não duplica)
- Cross-project compatível (manifest dual-key + lookups por email/nome)
- Robusto contra dados parciais (fallbacks em download, mime, file_path)

Pode usar com confiança entre as duas instâncias do CRM.

