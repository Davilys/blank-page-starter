## Objetivo

Permitir que o usuário **edite o texto do recurso** dentro do modal "Recurso Administrativo — Papel Timbrado" antes de clicar em **Download PDF** ou **Imprimir**, para corrigir qualquer detalhe (erros de digitação, ajustar argumento, mudar nome, etc.) sem precisar voltar à etapa de Revisão.

## Comportamento

No modal de preview do PDF (o que aparece após "Gerar PDF Timbrado"):

1. Aparece um novo botão **"Editar texto"** ao lado de **Imprimir** / **Download PDF**.
2. Ao clicar, a pré-visualização do documento é substituída por um editor (`<Textarea>` grande, fonte monoespaçada/serif, altura ~70vh) com **todo o conteúdo do recurso** carregado — mesmo conteúdo que hoje vai para o PDF.
3. Aparecem dois novos botões no modo edição:
   - **"Salvar alterações"** — aplica o texto editado, fecha o editor, volta para a pré-visualização já atualizada, e persiste em `inpi_resources.final_content` (para que ao reabrir o recurso o texto editado seja mantido).
   - **"Cancelar"** — descarta as edições e volta para a pré-visualização original.
4. Após salvar, **Imprimir** e **Download PDF** usam o texto editado (inclusive os marcadores `[DOC:NN]` continuam funcionando — imagens/legendas são reaplicadas no PDF como já é hoje).
5. O cabeçalho timbrado (logo Webmarcas, CNPJ, "RECURSO ADMINISTRATIVO", Marca, Processo nº, dados do procurador) **permanece fixo** — só o corpo do recurso é editável, evitando que o usuário quebre acidentalmente o timbrado.
6. Toast de sucesso ("Texto do recurso atualizado") ao salvar; erro tratado com toast caso a persistência falhe.

## O que muda no código

### `src/components/admin/INPIResourcePDFPreview.tsx`
- Adicionar estado interno `editableContent` (inicializado com `content` da prop) e `isEditing` (boolean).
- Adicionar botão **"Editar texto"** na barra superior (mesma linha de Imprimir/Download).
- Renderização condicional:
  - `isEditing === false` → mantém a pré-visualização atual (que já usa `cleanedContent`/`bodyContent` derivado de `content`). Trocar essa derivação para usar `editableContent` em vez da prop bruta.
  - `isEditing === true` → mostrar `<Textarea>` em tela cheia com o conteúdo, mais botões **Salvar alterações** e **Cancelar**.
- No salvar:
  - Atualizar `editableContent`.
  - Persistir em Supabase: `update inpi_resources set final_content = editableContent where id = resource.id`.
  - `toast.success(...)`.
- `handlePrint` e `generatePDF` usam `editableContent` (em vez da prop `content`).

### `src/pages/admin/RecursosINPI.tsx`
- Nenhuma mudança obrigatória (o modal já passa `content`). Opcional: ao fechar o modal, recarregar a lista para mostrar o texto atualizado — mas como `final_content` já é persistido, o próximo open vai mostrar o novo texto naturalmente.

## Fora do escopo

- Editor rico (negrito/itálico/imagens) — fica como `<Textarea>` simples, suficiente para correções textuais. Os marcadores `[DOC:NN]` continuam funcionando exatamente como hoje.
- Editar o cabeçalho timbrado (marca, processo, procurador) — esses dados vêm de `extractedData` e seguem o fluxo de extração; o usuário pode corrigi-los na etapa anterior, não no modal de PDF.
- Histórico de versões do texto editado — apenas a última versão é mantida em `final_content`.
