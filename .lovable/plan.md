## Problema
Ao selecionar "Não Respondeu" em "Definir status", aparece "Erro ao atualizar o andamento" porque a coluna `publicacoes_marcas.cumprimento_status` tem um CHECK constraint que só aceita: `cumprido`, `contato_agendado`, `aguardando_pagamento`, `desistiu`. O novo valor `nao_respondeu` é rejeitado pelo banco.

## Correção
Migração SQL para recriar o CHECK constraint incluindo `'nao_respondeu'`:

- DROP do constraint `publicacoes_marcas_cumprimento_status_check`
- ADD do constraint com a lista atualizada: `cumprido`, `contato_agendado`, `aguardando_pagamento`, `nao_respondeu`, `desistiu`

Nenhuma alteração de código frontend é necessária — `PublicacaoPrazos.tsx` já envia `'nao_respondeu'` corretamente.

## Arquivos
- Nova migração Supabase (somente SQL, ajuste de constraint)