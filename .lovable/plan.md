## Adicionar status "Assinou Distrato" na aba Desistiu

### Objetivo
Na aba **Desistiu** de Prazos (Publicações), adicionar a opção **"Assinou Distrato"** no dropdown "Definir status", para marcar processos cujo cliente formalizou o distrato. A seleção deve persistir corretamente.

### Mudanças

**1. `src/components/admin/publicacao/PublicacaoPrazos.tsx`**
- Estender o tipo `AndamentoStatus` incluindo `'assinou_distrato'`.
- Adicionar entrada em `ANDAMENTO_CFG`:
  - Label: **"Assinou Distrato"**
  - Ícone: `FileSignature` (lucide-react)
  - Cor: roxo/violet (para diferenciar de "Desistiu" que é cinza)
- Adicionar `<DropdownMenuItem>` "Assinou Distrato" no menu de status, exibido **somente quando `active === 'desistiu'`** (linha entre o item "Desistiu" e o "Limpar status"), garantindo que apareça apenas na aba correta conforme solicitado.
- Manter linha visível na aba Desistiu mesmo após mudar para `assinou_distrato` (atualizar o filtro `desistiuList` para incluir `cumprimento_status === 'desistiu' || cumprimento_status === 'assinou_distrato'`), evitando que a linha "suma" da aba ao selecionar.
- Incluir `'assinou_distrato'` no `STATUS_BLOQUEIA_REATRIBUICAO` para que a auto-atribuição de responsável não sobrescreva.

**2. Migração SQL — constraint do banco**
Atualizar o check constraint `publicacoes_marcas_cumprimento_status_check` para aceitar o novo valor `'assinou_distrato'`. Sem isso o UPDATE falha silenciosamente e a seleção não persiste (causa raiz dos casos de "não funcionar a seleção").

```sql
ALTER TABLE public.publicacoes_marcas
  DROP CONSTRAINT IF EXISTS publicacoes_marcas_cumprimento_status_check;
ALTER TABLE public.publicacoes_marcas
  ADD CONSTRAINT publicacoes_marcas_cumprimento_status_check
  CHECK (cumprimento_status IN (
    'cumprido','contato_agendado','aguardando_pagamento',
    'nao_respondeu','desistiu','assinou_distrato'
  ) OR cumprimento_status IS NULL);
```

### Fora do escopo
- Nenhuma mudança no template de Proposta R$ 699 ou em outras abas.
- Sem alteração visual em outros buckets.
