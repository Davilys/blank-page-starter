## Objetivo
Reverter a IA da aba Recursos INPI → "Criar Recurso com IA" de **Claude** para **OpenAI GPT-4o**, restaurando o comportamento que cabia em uma única invocação da edge function e eliminando os timeouts.

## Causa raiz confirmada
Os logs mostram que PASS 1 com Claude leva ~190s sozinho e PASS 2 é morto pelo limite de wall clock (~150–200s) do Supabase Edge. O frontend então cai no `catch`, faz `setStep('upload')` e o usuário percebe como "volta à página inicial". OpenAI GPT-4o completava as duas passadas dentro do limite.

## Escopo cirúrgico
**Um único arquivo:** `supabase/functions/process-inpi-resource/index.ts`

### O que muda
1. **Restaurar `callOpenAI(...)`** com a mesma assinatura atual de `callClaude`:
   - Endpoint: `https://api.openai.com/v1/chat/completions`
   - Headers: `Authorization: Bearer ${OPENAI_API_KEY}`
   - Modelo: `gpt-4o`
   - Body: `{ model, messages: [{role:'system', content:systemPrompt},{role:'user', content:userParts}], max_tokens, temperature }`
   - Conversão de `parts` (texto / PDF base64 / imagem) para o formato OpenAI Responses-style que já funcionava antes (texto, `input_file` com `file_data`, `input_image`).
   - Parsing: `aiData.choices[0].message.content`.

2. **Trocar leitura de secret**: `ANTHROPIC_API_KEY` → `OPENAI_API_KEY` (já existe no projeto). Mensagem de erro: `OPENAI_API_KEY não configurada`.

3. **Substituir as 6 chamadas `callClaude(ANTHROPIC_API_KEY, ...)`** (linhas 988, 1112, 1157, 1270, 1271, 1320) por `callOpenAI(OPENAI_API_KEY, ...)` com os MESMOS `max_tokens` e `temperature` atuais.

4. **Remover `callClaude` e helpers de conversão Claude** (`convertToClaudeFormat`) — não são mais usados.

### O que NÃO muda
- Prompts, system messages, lógica de duas passadas (PASS 1 / PASS 2)
- Classificação de evidências (`brand_logo`, `inpi_consulta`, `evidence`)
- Marcadores `[DOC:NN]`
- Header timbrado visual no PDF
- Frontend (`RecursosINPI.tsx`, `INPIResourcePDFPreview.tsx`, `EvidenceGallery.tsx`) — nenhuma linha alterada
- `adjust-inpi-resource` (já era OpenAI, continua)
- `extract-resource-evidences`, `inpi-viability-check`, `chat-inpi-legal`, `process-inpi-document`
- `ANTHROPIC_API_KEY` permanece configurada (não removo o secret) — apenas deixa de ser lida aqui

## Validação pós-implementação
1. Criar um recurso de Oposição com 3 PDFs anexos (mesmo caso dos logs).
2. Conferir nos logs da função `process-inpi-resource`:
   - `=== TWO-PASS GENERATION START ===`
   - `PASS 1 complete: NNNN chars` (esperado em ~40–70s com GPT-4o)
   - `PASS 2: Generating Sections V-VIII...`
   - Resposta 200 dentro do tempo limite — sem shutdown prematuro.
3. Conferir no frontend que o `setStep('review')` é atingido e o texto aparece para edição.
4. Confirmar que o botão "Ajustar com IA" continua funcionando (já era OpenAI, sem mudança).

## Fora de escopo
Qualquer alteração em prompts, agentes, evidências, UI, PDF ou outras funções de IA.
