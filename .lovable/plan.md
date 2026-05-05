## Objetivo

Hoje a aba **Financeiro** do `ClientDetailSheet` só mostra:
- `invoices` filtradas por `user_id` (só funciona se a fatura já está atrelada ao client_id local).
- Bloco "Asaas" (vencidas + renegociações) só quando o profile já tem `asaas_customer_id` ou `cpf_cnpj` casa em `cobrancas_vencidas`.

Resultado: para a maioria dos clientes (sem vínculo Asaas direto) a aba aparece vazia.

A meta é: para **TODOS** os clientes, mostrar no financeiro do ficheiro **todas** as cobranças do Asaas (pagas, em aberto, vencidas), encontrando-as por **CPF/CNPJ** ou **email** do profile, não apenas pelo `asaas_customer_id`.

## Como vai funcionar

1. **Resolver o(s) `asaas_customer_id` do cliente** sob demanda quando ele ainda não está vinculado:
   - Se profile já tem `asaas_customer_id` → usar.
   - Senão, chamar nova edge function `resolve-asaas-customer` que:
     - Busca no Asaas por `cpfCnpj` (normalizado, sem máscara).
     - Se nada, busca por `email`.
     - Retorna lista de `customer_id` encontrados (pode haver mais de um).
     - Se achou apenas 1 e o profile ainda não tem vínculo, grava `asaas_customer_id` no profile.

2. **Buscar TODAS as cobranças do Asaas** desse(s) customer:
   - Nova edge function `list-asaas-payments-for-client`:
     - Input: `{ client_id }` (admin only).
     - Lê profile (cpf_cnpj, email, asaas_customer_id).
     - Resolve customer_ids via passos acima.
     - Para cada customer_id, faz `GET /payments?customer={id}&limit=100` paginado até esgotar.
     - Normaliza cada cobrança em:
       ```
       { id, asaas_id, value, net_value, status, due_date, payment_date,
         description, invoice_url, bank_slip_url, billing_type, installment }
       ```
     - Classifica em: `pagas` (`RECEIVED|CONFIRMED|RECEIVED_IN_CASH`), `vencidas` (`OVERDUE` ou due_date < hoje e não paga), `em_aberto` (resto: `PENDING|AWAITING_*`).
     - Retorna `{ customer_ids, totals: { pago, aberto, vencido }, items: [...] }`.

3. **Atualização do `ClientDetailSheet` (Financeiro tab)**:
   - Novo estado: `asaasPayments`, `asaasTotals`, `loadingAsaasPayments`.
   - Ao abrir o sheet (após `loadFullData`), chamar `supabase.functions.invoke('list-asaas-payments-for-client', { body: { client_id }})`.
   - Renderizar 3 cards no topo do bloco Asaas: **Pago**, **Em aberto**, **Vencido** (com totais BRL e contagem).
   - Renderizar 3 listas colapsáveis (uma por status) com: descrição, valor, vencimento, data pagamento, link "Ver fatura" (`invoice_url`).
   - Manter o bloco existente de **Renegociações** logo abaixo (intacto).
   - Se nenhum customer_id resolvido → exibir aviso suave: "Nenhuma cobrança Asaas encontrada para este CPF/CNPJ/email".

4. **Bônus de UX**: botão "Atualizar Asaas" ao lado dos cards para re-puxar sob demanda (sem F5).

## Arquivos

- `supabase/functions/list-asaas-payments-for-client/index.ts` (novo)
  - Auth obrigatória, valida admin via `has_role`.
  - Service role para ler profile e dar update no `asaas_customer_id` quando resolver.
  - Usa `ASAAS_API_KEY`.
- `supabase/config.toml` — registrar a função (`verify_jwt = false`, validação interna).
- `src/components/admin/clients/ClientDetailSheet.tsx`
  - Novos estados, novo `loadAsaasPayments(clientId)`.
  - Novo bloco UI no Financeiro tab (3 cards + 3 listas) acima do bloco de renegociações.
  - Botão refresh.

## Detalhes técnicos

- Normalização CPF/CNPJ: `String(v).replace(/\D/g,'')`.
- Asaas paginação: `offset` += 100 até `hasMore=false` ou `data.length<limit`. Cap defensivo: 10 páginas (1000 cobranças) por customer.
- Sem novas colunas/migrations no DB. Não escreve em `invoices` (evita duplicar o que o webhook já mantém).
- Os totais são calculados no servidor para evitar inconsistência de timezone no `dueDate`.
- Se o Asaas retornar mais de um customer para o mesmo CPF/email, agregamos cobranças de todos (e mostramos um pequeno chip "n contas Asaas").

## Fora de escopo

- Não altera o webhook nem cria/edita `invoices` locais.
- Não altera a aba Devedores nem a lógica de renegociação.
- Não cria login para clientes sem auth user.
