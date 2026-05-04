## Diagnóstico — quanto está demorando hoje

Analisei os logs reais da edge function `inpi-viability-check` (consulta da marca "zarro colezione"):

```
20:24:40  INÍCIO
20:24:43  Classes NCL via IA (3s)        ← gpt-5.2
20:24:45  Buscas paralelas INPI/CNPJ/Web (2s)
20:24:47  Início do laudo via IA
20:25:08  FIM                            ← análise final levou 21s (gpt-5.2)
─────────────────────────────────────
Total na edge function: ~28s
+ Delay artificial no frontend:  3s
= Tempo total visto pelo usuário: ~31s
```

**Gargalos identificados:**
1. **Geração do laudo final** — `openai/gpt-5.2` com `max_completion_tokens: 3000` → 21s (75% do tempo total)
2. **Sugestão de classes NCL** — `openai/gpt-5.2` → 3s
3. **Delay artificial** de 3000ms em `src/lib/api/viability.ts` (linha `await new Promise(resolve => setTimeout(resolve, 3000))`)
4. **Animação do HUD** no `ViabilityStep.tsx` configurada para 5000ms (`totalDuration = 5000`)

Meta: cair de ~28-31s para **≤14s** (metade), idealmente próximo dos 9s antigos.

## Mudanças propostas

### 1. `supabase/functions/inpi-viability-check/index.ts`
- **`generateFinalAnalysis`** (linha ~697): trocar `openai/gpt-5.2` por `google/gemini-2.5-flash` (3-5x mais rápido, qualidade equivalente para laudo estruturado). Reduzir `max_completion_tokens` de 3000 → 1800 (laudo continua completo). Estimativa: 21s → ~6s.
- **`suggestClassesWithAI`** (linha ~157): trocar `openai/gpt-5.2` por `google/gemini-2.5-flash`. Estimativa: 3s → ~1s.
- Manter todos os prompts, validações, fallbacks e estrutura JSON exatamente como estão.

### 2. `src/lib/api/viability.ts`
- Remover o `await new Promise(resolve => setTimeout(resolve, 3000))` artificial. A animação visual já cobre a sensação de progresso.

### 3. `src/components/cliente/checkout/ViabilityStep.tsx`
- Ajustar `totalDuration` de `5000` para `9000` ms (alinhado com o novo tempo real da edge function, evita a barra travar em 98% esperando).

## Resultado esperado

| Etapa | Antes | Depois |
|---|---|---|
| Classes NCL (IA) | 3s | ~1s |
| Buscas paralelas | 2s | 2s |
| Laudo final (IA) | 21s | ~6s |
| Delay frontend | 3s | 0s |
| **Total** | **~29s** | **~9s** |

Sem mudanças visuais, sem mudar fluxo, sem mudar conteúdo do laudo — apenas trocando o modelo de IA pelo Gemini Flash (mais rápido) e removendo o delay artificial.