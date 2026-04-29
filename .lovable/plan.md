# Correção: PDF do distrato assinado não chega na área do cliente nem nos anexos

## Diagnóstico

Verifiquei no banco: existem vários distratos com `signature_status = 'signed'` (ex.: contrato 20268355 assinado em 28/04), mas **nenhum** registro correspondente na tabela `documents`. Os logs das edge functions também confirmam que `upload-signed-contract-pdf` nunca foi chamada para distratos.

Causas encontradas em `src/pages/AssinarDocumento.tsx` (função `handleSign`):

1. **Upload do PDF é "fire-and-forget"** (linha 414): `generateAndUploadContractPdf({...}).then(...)` é disparado sem `await`. A geração do PDF (html2canvas + jsPDF + base64) leva 5–15 segundos. Como distratos **não têm `payment_method`**, o handler termina imediatamente após `fetchContract()` e o usuário normalmente fecha/sai da página, abortando a Promise antes dela chegar na edge function.

2. **`documentType` errado no gerador de HTML** (linha 400): `generateSignedContractHtml(...)` é chamado com apenas 5 argumentos posicionais, omitindo o 6º parâmetro `documentType`. Resultado: o PDF do distrato sai com cabeçalho de "CONTRATO" em vez de "DISTRATO".

3. **Falta de feedback ao usuário**: erros do upload caem silenciosamente em `console.error`, sem `toast`, então o cliente acha que tudo foi salvo.

## Correções a aplicar

### 1. `src/pages/AssinarDocumento.tsx` — função `handleSign`

- Trocar `.then(...)` por `await generateAndUploadContractPdf(...)` para garantir que o upload conclua antes de mostrar a tela de sucesso e antes de qualquer navegação.
- Passar o 6º parâmetro `documentType` para `generateSignedContractHtml`, mapeando `contract.document_type` para um dos valores aceitos (`'contract' | 'procuracao' | 'distrato_multa' | 'distrato_sem_multa'`).
- Mostrar `toast.error` se o upload falhar (mas manter o `signed = true`, pois a assinatura blockchain já foi gravada).
- Mostrar um estado de loading "Gerando PDF assinado…" enquanto o upload roda, para o usuário não fechar a aba.

### 2. `supabase/functions/upload-signed-contract-pdf/index.ts`

- Hoje o `existingDoc` lookup faz `.maybeSingle()` em `contract_id` sem filtrar por tipo. Se já existir qualquer documento ligado ao contrato, ele é sobrescrito. Ajustar para filtrar `document_type ILIKE 'contrato%' OR document_type ILIKE 'distrato%' OR document_type = 'procuracao'` e usar `.limit(1)` em vez de `.maybeSingle()` (que dá erro se houver duplicatas).
- Garantir que o `process_id` do contrato seja preenchido no documento criado, para o anexo aparecer também na ficha do processo do cliente.
- Logar em `console.log` o `userId`/`contractId`/`documentType` recebidos para facilitar debug futuro.

### 3. Reprocessar distratos já assinados sem PDF (opcional, recomendado)

Criar uma rotina admin (botão "Regerar PDF assinado" no detalhe do contrato) que:
- Busca contratos com `signature_status = 'signed'` e sem documento correspondente.
- Reconstrói o HTML usando `generateSignedContractHtml` com os dados de blockchain já salvos no contrato.
- Chama `upload-signed-contract-pdf` para cada um.

Alternativa mais simples: um script one-shot via edge function `regenerate-signed-pdfs` que faz o mesmo em lote para todos os distratos pendentes. Posso rodar esse script após o deploy para preencher o histórico.

## Arquivos afetados

- `src/pages/AssinarDocumento.tsx` (handleSign + UI de loading)
- `supabase/functions/upload-signed-contract-pdf/index.ts` (lookup mais seguro + process_id)
- `supabase/functions/regenerate-signed-contract-pdfs/index.ts` (nova, opcional, para backfill)

## Resultado esperado

- Ao assinar um distrato (com ou sem multa), o PDF é gerado e enviado **antes** de a tela de sucesso aparecer.
- O documento fica salvo em `documents` vinculado ao contrato e ao usuário, aparecendo:
  - Na **área do cliente** (`/cliente/documentos`)
  - Na **aba Anexos do ficheiro do cliente** no CRM admin
- Falhas de upload viram `toast.error` visível, em vez de erro silencioso.
- (Se aprovado o backfill) os distratos já assinados ganham seus PDFs retroativamente.
