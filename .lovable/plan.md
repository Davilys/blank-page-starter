## Auditoria Completa — Diagnóstico

### O que está OK

- `extractStoragePath` + `downloadFile` com SDK + fallback fetch: funciona
- Manifesto com chaves duplas (compatibilidade cross-project): OK
- Edge functions deployadas com service_role: OK
- Progress bar e batching: OK

### Problemas Críticos Identificados

**1. CONTRATOS — Dados de assinatura e blockchain NÃO são exportados nem importados**
A interface `ContractManifestEntry` e o INSERT no edge function `import-contracts-zip` ignoram TODOS estes campos:

- `blockchain_hash`, `blockchain_timestamp`, `blockchain_tx_id`, `blockchain_network`, `blockchain_proof`
- `client_signature_image`, `contractor_signature_image`
- `signature_ip`, `signature_user_agent`, `signature_token`, `signature_expires_at`
- `signatory_name`, `signatory_cpf`, `signatory_cnpj`
- `ip_address`, `user_agent`, `device_info`
- `ots_file_url` (proof OpenTimestamps), `contract_type`, `contract_type_id`, `template_id`, `process_id`, `lead_id`
- `penalty_value`, `custom_due_date`, `suggested_classes`, `asaas_payment_id`, `visible_to_client`

**Resultado**: Contratos importados perdem assinaturas, blockchain proof e assinaturas digitais — exatamente o que o usuário pediu para preservar.

**2. CONTRATOS — PDF `ots_file_url` (blockchain timestamp proof) não é baixado para o ZIP**
O loop só busca `documents` com `contract_id`, mas o arquivo `.ots` está em `contracts.ots_file_url` direto.

**3. DOCUMENTOS — `contract_id` não é exportado/importado**
Documentos vinculados a contratos perdem o vínculo na importação.

**4. DOCUMENTOS — Arquivos importados perdem extensão correta**
Linha 292: `entry.name.split('.').pop() || 'bin'` — se o nome não tiver extensão, vira `.bin` e o arquivo não abre. Deve usar `mime_type` como fallback (ex: `application/pdf` → `.pdf`).

**5. DOCUMENTOS — `mime_type` não é definido no upload**
`supabase.storage.upload()` não passa `contentType`, então arquivos sobem como `application/octet-stream` e o navegador baixa em vez de abrir (PDFs, imagens não pré-visualizam).

**6. CONTRATOS — Mesmo problema de mime_type nos PDFs assumindo sempre `.pdf**`
Linha 385: hardcoded `.pdf` no path, mas sem `contentType: 'application/pdf'` no upload.

---

## Plano de Correção

### 1. `src/lib/zipExportImport.ts`

- **Expandir `ContractForExport` e `ContractManifestEntry**` com TODOS os campos de assinatura, blockchain, signatário, IP/device, IDs relacionais (template_id, contract_type_id, process_id, lead_id), valores e flags
- **Exportar `ots_file_url**` baixando o arquivo blockchain proof e adicionando ao ZIP em `pdfs/ots_<contract_number>.ots` com referência no manifest
- **Exportar `contract_id**` dos documentos no manifest
- **Helper `getExtensionFromMime**` para resolver extensão correta a partir do mime_type quando o nome não a tiver
- **Upload com `contentType**` correto baseado em `mime_type` (vital para abrir arquivos)
- **Importar PDFs de contratos** preservando mime_type real (não assumir `.pdf`)

### 2. `supabase/functions/import-contracts-zip/index.ts`

- **Inserir TODOS os campos** novos do manifest na tabela `contracts`: blockchain_*, signature_*, client/contractor_signature_image, signatory_*, ip_address, user_agent, device_info, ots_file_url, contract_type, penalty_value, custom_due_date, etc.
- **Resolver `process_id**` opcionalmente pelo brand_name se vier no manifest
- **Re-upload do ots_file** se vier como arquivo no ZIP, atualizar `ots_file_url` no contrato
- **Manter document_type correto** dos PDFs anexos

### 3. `supabase/functions/import-documents-zip/index.ts`

- **Aceitar `contract_id` resolvido por contract_number** (resolver via lookup na tabela contracts)
- Manter resolução de user_id e process_id atuais

### 4. Mensagens claras na UI

- Contratos: aviso "Inclui assinaturas, blockchain proof e PDFs"
- Documentos: aviso "Arquivos abrem com mime type preservado"

### Resultado Esperado

