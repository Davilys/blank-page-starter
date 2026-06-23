## Objetivo

Na aba **Prazos** → bucket **"Desistiu"**, substituir o botão "Notificar" por **"Enviar Proposta R$ 699"**. Ao clicar, dispara em um único clique:
- **E-mail** com o texto formal completo (Equipe Jurídica WebMarcas, R$ 1.621 → R$ 699 PIX/cartão)
- **WhatsApp** com a mensagem curta da oferta especial

Mensagens diferentes por canal; `[NOME]` substituído pelo nome do cliente.

## Escopo

### 1. Novo template (`src/components/admin/publicacao/cobrancaTemplates.ts`)
Adicionar `PROPOSTA_DESISTIU_TEMPLATE` exportado:
- `subject(marca)` → `"Proposta especial para continuidade do registro — <marca>"`
- `email(nome, marca)` → HTML formatado com o texto formal completo fornecido pelo usuário (parágrafos, bullets PIX/cartão, assinatura Equipe Jurídica WebMarcas, telefone, site)
- `whatsapp(nome)` → texto curto com 🚨 e oferta R$ 699

### 2. Botão exclusivo do bucket Desistiu (`src/components/admin/publicacao/PublicacaoPrazos.tsx`)
- Quando `status_cumprimento === 'desistiu'` (ou bucket ativo = "desistiu"), a célula de ações exibe **"Enviar Proposta R$ 699"** (botão destaque) no lugar do "Notificar" atual.
- Ao clicar, abre um `Dialog` de confirmação com:
  - Dados do cliente (nome, e-mail, WhatsApp) lidos do `profile` vinculado
  - Preview do assunto + corpo do e-mail
  - Preview da mensagem do WhatsApp
  - Botão **"Enviar agora (E-mail + WhatsApp)"** e **Cancelar**
- Handler `enviarPropostaDesistiu(pub)` chama a edge function já existente `send-multichannel-notification` com:
  - `channels: ['email','whatsapp']`
  - `recipient: { nome, email, phone, user_id }`
  - `custom_subject`, `custom_html`, `custom_message`
  - `event_type: 'desistiu_proposta_699'`
- Toast de sucesso/erro. Após envio, registra `last_notif_at` + `last_notif_bucket = 'desistiu_proposta'` em `publicacao_cobranca_schedule` (se existir registro para a publicação) apenas como histórico — sem alterar cronograma 15/30/50.

### 3. Comportamento
- Demais buckets (No Prazo / 30 Dias / Última Semana / Vencidos / Cumpridos) seguem com o botão **Notificar** original — nada muda.
- Apenas em **Desistiu** a ação vira a Proposta R$ 699.

## Detalhes técnicos

**Arquivos afetados:**
- `src/components/admin/publicacao/cobrancaTemplates.ts` — adicionar template.
- `src/components/admin/publicacao/PublicacaoPrazos.tsx` — render condicional + dialog + handler.

**Sem mudanças de schema. Sem nova edge function** — reutiliza `send-multichannel-notification`.

**Substituições:**
- `[NOME]` → `profile.full_name || 'Cliente'`
- marca → `pub.brand_name_rpi`

## Fora de escopo
- Não altera fluxo dos 3 lembretes (15/30/50) nem auto-assignment de responsável.
- Não cria automação/cron — disparo é manual por clique do admin.