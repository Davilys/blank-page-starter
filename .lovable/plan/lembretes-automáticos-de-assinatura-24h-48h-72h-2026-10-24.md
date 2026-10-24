# Lembretes automáticos de assinatura (24h / 48h / 72h)

## Como vai funcionar

- Vale para **todos os tipos de documento**: contrato padrão, premium, corporativo, procuração, distratos.
- O relógio começa quando o link de assinatura é gerado. O link passa a valer **3 dias** (hoje são 7).
- Se o cliente assinar, os lembretes param na hora.
- Envio por **e-mail** (texto um pouco mais completo) e **WhatsApp** (curto, direto), pelo mesmo BotConversa do envio de assinatura.
- Só sai entre **8h e 20h** (horário de São Paulo). Se cair fora, sai às 8h do dia seguinte.
- Quando o link vence sem assinatura, o contrato fica **marcado como expirado**. Nenhuma cobrança é cancelada; a equipe decide depois.
- Contratos antigos já pendentes não recebem lembretes retroativos (só os gerados a partir de agora).

## Mensagens de WhatsApp (curtas)

**1º — 24h (gatilho: compromisso + reciprocidade)**
```text
Olá, {nome}! 😊
Seu {documento} da marca *{marca}* já está pronto e falta só sua assinatura para darmos andamento.
✍️ Leva menos de 1 minuto: {link}
Equipe WebMarcas
```

**2º — 48h (gatilho: escassez + risco de perder a marca)**
```text
{nome}, sua marca *{marca}* ainda não está protegida. ⚠️
Enquanto o contrato não é assinado, outra pessoa pode pedir o mesmo nome no INPI antes de você.
✍️ Assine agora: {link}
Equipe WebMarcas
```

**3º — 72h, último dia (gatilho: urgência + perda)**
```text
⏰ {nome}, último aviso: o link do seu {documento} *vence hoje*.
Se não for assinado hoje, o contrato será cancelado e as condições/valor de {valor} serão encerrados.
✍️ Assine agora: {link}
Equipe WebMarcas
```
(Na procuração, que não tem valor, a frase do valor sai.)

## E-mails (um pouco mais longos)

Mesmos três gatilhos, com assunto próprio:
1. "Seu {documento} está pronto — falta só sua assinatura"
2. "{marca}: sua marca ainda não está protegida"
3. "Último dia: seu contrato vence hoje"

Cada e-mail tem 3–4 parágrafos curtos, botão "Assinar agora", o que acontece depois da assinatura, e no 3º o aviso de cancelamento e encerramento das condições. Visual azul WebMarcas, assinatura com site e WhatsApp (11) 91112-0225.

## Detalhes técnicos

- Nova tabela `signature_followups` (contract_id, step 1–3, scheduled_at, sent_at, status, results por canal) com unicidade (contract_id, step) para nunca duplicar; GRANT + RLS admin.
- `generate-signature-link`: padrão de validade 3 dias e, ao gerar/regerar o link, (re)agenda os 3 passos em +24h/+48h/+72h−margem (o 3º no dia do vencimento, ajustado para 8h–20h BRT); regerar cancela os pendentes antigos.
- Nova Edge Function `signature-followups`: pega passos vencidos, confere se o contrato continua pendente e com link válido, envia e-mail (`send-email`) e WhatsApp (`send-multichannel-notification` com o webhook de assinatura), grava resultado; também marca como `expired` contratos com link vencido e não assinados (sem tocar em faturas/Asaas).
- Cron a cada 15 min (96 execuções/dia; atraso máximo de 15 min) chamando a função — consulta leve quando não há nada pendente.
- Templates de texto num módulo com testes (`src/lib/signatureFollowups.test.ts`): 3 passos distintos, frase de valor ausente em procuração, horário 8h–20h.