- Contratos exportados ↔ importados com assinatura digital + hash blockchain + proof OpenTimestamps intactos
- Documentos importados abrem corretamente no navegador (PDF visualiza, imagem mostra) graças ao `contentType` correto
- Vínculos contract_id ↔ documents preservados
- Compatibilidade total entre instâncias do CRM mantida (chaves duplas no manifest) Auditoria da Implementação ZIP — Resultado
  ### ❌ Falhas críticas encontradas
  **1. Contratos perdem TODA a prova de assinatura digital na exportação**  
  O manifest exporta apenas 18 campos básicos. Os campos abaixo (presentes em 270 contratos do banco) **NÃO** são incluídos:
  - `blockchain_hash`, `blockchain_timestamp`, `blockchain_tx_id`, `blockchain_network`, `blockchain_proof` — prova OpenTimestamps/Bitcoin
  - `ots_file_url` — arquivo .ots de validação blockchain
  - `client_signature_image`, `contractor_signature_image` — imagens das assinaturas
  - `signature_ip`, `signature_user_agent`, `ip_address`, `user_agent`, `device_info` — metadados forenses (Lei 14.063/2020)
  - `signature_token`, `signature_expires_at`, `asaas_payment_id`, `lead_id`, `process_id`, `custom_due_date`, `suggested_classes`, `created_by`
  **Impacto:** ao importar no projeto B, o contrato chega como "assinado" mas sem nenhum hash, sem assinatura visual, sem prova blockchain — tornando juridicamente inválido e quebrando a página `/verificar-contrato?hash=...`.
  **2. Conflito de chave única** `contract_number` **na importação**  
  O insert preserva `contract_number` original. Se o projeto B já tiver contratos com a mesma numeração (cenário comum em CRMs idênticos), o insert falha sem fallback.
  **3. PDFs assinados são duplicados, não vinculados**  
  O PDF assinado original (no bucket `documents/signed-contracts/`) é re-enviado para `documents/imported/`, criando registro novo em `documents` em vez de manter o vínculo correto. Funciona, mas perde a estrutura de pastas original.
  **4. Documentos: arquivo** `.ots` **(prova blockchain) vai como documento solto**  
  Os arquivos `.ots` em `documents/ots-proofs/` aparecem na exportação de Documentos sem nenhuma marcação especial — não são reconectados ao contrato correto na importação.
  **5. Sem validação de tamanho/quota antes do export**  
  Com 270+ contratos e seus PDFs, o ZIP pode passar de 500MB e travar o navegador silenciosamente. Sem aviso prévio nem export em lotes.
  **6. Documentos importados com** `uploaded_by: 'import_zip'` **(string)**  
  A coluna `uploaded_by` é `uuid` no banco. Isso causa erro de insert silencioso em todo documento importado.
  ---
  ### ✅ O que funciona corretamente
  - Estrutura ZIP com `manifest.json` é válida
  - Mapeamento por email (cliente) e nome (marca/template/tipo) está correto
  - Download dos arquivos do Storage via `fetch` funciona para buckets públicos
  - Re-upload para Storage do projeto destino funciona
  - Progress callback e UI de progresso funcionam
  ---
  ### Plano de correção
  **1.** `src/lib/zipDocumentExporter.ts` **— Export de Contratos COMPLETO**  
  Adicionar ao `ContractManifestEntry` e ao manifest:
  - Todos os campos blockchain (`blockchain_hash`, `blockchain_timestamp`, `blockchain_tx_id`, `blockchain_network`, `blockchain_proof`, `ots_file_url`)
  - Imagens de assinatura (`client_signature_image`, `contractor_signature_image`)
  - Metadados forenses (`signature_ip`, `signature_user_agent`, `ip_address`, `user_agent`, `device_info`)
  - Demais campos (`signature_token`, `signature_expires_at`, `asaas_payment_id`, `process_id` via brand_name lookup, `custom_due_date`, `suggested_classes`)
  - Baixar também o arquivo `.ots` (de `ots_file_url`) e incluir no ZIP em `ots_proofs/`
  **2. Import de Contratos — Preservar prova jurídica**
  - Inserir todos os novos campos
  - Re-upload do `.ots` para o novo Storage e atualizar `ots_file_url` com nova URL
  - Tratar conflito de `contract_number`: se existir, gerar sufixo `_imp_<timestamp>` e logar aviso
  - Mapear `process_id` via `brand_name` (igual documents)
  **3. Import de Documentos — Corrigir bug** `uploaded_by`
  - Remover string `'import_zip'` (coluna é uuid). Usar `null` ou o uuid do admin atual via `auth.getUser()`
  - Preservar pasta original (`signed-contracts/`, `ots-proofs/`) no novo Storage para manter URLs previsíveis
  **4. Validação de tamanho pré-export**
  - Antes de baixar arquivos, somar `file_size` dos documents + estimar contratos
  - Se > 400MB, alertar usuário e oferecer "exportar apenas últimos N" ou continuar sob risco
  **5. Verificação pós-import**
  - Após importar contratos, recalcular `blockchain_hash` opcionalmente NÃO — manter o original (a prova OTS é vinculada ao hash original do projeto A, e a página `/verificar-contrato` valida pelo hash, não pelo conteúdo recriado)
  - Garantir que `signature_status='signed'` + `blockchain_hash` + `ots_file_url` cheguem juntos no projeto B → `VerificarContrato.tsx` funcionará identicamente
  ### Resultado esperado após correção
  - Exportar projeto A → importar projeto B → abrir `/verificar-contrato?hash=<hash>` no projeto B → mostra contrato 100% válido, com assinaturas visuais, prova blockchain Bitcoin verificável, IP/dispositivo de assinatura preservados
  - PDFs abrem corretamente (re-uploaded para Storage público do projeto B)
  - Sem duplicatas nem perda de vínculos cliente↔marca↔contrato↔documento