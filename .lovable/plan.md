# Resetar senha de administradores (apenas Admin Master)

## Objetivo
Na aba Configurações → Segurança → Usuários Administradores, adicionar um botão de "Resetar Senha" para cada admin (exceto o próprio Master). Apenas o Admin Master (`davillys@gmail.com`) pode usar essa ação. Ao confirmar, a senha do administrador será redefinida para a senha padrão `123Mudar@`.

## Mudanças

### 1. Nova Edge Function: `supabase/functions/reset-admin-password/index.ts`
- Recebe `{ userId }` no body.
- Valida o chamador via JWT (`supabase.auth.getUser` com o token Authorization).
- Verifica se o email do chamador é `davillys@gmail.com` (Master). Se não for, retorna 403.
- Usa `service_role` para chamar `supabaseAdmin.auth.admin.updateUserById(userId, { password: '123Mudar@' })`.
- Retorna `{ success: true }`.
- `verify_jwt = true` em `supabase/config.toml`.

### 2. `supabase/config.toml`
- Registrar a nova função `reset-admin-password` com `verify_jwt = true`.

### 3. `src/components/admin/settings/SecuritySettings.tsx`
- Adicionar mutation `resetPasswordMutation` que invoca a edge function `reset-admin-password`.
- Adicionar botão com ícone `KeyRound` ao lado dos botões "Editar Permissões" e "Remover", visível **apenas** quando `isMasterAdmin === true` e o usuário listado **não** é o próprio Master.
- Ao clicar, abrir um `AlertDialog` de confirmação informando que a senha será redefinida para `123Mudar@`.
- Após sucesso, mostrar `toast.success` exibindo a senha padrão e instrução para informá-la ao admin.

## Detalhes técnicos
- O botão fica oculto para qualquer admin que não seja o Master, garantindo a regra no front. A validação real de autorização acontece na edge function (server-side), que é a fonte de verdade.
- A senha padrão `123Mudar@` fica hardcoded na edge function (não trafega do cliente), evitando que alguém manipule o body para definir outra senha.
- Nenhuma mudança de schema é necessária.
