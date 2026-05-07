## Objetivo

Tornar o card "Vencido" do Financeiro clicável, abrir um modal com todos os vencidos dos últimos 30 dias, com filtros (dia/semana/mês), botão **Cobrar** ao lado de cada cliente (envia WhatsApp + e-mail com a mensagem aprovada), sincronização automática diária com Asaas (10h, seg-sex), histórico de cobranças e roteamento automático para Devedores 30+/60+ dias.

## 1. Card "Vencido" clicável + Modal de Cobrança

**Arquivo:** `src/pages/admin/Financeiro.tsx`

- Tornar o stat card "Vencido" um botão (`onClick` abre `<OverdueChargeDialog />`).
- Criar novo componente `src/components/admin/financeiro/OverdueChargeDialog.tsx`:
  - Lista todas as faturas com `status` normalizado = `overdue` E `due_date` nos últimos 30 dias (até hoje).
  - Filtros no topo: **Hoje / Semana / Mês** (default: Mês), busca por nome.
  - Tabela: Cliente · Marca/Descrição · Valor · Vencimento · Dias atraso · Telefone/Email · Botão **Cobrar**.
  - Botão **Cobrar** chama `supabase.functions.invoke('cobrar-fatura-vencida', { body: { invoice_id } })`.
  - Indicador "Já cobrada hoje" quando há registro recente em `cobranca_historico`.

## 2. Edge Function `cobrar-fatura-vencida` (nova)

**Arquivo:** `supabase/functions/cobrar-fatura-vencida/index.ts`

- Recebe `invoice_id`, busca fatura + perfil (nome, phone, email).
- Monta as duas mensagens com placeholders `[Nome do Cliente]` e `[data]`:

**WhatsApp** (texto da solicitação do usuário): coloque no texto o link da fatura em aberto 

```
Olá, *{nome}*, tudo bem?

Identificamos que sua fatura com vencimento em *{data}* encontra-se em aberto.

Você consegue realizar o pagamento hoje?
Preciso apenas da sua confirmação para atualizar nosso sistema.

✅ Pagando hoje via PIX, conseguimos retirar multas e juros.

🔑 Chave PIX (CNPJ):
*39.528.012/0001-29*

Após o pagamento, me envie o comprovante por aqui para que eu possa dar baixa no sistema, tudo bem?
```

**E-mail** (HTML com mesmo contexto, assunto: `Fatura em aberto — vencimento {data} — WebMarcas`).coloque no texto o link da fatura em aberto 

- Dispara via `send-multichannel-notification` (canais: whatsapp + email).
- Insere registro em `cobranca_historico` (tabela nova).
- Idempotência: bloqueia nova cobrança da mesma fatura nas últimas 24h.

## 3. Tabela `cobranca_historico` + retorno em 7 dias

**Migration nova:**

```sql
create table public.cobranca_historico (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  user_id uuid,
  cliente_nome text, cliente_email text, cliente_phone text,
  enviada_em timestamptz not null default now(),
  canais text[] not null,                 -- ['whatsapp','email']
  status text not null default 'enviada', -- enviada | confirmada_paga | reentrada_fila
  proxima_acao_em timestamptz,            -- enviada_em + 7d
  message_whatsapp text, message_email_html text,
  created_at timestamptz default now()
);
alter table public.cobranca_historico enable row level security;
create policy "admins read/write" on public.cobranca_historico
  for all using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
```

- Aba **Histórico** dentro do modal: lista cobranças enviadas, status (enviada/confirmada_paga), última ação.
- Quando uma fatura é confirmada paga no Asaas, `status` da cobrança vira `confirmada_paga`.
- Se passar de `proxima_acao_em` (7 dias) sem pagamento confirmado → status = `reentrada_fila` (volta a aparecer no modal de Vencidos como "elegível para nova cobrança").

## 4. Sync automático Asaas — diário 10h seg-sex

**Edge function existente:** `sync-asaas-invoices` já atualiza status. Já existe `sync-overdue-30` e `sync-overdue-60` em `asaas-debtors-api`.

Criar cron job (`pg_cron` + `pg_net`) — executar via SQL insert:

```sql
select cron.schedule(
  'asaas-daily-sync-10h',
  '0 13 * * 1-5',  -- 10h BRT = 13h UTC, seg-sex
  $$
  select net.http_post(url:='https://scpbqsvwojhbxihyqbdz.supabase.co/functions/v1/sync-asaas-invoices', headers:='{"Content-Type":"application/json","apikey":"<ANON>"}'::jsonb, body:='{}'::jsonb);
  select net.http_post(url:='https://scpbqsvwojhbxihyqbdz.supabase.co/functions/v1/asaas-debtors-api', headers:='{"Content-Type":"application/json","apikey":"<ANON>"}'::jsonb, body:='{"action":"sync-overdue-30"}'::jsonb);
  select net.http_post(url:='https://scpbqsvwojhbxihyqbdz.supabase.co/functions/v1/asaas-debtors-api', headers:='{"Content-Type":"application/json","apikey":"<ANON>"}'::jsonb, body:='{"action":"sync-overdue-60"}'::jsonb);
  $$
);
```

Botão **Atualizar** no modal força execução manual das mesmas funções.

## 5. Roteamento automático 30+ / 60+ dias

Já existe a lógica de buckets `d30` (1–30 dias) e `d60` (≥60 dias) em `asaas-debtors-api`. Ajustes:

- **0–30 dias** → permanece no Financeiro/Vencido (modal de cobrança).
- **>30 e <60 dias** → entra em `Devedores` aba "Devedor 30 dias" (bucket `d30`, já existe — confirmar que `sync-overdue-30` aceita até ~59 dias; ajustar limite superior de 30 → 59 em `asaas-debtors-api/index.ts` linha 209).
- **≥60 dias** → "Devedor 60+" (bucket `d60`, já funciona).
- Faturas confirmadas pagas no Asaas → `invoices.status` = `paid`/`confirmed`, não aparecem mais em vencidos. Cobrança correspondente em `cobranca_historico` é marcada `confirmada_paga` (histórico).

Acrescentar trigger SQL ou lógica no `sync-asaas-invoices`: ao detectar pagamento, atualizar `cobranca_historico.status='confirmada_paga'` para a fatura.

## 6. Detalhes de UI no modal

- Filtros de período (Hoje / Semana / Mês) reutilizando padrão dos botões já existentes em Financeiro.
- Coluna "Ações": ícones WhatsApp + Email separados (envia só por aquele canal) e botão consolidado **Cobrar** (envia ambos).
- Aba **Histórico** dentro do modal mostrando todas as cobranças enviadas com filtro por período.

## Resumo dos arquivos

**Novos**

- `src/components/admin/financeiro/OverdueChargeDialog.tsx`
- `supabase/functions/cobrar-fatura-vencida/index.ts`
- Migration: tabela `cobranca_historico` + RLS + trigger de marcação como paga
- SQL insert: cron job 10h seg-sex

**Editados**

- `src/pages/admin/Financeiro.tsx` — card "Vencido" clicável, integra dialog
- `supabase/functions/asaas-debtors-api/index.ts` — bucket d30 passa a cobrir 1–59 dias
- `supabase/functions/sync-asaas-invoices/index.ts` — atualiza `cobranca_historico` ao confirmar pagamento

Pronto para aprovar e implementar?