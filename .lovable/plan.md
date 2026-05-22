## Diagnóstico

Reproduzi o erro chamando a edge function `create-admin-user` com `joao@webmarcas.net`. Ela retorna:

> "Usuário não encontrado após verificação de duplicidade."

O que acontece hoje:

1. Ao tentar excluir o admin antes, a função `delete-auth-user` falhou silenciosamente — o frontend (`SecuritySettings.tsx` linha 148) chama `supabase.functions.invoke('delete-auth-user', ...)` **sem checar o erro**. Só o `user_roles` e o `admin_permissions` foram apagados; o usuário continuou em `auth.users` (confirmado: `joao@webmarcas.net` ainda existe lá, e o `profiles` continua com o registro).
2. Ao recriar, `create-admin-user` chama `createUser`, recebe "already been registered", e tenta achar o usuário com `auth.admin.listUsers()`. Esse método retorna apenas a **primeira página (50 usuários)** por padrão — como o João não está na primeira página, `existingUser` fica `undefined` e a função lança o erro.

## Correções

### 1. `supabase/functions/create-admin-user/index.ts`
Substituir a busca por `listUsers()` (que só vê a 1ª página) por uma busca confiável:
- Primeiro: consultar `public.profiles` por `email` para pegar o `id`.
- Fallback: paginar `listUsers({ page, perPage: 1000 })` até encontrar.
- Se mesmo assim não achar, lançar mensagem clara.

### 2. `supabase/functions/delete-auth-user/index.ts`
Antes do `auth.admin.deleteUser`, garantir limpeza de dependências em ordem segura (idempotente):
- `admin_permissions` por `user_id`
- `user_roles` por `user_id`
- `profiles` por `id`
- Depois `auth.admin.deleteUser(userId)`; se retornar erro, propagar com mensagem detalhada (não engolir).

### 3. `src/components/admin/settings/SecuritySettings.tsx`
Na mutation `deleteAdminMutation` (linhas 132-149):
- Capturar `{ data, error }` do `supabase.functions.invoke('delete-auth-user', …)` e lançar erro se falhar, para o toast mostrar o problema real em vez de "sucesso" enganoso.
- Mover a limpeza de `admin_permissions`/`profiles` para dentro da edge function (passo 2) e simplificar o frontend para apenas invocar `delete-auth-user` (ela já cuida de tudo).

### 4. Limpeza pontual do João
Como o registro está órfão, depois de aplicado o fix a UI permitirá recriar. Alternativamente, executar uma migração única para deletar `auth.users` + `profiles` do `joao@webmarcas.net` antes do recadastro — incluo isso na implementação para destravar o caso imediato.

## Resultado esperado
- Excluir admin remove de fato o usuário do `auth.users`, permitindo recriação com o mesmo e-mail.
- Se a exclusão falhar por qualquer motivo, o toast mostra o erro real.
- Recriar um admin com e-mail já existente (caso usuário cliente, por exemplo) funciona mesmo com base grande de usuários (não depende mais da 1ª página do `listUsers`).
