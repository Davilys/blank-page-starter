## Causa do travamento

No commit anterior a geração do PDF foi convertida para modo "seção por seção": o código percorre cada elemento com `data-pdf-section` e chama `html2canvas` uma vez para cada. Como praticamente todo parágrafo, item de lista, cabeçalho, tabela e bloco de anexo do preview recebe o atributo `data-pdf-section` (linhas 477, 487, 498, 534, 566, 598, 733, 740, 762, 768, 802, 829, 842, 851), um recurso típico gera **80–200+ chamadas** de `html2canvas` sequenciais. Cada chamada força reflow + rasterização em `scale: 2`. Resultado: parece travar em "Gerando PDF…" ou demora minutos.

O CSS de bullets/`overflow-wrap` da correção anterior está correto e não é a causa — o problema é exclusivamente o loop de rasterização.

## Correção

Escopo: apenas `src/components/admin/INPIResourcePDFPreview.tsx`, função `handleDownloadPDF`. Sem tocar em CSS, prompts, banco ou outros componentes.

Voltar ao pipeline single-shot que funcionava antes, mantendo margens e rodapé paginado:

1. Chamar `html2canvas` **uma única vez** sobre `printRef.current` (com `scale: 2`, `useCORS`, `backgroundColor: '#fff'`, `windowWidth: printRef.scrollWidth`).
2. Calcular altura total em mm proporcional à largura útil (`A4 - 2*margem`).
3. Fatiar o canvas único em páginas A4 por `drawImage` para um canvas temporário do tamanho da página, adicionando `pdf.addPage()` conforme necessário — mesmo algoritmo de slicing atual, mas rodando sobre 1 canvas em vez de N.
4. Manter o rodapé com "Av. Brigadeiro…" e paginação `i / total` no laço final já existente.
5. Remover o loop `for (const section of sections)` e o uso de `[data-pdf-section]` no download. O atributo pode ficar no JSX (inofensivo) — não vou removê-lo para não expandir o diff.

Isso restaura o tempo de geração para poucos segundos e produz visualmente o mesmo PDF (o slicing global respeita as margens; quebras de página no meio de parágrafo eram aceitáveis na versão anterior que a usuária pediu para restaurar).

## Validação

- Abrir um recurso de Indeferimento com muitos parágrafos (ex.: "Mega Robô de Led") e clicar em **Baixar PDF**: deve concluir em <10 s e salvar o arquivo.
- Conferir que o preview continua com os bullets alinhados (correção anterior preservada).
- Testar também Oposição e Exigência de Mérito (mesmo componente).

## Fora do escopo

- Não altero `handlePrint`, prompts, `adjust-inpi-resource`, banco, ou os markers `[IMG:]`.
- Não removo o atributo `data-pdf-section` do JSX para manter o diff mínimo.