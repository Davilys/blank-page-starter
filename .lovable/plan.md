## Diagnóstico

Verifiquei o fluxo `Recursos INPI → Aprovar → Gerar PDF Timbrado` (`INPIResourcePDFPreview.tsx`) e a galeria (`EvidenceGallery.tsx`). No banco os anexos existem, estão com `included=true`, `placement='inline'` e `party='cliente'|'concorrente'`. Mesmo assim as imagens não aparecem no recurso aprovado por três motivos combinados:

1. **Marcadores dentro de tabelas markdown ficam como texto cru.** A imagem `image-209` mostra `[IMG:marca_cliente]` aparecendo literal dentro da tabela comparativa. Em `renderContent()` o parser de `[DOC:NN]` / `[IMG:slug]` só roda para parágrafos — as células da tabela chamam `renderInlineMarkdown(c)`, que não substitui marcadores por figuras nem por rótulos "(Doc. NN)".
2. `**[IMG:slug]` não conta como "citado".** O `citedDocNums` só coleta `[DOC:NN]`. Como o prompt hoje mistura `[IMG:slug]` e `[DOC:NN]`, evidências referenciadas só por `[IMG:...]` acabam duplicando no bloco final (ou ficam órfãs quando o slug não bate com `caption/source_file_name`).
3. **Prompts de geração/ajuste não garantem citação das evidências.** `process-inpi-resource` e `adjust-inpi-resource` não recebem a lista numerada de evidências disponíveis (com número Doc. NN, party e caption), então o modelo raramente insere `[DOC:NN]` — sobra só o fallback "uncited" no fim do documento e nada dentro da argumentação.

## Correções

### 1. `src/components/admin/INPIResourcePDFPreview.tsx`

- Extrair o parser de marcadores para uma função `renderMarkersInline(text)` reutilizável que devolve nós React (spans "(Doc. NN)" + `<figure>` empilhadas).
- Usar essa função nas **células de tabela** (`<td>`) e no cabeçalho: substituir `renderInlineMarkdown(c)` por uma versão que primeiro troca `[DOC:NN]`/`[IMG:slug]` por "(Doc. NN)" inline no texto da célula e, em seguida, insere `<figure>` logo abaixo da tabela (agrupadas por linha) — evitando quebrar o layout da tabela.
- Ampliar `citedDocNums` para também consumir `[IMG:slug]` resolvidos via `findEvidenceBySlug`, para não duplicar a figura no bloco final.
- Rotular o bloco "uncited" separando por party ("Provas do cliente" / "Provas do concorrente") e usando o mesmo estilo `legal-figure` já com `pageBreakInside: avoid`.

### 2. `src/components/admin/inpi/EvidenceGallery.tsx`

- Ao subir novos anexos, definir `placement: 'inline'` por padrão (hoje o backend grava `annex`), refletindo o comportamento "sempre inline" já acordado.

### 3. `supabase/functions/process-inpi-resource/index.ts` e `supabase/functions/adjust-inpi-resource/index.ts`

- Carregar `inpi_resource_evidences` (ordenadas, `included=true`) e injetar no prompt do sistema um bloco:
  ```
  EVIDÊNCIAS DISPONÍVEIS (cite obrigatoriamente com [DOC:NN]):
  Doc. 01 (cliente) — <caption> [arquivo: <source_file_name>]
  Doc. 02 (concorrente) — ...
  ```
- Regra explícita no prompt: "sempre que argumentar sobre logotipo, embalagem, canal de venda, uso real, indício de má-fé, exigência ou similitude visual, cite a evidência correspondente inserindo `[DOC:NN]` no final da frase". Manter `[IMG:slug]` apenas como alias tolerado.
- No `adjust-inpi-resource`, incluir o mesmo bloco para que os "Ajustes com IA" preservem/adicionem citações em vez de apagá-las.

### 4. Validação em preview real (antes de publicar)

- Rodar Playwright em `http://localhost:8080/admin/recursos-inpi`, abrir o recurso `0964fe3f-e1ca-48b4-b4e8-d1cf8fee9f47` (7 evidências cliente já no banco), clicar em "Gerar PDF Timbrado" e capturar screenshots do diálogo de preview.
- Confirmar visualmente: (a) rótulos `(Doc. NN)` no lugar de `[IMG:marca_cliente]` nas tabelas, (b) `<figure>` com a imagem correta abaixo, (c) nenhum bloco duplicado no final, (d) download PDF mantém as figuras (o pipeline de `html2canvas` já pré-carrega `dataUrl`, então nenhuma mudança adicional aqui).
- Repetir a checagem para um recurso com evidências de concorrente (subir 1 via UI se necessário).
- Somente após as duas verificações passarem, sinalizar publicação.

## Fora de escopo

- Layout do PDF, paginação, cabeçalho/rodapé, download DOCX — permanecem intocados.
- Fluxo de checkout, área do cliente, rebrand público. corrija tabem ao fazer daoload do pdf esta dando erro 