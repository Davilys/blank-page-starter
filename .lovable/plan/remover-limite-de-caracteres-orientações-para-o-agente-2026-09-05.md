# Remover limite de caracteres — "Orientações para o Agente"

## Objetivo
Retirar o limite de 4.000 caracteres do campo opcional "Orientações para o Agente" no fluxo de criação de recurso jurídico (aba "Recurso jurídico"), válido para todos os tipos (Exigência, Deferimento, etc.).

## Contexto atual
- Arquivo: `src/pages/admin/RecursosINPI.tsx` (linhas 2392–2399)
- O campo é um único `Textarea` renderizado para todos os tipos de recurso (uma instância só), então a correção vale para todas as abas.
- Limite aplicado em dois pontos:
  1. `onChange={(e) => setUserOrientation(e.target.value.slice(0, 4000))}`
  2. Contador `<p>{userOrientation.length}/4000</p>`

## Mudança
1. Trocar `e.target.value.slice(0, 4000)` por `e.target.value` — remover o truncamento.
2. Ajustar o contador: deixar apenas `{userOrientation.length} caracteres` (sem o `/4000`), para não sugerir limite onde não há.
3. Sem outras mudanças — o texto continua opcional, enviado como `userOrientation` no payload para a Edge Function `process-inpi-resource` já sem limite de tamanho.

## Verificação
- Typecheck com `tsgo --noEmit` para confirmar sem erros.
- Confirmar no preview que o campo aceita texto maior que 4.000 caracteres sem truncar e sem mostrar limite.
