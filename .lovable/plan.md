# Financeiro — Filas de cobrança sem duplicidade e sem loop

## O que a auditoria encontrou (verificado no código e no banco)

**Como as filas são montadas hoje**

- **Vencidos até 30 dias** (`Vencidos30DiasTab.tsx`) lê direto da tabela `invoices` (vencimento nos últimos 30 dias, status pendente/vencido) e filtra no navegador.
- **Devedores +30 / +60** (`Devedores.tsx`) leem `cobrancas_vencidas` (campo `bucket` = `d30`/`d60`, `status = pendente_renegociacao`), alimentada pela Edge Function `asaas-debtors-api` (ações `sync-overdue-30` e `sync-overdue`).
- **Histórico** de ≤30 dias vem de `cobranca_historico`; o de +30/+60 vem de `negociacoes_devedor` / `renegociacoes` com suas parcelas (`parcelas_devedor`, `parcelas_renegociadas`).

**Anti-loop atual (frágil, e é a causa do problema)**

- Não existe nenhum campo no banco que marque "esta cobrança nasceu do CRM". A exclusão é feita em tempo de execução, montando uma lista de `asaas_payment_id` a partir de `parcelas_devedor` + `parcelas_renegociadas`.
- No front (`Vencidos30DiasTab.tsx`, linhas 104-111) essa consulta **não pagina**: o Supabase devolve no máximo 1000 linhas. Passando disso, parcelas geradas pelo CRM deixam de ser reconhecidas e voltam para a fila de vencidos — exatamente o loop relatado.
- `invoices` não tem nenhum vínculo com negociação: quando o `sync` do Asaas cria/atualiza uma fatura de parcela de acordo, ela é indistinguível de uma dívida nova.

**Cancelamento do boleto original: não existe**

- Não há nenhuma chamada de exclusão/cancelamento (`DELETE /payments/{id}`) em `asaas-debtors-api`. Ao negociar/cobrar, o CRM cria os novos boletos e apenas marca as linhas de `cobrancas_vencidas` como `renegociada`/`cobrada` — os boletos originais continuam ativos no Asaas, gerando cobrança duplicada para o cliente.

**Sem transação registrada de forma auditável**

- `negociacoes_devedor` guarda `parcelas_originais_ids` mas não guarda o resultado do cancelamento no Asaas, nem quem/quando/qual motivo por dívida original.

## O que será feito

### 1. Marcação permanente de origem CRM (banco)

Migração reutilizando as tabelas existentes:

- `invoices`: novas colunas `originado_pelo_crm` (bool, default false), `negociacao_id`, `renegociacao_id`, `cobranca_origem_id` (asaas payment original).
- `cobrancas_vencidas`: mesmas colunas de origem + `tratada_em`, `tratada_por`.
- `parcelas_devedor` / `parcelas_renegociadas`: já têm `asaas_payment_id`; nada muda.
- Nova tabela `cobranca_tratamentos` (histórico imutável do tratamento da dívida): cliente, CPF/CNPJ, boleto original + id Asaas, valor original, tipo de ação (`cobranca`, `negociacao`, `renegociacao`, `acordo`, `outra`), motivo, usuário responsável, novo boleto + id Asaas + vencimento, resultado do cancelamento no Asaas, status da negociação, data. Com GRANTs e RLS restrita a admins/service_role.
- Índices únicos para idempotência: `invoices.asaas_invoice_id`, `cobrancas_vencidas.asaas_payment_id`, e chave única de evento em `cobranca_tratamentos` (`asaas_payment_id_original` + `crm_action_id`).
- Backfill: marcar como `originado_pelo_crm = true` toda fatura/cobrança cujo `asaas_payment_id` já apareça em `parcelas_devedor` ou `parcelas_renegociadas`, e criar registros de tratamento retroativos a partir de `negociacoes_devedor` / `renegociacoes`.

### 2. Cancelar o boleto original no Asaas

