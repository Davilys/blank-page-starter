# Notificações de Publicação (15/30/50 dias) + Botão Prazos em Destaque

## 1. Destaque visual do botão "Prazos"

No `PublicacaoTab.tsx`, criar um **banner de destaque** logo abaixo do banner "Auto-vincular" (linhas ~1641–1656), só visível quando `viewMode !== 'prazos'`:

- Card com gradiente sutil (token semântico: `bg-primary/5` + borda `border-primary/30`).
- Ícone `CalendarClock`, título "Controle de Prazos das Publicações".
- Mostra contagem dinâmica: `X publicações vencendo em 7 dias · Y vencidas`.
- Botão CTA grande "Abrir Prazos" que faz `setViewMode('prazos')`.

Manter o botão pequeno na barra de view (lista/kanban/prazos) como atalho secundário.

## 2. Cadastro de cronograma de cobrança por publicação

Migração — nova tabela `publicacao_cobranca_schedule`:

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | |
| publicacao_id | uuid FK → publicacoes_marcas | unique |
| client_id | uuid | denormalizado p/ leitura rápida |
| data_inicio | date | data do primeiro contato (default = data_publicacao_rpi) |
| notif_1_at, notif_2_at, notif_3_at | timestamptz | datas reais de envio |
| notif_1_channel, notif_2_channel, notif_3_channel | text | 'email' \| 'whatsapp' \| 'ambos' |
| status | text | 'ativo' \| 'pausado_resposta' \| 'concluido' |
| client_responded_at | timestamptz | quando cliente respondeu (pausa o cronograma) |
| responsavel_admin_id | uuid | quem está cobrando |
| created_at / updated_at | timestamptz | |

Datas planejadas (calculadas): `data_inicio + 15`, `data_inicio + 30`, `data_inicio + 50`.

GRANTs + RLS: admins gerenciam tudo; clientes leem somente o próprio (`client_id = auth.uid()`).

## 3. UI — Ação por linha em `PublicacaoPrazos.tsx`

Em cada linha da lista, adicionar botão "Notificar Cliente" que abre um **dialog** `NotificarClienteDialog`:

- Mostra dados do cliente (nome, email, telefone).
- Mostra o cronograma atual (1ª/2ª/3ª) com indicação `pendente`, `enviada em XX/XX`, `vence em Xd`.
- Para cada notificação ainda não enviada:
  - Pré-visualização da mensagem (templates abaixo, com `{{NOME_CLIENTE}}` substituído).
  - Selector de canal: ☑ Email · ☑ WhatsApp (multi-select).
  - Botão "Enviar agora" → chama `send-multichannel-notification` (já existe) com `custom_message` e `custom_subject`; grava `notif_X_at` e `notif_X_channel` em `publicacao_cobranca_schedule`.
- Botões finais: "Marcar como respondido pelo cliente" (seta `status='pausado_resposta'` + `client_responded_at`), "Reiniciar cronograma" (admin manual).

### Templates (armazenados como constantes no front, com merge `{{NOME_CLIENTE}}`)

- **1ª notificação (15 dias):** texto fornecido pelo usuário (versão amigável de lembrete dos 60 dias).
- **2ª notificação (30 dias):** versão de cobrança mais firme (39 dias).
- **3ª notificação (50 dias):** notificação formal com débito R$ 1.621,00 e arquivamento iminente.

Assunto do email:
- 1ª: "Lembrete: prazo de 60 dias junto ao INPI — {{MARCA}}"
- 2ª: "Atenção: prazo do INPI próximo de vencer — {{MARCA}}"
- 3ª: "Notificação formal: cumprimento de exigência INPI — {{MARCA}}"

## 4. Disparo automático — flow "NOTIFICAÇÃO PUBLICAÇÃO"

Nova edge function `check-publicacao-notificacoes` agendada via `pg_cron` (1×/dia, 09:00 BRT):

Para cada `publicacao_cobranca_schedule` com `status='ativo'`:
1. Calcula dias desde `data_inicio`.
2. Se `>=15` e `notif_1_at` nulo → envia 1ª via canais default (email + whatsapp do cliente).
3. Se `>=30` e `notif_2_at` nulo → envia 2ª.
4. Se `>=50` e `notif_3_at` nulo → envia 3ª.
5. Atualiza `notif_X_at` na tabela.

A função reusa `send-multichannel-notification` (já existe, suporta email + whatsapp + crm).

Auto-cadastro: ao criar publicação vinculada a cliente (em `handleAutoPopulateFromRPI`), inserir automaticamente uma linha em `publicacao_cobranca_schedule` com `data_inicio = data_publicacao_rpi` e `responsavel_admin_id = admin atual`.

## 5. Pausa automática por resposta do cliente

Adicionar trigger Postgres em `chat_messages` (e/ou `email_inbox`) que, ao receber mensagem do cliente (`sender_role='client'`), atualiza todos os `publicacao_cobranca_schedule` desse `client_id` para `status='pausado_resposta'` + `client_responded_at = now()`. A função cron passa a ignorá-los; admin precisa retomar manualmente.

Se a tabela exata de mensagens recebidas não tiver coluna direta, faremos um trigger leve apenas em `chat_messages` (admin pode marcar manualmente quando vier por outro canal).

## 6. Indicadores no dialog e na lista

Coluna extra opcional "Cobrança" na lista de prazos:
- 🟢 ativo — próx. envio em Xd
- 🟡 pausado — cliente respondeu
- ⚪ não iniciado

## Arquivos afetados

- `src/components/admin/PublicacaoTab.tsx` — banner CTA Prazos.
- `src/components/admin/publicacao/PublicacaoPrazos.tsx` — coluna + botão "Notificar".
- `src/components/admin/publicacao/NotificarClienteDialog.tsx` — novo.
- `src/components/admin/publicacao/cobrancaTemplates.ts` — novo (3 templates).
- `supabase/functions/check-publicacao-notificacoes/index.ts` — novo (cron).
- Migration nova: tabela `publicacao_cobranca_schedule` + grants + RLS + trigger de pausa por resposta + agendamento `pg_cron`.

## Validações finais

- Dialog dispara e-mail + WhatsApp manualmente com templates corretos.
- Cron processa apenas pendentes e respeita `status`.
- Resposta de cliente pausa o cronograma.
- Cronograma é criado automaticamente ao vincular publicação a cliente.
