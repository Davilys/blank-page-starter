## Objetivo

Ao clicar em **Confirmar renegociação** na aba Devedores, disparar automaticamente notificação por **email** e **WhatsApp** ao cliente com a mensagem padrão e o link da **primeira fatura** gerada no Asaas.

## Mensagem padrão

```
Oi {NOME_CLIENTE}! Tudo bem?

Consegui uma condição especial pra você não perder o seu processo de registro de marca 👇

✅ Parcelamos o débito {VALOR_DEBITO} em aberto com mais de {DIAS_VENCIMENTO} dias, consegui fazer em até 5x sem juros no boleto!
📅 Primeira parcela só dia 20, segue fatura: {LINK_PRIMEIRA_FATURA}

Assim você mantém seu contrato ativo e evita qualquer risco de cancelamento 🚨

Nosso objetivo é garantir que sua marca continue protegida e em andamento no INPI.

Me confirma aqui se posso já liberar essa condição pra você? 👍
```

## Mudanças

### 1. `supabase/functions/asaas-debtors-api/index.ts` (action `renegotiate`)

No retorno do bloco RENEGOTIATE incluir dados que o frontend precisa para a notificação:

- `primeira_fatura_url` = `created[0]?.invoiceUrl || created[0]?.bankSlipUrl || null`
- `valor_debito_original` = `totalOriginal`
- `dias_vencimento_max` = maior `(hoje - data_vencimento)` em dias entre as parcelas originais
- `cliente_email`, `cliente_telefone` lidos do profile via CPF/CNPJ ou do registro Asaas (fallback: `GET /customers/{asaas_customer_id}` para email/mobilePhone)
- `cliente_nome`

### 2. `src/pages/admin/Devedores.tsx` (`handleRenegotiate`)

Após sucesso, antes do toast/refresh, chamar duas edge functions em paralelo:

**WhatsApp** (`send-multichannel-notification`):

```ts
supabase.functions.invoke('send-multichannel-notification', {
  body: {
    event_type: 'manual',
    channels: ['whatsapp'],
    recipient: { nome, phone, email },
    custom_message: msgFormatada,  // mensagem padrão preenchida
    data: { link: primeira_fatura_url, marca: 'sua marca' },
  }
});
```

**Email** (`send-email`): envie pelo email [neroplay@webmarcas.net](mailto:noreply@webmarcas.net)

```ts
supabase.functions.invoke('send-email', {
  body: {
    to: [email],
    subject: 'Condição especial para regularizar seu registro de marca',
    html: msgFormatadaHtml,  // mesma mensagem com <br/> e link clicável
  }
});
```

Helpers locais em `Devedores.tsx`:

- `formatRenegMessage({ nome, valor, dias, link })` retorna texto puro (WhatsApp) e versão HTML (email).
- `valor` formatado em BRL, `dias` inteiro.

### 3. Tratamento de falha

- Se notificação falhar, exibir `toast.warning("Renegociação criada, mas falhou enviar notificação")` mantendo o sucesso da renegociação.
- Se faltar email ou telefone, enviar apenas o canal disponível e avisar.

## Fora de escopo

- Sem novas tabelas ou migrations.
- Não altera `send-multichannel-notification` nem `send-email` (já suportam `custom_message` e HTML livre).
- Não toca no histórico/UI das outras abas.