Em `asaas-debtors-api`, nas ações `negociar-devedor`, `cobrar-devedor` e `renegotiate`, depois de criar com sucesso os novos boletos:

1. Para cada `asaas_payment_id` original, consultar o status atual no Asaas.
2. Se estiver excluível → `DELETE /payments/{id}`; se não for excluível pelo status → usar a operação disponível (estorno/cancelamento) para aquele status.
3. Só considerar tratado após confirmação do retorno da API; gravar o retorno em `cobranca_tratamentos.resultado_cancelamento`.
4. Falha no cancelamento não desfaz a negociação — fica registrada e sinalizada na interface do histórico.

### 3. Anti-loop persistente

- Todo boleto criado pelo CRM nasce com `originado_pelo_crm = true` e vínculo à negociação, tanto em `parcelas_*` quanto na `invoices` correspondente (quando o sync a criar).
- As três filas passam a excluir, **na consulta**, qualquer registro com `originado_pelo_crm = true`, `negociacao_id`/`renegociacao_id` preenchido, ou com tratamento em `cobranca_tratamentos`.
- `sync-overdue`, `sync-overdue-30` e `sync-asaas-invoices` deixam de reinserir esses pagamentos: apenas atualizam status e vencimento do registro já existente.
- Remove-se a dependência da lista de 1000 linhas montada no navegador — o filtro passa a ser feito no banco.

### 4. Transferência para o Histórico no momento da ação

Ao concluir cobrança/negociação: a dívida original sai da fila imediatamente (`status` tratado + `tratada_em`), grava-se o registro em `cobranca_tratamentos` com motivo (COBRANÇA REALIZADA / NEGOCIAÇÃO REALIZADA / NOVO BOLETO GERADO / ACORDO REALIZADO / OUTRA AÇÃO), e o novo boleto fica vinculado à negociação. Nada disso espera o pagamento.

O Histórico das três abas passa a mostrar, além do que já mostra: boleto original → ação → novo boleto, com o status atual do novo boleto (inclusive "vencido") sem que ele volte para a fila. O histórico do CRM nunca é apagado por cancelamento no Asaas.

### 5. Idempotência

- Toda ação de cobrança/negociação recebe um `crm_action_id`; reenvio do mesmo evento não cria novo boleto nem novo tratamento.
- Webhook `asaas-webhook` e sincronizadores passam a fazer upsert por `asaas_payment_id` (índice único), nunca insert cego.

### 6. Atualização em tempo real

Após concluir cobrança/negociação, as telas recarregam fila + histórico automaticamente (já existe `load()`; será chamada nas rotas que hoje não recarregam) — sem F5.

### 7. Interface

Layout mantido. Alterações apenas: coluna/linha no Histórico mostrando "boleto original → novo boleto" e um selo quando o cancelamento no Asaas falhou.

## Testes

Testes Deno para as Edge Functions cobrindo os 10 cenários pedidos: entrada na fila ≤30, saída após cobrança, cancelamento no Asaas, vínculo do novo boleto, novo boleto vencido não retorna (30/60 dias), webhook duplicado, sync periódico e persistência do histórico após refresh.

## Detalhes técnicos

Arquivos afetados: migração SQL nova; `supabase/functions/asaas-debtors-api/index.ts`; `supabase/functions/sync-asaas-invoices/index.ts`; `supabase/functions/asaas-webhook/index.ts`; `supabase/functions/cobrar-fatura-vencida/index.ts`; `src/components/admin/financeiro/vencidos/Vencidos30DiasTab.tsx`; `src/pages/admin/Devedores.tsx`. Nenhuma integração nova com o Asaas — apenas a atual (`ASAAS_API_KEY`, base v3).

## Dependência externa

O cancelamento definitivo depende do status da cobrança no Asaas: boletos já confirmados/recebidos não podem ser excluídos, apenas estornados. Nesses casos o CRM registra o resultado real retornado pela API e sinaliza na tela.
