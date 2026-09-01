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

O cancelamento definitivo depende do status da cobrança no Asaas: boletos já confirmados/recebidos não podem ser excluídos, apenas estornados. Nesses casos o CRM registra o resultado real retornado pela API e sinaliza na tela. CONTINUE A IMPLEMENTAÇÃO A PARTIR DOS RESULTADOS DA AUDITORIA.

A auditoria confirmou dois problemas críticos:

1. Não existe identificação permanente de que uma cobrança foi criada pelo CRM.

2. O boleto original não está sendo cancelado no Asaas quando ocorre cobrança/negociação.

NÃO considere a implementação concluída apenas criando um campo de origem.

A solução precisa garantir rastreabilidade e comportamento correto de ponta a ponta.

==================================================

1. ORIGEM CRM

==================================================

Criar uma identificação permanente e confiável para toda cobrança gerada pelo CRM.

Utilizar a estrutura de banco mais adequada à arquitetura existente.

A identificação deve permitir responder:

- Esta cobrança foi criada pelo CRM?

- Qual negociação originou esta cobrança?

- Qual cobrança original deu origem à negociação?

- Qual cliente está relacionado?

- Qual usuário realizou a ação?

- Quando a ação ocorreu?

- Qual foi o ID da cobrança no Asaas?

Não depender de consultas em parcelas para descobrir se uma cobrança foi criada pelo CRM.

Não depender de filtros no navegador.

Não depender do limite de 1.000 registros do Supabase.

A origem deve ser persistida no banco.

==================================================

2. VÍNCULO ENTRE COBRANÇA ORIGINAL E NOVA COBRANÇA

==================================================

Toda nova cobrança criada pelo CRM deve possuir vínculo explícito com a cobrança original.

Estrutura conceitual:

cobranca_original

↓

negociacao

↓

nova_cobranca

↓

asaas_payment_id

A implementação deve reutilizar tabelas/campos existentes quando possível.

Não criar estruturas duplicadas sem necessidade.

==================================================

3. CANCELAMENTO DO BOLETO ORIGINAL NO ASAAS

==================================================

Quando uma cobrança/negociação gerar uma nova cobrança:

1. Identificar o payment_id original no Asaas.

2. Verificar o status atual da cobrança.

3. Executar pela API do Asaas a operação correta para cancelar/excluir a cobrança original, conforme permitido pelo status.

4. Aguardar e validar a resposta da API.

5. Registrar o resultado no banco.

6. Somente depois concluir a operação no CRM.

IMPORTANTE:

NUNCA marcar internamente o boleto como cancelado se o Asaas não confirmar a operação.

Se o Asaas retornar erro, o CRM deve registrar o erro e informar que a operação externa não foi concluída.

Não criar falsa confirmação.

==================================================

4. AUDITORIA DA OPERAÇÃO

==================================================

Toda negociação/cobrança deve registrar:

- ID da negociação

- cliente

- cobrança original

- asaas_payment_id original

- nova cobrança

- novo asaas_payment_id

- usuário responsável

- data/hora

- tipo da operação

- valor

- resultado do cancelamento

- resposta/status retornado pelo Asaas

- status final da negociação

Se já existir tabela adequada, adicionar os campos necessários nela.

Não duplicar informações desnecessariamente.

==================================================

5. FILAS DE COBRANÇA

==================================================

Corrigir definitivamente as consultas de:

Vencidos até 30 dias

Devedores +30

Devedores +60

As filas NÃO devem fazer exclusão de registros no navegador para tentar descobrir o que já foi tratado.

A regra precisa estar no banco/query/backend.

Uma cobrança originada pelo CRM ou vinculada a uma negociação já tratada NÃO pode aparecer em nenhuma dessas filas.

Isso deve continuar funcionando mesmo com:

- 1.000 registros

- 10.000 registros

- 100.000 registros

Não utilizar lógica dependente do limite padrão de retorno do Supabase.

==================================================

6. REGRA ANTI-LOOP DEFINITIVA

==================================================

Se:

cobranca foi criada pelo CRM

OU

cobranca pertence a uma negociação realizada pelo CRM

ENTÃO:

não inserir em Vencidos até 30;

não inserir em Devedores +30;

não inserir em Devedores +60.

Se essa cobrança posteriormente vencer:

APENAS atualizar seu status.

NÃO criar nova dívida.

NÃO criar novo registro de cobrança.

NÃO retornar para a fila.

NÃO iniciar nova negociação automaticamente.

Ela permanece vinculada ao histórico da negociação.

==================================================

7. HISTÓRICO

==================================================

Quando a dívida original for tratada:

