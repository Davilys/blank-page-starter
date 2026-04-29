# Botão "Resetar Senha" no Ficheiro do Cliente

## Objetivo
Adicionar um botão de **Resetar Senha** nas "Ações Rápidas" do ficheiro do cliente (que abre ao selecionar um card no Kanban da aba Clientes). Ao clicar, a senha do cliente é resetada para `123Mudar@`, permitindo que ele acesse a Área do Cliente caso tenha esquecido a senha atual.

Sem alterar mais nada no projeto.

## Mudanças

### 1. Edge Function `reset-admin-password` — generalizar para também resetar clientes
Arquivo: `supabase/functions/reset-admin-password/index.ts`

A função já existe e valida que o chamador é o Master Admin. Vamos:
- Manter a mesma validação de Master Admin (`davillys@gmail.com`).
- Aceitar opcionalmente o reset de qualquer usuário (admin ou cliente) por `userId`.
- Continuar resetando para `123Mudar@`.

Nenhuma mudança de comportamento para o reset de admins existente — só remove a restrição implícita de "apenas admins". O master admin já é o único autorizado a chamar.

### 2. `ClientDetailSheet.tsx` — adicionar botão e handler
Arquivo: `src/components/admin/clients/ClientDetailSheet.tsx`

- Importar ícone `KeyRound` do `lucide-react` e `useCanViewFinancialValues` (para `isMasterAdmin`).
- Adicionar nova ação ao array `QUICK_ACTIONS` (linha ~1073), visível apenas se `isMasterAdmin`:
  ```ts
  { id: 'reset_senha', label: 'Resetar Senha', icon: KeyRound, cls: 'bg-amber-100 ... text-amber-700 ...' }
  ```
- Adicionar `case 'reset_senha'` em `handleQuickAction` (linha ~814) que:
  1. Confirma com o usuário (AlertDialog ou `confirm()` simples seguindo padrão do componente).
  2. Chama `supabase.functions.invoke('reset-admin-password', { body: { userId: client.id } })`.
  3. Mostra toast de sucesso com a nova senha `123Mudar@` (duração 10s) ou erro.

### Comportamento final
- Apenas o **Master Admin** (`davillys@gmail.com`) vê o botão.
- Ao clicar → confirmação → senha do cliente resetada para `123Mudar@`.
- Cliente passa a poder logar em `/cliente/login` com seu email + `123Mudar@`.
- Nenhum outro fluxo é alterado.

## Arquivos afetados
- `supabase/functions/reset-admin-password/index.ts` (pequeno ajuste / nenhuma mudança de assinatura)
- `src/components/admin/clients/ClientDetailSheet.tsx` (adicionar ação + handler)
