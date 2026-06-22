## Problema

Na aba "Ajustes com IA" do Rascunho do Recurso, quando o usuário descreve um ajuste (ex.: "remova jurisprudência", "torne mais objetivo", "corrija a classe X para Y", "reforce o item III"), o agente não está lendo as orientações nem comparando com o rascunho — está apenas devolvendo o texto quase intacto ou ignorando o pedido.

Causa raiz no `supabase/functions/adjust-inpi-resource/index.ts`:

1. O system prompt obriga **sempre acrescentar** e **nunca encurtar** ("O texto ajustado deve ser MAIOR ou IGUAL ao original — NUNCA menor"). Isso bloqueia ajustes legítimos de remoção/objetividade (ex.: TIPO A do exame de mérito, "remova citação doutrinária", "corte a conclusão extensa").
2. O prompt do usuário não força o modelo a **ler primeiro as orientações, mapeá-las a cada seção do rascunho e só então editar**.
3. `max_completion_tokens: 16000` no `gpt-5` é insuficiente — o modelo gasta tokens em raciocínio interno e a resposta é truncada, devolvendo um trecho incompleto que parece "não ter sido ajustado".
4. Nenhuma validação de que as orientações foram efetivamente aplicadas — se o modelo devolve texto idêntico, o sistema aceita.

## Mudança

Arquivo único: `supabase/functions/adjust-inpi-resource/index.ts`.

### 1) Reescrever `systemPrompt`

Substituir as "REGRAS ABSOLUTAS" atuais por um fluxo explícito de 4 passos que o agente DEVE seguir antes de gerar o texto:

```
PASSO 1 — LEIA as ORIENTAÇÕES DE AJUSTE do usuário palavra por palavra e liste internamente cada pedido (adicionar X, remover Y, corrigir Z, encurtar W).
PASSO 2 — LEIA o RASCUNHO DO RECURSO inteiro e localize, para cada pedido do passo 1, a seção/parágrafo exato impactado.
PASSO 3 — APLIQUE cada ajuste fielmente:
  • "adicione/insira/reforce" → expande a seção indicada.
  • "remova/retire/exclua/corte" → APAGA o trecho indicado, mesmo que isso encurte a peça.
  • "corrija/troque/substitua" → substitui o trecho antigo pelo novo conteúdo.
  • "deixe mais objetivo/curto/conciso" → REESCREVE a seção de forma mais enxuta.
  • "reorganize/mova" → reordena seções.
PASSO 4 — Devolva o recurso COMPLETO já com TODOS os ajustes aplicados. Não devolva o texto sem aplicar; não devolva resumo das mudanças.
```

Adicionar regras de preservação que continuam valendo:
- Manter cabeçalho determinístico (processo, marca, classe, titular, examinador, procurador) — o código já reaplica isso ao final.
- Preservar marcadores literais `[DOC:NN]`, `[IMG:marca_cliente]`, `[IMG:marca_opositora]`, tabelas markdown, **negrito** e *itálico*.
- Manter encerramento ("Termos em que, pede deferimento" + assinatura) uma única vez ao final.

REMOVER as regras que travam o ajuste:
- "O texto ajustado deve ser MAIOR ou IGUAL ao original — NUNCA menor"
- "NUNCA retorne um texto resumido, abreviado ou mais curto que o original"
- "O recurso ajustado DEVE ser mais robusto que o original"

Substituir por: "O tamanho final é consequência dos ajustes pedidos — encurte quando o usuário pedir objetividade/remoção, expanda quando pedir reforço."

### 2) Reescrever `userPrompt`

Trocar a ordem para forçar o modelo a ler as orientações primeiro:

```
ORIENTAÇÕES DE AJUSTE DO USUÁRIO (leia, interprete e aplique COMPLETAMENTE):
---INÍCIO DAS ORIENTAÇÕES---
{adjustmentInstructions}
---FIM DAS ORIENTAÇÕES---

RASCUNHO ATUAL DO RECURSO (compare com as orientações acima e aplique cada ajuste no local correto):
---INÍCIO DO RASCUNHO---
{currentContent}
---FIM DO RASCUNHO---

INSTRUÇÕES FINAIS:
- Aplique TODAS as orientações listadas, fielmente.
- Devolva apenas o recurso final ajustado, sem comentários, sem listagem de mudanças.
- Mantenha cabeçalho, marcadores [DOC:NN], tabelas e encerramento.
```

### 3) Aumentar token budget

Subir `max_completion_tokens` de 16000 para 32000 (o `gpt-5` reserva muito para reasoning; com 16k o output era cortado e parecia "sem ajuste").

### 4) Log de auditoria

Após receber a resposta, logar quantos caracteres mudaram (`Levenshtein` é caro — usar diferença simples de comprimento + checagem se `trimmed === currentContent`) e devolver um aviso no console quando o texto sai idêntico, para facilitar diagnóstico futuro.

## Fora de escopo

- Nenhuma mudança no frontend (`RecursosINPI.tsx`, `INPIResourcePDFPreview.tsx`).
- Nenhuma mudança em `process-inpi-resource` (geração inicial).
- Nenhuma mudança nos outros tipos de peça além do prompt unificado de ajustes (que já serve todos).
