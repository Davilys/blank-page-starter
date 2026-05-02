Vou tratar isso como auditoria antes de mexer/importar. O erro atual não é de cliente/arquivo em si; é uma falha no pipeline de dados gerados.

Diagnóstico já confirmado:
- As funções `import-perfex-customers` e `import-perfex-contracts` estão tentando descompactar `customers.ndjson.gz` / `contracts.ndjson.gz`.
- No Storage do bucket `perfex-import` não existem os arquivos `generated/customers.ndjson.gz`, `generated/contracts.ndjson.gz`, `generated/files.ndjson.gz` nem o SQL enviado; a consulta retornou 0 objetos.
- Como não encontra os arquivos no Storage, as funções caem no fallback `APP_URL/perfex-data/*.ndjson.gz`.
- Esse fallback aponta para o preview Lovable, que retorna redirect/HTML de auth, não gzip. Por isso o erro exato é `TypeError: invalid gzip header`.
- Resultado atual no banco: 0 clientes importados com `origin='import_perfex'`, 0 documentos com `uploaded_by='import_perfex'`, 0 contratos com marcador Perfex.

Plano de correção e teste antes de importar:

1. Tornar o parser independente do upload manual quebrado
- Atualizar `parse-perfex-dump` para aceitar também `sourceUrl`.
- Quando chamado sem `storagePath`, ele vai baixar diretamente de:
  `https://crm.webmarcas.net/u973561543_perfexcrm.sql`
- Manter suporte a upload `.sql`, `.sql.gz` e `.zip`, mas não depender disso para este caso.
- Salvar o SQL baixado no bucket `perfex-import/uploads/latest-perfex.sql` e gerar os arquivos:
  - `generated/customers.ndjson.gz`
  - `generated/contracts.ndjson.gz`
  - `generated/files.ndjson.gz`
  - `generated/mapping.json`

2. Remover o fallback inválido que causa `invalid gzip header`
- Atualizar `import-perfex-customers`, `import-perfex-contracts` e `import-perfex-files` para ler somente do Storage `perfex-import/generated/*`.
- Se o arquivo gerado não existir, retornar erro claro: “Execute o parse do dump antes de importar”, em vez de tentar o preview Lovable.
- Adicionar validação dos primeiros bytes gzip antes de descompactar, para detectar arquivo errado com mensagem compreensível.

3. Auditar o parser com o dump real antes de importar
- Executar/testar `parse-perfex-dump` usando o URL real do SQL.
- Confirmar que ele gera estatísticas coerentes no retorno: clientes, contratos assinados e arquivos.
- Consultar o Storage para confirmar que os 4 arquivos gerados foram criados.
- Testar uma leitura pequena dos NDJSON gerados antes de rodar qualquer importação real.

4. Corrigir importadores para modo de teste/dry-run
- Adicionar parâmetro `dryRun=true` nas 3 funções de importação.
- Em dry-run, elas só leem e validam os registros do lote, resolvem clientes/mapeamentos e retornam contadores, sem inserir no banco nem subir arquivos.
- Usar dry-run com `limit` pequeno para provar que:
  - clientes são lidos corretamente;
  - contratos encontram email/cliente esperado;
  - arquivos têm caminhos e candidatos de download válidos.

5. Melhorar download dos arquivos legados
- Manter os caminhos já usados e acrescentar variações mais próximas do Perfex:
  - `/uploads/clients/{rel_id}/{file_name}`
  - `/uploads/customer/{rel_id}/{file_name}`
  - `/uploads/customer_files/{rel_id}/{file_name}`
  - `/uploads/contracts/{rel_id}/{file_name}`
  - `/uploads/contract/{rel_id}/{file_name}`
  - `/uploads/contract_files/{rel_id}/{file_name}`
  - `/download/file/{attachment_key}` quando houver chave
- Validar status, tamanho e tipo básico para evitar salvar página HTML como arquivo.

6. Atualizar o painel Admin para evitar execução fora de ordem
- Adicionar botão “Baixar e processar dump do CRM antigo” usando o URL oficial.
- Exibir status real dos arquivos gerados e estatísticas do parse.
- Desabilitar as fases 1/2/3 enquanto o parse não estiver concluído.
- Mostrar mensagem clara se os arquivos gerados não existirem.

7. Teste final antes de concluir
- Fazer deploy das 4 Edge Functions atualizadas.
- Rodar teste real do parser com o dump do CRM.
- Rodar dry-run dos 3 importadores.
- Verificar logs das Edge Functions depois dos testes.
- Só depois deixar o importador pronto para execução real no painel.

Arquivos que serão alterados:
- `supabase/functions/parse-perfex-dump/index.ts`
- `supabase/functions/import-perfex-customers/index.ts`
- `supabase/functions/import-perfex-contracts/index.ts`
- `supabase/functions/import-perfex-files/index.ts`
- `src/components/admin/settings/PerfexImportSection.tsx`

Não vou alterar outras áreas do sistema nem mexer em clientes/contratos/documentos fora do fluxo Perfex.