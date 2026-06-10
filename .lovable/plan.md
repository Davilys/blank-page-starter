## Objetivo
1. Adicionar 5ª aba **Cumpridos** na lista de faixas de prazo.
2. Sinalização visual clara quando o cliente **já foi notificado** na faixa atual (No Prazo / 30 Dias / Última Semana / Vencidos), para evitar reenvio.
3. Novo modelo de notificação **"Notificação Formal de Vencimento"** disponível na aba Vencidos, com o texto fornecido pelo usuário.

## 1. Nova aba "Cumpridos" em `PublicacaoPrazos.tsx`
- Adicionar bucket `cumpridos` em `Bucket` e em `BUCKETS` (cor verde escuro / esmeralda, distinta do "No Prazo").
- Mudar grid de `lg:grid-cols-4` para `lg:grid-cols-5`.
- Ajustar `eligible`:
  - Listas de prazo (no_prazo / 30dias / ultima_semana / vencidos) continuam excluindo `cumprimento_ok = true` / `cumprimento_status = 'cumprido'`.
  - Quando `active === 'cumpridos'`, montar lista separada com publicações onde `cumprimento_status = 'cumprido'` (ou `cumprimento_ok = true`), ordenadas por `cumprimento_at` desc. Essas linhas não recalculam bucket por dias.
- Counts: incluir `cumpridos` no objeto `counts`.
- Na tabela, quando `active === 'cumpridos'`:
  - Mostrar coluna "Cumprido em" no lugar de "Dias Restantes" (ou adicional), exibindo `cumprimento_at` formatado.
  - Botão de status já mostra "Cumprido" verde; menu permite "Limpar status" para devolver à lista de prazos.
  - Ocultar botão "Arquivar" (já cumprido).

## 2. Indicador "Já notificado" por faixa
Hoje a coluna **Cobrança** mostra apenas `{sentCount}/3 enviadas` global. Vamos enriquecer:

- Determinar a **faixa atual** do registro (no_prazo / 30dias / ultima_semana / vencidos) e gravar essa informação no momento de cada notificação. Implementação:
  - Adicionar coluna `notif_X_bucket` (text) em `publicacao_cobranca_schedule` para cada uma das 3 notificações já existentes — ou, mais simples, uma única coluna `last_notif_bucket` + `last_notif_at`.
  - Decisão: usar `last_notif_bucket` (text) + `last_notif_at` (timestamptz). Atualizado tanto por envio manual (`NotificarClienteDialog`) quanto pelo cron `check-publicacao-notificacoes`.
- Na linha da tabela, mostrar badge **"✓ Notificado nesta faixa"** (verde) quando `schedule.last_notif_bucket === pub._bucket`. Caso contrário, badge cinza "Pendente nesta faixa".
- Esse badge aparece junto do contador `{sentCount}/3`, dentro da coluna "Cobrança".

### Onde gravar `last_notif_bucket`
- `NotificarClienteDialog.tsx` → ao enviar, calcular o bucket atual e atualizar `publicacao_cobranca_schedule` com `last_notif_bucket`, `last_notif_at`.
- `check-publicacao-notificacoes/index.ts` → mesma lógica antes de retornar.

## 3. Novo template "Notificação Formal de Vencimento"
- Em `cobrancaTemplates.ts`, adicionar um quarto template `vencido_formal` com o texto fornecido (assinatura WebMarcas + telefones).
- Em `NotificarClienteDialog.tsx`:
  - Quando a publicação está **vencida** (dias < 0) ou está na aba **Vencidos**, exibir esse template adicional como opção selecionável (radio/select de templates).
  - Caso contrário, manter os 3 templates atuais.

## 4. Migração de banco
Nova migration:
```sql
ALTER TABLE public.publicacao_cobranca_schedule
  ADD COLUMN IF NOT EXISTS last_notif_bucket text,
  ADD COLUMN IF NOT EXISTS last_notif_at timestamptz;
```
Sem novas tabelas → sem novos GRANTs.

## 5. Arquivos afetados
- `src/components/admin/publicacao/PublicacaoPrazos.tsx` — bucket "Cumpridos", coluna "Cumprido em", badge "Notificado nesta faixa".
- `src/components/admin/publicacao/NotificarClienteDialog.tsx` — novo template para vencidos + gravar `last_notif_bucket`.
- `src/components/admin/publicacao/cobrancaTemplates.ts` — template `vencido_formal`.
- `supabase/functions/check-publicacao-notificacoes/index.ts` — gravar `last_notif_bucket`/`last_notif_at`.
- Nova migration adicionando colunas em `publicacao_cobranca_schedule`.

## 6. Fora de escopo
Sem mudanças em outras telas, edge functions de email/whatsapp, ou políticas RLS.