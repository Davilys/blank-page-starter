
## Auditoria realizada

Verifiquei como o "ficheiro do cliente" é aberto em cada aba do admin. Resultado:

| Aba | Componente que abre | Status |
|---|---|---|
| Clientes (`/admin/clientes`) | `ClientDetailSheet` | OK — é a referência |
| Publicações (`/admin/publicacoes`) | `ClientDetailSheet` (mesmo, com fetch idêntico ao de Clientes) | OK |
| Devedores (`/admin/devedores`) — Devedores 60d, Devedor 30d, Histórico Devedores, Histórico Devedor | `ClientDetailSheet` (carregado via `find-or-create-client-from-asaas`) | OK |
| Financeiro (`/admin/financeiro`) | NÃO abre ficheiro — clique no cliente da fatura não faz nada | FALTANDO |

Ou seja, **3 das 4 abas já abrem o mesmo ficheiro** (`ClientDetailSheet`). A única lacuna real é o **Financeiro**, onde o nome do cliente na tabela de faturas não é clicável.

## Mudanças propostas

### 1. Financeiro — abrir o mesmo ficheiro do cliente
Em `src/pages/admin/Financeiro.tsx`:
- Importar o `ClientDetailSheet` (lazy, igual a `Clientes.tsx` e `Devedores.tsx`).
- Adicionar estado `selectedClientForSheet` + `sheetOpen`.
- Reaproveitar o mesmo padrão de fetch usado em `PublicacaoTab.tsx` (`fetchClientForSheet`) — busca paralela em `profiles`, `brand_processes`, `contracts` para montar um `ClientWithProcess` completo, idêntico ao da aba Clientes.
- Tornar a célula `Cliente` da tabela clicável (`cursor-pointer`, hover underline + cor primária, com `Loader2` enquanto carrega).
- Renderizar `<ClientDetailSheet>` no fim da página, dentro de `<Suspense>`.

### 2. Padronização final (mesma ficha em qualquer aba)
- Garantir que todas as quatro telas usam o mesmo componente `@/components/admin/clients/ClientDetailSheet` — confirmado.
- Garantir que o objeto `client` passado tem o mesmo shape (`ClientWithProcess`) — usar o helper de fetch do PublicacaoTab também no Financeiro para consistência.
- Após fechar o sheet, os dados da aba são revalidados (Financeiro: re-fetch faturas; Publicações: invalidate query; Devedores: re-fetch debtors; Clientes: refresh).

### 3. Pequena auditoria de consistência
- Em Devedores, garantir que `e.stopPropagation()` está nos botões de ação dentro de linhas clicáveis (já estava após correção anterior — só revisar).
- Em Publicações, confirmar que clicar em qualquer card/linha que tenha `client_id` abre o sheet (já implementado nas linhas 1947 e 1999).

## Detalhes técnicos

Arquivos editados:
- `src/pages/admin/Financeiro.tsx` (adiciona import lazy, estados, handler de clique, render do sheet)

Sem mudanças de banco de dados, sem nova edge function. Apenas frontend.

## Resultado esperado
Clicar no nome do cliente em Clientes, Publicações, Devedores (qualquer das 4 sub-abas) ou Financeiro abre exatamente o mesmo `ClientDetailSheet`, com as mesmas informações, ações e seções.
