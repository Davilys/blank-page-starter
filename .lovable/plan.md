## Objetivo
Trocar **apenas** a IA usada na criação de recursos com IA (aba Recursos INPI → "Criar Recurso com IA") de **OpenAI (GPT-4o)** para **Anthropic Claude**, mantendo TODO o restante (prompts, agentes, fluxos, UI, ajuste/edição, extração de evidências, viabilidade, chat-inpi, process-inpi-document, etc.) exatamente como está hoje.

## Escopo cirúrgico
Alteração restrita a **um único arquivo**:

- `supabase/functions/process-inpi-resource/index.ts`

Tudo o mais fica intocado:
- `adjust-inpi-resource` (ajustes pós-geração) → continua OpenAI
- `extract-resource-evidences` → continua como está
- `process-inpi-document`, `inpi-viability-check`, `chat-inpi-legal` → continuam como estão
- Frontend (`RecursosINPI.tsx`, `INPIResourcePDFPreview.tsx`, `EvidenceGallery.tsx`) → sem alteração
- Prompts, system messages, lógica de duas passadas, classificação de evidências, marcadores `[DOC:NN]`, header timbrado, etc. → idênticos

## O que muda dentro de `process-inpi-resource`

1. **Nova função `callClaude(...)`** com a mesma assinatura de `callOpenAI(apiKey, systemPrompt, userParts, maxTokens, temperature)` e mesmo retorno `{ content, error?, status? }`.
   - Endpoint: `https://api.anthropic.com/v1/messages`
   - Headers: `x-api-key: ANTHROPIC_API_KEY`, `anthropic-version: 2023-06-01`, `content-type: application/json`
   - Modelo: `claude-sonnet-4-5` (mais recente Sonnet, melhor para redação jurídica longa)
   - `max_tokens` ← mesmo valor que hoje (16000 / 9000 / 1000 conforme passada)
   - `system` ← `systemPrompt`
   - `messages: [{ role: 'user', content: [...] }]`

2. **Conversão de parts** (texto / PDF / imagem) para o formato Claude:
   - `text` → `{ type: 'text', text }`
   - PDF (`input_file` com `file_data` base64 data URL) → `{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: <base64 puro> } }`
   - Imagem (`input_image` com URL ou data URL) → `{ type: 'image', source: { type: 'base64'|'url', media_type, data|url } }`

3. **Substituir as 6 chamadas** atuais a `callOpenAI(OPENAI_API_KEY, ...)` (linhas 924, 1048, 1093, 1206, 1207, 1256) por `callClaude(ANTHROPIC_API_KEY, ...)`.

4. **Troca de secret**:
   - Ler `ANTHROPIC_API_KEY` em vez de `OPENAI_API_KEY`.
   - Mensagem de erro: `ANTHROPIC_API_KEY não configurada`.
   - `OPENAI_API_KEY` continua existindo (usada por `adjust-inpi-resource` e outras funções) — apenas não é mais lida aqui.

5. **Parsing da resposta**:
   - Claude retorna `{ content: [{ type: 'text', text: '...' }] }` → concatenar todos os blocos `text` em uma string (equivalente ao loop atual de `output_text`).

## Detalhes técnicos

```text
Fluxo atual (mantido):
  process-inpi-resource
    ├── Pass 1: extração de dados do PDF INPI  (callClaude, 1000 tok, temp 0.1)
    ├── Pass 1: redação inicial do recurso      (callClaude, 9000 tok, temp 0.25)
    └── Pass 2: revisão/finalização             (callClaude, 9000 tok, temp 0.25)
  Outras rotas (indeferimento/oposição):        (callClaude, 16000 tok)
```

Limites do Claude:
- `claude-sonnet-4-5` aceita até ~64k tokens de saída, portanto os max_tokens atuais (16k/9k) cabem sem ajuste.
- Suporta PDF nativo via blocos `document` (base64), igual ao que já enviamos hoje para o OpenAI Responses API.
- Suporta imagens via base64/URL.
- `temperature` é parâmetro válido (0–1), mantemos os mesmos valores.

## Secret necessária
Será requisitada via `add_secret`:
- `ANTHROPIC_API_KEY` (obtida em https://console.anthropic.com/settings/keys)

Não toco em `OPENAI_API_KEY` — permanece para o restante do sistema.

## Fora de escopo (explicitamente NÃO mexo)
- Prompts e regras jurídicas
- Classificação de evidências (`brand_logo`, `inpi_consulta`, `evidence`)
- Header visual no PDF
- Função de ajuste (`adjust-inpi-resource`) → continua OpenAI
- Galeria de evidências, UI de criação, edição manual antes do download
- Outros agentes IA (viabilidade, chat jurídico, importação de documentos)

## Validação após implementar
1. Criar um recurso de teste (Indeferimento) com 1–2 PDFs anexos.
2. Conferir nos logs da função `process-inpi-resource` que está chamando `api.anthropic.com`.
3. Validar que o texto gerado segue o mesmo formato (timbrado, seções I/II/III, marcadores `[DOC:NN]`).
4. Confirmar que o botão "Ajustar com IA" continua funcionando (OpenAI, sem alteração).