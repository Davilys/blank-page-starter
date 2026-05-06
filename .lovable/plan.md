## Objetivo

Em **Financeiro › Devedores**, adicionar uma nova aba **"Devedor"** ao lado de **"Devedores (60+)"** e **"Histórico"**. Essa aba lista cobranças vencidas do Asaas com **até 30 dias** de atraso, espelhando exatamente a UI de Devedores, mas com dois botões por linha:

- **Negociar** — parcela em 3x sem juros no boleto, com **acréscimo de 10%** sobre o total.
- **Cobrar** — gera **um único boleto** com a soma de todos os débitos do cliente, **sem taxa**.

Ambas as ações disparam notificação por **WhatsApp + e-mail** com mensagem própria e o link do boleto da primeira parcela (Negociar) ou do boleto único (Cobrar). Há um **histórico próprio** dessas operações, separado do histórico de renegociação 60+.

## Estrutura da UI

```text
Tabs:
  [ Devedores (60+) ] [ Devedor (≤30d) ] [ Histórico 60+ ] [ Histórico Devedor ]
```

Cada linha da nova aba "Devedor":

```text
Cliente | CPF/CNPJ | Parcelas | Total devido | Total + 10% | [Negociar] [Cobrar]
```

Cards de resumo idênticos aos de Devedores, recalculados para o conjunto ≤30 dias.

## Mudanças no banco (migration)

1. **`cobrancas_vencidas`**: adicionar coluna opcional `bucket text default 'd60'` (`'d60'` para 60+, `'d30'` para ≤30) — permite reaproveitar a mesma tabela sem misturar listas.
2. Nova tabela **`negociacoes_devedor`** (espelha `renegociacoes`):
   ```text
   id uuid pk, cliente_nome, cliente_cpf_cnpj, asaas_customer_id,
   tipo text check (tipo in ('negociar','cobrar')),
   valor_original_total numeric, valor_acrescimo numeric, valor_total numeric,
   parcelas_originais_ids text[], motivo_cobranca text, observacao text,
   created_by uuid, created_at timestamptz default now()
   ```
3. Nova tabela **`parcelas_devedor`** (espelha `parcelas_renegociadas`):
   ```text
   id uuid pk, negociacao_id uuid fk,
   numero_parcela int, asaas_payment_id text, valor numeric,
   data_vencimento date, status text, link_boleto text, invoice_url text,
   motivo_cobranca text, created_at timestamptz default now()
   ```
4. RLS: somente admins (mesmo padrão das tabelas existentes).

## Mudanças no edge function `asaas-debtors-api`

Novas actions, mantendo o que já existe:

- **`sync-overdue-30`** — varre `/payments?status=OVERDUE`, mantém somente cobranças com `dias_atraso >= 1 e <= 30`, faz upsert em `cobrancas_vencidas` com `bucket='d30'`.
- **`list-debtors-30-grouped`** — agrupa por cliente onde `bucket='d30' and status='pendente_renegociacao'`. Calcula `total_original`, `acrescimo (10%)`, `novo_total`, `valor_parcela = novo_total/3`, `datas_parcelas` = próximos 3 dias 20.
- **`negociar-devedor`** (POST `{ cliente_cpf_cnpj, asaas_customer_id, observacao? }`)
  - Soma parcelas, aplica +10%, divide em 3 boletos vencendo dia 20.
  - Cria registro em `negociacoes_devedor` (`tipo='negociar'`) e 3 linhas em `parcelas_devedor`.
  - Cria 3 boletos no Asaas (mesma lógica do `renegotiate`).
  - Marca cobranças originais como `status='renegociada'`.
  - Retorna `primeira_fatura_url`, `cliente_email`, `cliente_telefone` para o front disparar a notificação.
- **`cobrar-devedor`** (POST `{ cliente_cpf_cnpj, asaas_customer_id }`)
  - Soma parcelas **sem acréscimo**.
  - Cria **1 boleto único** no Asaas com vencimento no próximo dia 20.
  - Cria registro em `negociacoes_devedor` (`tipo='cobrar'`, `valor_acrescimo=0`) e 1 linha em `parcelas_devedor`.
  - Marca cobranças originais como `status='cobrada'`.
  - Retorna `fatura_url`, contatos.

Também ajustar `sync-overdue` existente para gravar `bucket='d60'` nas cobranças que mantém (>60d), mantendo retrocompatibilidade.

## Frontend (`src/pages/admin/Devedores.tsx`)

1. Acrescentar 2 abas: `Devedor (n)` e `Histórico Devedor (n)`.
2. Estado novo: `debtors30`, `history30`, `selectedNeg` (modal Negociar), `selectedCob` (confirmação Cobrar).
3. Botão **Sincronizar com Asaas** continua disparando `sync-overdue` (60+) **e** o novo `sync-overdue-30` em paralelo, com toast unificado.
4. Botões **Negociar** e **Cobrar** abrem modais de confirmação mostrando os valores calculados; ao confirmar chamam as novas actions e em seguida disparam `send-multichannel-notification` com mensagens próprias (templates abaixo).
5. Tabela do **Histórico Devedor** com data, cliente, tipo (Negociar/Cobrar), original, acréscimo, total, parcelas — e os mesmos botões pequenos 📧 / 💬 ao lado do nome (igual ao histórico de renegociação) para reenviar a notificação.

## Templates de mensagem

**Negociar (3x +10%)** — assunto "Condição especial para regularizar suas faturas":
```text
Oi {firstName}! Tudo bem?

Para você não ficar com pendências em aberto, consegui parcelar suas
faturas vencidas em até 3x sem juros no boleto 👇

✅ Total renegociado: {valor_total} (com pequeno acréscimo de 10%)
📅 1ª parcela vence dia 20, segue boleto: {link}

Assim você regulariza tudo de forma tranquila e mantém seu cadastro em dia.

Já liberei essa condição pra você, combinado? 👍
```

**Cobrar (boleto único, sem taxa)** — assunto "Boleto único das suas faturas em aberto":
```text
Oi {firstName}! Tudo bem?

Juntei todas as suas faturas em aberto em um único boleto, sem qualquer
acréscimo, pra ficar mais fácil de quitar 👇

✅ Total: {valor_total}
📅 Vencimento dia 20, segue boleto: {link}

Assim você regulariza tudo de uma vez e fica em dia.

Combinado? 👍
```

Versão HTML equivalente, igual ao padrão usado em `buildRenegMessage`.

## Validação pós-deploy

1. Clicar **Sincronizar com Asaas** → toasts mostram totais 60+ e ≤30.
2. Aba **Devedor** lista clientes com vencimentos ≤30d.
3. Clicar **Negociar** → 3 boletos criados no Asaas, e-mail e WhatsApp enviados, registro aparece em **Histórico Devedor**.
4. Clicar **Cobrar** → 1 boleto único criado, e-mail e WhatsApp enviados, registro aparece em **Histórico Devedor** com `tipo='cobrar'`.
5. Os botões 📧 / 💬 reenviam a notificação correspondente.
6. Cobranças originais saem da listagem **Devedor** após a ação.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — coluna `bucket`, tabelas `negociacoes_devedor`, `parcelas_devedor`, RLS.
- `supabase/functions/asaas-debtors-api/index.ts` — novas actions `sync-overdue-30`, `list-debtors-30-grouped`, `negociar-devedor`, `cobrar-devedor`; ajuste do `sync-overdue` para gravar `bucket`.
- `src/pages/admin/Devedores.tsx` — 2 abas novas, modais Negociar/Cobrar, fetchers, builders de mensagem, reenvio.
