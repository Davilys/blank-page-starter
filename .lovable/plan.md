# Corrigir erro ao final da geração de Recurso INPI

## Diagnóstico

Pelos logs da edge function `process-inpi-resource`, a geração leva **~75-80 segundos** (PASS 1 + PASS 2 sequenciais com OpenAI gpt-4o, 16k tokens cada). Está perto do limite do gateway (Cloudflare ~100s). Quando o PDF é maior ou a OpenAI fica lenta, a chamada estoura o timeout do proxy: a função completa no servidor, mas o navegador recebe um erro de rede / resposta vazia, e o `supabase.functions.invoke` retorna sem `data`.

Além disso, o passo `processing` no `RecursosINPI.tsx` referencia `agent.color`, `agent.icon`, `agent.bgGlow`, etc. sem proteção. Se `selectedAgent` ficar fora do mapa `AI_AGENTS` (por exemplo, após reset/refresh), o render lança e o `AdminErrorBoundary` mostra "Algo deu errado" — exatamente o que aparece na imagem.

## Correções

### 1. `src/pages/admin/RecursosINPI.tsx`
- Garantir `const agent = AI_AGENTS[selectedAgent] ?? AI_AGENTS.mazzola;` (fallback seguro).
- No bloco `step === 'processing'` proteger todos os acessos com `agent?.` e valores padrão.
- No `catch` dos 4 fluxos (`processDocument`, `processNotificacao`, `processRespostaNotificacao`, `processProcurador`) registrar `error.message` no console e exibir mensagem específica para timeout/rede ("A geração demorou mais que o esperado. Tente novamente com um PDF menor ou apenas 1 arquivo.") em vez do erro genérico.

### 2. `supabase/functions/process-inpi-resource/index.ts`
Reduzir tempo total para ficar bem dentro do limite do gateway:
- Manter PASS 0 (extração) e PASS 1 em paralelo (já está).
- Reduzir `max_tokens` de cada passe de 16000 para **9000** (suficiente para ~3.500 palavras por passe; hoje as saídas têm 8-11k chars, ~1.700 palavras).
- Reduzir o prompt da PASS 2 passando apenas os primeiros 4.000 chars de `pass1Content` em vez de 8.000.
- Manter o fallback parcial caso PASS 2 falhe (já existe).

Esses ajustes mantêm a robustez da peça mas cortam ~30-40% do tempo de resposta, eliminando o estouro de timeout que provoca o erro final.

## Validação

Após o build, abrir Recursos INPI → "Recurso contra Indeferimento" → escolher um agente → anexar PDF → confirmar que:
1. A barra de progresso conclui sem mostrar a tela "Algo deu errado".
2. O passo "Revisão" abre com os dados extraídos e o rascunho.
3. Em caso de falha real, o toast mostra mensagem clara em vez do ErrorBoundary global.
