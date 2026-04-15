
Diagnóstico

- O erro atual não está no banco nem nas edge functions. Os logs mostram “Sem arquivo para ...”, ou seja, a falha acontece antes do registro no Supabase.
- Comparei este projeto com o outro projeto que “funciona perfeitamente”. O formato do ZIP é diferente:
  - Projeto que funciona exporta `manifest.json` com `zip_filename` e `file_url`
  - Este projeto importa esperando `file_path` e `original_file_url`
- Resultado: ao importar um ZIP vindo do outro projeto, `zip.file(entry.file_path)` não encontra nada, o fallback também não usa o campo certo, e todos os itens falham.
- O mesmo problema existe para contratos:
  - Projeto que funciona usa `attached_pdfs`
  - Este projeto espera `pdf_files`
- Os logs das edge functions não mostram erro relevante, o que confirma que o problema principal é incompatibilidade de formato entre ZIPs.

Plano de correção

1. Unificar compatibilidade em `src/lib/zipExportImport.ts`
- Ajustar a leitura do `manifest.json` de documentos para aceitar ambos os formatos:
  - `file_path` ou `zip_filename`
  - `original_file_url` ou `file_url`
- Normalizar cada item antes do processamento.
- Fazer o import buscar o arquivo no ZIP usando o campo normalizado.
- Se não existir no ZIP, usar fallback pela URL correta do manifest.

2. Corrigir compatibilidade de contratos
- Ajustar `importContractsZip` para aceitar:
  - `pdf_files` ou `attached_pdfs`
  - `template_name`, `contract_type_name` e demais campos do formato do outro projeto
- Normalizar o manifest de contratos antes de criar contratos e subir PDFs.

3. Tornar a exportação deste projeto compatível nos dois sentidos
- Alterar o export para gravar os dois nomes de chave no manifest:
  - documentos: `file_path` e `zip_filename`, `original_file_url` e `file_url`
  - contratos: `pdf_files` e `attached_pdfs`
- Assim, ZIPs exportados aqui funcionarão tanto neste projeto quanto no outro projeto idêntico.

4. Melhorar robustez operacional
- Aplicar importação em lotes de até 50 itens para documentos, seguindo a regra já salva na memória do projeto e reduzindo risco de timeout.
- Melhorar mensagens de erro para distinguir:
  - “arquivo não encontrado no ZIP”
  - “falha no upload”
  - “falha ao registrar no banco”

5. Validar ponta a ponta
- Testar import de um ZIP exportado pelo outro projeto para Documentos
- Testar import de um ZIP exportado pelo outro projeto para Contratos
- Testar export deste projeto e reimport em outro projeto idêntico
- Confirmar que PDFs anexos de contratos também entram corretamente

Arquivos a ajustar

- `src/lib/zipExportImport.ts`
- Possivelmente pequenos ajustes em:
  - `src/pages/admin/Documentos.tsx`
  - `src/pages/admin/Contratos.tsx`
  apenas para melhorar feedback visual e mensagens, não para a lógica principal

Resultado esperado

- O sistema passará a importar ZIPs gerados no outro projeto sem quebrar
- Documentos e contratos voltarão a ser transferíveis entre instâncias idênticas
- Os arquivos reais dentro do ZIP serão reconhecidos corretamente
- A compatibilidade ficará mantida para exportações antigas e novas
