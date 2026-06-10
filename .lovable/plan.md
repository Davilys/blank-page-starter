## Objetivo
Na aba **Prazos**, (1) permitir vincular cliente direto na linha para publicações órfãs, (2) trocar o botão "Cumprido" por um seletor de status (Cumprido / Em Contato Agendado / Aguardando Pagamento) com cores distintas, e (3) tornar o nome do cliente e o nome da marca clicáveis para abrir o detalhe.

## 1. Banco de dados
Migration nova adiciona em `publicacoes_marcas`:
- `cumprimento_status` text — valores: `cumprido`, `contato_agendado`, `aguardando_pagamento`, ou null.
- Trigger/regra simples: quando `cumprimento_status = 'cumprido'` → `cumprimento_ok = true` (mantém compatibilidade com lógica de arquivamento atual). Os outros dois status **não** marcam `cumprimento_ok`, então a publicação continua aparecendo na lista de prazos com o status visível.

## 2. `PublicacaoPrazos.tsx`

### Vincular cliente (linha órfã)
Quando `pub.client_id` for null, a célula "Cliente" mostra um pequeno autocomplete inline (mesmo padrão do `editClientSearch` já usado em PublicacaoTab — buscar por nome/email/CPF, dropdown com até 10 resultados). Ao selecionar, faz `update publicacoes_marcas set client_id = ?` e invalida a query. Também tenta resolver `process_id` automaticamente se houver match por `process_number_rpi`.

### Nome do cliente e marca clicáveis
- A célula Cliente (quando vinculado) vira `<button>` que chama `onOpenDetail(pub.id)`.
- A célula Marca/Processo vira `<button>` que chama `onOpenDetail(pub.id)`.
- Mantém o ícone de olho (Eye) também, mas o foco passa a ser o clique no texto.

### Seletor de status (substitui botão Cumprido)
Substituir o botão único "Cumprido" por um **DropdownMenu** com gatilho colorido conforme o status atual:

| Status                 | Cor                          |
| ---------------------- | ---------------------------- |
| (nenhum)               | cinza / outline neutro       |
| Cumprido               | verde (emerald)              |
| Contato Agendado       | azul (sky/blue)              |
| Aguardando Pagamento   | amarelo (amber)              |

O gatilho exibe um badge com o label do status atual (ou "Definir status"). Ao escolher uma opção:
- Persiste `cumprimento_status` em `publicacoes_marcas`.
- Se "Cumprido" → também marca `cumprimento_ok=true`, `cumprimento_at`, `cumprimento_by` (igual ao fluxo atual) e some da lista.
- Se "Contato Agendado" ou "Aguardando Pagamento" → linha permanece visível, mas o badge colorido fica destacado.
- Opção extra "Limpar status" para reverter.

A coluna "Status" continua mostrando o despacho INPI; o novo status fica na coluna Ações (ou em nova coluna "Andamento"). Optaremos por **adicionar uma coluna "Andamento"** entre "Cobrança" e "Ações" para o badge colorido — fica visível mesmo sem clicar.

## 3. Filtro de elegibilidade
Em `eligible`, manter o filtro `!p.cumprimento_ok` (já existe). Itens com `cumprimento_status` `contato_agendado` ou `aguardando_pagamento` continuam elegíveis e aparecem nas faixas normais de prazo.

## 4. Arquivos afetados
- **Nova migration**: adiciona coluna `cumprimento_status` + trigger de sincronia com `cumprimento_ok`.
- **`src/components/admin/publicacao/PublicacaoPrazos.tsx`**:
  - Autocomplete inline para órfãos.
  - Texto clicável em Cliente e Marca.
  - DropdownMenu de status colorido substituindo botão "Cumprido".
  - Nova coluna "Andamento" com badge do status atual.
- **`src/integrations/supabase/types.ts`** regenerado após a migration.

## 5. Fora de escopo
- Não mexe em outros locais (Revista, Sheet de detalhe, edge functions). O badge de status pode ser exibido futuramente em outras telas, mas neste passo só vive na aba Prazos.