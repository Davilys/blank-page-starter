# Importação Legado Perfex CRM

Adicionar um sistema completo de importação do dump SQL do Perfex CRM (https://crm.webmarcas.net/u973561543_perfexcrm.sql) ao painel admin, sem alterar nenhuma feature existente. Apenas **adiciona** arquivos novos e faz **dois pequenos acréscimos** em um arquivo existente (`BackupSettings.tsx`).

Restrito ao Master Admin (`davillys@gmail.com`), igual ao que funcionou no outro projeto.

## O que será criado

### 1. Migration (storage + RPC auxiliar)
Cria um bucket privado `perfex-import` com 4 RLS policies (SELECT/INSERT/UPDATE/DELETE) restritas ao email master, e garante a RPC `get_auth_user_id_by_email` (idempotente — já existe no projeto, mas o `CREATE OR REPLACE` é seguro).

### 2. Quatro Edge Functions (deploy automático)
- `parse-perfex-dump` — recebe o ZIP/SQL/SQL.GZ, faz parse tolerante dos `INSERT INTO` das tabelas Perfex (`tblwebmarcas_customers`, `tblcontacts`, `tblclients`, `tblcontracts`, `tblfiles`), mescla por email/CPF/CNPJ e gera 4 arquivos em `perfex-import/generated/`: `customers.ndjson.gz`, `contracts.ndjson.gz` (apenas signed=1), `files.ndjson.gz`, `mapping.json`.
- `import-perfex-customers` — paginado por offset/limit. Dedupe por email→cpf→cnpj. Cria auth user com senha padrão `123Mudar@`, faz upsert em `profiles` com `origin='import_perfex'`, `client_funnel_type='juridico'`, `created_by/assigned_to=master`, insere role `user` em `user_roles` e cria um `brand_processes` inicial em `protocolado`.
- `import-perfex-contracts` — paginado. Resolve cliente por email; idempotência via marcador `[PERFEX_ID:N]` no `description`. Insere em `contracts` com `signature_status` conforme signed, `contract_type='registro_marca'`, `visible_to_client=true`.
- `import-perfex-files` — paginado. Resolve cliente por email, baixa de `https://crm.webmarcas.net/uploads/` em 3 variantes de path, faz upload no bucket `documents` em `imported/perfex/{rel_type}/{rel_id}/{file_name}`, linka `contract_id` via marcador `[PERFEX_ID]`. Idempotente por `file_url`.

Todas as 4 functions:
- Usam `createClient` de `https://esm.sh/@supabase/supabase-js@2`
- `corsHeaders` manual (NÃO importam de `@supabase/supabase-js/cors`)
- Validam Master Admin (`user.email === 'davillys@gmail.com'`)
- As 3 import functions usam `createSignedUrl(60s)` primeiro, com fallback para URL pública
- `parse-perfex-dump` usa `fflate` para zip/gzip

### 3. Componente novo `PerfexImportSection.tsx`
Renderiza somente se `user.email === 'davillys@gmail.com'`. Possui:
- Box de upload com XHR + barra de progresso (aceita `.zip`, `.sql`, `.sql.gz`)
- Dispara `parse-perfex-dump` ao concluir upload e mostra estatísticas
- Três fases sequenciais (Clientes → Contratos → Arquivos) com `Progress`, badges (importados/pulados/erros/notFound/missingClient) e modal com detalhes de erro
- Loop de paginação chamando cada edge function por `fetch` direto com offset/limit incremental

### 4. Integração mínima em `BackupSettings.tsx`
Apenas duas linhas adicionadas:
- `import { PerfexImportSection } from './PerfexImportSection';`
- `<PerfexImportSection />` logo abaixo de `<BackupImportSection />`

Nada mais é alterado. Nenhum cliente, contrato, arquivo ou configuração existente é tocado pela aplicação dessa feature — ela só **adiciona** capacidade de importar.

## Detalhes técnicos relevantes

- `supabase/config.toml` recebe entradas para as 4 funções com `verify_jwt = false` (validação é feita dentro de cada função via `getClaims` + checagem do email).
- Bucket `documents` já existe e é público — perfeito para os arquivos importados.
- `APP_URL` constante nas 3 import functions será setada para `https://id-preview--6c60bdcc-40b1-49c5-b46b-40ac18ae182b.lovable.app` (URL atual do projeto). Após publicar o domínio definitivo, basta atualizar essa constante.
- Não modifico `src/integrations/supabase/client.ts` nem `src/integrations/supabase/types.ts`.
- Schema das tabelas-alvo (`profiles`, `user_roles`, `brand_processes`, `contracts`, `documents`) já existe e suporta os campos usados.

## O que NÃO será alterado

- Nenhuma página, componente, função ou tabela existente.
- Nenhuma rota, layout ou navegação.
- Nenhuma config de outras edge functions.
- Nenhum cliente, contrato ou arquivo já cadastrado é modificado pela importação (são apenas inserções idempotentes — duplicatas são puladas).

## Passo manual após deploy

O painel aparecerá em **Admin → Configurações → aba Backup → "Importação Legado Perfex CRM"** (somente para `davillys@gmail.com`). Fluxo:
1. Upload do dump SQL do Perfex (`.zip`, `.sql` ou `.sql.gz`) — pode também baixar primeiro de `https://crm.webmarcas.net/u973561543_perfexcrm.sql` e subir.
2. Aguardar o parse exibir as estatísticas.
3. Executar as 3 fases na ordem: **1) Clientes → 2) Contratos → 3) Arquivos**.

Senha padrão dos clientes importados: `123Mudar@` (eles podem trocar via "Esqueci minha senha").
