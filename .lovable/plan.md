## Problema
Na aba **Contratos**, ao selecionar "Contrato Padrão - Registro de Marca INPI", aparecem também distratos (ex.: "Distrato sem Multa - Padrão" do Leonardo). Isso acontece porque o filtro `getContractTabMatch` (linhas 601–626 de `src/pages/admin/Contratos.tsx`) usa apenas a string combinada de template/tipo/assunto e a palavra "padrão" presente no distrato faz casar com a aba "padrao". O campo `document_type` (que já existe no banco — `contract` / `distrato_multa` / `distrato_sem_multa` / `procuracao`) não é considerado.

## Correção
Reescrever `getContractTabMatch` para usar `document_type` como fonte primária e o nome do template apenas para diferenciar padrão/premium/corporativo dentro de `document_type === 'contract'`.

Regras por aba:
- `padrao` → `document_type === 'contract'` **e** template contém "padr" e "registro de marca" e **não** contém premium/corporativ.
- `premium` → `document_type === 'contract'` **e** template/tipo/assunto contém "premium".
- `corporativo` → `document_type === 'contract'` **e** contém "corporativ".
- `procuracao` → `document_type === 'procuracao'` (ou contém "procura" como fallback).
- `distrato_sem` → `document_type === 'distrato_sem_multa'`.
- `distrato_com` → `document_type === 'distrato_multa'`.

Com isso, distratos nunca caem em abas de contrato, e cada aba mostra somente o tipo correspondente.

## Arquivo alterado
- `src/pages/admin/Contratos.tsx` — apenas a função `getContractTabMatch`.

Sem alterações de schema, edge functions ou UI.