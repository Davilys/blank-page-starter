# Orientações para o Agente em todos os recursos + rodapé sem OAB

## 1. Campo "Orientações para o Agente" para todos os tipos

A implementação já existe e é usada hoje só na Exigência de Mérito:

- Estado: `userOrientation` em `src/pages/admin/RecursosINPI.tsx` (linha 312).
- UI: bloco âmbar com `Brain` + `Textarea` (limite 4000, contador) na etapa "Anexar Documentos", hoje envolto por `{resourceType === 'exigencia_merito' && (...)}`.
- Envio: `userOrientation` no body das chamadas pass1/pass2 de `process-inpi-resource`.
- Uso pela IA: `userOrientationBlock` na edge function (linha 1418) — hoje anexado apenas nos prompts do ramo `exigencia_merito`.

Alterações mínimas:

- Remover apenas a condição `resourceType === 'exigencia_merito'` que envolve o bloco, mantendo markup, estilo, limite e comportamento idênticos. O mesmo bloco passa a aparecer na etapa de anexos de todos os tipos.
- Passar `userOrientation` também nos fluxos que hoje não o enviam: `processNotificacao`, `processRespostaNotificacao` e `processProcurador` (mesmo campo `userOrientation` no body).
- Na edge function `process-inpi-resource`, acrescentar `${userOrientationBlock}` aos prompts que ainda não o têm: ramo genérico do pass1 e do pass2 (recurso contra indeferimento, manifestação à oposição etc.), notificação extrajudicial, resposta a notificação e petições de procurador.

Nada muda no fluxo da Exigência de Mérito: mesmos prompts, mesma ordem, mesmo bloco de orientações.

## 2. Rodapé do papel timbrado

Em `src/components/admin/INPIResourcePDFPreview.tsx`, remover a linha
`OAB/SP nº 000.000 — Agente da Propriedade Industrial` do bloco de assinatura do PDF (linhas 757-760), que hoje é impressa em todos os tipos exceto extrajudicial/procurador.

Resultado em todos os tipos: assinatura + "Davilys Danques de Oliveira Cunha" + "Procurador". Nada mais é alterado (CPF, traço, cores, layout e rodapés de página permanecem).

Verificação: busca por "OAB" e "Agente da Propriedade Industrial" em `src/` e `supabase/` para garantir que não resta nenhuma variação no documento final.

## Fora de escopo

Seleção de tipo, upload, geração, prompts existentes (além do acréscimo do bloco de orientações), banco, permissões e layout geral permanecem intocados.
