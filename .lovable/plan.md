## Diagnóstico

Conferi o código e o banco. Hoje a página `/admin/emails` decide o que mostrar **apenas** pelo campo `email_accounts.assigned_to`:

- `src/pages/admin/Emails.tsx` (linhas 77-87): se o admin **não é o master**, filtra `email_accounts` por `assigned_to = userId`.
- `src/components/admin/email/EmailSettings.tsx` (linhas 95-98): mesma regra.

No banco, todas as contas (`caroline@`, `financeiro@`, `juridico@`, `Ola@`) estão atribuídas ao usuário `1ca389a4-...`. Quando você dá a permissão "Emails" em **Configurações → Segurança → Permissões** para um admin diferente (ex.: João), o `admin_permissions` recebe `emails.can_view=true`, mas o filtro acima continua escondendo todas as contas, porque o `assigned_to` não bate. Resultado: o admin entra na página e não vê nenhuma conta nem mensagem.

## Correção

Tratar a permissão "Emails" como acesso completo (mesma regra do master) e usar o `assigned_to` apenas como classificação organizacional (não como gate de leitura).

### 1. `src/pages/admin/Emails.tsx`
- Importar `hasPermission` de `useAdminPermissions`.
- Calcular `canSeeAllEmails = isMasterAdmin || hasPermission('emails', 'can_view')`.
- Trocar o filtro da query `email-accounts-list`: aplicar `.eq('assigned_to', userId)` **somente quando** `canSeeAllEmails` for `false`.

### 2. `src/components/admin/email/EmailSettings.tsx`
- Mesmo tratamento: admin com permissão `emails.can_view` lista todas as contas (igual ao master), apenas a edição/criação continua restrita ao master (já controlado por `isMaster`).
- Passar `canSeeAllEmails` para substituir o `isMaster` na query de listagem (mantém `isMaster` para os botões de adicionar/editar/excluir).

### 3. `src/components/admin/email/EmailSidebar.tsx`
- Onde aparece "Tools - Only visible for master admin" (linha 233), manter como está (são ferramentas administrativas como sincronizar/limpar — só master).

### 4. Sem mudanças de banco
- Não precisa migration. RLS já permite admins lerem `email_accounts`/`email_inbox` (controlado pelo `user_roles`); a restrição era apenas no client.

## Resultado esperado
- Qualquer admin com a permissão "Emails" marcada em Configurações → Segurança passa a ver todas as contas e caixas de entrada na página de Emails.
- O master continua sendo o único que pode adicionar/editar/excluir contas e usar as ferramentas administrativas.
- O campo `assigned_to` continua existindo e visível ("Atribuído a: …") para organização, sem mais bloquear o acesso.

## Observação sobre o build
Os erros `Cannot find name 'loadDebtors'` já foram corrigidos no turno anterior (o arquivo agora usa `fetchDebtors` nas linhas 780 e 854). Eram cache antigo do build — confirmei com busca.
