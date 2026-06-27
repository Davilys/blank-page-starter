## Objetivo

Adicionar, no card do cliente (aba Clientes / Kanban), uma etiqueta destacada ao lado do badge **MEDIUM** indicando se o cliente possui débitos em aberto:

- 🟢 **EM DIA** — verde, quando não há faturas vencidas/pendentes em atraso.
- 🔴 **DEVEDOR** — vermelho, quando há fatura(s) com `status = overdue` (ou `pending` com `due_date` no passado) na tabela `invoices`, que já é sincronizada com o Asaas pela função `sync-asaas-invoices`.

## Onde alterar

Apenas `src/components/admin/clients/ClientKanbanBoard.tsx` (frontend / apresentação). Nenhuma mudança de banco — vamos reusar a tabela `invoices` já sincronizada com Asaas.

## Implementação

1. **Buscar débitos por cliente (1 query agregada)**
   - Em um `useEffect` no `ClientKanbanBoard`, consultar:
     ```ts
     supabase.from('invoices')
       .select('user_id, status, due_date')
       .in('status', ['overdue', 'pending'])
     ```
   - Construir um `Set<string>` `debtorUserIds` contendo os `user_id` que possuem:
     - alguma linha com `status = 'overdue'`, **ou**
     - linha com `status = 'pending'` e `due_date < hoje`.
   - Guardar em `useState` e revalidar quando `onRefresh` rodar ou a cada ~5 min.

2. **Sincronização automática com Asaas**
   - Disparar `supabase.functions.invoke('sync-asaas-invoices')` em background uma vez ao montar o board (igual ao padrão já usado na aba Contratos), para garantir que o status local reflita o Asaas antes de calcular a etiqueta.

3. **Renderizar a etiqueta no card**
   - No bloco *Badges Row* (linhas ~597-615), logo após o `<Badge>` do `priorityConfig` (MEDIUM), inserir um novo badge condicional:
     - `client.user_id && debtorUserIds.has(client.user_id)` → `<Badge>` vermelho sólido com texto **"DEVEDOR"** e ícone `AlertCircle`.
     - Caso contrário (cliente sem débitos em aberto) → `<Badge>` verde sólido com texto **"EM DIA"** e ícone `CheckCircle2`.
   - Estilo seguindo a mesma altura/escala do badge MEDIUM (`text-[10px] px-1.5 py-0`), com cores via classes Tailwind já usadas no projeto:
     - DEVEDOR: `bg-red-500 text-white ring-1 ring-red-400`
     - EM DIA: `bg-emerald-500 text-white ring-1 ring-emerald-400`
   - Tooltip ao passar o mouse: "Cliente possui fatura(s) vencida(s) no Asaas" ou "Sem débitos em aberto".

4. **Casos de borda**
   - Cliente sem `user_id` (lead não convertido) → não exibir nenhum dos dois badges (evita falso "EM DIA").
   - Enquanto a query inicial está carregando, não renderizar o badge (evita flash incorreto).

## Resultado visual

```text
[ MEDIUM ] [ DEVEDOR ] [ import ]      ← vermelho destacado
[ MEDIUM ] [ EM DIA  ] [ site   ]      ← verde destacado
```

Apenas alteração de UI no card do Kanban de Clientes; nenhuma regra de negócio nem schema alterado.