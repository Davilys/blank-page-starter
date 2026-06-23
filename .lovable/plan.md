## Objetivo

No Financeiro, parcelas geradas por uma negociação (Devedores +30) ou renegociação (Devedores +60) estão reaparecendo como "novos vencidos" assim que vencem (em Vencidos até 30, depois +30, depois +60). Isso é errado: uma vez que o débito foi negociado, suas parcelas pertencem **apenas** ao Histórico daquela negociação — nunca devem voltar a aparecer nas listas de cobrança. Além disso, o Histórico precisa mostrar o detalhe parcela a parcela (pagas, a vencer, vencidas).

## O que muda

### 1. Filtro global de "parcelas já negociadas" (backend)

Criar um helper único no edge function `asaas-debtors-api` que retorna o conjunto de `asaas_payment_id` que já pertencem a alguma negociação — unindo:

- `parcelas_devedor.asaas_payment_id` (vindo de `negociacoes_devedor`)
- `parcelas_renegociadas.asaas_payment_id` (vindo de `renegociacoes`)

Aplicar esse filtro em:

- `sync-overdue` (bucket d60) — ignora o pagamento e não insere em `cobrancas_vencidas`.
- `sync-overdue-30` (bucket d30) — idem.
- `list-debtors-grouped` e `list-debtors-30-grouped` — remove qualquer linha residual cujo `asaas_payment_id` já esteja em uma negociação.
- Como segurança extra: marcar tais linhas como `status='negociada'` em `cobrancas_vencidas` durante o sync, para nunca mais voltarem.

### 2. Vencidos até 30 dias (lista do Financeiro)

`src/components/admin/financeiro/vencidos/Vencidos30DiasTab.tsx` lê direto da tabela `invoices`. Antes de renderizar, buscar todos os `asaas_payment_id` em `parcelas_devedor` + `parcelas_renegociadas` e filtrar as faturas cujo `asaas_invoice_id` esteja nesse conjunto — assim parcelas de negociação que vencem entre 1 e 30 dias somem desta aba.

### 3. Histórico (Devedores +30 e +60) — detalhar parcelas

Hoje o histórico mostra só totais. Vou:

- Tornar cada linha do histórico **expansível** (chevron) para abrir um painel com a lista de parcelas (`parcelas_devedor` ou `parcelas_renegociadas` — já são carregadas via join).
- Em cada parcela, mostrar: nº, vencimento, valor, link do boleto, e um badge calculado:
  - **Paga** — quando `status` ∈ {paid, confirmed, received}.
  - **A vencer** — quando não paga e `data_vencimento >= hoje`.
  - **Vencida** — quando não paga e `data_vencimento < hoje`.
- No cabeçalho da linha do histórico, adicionar contadores resumidos: `X pagas · Y a vencer · Z vencidas` e o subtotal vencido em R$.

### 4. Organização do Financeiro

Para deixar coerente com a nova regra:

- Em `FinanceiroVencidos.tsx`, renomear as abas e descrições:
  - "Vencidos até 30 dias" → faturas avulsas (sem negociação) com 1–30 dias de atraso.
  - "Devedores +30 dias" → débitos 31–59 dias **ainda não negociados** + histórico de negociações 3x.
  - "Devedores +60 dias" → débitos 60+ dias **ainda não renegociados** + histórico de renegociações 5x.
- Em cada aba, adicionar uma legenda curta abaixo do toggle Lista/Histórico explicando que "parcelas já negociadas só aparecem no Histórico".
- Na página `Financeiro.tsx`, o card "Vencidos 30d" passa a refletir o mesmo filtro (descontando parcelas negociadas) para o número não divergir da aba.

## Arquivos afetados

- `supabase/functions/asaas-debtors-api/index.ts` — novo helper `getNegotiatedPaymentIds`, aplicado em sync + list.
- `src/components/admin/financeiro/vencidos/Vencidos30DiasTab.tsx` — filtro de exclusão por `asaas_invoice_id`.
- `src/pages/admin/Devedores.tsx` — linhas de histórico expansíveis com detalhe de parcelas; contadores; estado de expansão por id.
- `src/pages/admin/FinanceiroVencidos.tsx` — textos das abas e legenda explicativa.
- `src/pages/admin/Financeiro.tsx` — ajuste do cálculo `overdue30d` para descontar parcelas negociadas.

## Detalhes técnicos

- Sem migration: as tabelas `parcelas_devedor` e `parcelas_renegociadas` já existem e têm `asaas_payment_id`.
- O helper roda em batches de até 1000 ids para respeitar o limite do PostgREST.
- Status de parcela vem de `parcelas_devedor.status` / `parcelas_renegociadas.status` (já gravado pelo webhook do Asaas); a categorização "a vencer / vencida" é puramente derivada no cliente.
- A marcação `status='negociada'` em `cobrancas_vencidas` é idempotente e usa update em massa apenas quando há ids novos detectados no sweep.