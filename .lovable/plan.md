## Objetivo
Fazer com que a tela "Lembretes de Vencimento" (Aguardando) mostre **apenas faturas que ainda existem e estão ativas no Asaas**. Faturas que foram excluídas/removidas no Asaas devem sumir do CRM automaticamente ao sincronizar.

## Diagnóstico
Hoje o `sync-asaas-invoices` só atualiza status/valor/vencimento das faturas pendentes. Quando o Asaas retorna **404** (fatura deletada) ou **status = DELETED**, o código apenas loga o erro e segue — a fatura continua "pending" no banco e aparece na aba Aguardando.

## Mudanças

### 1) Edge function `sync-asaas-invoices` — detectar faturas removidas
Para cada fatura pending/overdue com `asaas_invoice_id`:
- Se o GET no Asaas retornar **404** (ou 400 com "not found"): marcar a fatura local como `status = 'cancelled'` e gravar `updated_at`. Não aparece mais em Aguardando (o filtro é `pending`/`overdue`).
- Se o Asaas retornar `status = "DELETED"`: mesmo tratamento — marcar `cancelled` local.
- Adicionar no mapper `mapAsaasStatus`: `'DELETED' -> 'cancelled'`.
- Contadores no retorno: incluir `removed` (quantas foram canceladas por não existirem mais no Asaas) além do `synced` atual.
- Manter o resto do comportamento (status, due_date, amount, payment_date).

### 2) Auto-sync ao abrir a aba Aguardando
Em `FinanceiroAguardando.tsx`: chamar `sync-asaas-invoices` automaticamente **uma vez ao montar a página** (silencioso, sem toast bloqueante — só um toast discreto de "Sincronizando..." → "Atualizado") e depois invalidar as queries. Assim, ao abrir a tela o usuário já vê a lista limpa sem precisar clicar em "Sincronizar com Asaas".

### 3) Filtro defensivo no front (garantia extra)
No `AguardandoTab` (query `financeiro-aguardando`): exigir `asaas_invoice_id NOT NULL` e `status IN ('pending','overdue')`. Faturas sem vínculo Asaas ou já canceladas nunca aparecem. (Verificar o filtro atual e ajustar se necessário — sem mudar layout.)

## Nada muda
- UI, cores, templates, cron diário, webhook do lembrete, delay de 1 min entre envios: **inalterados**.
- Nenhuma migração de schema — só uso do valor `'cancelled'` já suportado em `invoices.status`.

## Como validar
1. Abrir `/admin/financeiro/aguardando` → sync roda automático, faturas deletadas no Asaas somem.
2. Botão "Sincronizar com Asaas" continua funcionando manualmente e mostra `X atualizadas · Y removidas`.
3. Clicar em "Lembrar" só dispara para clientes que ainda existem no Asaas.
