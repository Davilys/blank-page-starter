# Corrigir e-mails aparecendo como código (DKIM/headers) após sincronização

## Problema

Após a última atualização, e-mails sincronizados aparecem com assunto e conteúdo poluídos por trechos de cabeçalhos técnicos (DKIM-Signature: `h=...subject:date:message-id...`, `b=NYKKm2B2+quiZ9Wzsq...`), em vez do assunto e corpo reais.

## Causa raiz

No `supabase/functions/sync-imap-inbox/index.ts`, a função `parseEnvelope(raw)` usa regexes **sem âncora de início de linha** sobre o e-mail bruto inteiro:

```ts
raw.match(/From:\s*.../i)
raw.match(/Subject:\s*(.+?).../is)
raw.match(/Date:\s*(.+?).../i)
raw.match(/Message-ID:\s*<?([^>\r\n]+)>?/i)
```

Como o cabeçalho `DKIM-Signature` contém literais como `h=from:to:cc:subject:date:message-id:references:reply-to` (dobrado em várias linhas com `\r\n\t`) e `b=<base64>`, o primeiro match de `From:` / `Subject:` / `Date:` / `Message-ID:` cai **dentro do DKIM**, e o valor capturado vira lixo (a lista `h=` ou o base64 `b=`).

Resultado: assunto, remetente, data e snippet ficam corrompidos exatamente como mostrado nas imagens.

## Correção

Em `supabase/functions/sync-imap-inbox/index.ts`:

1. Em `parseEnvelope`, isolar primeiro o bloco de headers (`raw.split(/\r?\n\r?\n/)[0]`) e **desdobrar** continuações (`/\r?\n[ \t]+/g` → espaço), antes de aplicar os regexes.
2. Reescrever os regexes com âncora `^` em modo multilinha (`m`), garantindo que só batam em cabeçalhos reais — não em substrings dentro de DKIM-Signature, Authentication-Results, Received, etc.:
   - `^From:\s*...`
   - `^To:\s*...`
   - `^Subject:\s*(.+)$`
   - `^Date:\s*(.+)$`
   - `^Message-ID:\s*<?([^>\s]+)>?`
3. Manter o `decodeMimeWords` no subject/from/to.
4. Reaproveitar o bloco de headers desdobrado para a coleta de `recipients` (já correta, mas evita refazer o split).
5. Após corrigir, redeployar `sync-imap-inbox`.

## Limpeza dos registros já corrompidos

Os e-mails já inseridos com assunto/corpo errado continuam no banco. Opções:

- **Recomendado:** apagar do `email_inbox` os registros cujo `subject` começa com cabeçalhos técnicos (`Date:`, `MIME-Version:`, `subject:date:`, `to:cc:subject:`, `b=`, `bh=`, `From:`) **dos últimos 7 dias**, e em seguida acionar a sincronização normalmente — os mesmos UIDs serão reimportados corretamente porque o `last_uid` no `email_sync_state` precisa também ser revertido para antes do problema.
- Alternativa mais conservadora: apenas marcar como `is_archived = true` e deixar o usuário decidir.

Preciso da sua confirmação para também executar a limpeza + reset do `last_uid` por conta afetada (financeiro@, juridico@, ola@, caroline@), ou apenas corrigir o parser e deixar novas mensagens entrarem corretas.

## Arquivos afetados

- `supabase/functions/sync-imap-inbox/index.ts` (fix em `parseEnvelope`)
- Redeploy de `sync-imap-inbox`
- (Opcional) Migration SQL one-shot para limpeza dos registros corrompidos + reset de `last_uid`
