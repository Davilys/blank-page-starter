## Mudança

Na aba **Serviços** do ficheiro do cliente, ao acionar uma exigência do INPI, o texto do **WhatsApp** será trocado por um tom mais conversacional. O **e-mail permanece exatamente igual** (sem nenhuma alteração).

## Arquivo

- `src/components/admin/clients/ServiceActionPanel.tsx` → função `generateWhatsAppTemplate` (linhas 76–91).

## Novo texto do WhatsApp

```
Olá, {nome do cliente}, tudo bem? 

Preciso informar uma atualização importante sobre o processo da marca {Nome da marca}, nº {numero do processo}.

O INPI publicou uma exigência referente ao processo, e o prazo para cumprimento é de 60 dias corridos a partir da publicação na Revista da Propriedade Industrial (RPI).

Preciso URGENTE agendar uma reunião para que eu possa atualizá-lo(a) sobre o processo e orientá-lo(a) quanto às providências necessárias.

Por gentileza, informe o melhor dia e horário para conversarmos.
```

Variáveis preenchidas dinamicamente: `nome` = `client.full_name`, `marca` = `client.brand_name`, `numero do processo` = `client.process_number` (se ausente, omite o trecho "sob o número ...").

## Fora de escopo

- E-mail (`generateEmailTemplate`) — **não tocar**.
- Valor da cobrança / fluxo de fatura — inalterado (o novo texto do WhatsApp não menciona valor, conforme pedido).
- Demais templates (arquivado, distrato) — inalterados.