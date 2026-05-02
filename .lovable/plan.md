Auditoria concluída: o erro não está no upload manual do usuário, está na estratégia aplicada aqui.

Causa raiz encontrada
- No projeto atual, eu deixei o fluxo dependente da Edge Function `parse-perfex-dump` para baixar e processar `https://crm.webmarcas.net/u973561543_perfexcrm.sql` dentro do Supabase.
- Esse parse do SQL completo dentro da Edge Function estoura limite de recurso/memória (`WORKER_RESOURCE_LIMIT`). Por isso só foi gerado `generated/customers.ndjson.gz` e `generated/mapping.json` no bucket `perfex-import`; faltam `generated/contracts.ndjson.gz` e `generated/files.ndjson.gz`.
- O banco confirma o estado quebrado/incompleto: há apenas 28 `profiles` com `origin='import_perfex'`, 0 contratos Perfex e 0 documentos Perfex.
- No projeto semelhante `SITE WEBMARCAS` a solução que deu certo não dependia de parse pesado na Edge Function. Ele já tinha os arquivos prontos em `public/perfex-data/`:
  - `customers.ndjson.gz`
  - `contracts.ndjson.gz`
  - `files.ndjson.gz`
  - `mapping.json`
- O projeto atual não possui a pasta `public/perfex-data`, então os importadores não têm os dados finais completos para consumir.

Correção proposta para ficar igual ao SITE WEBMARCAS

1. Copiar os dados estáticos do projeto que funcionou
- Copiar de `SITE WEBMARCAS/public/perfex-data/` para este projeto:
  - `public/perfex-data/customers.ndjson.gz`
  - `public/perfex-data/contracts.ndjson.gz`
  - `public/perfex-data/files.ndjson.gz`
  - `public/perfex-data/mapping.json`
- Isso elimina a necessidade de fazer upload manual e também elimina o gargalo de parse do SQL de 70MB em Edge Function.

2. Ajustar os importadores para usar os arquivos estáticos como fonte principal
- Atualizar:
  - `supabase/functions/import-perfex-customers/index.ts`
  - `supabase/functions/import-perfex-contracts/index.ts`
  - `supabase/functions/import-perfex-files/index.ts`
- Eles passarão a ler primeiro `https://<app>/perfex-data/*.ndjson.gz`, como no projeto SITE WEBMARCAS.
- Manter leitura do bucket `perfex-import/generated/*` apenas como fallback opcional, se existir.
- Remover a dependência obrigatória de `parse-perfex-dump` antes das fases 1/2/3.

3. Corrigir a URL base do app no projeto atual
- O projeto SITE WEBMARCAS usava `APP_URL = 'https://webmarcas1.lovable.app'`.
- Aqui será usado o domínio correto do projeto atual. Como ainda não há domínio publicado/customizado, a fonte estática deve usar um URL robusto do Supabase Storage ou do app publicado/preview configurado, evitando redirect HTML que causa `invalid gzip header`.
- A validação do gzip será mantida: se baixar HTML/redirect em vez de `.gz`, a função retorna erro claro.

4. Simplificar a UI para não exigir upload manual
- Atualizar `src/components/admin/settings/PerfexImportSection.tsx` para deixar claro que os dados do Perfex já estão embutidos em `public/perfex-data`.
- Remover ou rebaixar o botão de upload/parse manual.
- Mostrar status “Dados Perfex prontos” e liberar as fases diretamente:
  1. Importar Clientes
  2. Importar Contratos Assinados
  3. Baixar Arquivos do Servidor Antigo
- Manter visível apenas para Master Admin.

5. Manter idempotência e segurança
- Não criar migrations.
- Não alterar schema.
- Continuar pulando duplicados por email/CPF/CNPJ.
- Continuar usando service role somente dentro das Edge Functions.
- Continuar exigindo JWT e email Master (`davillys@gmail.com`) no código.
- Não sobrescrever clientes/contratos/documentos existentes.

6. Teste antes de liberar importação real
- Após a alteração, fazer deploy das 3 Edge Functions de importação.
- Rodar chamadas de validação/dry-run com lotes pequenos:
  - `import-perfex-customers?offset=0&limit=5&dryRun=true`
  - `import-perfex-contracts?offset=0&limit=5&dryRun=true`
  - `import-perfex-files?offset=0&limit=5&dryRun=true`
- Confirmar que cada função consegue abrir o `.ndjson.gz`, contar registros e retornar amostras sem inserir nada.
- Só depois deixar o painel pronto para execução real.

Arquivos a alterar/copiar
- Copiar do projeto SITE WEBMARCAS:
  - `public/perfex-data/customers.ndjson.gz`
  - `public/perfex-data/contracts.ndjson.gz`
  - `public/perfex-data/files.ndjson.gz`
  - `public/perfex-data/mapping.json`
- Editar neste projeto:
  - `supabase/functions/import-perfex-customers/index.ts`
  - `supabase/functions/import-perfex-contracts/index.ts`
  - `supabase/functions/import-perfex-files/index.ts`
  - `src/components/admin/settings/PerfexImportSection.tsx`
  - Opcional: desativar/remover uso prático de `supabase/functions/parse-perfex-dump/index.ts` na UI para não repetir o erro de limite.

Resultado esperado
- O painel deixará de depender de upload manual ou parse pesado.
- As fases passarão a consumir os mesmos arquivos estáticos que fizeram o outro projeto funcionar.
- O estado “zerado” será resolvido porque `contracts.ndjson.gz` e `files.ndjson.gz` existirão no projeto atual.
- A importação poderá ser executada de forma idempotente, sem duplicar e sem alterar dados existentes.