REMOVER DA FILA ATIVA

+

REGISTRAR NO HISTÓRICO

+

VINCULAR A NEGOCIAÇÃO

+

VINCULAR O NOVO BOLETO.

O histórico deve permanecer mesmo se:

- novo boleto vencer;

- cliente não pagar;

- novo boleto for cancelado posteriormente;

- houver alteração de status no Asaas.

O histórico representa a ação realizada pelo Financeiro.

==================================================

8. SINCRONIZAÇÃO ASAAS

==================================================

Revisar a Edge Function:

asaas-debtors-api

Especialmente:

sync-overdue-30

sync-overdue

A sincronização não pode simplesmente importar qualquer cobrança vencida do Asaas e transformá-la em nova pendência.

Antes de inserir/atualizar uma cobrança:

VERIFICAR SE ELA POSSUI ORIGEM CRM OU VÍNCULO COM NEGOCIAÇÃO.

Se possuir:

ATUALIZAR O STATUS EXISTENTE.

NÃO criar nova pendência.

==================================================

9. IDEMPOTÊNCIA

==================================================

Garantir que webhooks e sincronizações repetidas não criem:

- cobranças duplicadas;

- negociações duplicadas;

- históricos duplicados;

- parcelas duplicadas;

- boletos duplicados.

Usar IDs únicos do Asaas e identificadores internos do CRM.

==================================================

10. TRANSAÇÃO E CONSISTÊNCIA

==================================================

A operação de negociação deve ser tratada como um fluxo consistente.

Se ocorrer:

CRM cria negociação

→ cria novo boleto

→ tenta cancelar boleto original

e o cancelamento falhar:

NÃO apresentar a operação como concluída integralmente.

Registrar o erro.

Permitir que a equipe identifique e corrija a pendência.

Não deixar o sistema em um estado em que o usuário acredita que o boleto original foi cancelado quando ele continua ativo no Asaas.

==================================================

11. TESTE OBRIGATÓRIO DO CASO REAL

==================================================

Simular exatamente:

Cliente possui boleto vencido.

1. Boleto aparece em Vencidos até 30.

2. Operador realiza negociação.

3. CRM cria novo boleto.

4. CRM cancela o boleto original no Asaas.

5. CRM registra a negociação.

6. Dívida original vai para Histórico.

7. Novo boleto fica vinculado à negociação.

8. Novo boleto não aparece nas filas.

9. Novo boleto vence.

10. Sincronização do Asaas é executada.

11. Novo boleto NÃO retorna para Vencidos até 30.

12. Depois de 30 dias NÃO aparece em Devedores +30.

13. Depois de 60 dias NÃO aparece em Devedores +60.

14. Histórico continua apresentando a negociação completa.

==================================================

12. TESTE DE ESCALA

==================================================

Criar teste com mais de 1.000 cobranças originadas pelo CRM.

Garantir que nenhuma delas volte para as filas.

Esse teste é obrigatório porque a auditoria identificou o limite atual de 1.000 registros como uma das causas do loop.

==================================================

13. NÃO ALTERAR O QUE JÁ FUNCIONA

==================================================

Preservar:

- layout atual;

- botões existentes;

- abas existentes;

- Histórico;

- integração atual com Asaas;

- permissões;

- autenticação;

- demais módulos do CRM.

Alterar somente o necessário para corrigir a lógica financeira.

==================================================

14. CRITÉRIO DE ACEITE

A implementação somente será considerada concluída quando esta regra for verdadeira:

"Depois que uma dívida for tratada pelo CRM e uma nova cobrança for criada, nenhuma cobrança pertencente àquela negociação poderá voltar para as filas de cobrança, independentemente de quantos dias permaneça vencida ou quantas sincronizações com o Asaas sejam executadas."

Também deve ser possível auditar no CRM:

DÍVIDA ORIGINAL

→ AÇÃO REALIZADA

→ BOLETO ORIGINAL

→ CANCELAMENTO NO ASAAS

→ NOVA NEGOCIAÇÃO

→ NOVO BOLETO

→ STATUS ATUAL

→ HISTÓRICO COMPLETO.

Ao finalizar, apresente:

1. Migrações realizadas.

2. Campos/tabelas utilizados.

3. Funções alteradas.

4. Edge Functions alteradas.

5. Regras de fila alteradas.

6. Regra anti-loop implementada.

7. Fluxo de cancelamento no Asaas.

8. Testes realizados.

9. Resultado de cada teste.

10. Eventuais falhas ou pontos que ainda dependam de configuração externa.

NÃO declarar "concluído" se algum dos testes obrigatórios falhar.