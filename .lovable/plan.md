Auditoria concluída. Encontrei a causa real do erro: o PDF do distrato está sendo gerado e enviado para o Storage, mas a gravação na tabela `documents` falha por restrição do banco.

Erro confirmado nos logs da Edge Function:

```text
new row for relation "documents" violates check constraint "documents_document_type_check"
```

A restrição atual da tabela `documents` permite tipos como `contrato`, `procuracao`, `anexo`, etc., mas não permite `distrato_multa` nem `distrato_sem_multa`. Por isso:

```text
Assinatura OK
PDF gerado OK
Upload no Storage OK
Registro em documents FALHA
Resultado: não aparece em Anexos do CRM
```

Também confirmei que há distratos assinados recentes sem nenhum registro em `documents`, inclusive o teste recente de `DISTRATO SEM MULTA DO REGISTRO DE MARCA - WEBMARCAS`.

Plano de correção:

1. Corrigir o banco de dados
   - Criar uma migration para atualizar o check constraint `documents_document_type_check`.
   - Incluir explicitamente os tipos:
     - `distrato_multa`
     - `distrato_sem_multa`
   - Manter todos os tipos já existentes para não quebrar documentos atuais.

2. Blindar a Edge Function `upload-signed-contract-pdf`
   - Normalizar o tipo do documento antes de inserir em `documents`.
   - Garantir que contratos criados como `contract` sejam salvos em `documents` como `contrato` quando necessário.
   - Garantir que `distrato_multa` e `distrato_sem_multa` sejam salvos corretamente.
   - Se o insert/update em `documents` falhar, retornar erro real para o frontend em vez de responder `success: true` sem `documentId`. Isso evita falso positivo.

3. Corrigir a UI da Área do Cliente
   - A página `/cliente/documentos` hoje só categoriza contrato e procuração; distratos caem como “Outros”.
   - Ajustar para mostrar distratos com rótulo correto:
     - “Distrato com Multa”
     - “Distrato sem Multa”
   - Isso melhora a visualização para o cliente, mesmo quando o documento vem da tabela `contracts`.

4. Corrigir/compatibilizar Anexos no CRM
   - A aba Anexos do ficheiro do cliente busca `documents` por `user_id`; após corrigir o banco, novos distratos assinados passarão a aparecer automaticamente.
   - Melhorar o nome/rótulo exibido quando o documento for distrato, para ficar claro no ficheiro.

5. Recuperar distratos já assinados e sem anexo
   - Criar/ajustar uma rotina de backfill para registrar em `documents` os PDFs de distratos já enviados ao Storage mas que falharam no insert.
   - Para os casos em que o PDF existe em `storage.objects`, criar o registro correspondente em `documents` com:
     - `contract_id`
     - `user_id`
     - `process_id` quando existir
     - `document_type`
     - `file_url`
     - `mime_type = application/pdf`
     - `file_size`
   - Para casos sem PDF no Storage, deixar a rotina pronta para identificar pendências e permitir regeneração.

6. Teste de validação
   - Testar com distrato com multa e sem multa.
   - Validar que após assinar:
     - o PDF é gerado;
     - o registro aparece em `documents`;
     - aparece na aba Anexos do CRM;
     - aparece na Área do Cliente;
     - o tipo/nome do documento aparece corretamente.

Arquivos/áreas que serão alterados:

```text
supabase/migrations/...sql
supabase/functions/upload-signed-contract-pdf/index.ts
supabase/functions/regenerate-signed-contract-pdfs/index.ts ou nova rotina de backfill
src/pages/cliente/Documentos.tsx
src/components/admin/clients/ClientDetailSheet.tsx
```

Resultado esperado: distrato com multa e sem multa, depois de assinado, ficará salvo como PDF e visível tanto no ficheiro do cliente em Anexos quanto na área do cliente.