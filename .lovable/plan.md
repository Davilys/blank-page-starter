## Objetivo

Ao clicar no card **AGUARDANDO** no Financeiro, abrir uma central de "Faturas a Vencer" (D-3 e D-0) e permitir disparo de lembretes (email + WhatsApp via o mesmo webhook BotConversa já usado nos vencidos), com envio manual em massa/individual e automação diária via cron. cada envio ter um delei de 5 minutos e 7 minutos e 10 minutos dentro do horario comercial...

## 1. Nova página `/admin/financeiro/aguardando`

- Card **Aguardando** vira clicável (igual ao Vencido) → `navigate('/admin/financeiro/aguardando')`.
- Adicionar sub-legenda "(clique p/ lembrar)" no card.
- Layout espelhando `FinanceiroVencidos.tsx`, com 3 abas:
  - **Vence hoje** (due_date = hoje, status pending)
  - **Vence em 3 dias** (due_date = hoje+3)
  - **Todos aguardando** (status pending/overdue-ainda-no-mês, ordenados por vencimento)
- Cada linha: cliente, valor, vencimento, canais disponíveis (📧/📱), status do último lembrete (badge "Enviado hoje", "3d antes enviado", "Nunca"), botão **Lembrar agora**.
- Botão topo: **Disparar todos desta aba** (envio em massa).
- Toggle **Lista / Histórico** (histórico lê `cobranca_historico` filtrando `tipo='lembrete_vencimento'`).

## 2. Edge Function `lembrar-fatura-vencendo`

Clone de `cobrar-fatura-vencida` com ajustes:

- Aceita `invoice_id` + `tipo: "d3" | "d0"` + `channels` + `force`.
- Idempotência: bloqueia reenvio se já houver `cobranca_historico` do mesmo `tipo` para essa fatura nas últimas 20h.
- Reutiliza mesmo `FINANCEIRO_WEBHOOK` do BotConversa (mesmo pipeline WhatsApp dos vencidos) e Resend p/ email.
- Templates (WhatsApp e HTML) com a mensagem solicitada:
  ```
  Olá, {primeiro_nome}!
  Passando para lembrar que sua cobrança vence {hoje|em 3 dias} ({data_vencimento}).
  Para evitar juros e multas, você pode realizar o pagamento aqui:
  {link_boleto}
  Qualquer dúvida estamos à disposição 😊
  ```
- Registra em `cobranca_historico` com `metadata.tipo = 'lembrete_d3'` ou `'lembrete_d0'` e `status='enviada'`.

## 3. Edge Function `cron-lembretes-vencimento` (automação diária)

- Roda 1x ao dia (08:00 BRT via pg_cron/pg_net) — reusa infra do projeto.
- Query: faturas `status IN ('pending','open')` com `due_date = current_date` ou `due_date = current_date + 3`.
- Para cada, chama `lembrar-fatura-vencendo` com o `tipo` correspondente.
- Skip automático se idempotência bloquear.
- Log em `cobranca_historico` (mesma tabela, `metadata.origin='cron'`).

## 4. Simulação/teste antes de publicar

- Edge function terá query param `?dry_run=1` que monta a mensagem, resolve destinatários mas **não** dispara webhook nem grava histórico — retorna preview JSON.
- Botão **Simular envio** no dialog de confirmação da UI usa `dry_run`, mostrando exatamente qual mensagem sairá para cada cliente (nome, canal, texto, link) para validação visual.
- Só após o admin clicar **Confirmar** dispara de verdade.

## 5. Migração SQL

Nenhuma tabela nova. Apenas:

- Adicionar coluna opcional `tipo TEXT` em `cobranca_historico` (default 'cobranca_vencida') para distinguir lembretes de cobranças de vencidos. Backfill = 'cobranca_vencida'.
- Criar o cron job via `supabase--insert` (dados sensíveis: URL + anon key).

## 6. Arquivos a criar/editar

```
src/pages/admin/FinanceiroAguardando.tsx         (novo)
src/components/admin/financeiro/aguardando/
  ├── AguardandoTab.tsx                          (novo — lista D0/D3/all)
  ├── LembreteConfirmDialog.tsx                  (novo — com simulação)
src/App.tsx                                      (rota /admin/financeiro/aguardando)
src/pages/admin/Financeiro.tsx                   (card clicável + label)
supabase/functions/lembrar-fatura-vencendo/      (novo)
supabase/functions/cron-lembretes-vencimento/    (novo)
```

## 7. Ordem de execução

1. Migração `ALTER TABLE cobranca_historico ADD COLUMN tipo`.
2. Criar 2 edge functions (deploy automático).
3. Criar UI (rota + página + componentes).
4. Testar manualmente com `dry_run` → confirmar preview correto.
5. Depois de validado com o usuário, agendar o cron via `supabase--insert`.

Ao concluir, informo para você testar em `/admin/financeiro/aguardando` usando o botão **Simular** antes de qualquer disparo real.