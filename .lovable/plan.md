## Objetivo

Na aba **Devedores**, ao clicar no nome do cliente na linha da tabela, abrir o **mesmo ClientDetailSheet** usado na aba Clientes. Se o devedor (vindo do Asaas) ainda não existir como cliente no sistema, criá-lo automaticamente antes de abrir o ficheiro.

## Comportamento

1. Nome do cliente vira link/botão clicável (cursor pointer + hover azul).
2. Ao clicar:
   - Tenta localizar o profile existente por: `asaas_customer_id` → `cpf_cnpj` (com e sem máscara) → `email`.
   - Se encontrado: carrega o profile completo e abre o `ClientDetailSheet`.
   - Se não encontrado: chama nova edge function `find-or-create-client-from-asaas` que:
     - Busca os dados do cliente no Asaas (`/customers/{id}`) para obter nome, email, cpfCnpj, telefone, endereço.
     - Reaproveita a lógica de `create-client-user` (dedup por cpf/email; cria auth user + profile) quando há email.
     - Se o Asaas não tiver email, cria apenas um `profiles` (sem auth user) com um placeholder `email = "asaas-{customer_id}@webmarcas.local"` e marca `origin = "asaas-devedor"`, garantindo que o sheet abra normalmente.
     - Sempre grava `asaas_customer_id`, `cpf_cnpj`, `full_name`, `phone`, `address`, etc.
   - Após criar, recarrega o profile e abre o sheet.
3. O coluna **Renegociar** continua intacta (botão à direita).

## Arquivos a alterar/criar

- **`supabase/functions/find-or-create-client-from-asaas/index.ts`** (novo)
  - Auth obrigatória (admin via `has_role`).
  - Input: `{ asaas_customer_id, cpf_cnpj?, cliente_nome?, cliente_email? }`.
  - Output: `{ profile: <linha completa de profiles>, created: boolean }`.
- **`supabase/config.toml`** — registrar a nova função (`verify_jwt = false`, validação interna).
- **`src/pages/admin/Devedores.tsx`**
  - Estado `selectedClient: ClientWithProcess | null` e `loadingClient: boolean`.
  - Função `openClientFile(d: Debtor)` que chama a edge function e monta o objeto no formato `ClientWithProcess`.
  - Render do `ClientDetailSheet` (lazy import como em `Clientes.tsx`).
  - Nome do cliente na tabela vira `<button>` com `onClick={() => openClientFile(d)}`.

## Detalhes técnicos

```ts
// montagem mínima do ClientWithProcess para o sheet
const clientForSheet: ClientWithProcess = {
  id: profile.id,
  full_name: profile.full_name,
  email: profile.email,
  phone: profile.phone,
  company_name: profile.company_name,
  priority: profile.priority,
  origin: profile.origin,
  contract_value: profile.contract_value,
  process_id: null, brand_name: null, business_area: null,
  pipeline_stage: null, process_status: null,
  cpf_cnpj: profile.cpf_cnpj,
  created_by: profile.created_by,
  assigned_to: profile.assigned_to,
};
```

O `ClientDetailSheet` carrega o resto (processos, faturas, documentos, notas) sozinho a partir do `id`.

## Fora de escopo

- Não altera lógica de renegociação nem de sincronização Asaas.
- Não cria login para o cliente automaticamente quando o Asaas não tem email (fica como cadastro sem acesso até admin completar).
