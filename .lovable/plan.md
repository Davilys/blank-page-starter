## Diagnóstico

Após investigar o banco e o código:

**1. O salvamento está funcionando** — consultei `responsavel_atribuicao` e há 3 linhas gravadas hoje (entidade=`publicacao`, user=`caroline martins dos santos`). Ou seja, o `atribuirResponsavel` está executando o upsert corretamente.

**2. O problema está na LEITURA** — o hook `useResponsaveis` chama:
```ts
supabase.from("responsavel_atribuicao")
  .select(...)
  .eq("entidade", entidade)
  .in("entidade_id", ids)   // ❌ ids tem 850 UUIDs em Publicações
```

Com 850 UUIDs (≈ 31 KB na querystring), o PostgREST/Supabase rejeita a requisição (URL muito longa) e o `data` volta vazio/null silenciosamente. Resultado: o `map` fica `{}` e o `ResponsavelChip` sempre renderiza "Sem responsável", mesmo após o upsert.

**3. O realtime também falha** porque o filtro `ids.includes(row.entidade_id)` depende do `ids` carregado, mas o handler funciona — o que não funciona é o estado inicial, então o usuário só veria mudanças, nunca o que já existe.

**4. Bônus**: o nome do canal `resp_${entidade}_${ids.length}` colide entre componentes que tenham o mesmo número de itens, e não há tratamento de erro do Supabase no `load()`.

## Correção

Vou refatorar **apenas `src/hooks/useResponsaveis.ts`** (sem mexer em UI, banco, edge functions):

### 1. Eliminar o `.in()` com listas grandes

Trocar por uma busca única por entidade (a tabela `responsavel_atribuicao` é pequena — só contém linhas com responsável de fato atribuído):

```ts
const { data, error } = await supabase
  .from("responsavel_atribuicao")
  .select("entidade_id, user_id, user_nome, atribuido_em")
  .eq("entidade", entidade);
```

Depois filtra client-side só os `entidade_id` que aparecem em `ids` (ou monta o map completo — é leve, são poucas dezenas).

### 2. Realtime mais robusto

- Nome de canal único: `resp_${entidade}_${Math.random().toString(36).slice(2)}` (ou `useId()`), para evitar colisão entre instâncias.
- No handler de `postgres_changes`, atualizar o map sem depender do `ids.includes(...)` — se a entidade bate, atualiza/insere/deleta a entrada no map. Isso garante que o chip apareça em segundos para todos os admins.
- Manter cleanup com `removeChannel`.

### 3. Tratamento de erro

Logar `error` no console se a query falhar, para facilitar debug futuro.

### 4. `useAdminList` — pequena melhora paralela

Está OK, mas vou conferir que o nome usado no upsert (`userNome` derivado do `profile.full_name`) está vindo correto — pelos dados do banco já está (`caroline martins dos santos`), então mantém.

## Validação

Depois do fix:
1. Atribuir um responsável em **Publicações → Prazos** → chip deve mostrar iniciais + primeiro nome imediatamente, em vez de "Sem responsável".
2. Atribuir em **Financeiro → Vencidos** e **Devedores +30/+60** → mesmo comportamento (mesmo hook).
3. Abrir em outra aba/navegador logado como outro admin → chip aparece em poucos segundos (realtime).
4. Recarregar a página → chip permanece preenchido (estado inicial agora funciona com qualquer número de publicações/faturas).

## Fora do escopo

- Nada de banco/migration: a tabela já está correta e tem os dados.
- Nada de mudança visual no `ResponsavelChip` ou nas telas.
- Nada de notificações automáticas para o responsável (próxima iteração, se você quiser).

Confirma para eu aplicar?
