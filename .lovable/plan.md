## Auditoria — Recurso de Indeferimento, OPOSCAO, EM TODOS OS RECURSOS  (PDF/Impressão)

### Causa-raiz identificada

O componente `src/components/admin/INPIResourcePDFPreview.tsx` mantém **duas pipelines paralelas** que não conversam:

1. **Preview HTML** (`renderContent()`): usa `<div className="text-justify">` no container e `<p className="text-justify" style={{ textIndent: '2cm', textAlignLast: 'left' }}>` em cada parágrafo. Quando uma linha justificada contém tokens longos com hífen/pontuação (ex.: `TRF-2, Apelação 0800858 92.2014.4.02.5101`), o navegador distribui o espaço extra **entre caracteres** (efeito visível nas imagens anexadas — "T R F - 2 ,  A p e l a ç ã o"). Sem `hyphens`, sem `overflow-wrap: break-word` e sem `text-justify: inter-word`, o algoritmo entra em modo degradado.
2. **PDF direto via `jsPDF.text()**`: desenha texto linha a linha independentemente do preview. Não há garantia de que quebra, indentação, fonte e espaçamento sejam iguais. Tabelas markdown são redesenhadas em grade fixa (colunas de largura igual, texto truncado em uma linha), o que estoura conteúdo real (ex.: coluna "Marca Cliente" com "Produtoras, organizadores de..." é cortada).
3. `**handlePrint()**` injeta CSS totalmente diferente do preview (Crimson Pro, `text-indent: 2cm`, `line-height: 1.8`), gerando terceira aparência.

Resultado: preview ≠ PDF ≠ impressão, com letter-spacing anômalo, tabelas cortadas e cabeçalho/rodapé desalinhados.

### Estratégia

Adotar **uma única fonte da verdade** (o DOM do preview) e gerar PDF a partir dele via `html2canvas` por seções (padrão já documentado no `<lovable-stack-overflow>`), preservando idêntica renderização entre tela, impressão e PDF.

### Mudanças

**1. `src/components/admin/INPIResourcePDFPreview.tsx` — CSS de renderização**

- Remover `text-align-last: left` e `text-indent: 2cm` inline dos `<p>`; migrar para uma classe `.legal-body p` no bloco de estilo do documento.
- Aplicar em `.legal-body`:
  ```css
  text-align: justify;
  text-justify: inter-word;    /* impede letter-spacing anômalo */
  hyphens: auto;
  -webkit-hyphens: auto;
  overflow-wrap: break-word;
  word-break: normal;
  line-height: 1.7;
  ```
- Parágrafos: `text-indent: 1.25cm` (só primeira linha, sem `textAlignLast`), `margin-bottom: 0.6em`, `orphans: 3; widows: 3; page-break-inside: avoid`.
- Cabeçalhos (`h2`) e tabelas: `page-break-inside: avoid; break-inside: avoid`.
- Adicionar `<style>` global de `@media print` idêntico ao usado no preview + `@page { size: A4; margin: 20mm 18mm 22mm 20mm }`.

**2. Tabelas markdown**

- Trocar `border-collapse` fixo por `table-layout: auto` com `width: 100%`; células com `word-wrap: break-word`, `padding: 6px 8px`, `vertical-align: top`.
- Larguras percentuais mínimas por coluna (`th:nth-child(1) { width: 22% }` etc.) para evitar coluna espremida com texto longo. `page-break-inside: avoid`.

**3. Pipeline única de PDF (substituir `handleDownloadPDF`)**

- Adicionar `html2canvas` (já disponível na base) e reaproveitar `jspdf`.
- Marcar cada bloco lógico do preview com atributo `data-pdf-section` (letterhead, título, metadados, cada parágrafo/heading, cada tabela, assinatura, cada anexo).
- Loop:
  1. `html2canvas(section, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })`.
  2. Converter altura para mm com base em `contentWidth = 210 − 2·margem`.
  3. Se `heightMM > espaçoRestante`: `pdf.addPage()` e reset `currentY`.
  4. `pdf.addImage(dataUrl, 'PNG', margin, currentY, contentWidth, heightMM)`.
  5. `currentY += heightMM + 2mm`.
- Cabeçalho/rodapé fixos: desenhar em segunda passagem sobre todas as páginas usando `pdf.getNumberOfPages()` + `pdf.setPage(i)` (mantém a barra azul/dourada e paginação `n/N`).
- Nome do arquivo e resource-type labels permanecem os existentes.

**4. `handlePrint()**`

- Passar a imprimir o próprio `printRef.current` no `window.print()` da própria janela (usando `@media print { body > *:not(.print-target) { display:none } .print-target, .print-target * { visibility:visible } }`) em vez de abrir nova aba com CSS diferente. Isso elimina a terceira aparência divergente e garante que impressão = preview.

**5. Limpeza**

- Remover `imageToBase64`, `pdf.setFont/pdf.text` de conteúdo (mantidos apenas para cabeçalho/rodapé fixos).
- Remover `parseMarkdownTable` da pipeline PDF (só é usada no preview via renderContent → HTML).
- Manter `stripOpeningMarkers` / `stripClosingFromContent` (limpeza do texto do agente).

### Detalhes técnicos

- `html2canvas` renderiza cada seção usando o CSS já aplicado — logo o PDF herda automaticamente `hyphens`, `text-justify: inter-word` e evita o letter-spacing anômalo mostrado nas imagens do usuário.
- `scale: 2` mantém legibilidade em impressão A4 sem estourar tamanho do PDF (imagens PNG comprimidas via `toDataURL('image/jpeg', 0.92)` opcional para documentos > 20 páginas).
- Todas as marcações `[IMG:...]`/`[DOC:...]` continuam sendo transformadas em `<figure>` no preview, portanto entram automaticamente no PDF na mesma posição.
- Compatibilidade Chrome/Edge/Safari/Firefox: `html2canvas` + `@media print` cobrem os quatro; `hyphens: auto` é aplicado com prefixos.

### Fora do escopo

- Não alterar prompts da IA nem estrutura de dados (`inpi_resources`, `inpi_resource_evidences`).
- Não mexer nos demais tipos de recurso além do que já compartilham o mesmo componente (mudança beneficia oposição, indeferimento, exigência etc. porque tudo passa pelo mesmo preview).
- Sem migração de banco.

### Validação após implementação

1. Abrir um recurso de Indeferimento longo (>15 páginas), conferir preview.
2. Baixar PDF, abrir e conferir se cada página tem cabeçalho/rodapé, sem letter-spacing anômalo e sem corte de tabela.
3. Testar `Imprimir` (Chrome + Firefox) — deve ficar visualmente idêntico ao preview.