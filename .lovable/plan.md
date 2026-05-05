# Aba "DEVEDORES" — Cobrança Asaas com Renegociação Automática

## Entendimento (confirmado com sua nova regra)

1. Sincronizar do Asaas TODOS os pagamentos com status `OVERDUE` há **mais de 60 dias**.
2. **Agrupar por cliente** (mesmo nome + mesmo CPF/CNPJ) — somando TODAS as parcelas vencidas dele.
3. Aplicar **+10% sobre o valor total somado** desse cliente.
4. Gerar **5 novos boletos no Asaas** (parcelamento), divididos igualmente.
5. **Todos os vencimentos sempre no dia 20 de cada mês** (1ª parcela = próximo dia 20; 2ª = dia 20 do mês seguinte; e assim por diante).
6. Salvar histórico completo da renegociação (motivo, parcelas originais agrupadas, novo plano).

---

## 1. Banco de dados (migration)

### Tabela `cobrancas_vencidas` (snapshot do Asaas)
- `id` (uuid pk), `asaas_payment_id` (text unique), `asaas_customer_id` (text)
- `cliente_nome` (text), `cliente_cpf_cnpj` (text), `cliente_email` (text)
- `valor` (numeric), `data_vencimento` (date), `dias_atraso` (int)
- `descricao` (text), `status` (text default 'pendente_renegociacao'), `created_at`

### Tabela `renegociacoes` (uma por cliente renegociado)
- `id` (uuid pk), `cliente_nome`, `cliente_cpf_cnpj`, `asaas_customer_id`
- `valor_original_total` (numeric), `valor_acrescimo` (numeric, =10%), `valor_renegociado` (numeric)
- `parcelas_originais_ids` (text[]) — IDs Asaas agrupados
- `motivo_cobranca` (text) — histórico completo legível
- `created_by` (uuid), `created_at`

### Tabela `parcelas_renegociadas` (5 boletos gerados)
- `id` (uuid pk), `renegociacao_id` (fk), `numero_parcela` (1-5)
- `asaas_payment_id` (text), `valor` (numeric), `data_vencimento` (date — sempre dia 20)
- `status` (text), `link_boleto` (text), `motivo_cobranca` (text), `created_at`, `updated_at`

RLS: somente `admin` (via `has_role`).

---

## 2. Edge Function `asaas-debtors-api`

Ações via `?action=`:

### `sync-overdue`
- GET `/v3/payments?status=OVERDUE&limit=100&offset=...` paginado.
- Para cada pagamento: calcula `dias_atraso`. Mantém apenas se **> 60 dias**.
- Busca dados do cliente (`/v3/customers/{id}`) → grava nome + CPF/CNPJ.
- Upsert em `cobrancas_vencidas` por `asaas_payment_id`.

### `list-debtors-grouped`
- Retorna agrupamento por `cliente_cpf_cnpj` + `cliente_nome`:
  - quantidade de parcelas, soma total, valor com +10%, valor de cada uma das 5 parcelas, datas dos próximos 5 dias 20.

### `renegotiate`
Body: `{ cliente_cpf_cnpj, cliente_nome, asaas_customer_id, observacao? }`
- Busca todas `cobrancas_vencidas` desse cliente em status `pendente_renegociacao`.
- `total = soma(valor)`, `acrescimo = total * 0.10`, `novo_total = total + acrescimo`.
- `valor_parcela = round(novo_total / 5, 2)` (última parcela ajusta centavos).
- Calcula 5 datas: próximo dia 20 ≥ hoje; depois +1 mês; +2; +3; +4 (sempre dia 20).
- Para cada parcela: POST `/v3/payments` (BOLETO) no Asaas com `dueDate`, `value`, `description` contendo `motivo_cobranca` completo.
- Cria `renegociacoes` + 5 `parcelas_renegociadas`.
- Marca `cobrancas_vencidas` originais como `renegociada`.

### `refresh-installment-status`
Atualiza status das parcelas chamando `/v3/payments/{id}`.

Headers Asaas: `access_token: ${ASAAS_API_KEY}`. Base URL via `ASAAS_ENV` (sandbox/produção). Validação JWT + `has_role('admin')`. Logs detalhados.

---

## 3. UI — `src/pages/admin/Devedores.tsx`

Rota nova: `/admin/devedores`. Botão **"Devedores"** na aba Financeiro (`Financeiro.tsx`) abre essa página.

Layout:
- **4 cards resumo**: Total devedores · Total parcelas vencidas · Valor original total · Valor com +10%.
- Botão **"Sincronizar com Asaas"** (chama `sync-overdue`, mostra toast com quantos sincronizados).
- **Tabela agrupada por cliente** (uma linha por CPF/CNPJ):
  - Nome · CPF/CNPJ · Qtd parcelas · Total devido · Total +10% · Botão **"Renegociar"**.
- Modal **Renegociar**: mostra preview com:
  - Lista das parcelas originais agrupadas
  - Total original · Acréscimo (10%) · Novo total
  - As **5 parcelas com datas (sempre dia 20)** e valor de cada
  - Campo de observação opcional → adiciona ao `motivo_cobranca`
  - Botão "Confirmar renegociação" → cria 5 boletos no Asaas
- Aba **"Histórico de renegociações"**: lista `renegociacoes` com expand mostrando as 5 parcelas e status de cada uma.

---

## 4. Configurações Asaas (`Configuracoes.tsx`)
- Card "Asaas": status do `ASAAS_API_KEY` (configurado/não), toggle Sandbox/Produção (`ASAAS_ENV`), botão "Testar conexão".

---

## Regra do dia 20 (detalhe técnico)

```text
hoje = 2026-05-05  → 1ª = 2026-05-20, 2ª = 2026-06-20, 3ª = 2026-07-20, 4ª = 2026-08-20, 5ª = 2026-09-20
hoje = 2026-05-21  → 1ª = 2026-06-20, 2ª = 2026-07-20, ...
```

## Arquivos a criar/editar
- Migration: 3 tabelas + RLS
- `supabase/functions/asaas-debtors-api/index.ts` (nova)
- `supabase/config.toml` (registrar função, `verify_jwt = true`)
- `src/pages/admin/Devedores.tsx` (nova)
- `src/App.tsx` (rota)
- `src/pages/admin/Financeiro.tsx` (botão "Devedores")
- `src/pages/admin/Configuracoes.tsx` (card Asaas)

Confirma para eu implementar?
