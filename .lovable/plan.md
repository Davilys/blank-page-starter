

## Plano: Corrigir Criacao de Admin e Edicao de Permissoes

### Problemas Identificados

1. **Login falha para admin criado**: A conta `caroline@webmarcas.net` foi criada em 14/04 como usuario normal (role `user`). Quando o "Criar Novo Admin" tentou criá-la novamente, o edge function detectou que o usuario ja existia e promoveu para admin, mas **nao atualizou a senha**. A senha original (da criacao como cliente) permaneceu, por isso "Carol@@0" nao funciona.

2. **Permissoes duplicadas**: O edge function insere permissoes (linhas 82-103) E o codigo do cliente tambem insere permissoes (CreateAdminDialog linhas 92-109). Isso causa `duplicate key` quando o usuario nao tem fullAccess.

3. **EditPermissionsDialog**: O delete + re-insert funciona, mas o `clients_own_only` pode conflitar se inserido duas vezes.

### Alteracoes

#### 1. `supabase/functions/create-admin-user/index.ts`
- Quando o usuario ja existe, **atualizar a senha** usando `supabaseAdmin.auth.admin.updateUserById(userId, { password })`
- Isso garante que a senha definida no formulario seja aplicada mesmo para usuarios existentes
- Manter o upsert de permissoes no edge function (usa service_role, bypassa RLS)

#### 2. `src/components/admin/settings/CreateAdminDialog.tsx`
- **Remover** a insercao duplicada de permissoes no client-side (linhas 92-109)
- **Remover** a insercao duplicada de `clients_own_only` no client-side (linhas 112-124)
- Passar `viewOwnClientsOnly` para o edge function e deixar ele cuidar de tudo
- O edge function ja recebe `permissions` e `fullAccess`, basta ele tambem receber e tratar `viewOwnClientsOnly`

#### 3. `supabase/functions/create-admin-user/index.ts` — Tratar `viewOwnClientsOnly`
- Adicionar `viewOwnClientsOnly` no destructuring do body
- Se `viewOwnClientsOnly` for true, inserir a permissao `clients_own_only` no edge function

#### 4. Fix imediato: Atualizar senha da Caroline
- Usar o edge function corrigido ou atualizar via query para que a conta funcione

### Resultado
- Criar novo admin funciona mesmo se o email ja existe (atualiza senha + promove)
- Permissoes sao inseridas apenas uma vez (no edge function, com service_role)
- Editar permissoes funciona sem erro de chave duplicada
- Login funciona com a senha definida no formulario

