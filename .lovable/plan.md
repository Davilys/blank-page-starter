## Diagnóstico

O erro da imagem acontece porque a otimização anterior passou a cortar o documento em fatias fixas de página inteira. Esse método é rápido, mas corta texto no meio da linha e depois desenha o rodapé por cima do conteúdo, causando exatamente o problema mostrado: linha azul/rodapé atravessando o parágrafo e texto continuando atrás do rodapé.

## Plano de correção

1. **Remover corte cego por altura fixa**
   - Não usar mais fatias que dividem o canvas em qualquer ponto.
   - Isso evita cortar linhas, tabelas, títulos e parágrafos no meio.

2. **Voltar para paginação por blocos, mas otimizada**
   - Usar os blocos `data-pdf-section` como unidade de quebra.
   - Renderizar cada bloco com `html2canvas`, mas com escala menor e compressão controlada para não ficar lento como antes.
   - Antes de inserir um bloco, calcular se ele cabe no espaço útil da página.
   - Se não couber, abrir nova página antes de adicionar o bloco.

3. **Reservar área real para rodapé**
   - A página terá uma área útil menor, terminando antes da linha azul e dados de contato.
   - O rodapé será desenhado somente no espaço reservado, sem sobrepor texto.

4. **Tratar blocos muito grandes**
   - Se uma tabela/imagem/anexo for maior que a área útil da página, reduzir proporcionalmente quando possível.
   - Só fatiar blocos gigantes em último caso, com margem interna, para evitar corte visual agressivo.

5. **Manter velocidade aceitável**
   - Reduzir `scale` para cerca de `1.35`.
   - Manter a remoção de conversão antecipada de evidências para base64.
   - Mostrar progresso no botão: “Renderizando bloco X/Y...” e “Baixando arquivo...”.

6. **Validar**
   - Rodar validação TypeScript.
   - Conferir que o botão de download não fica preso.
   - Confirmar pelo código que o PDF não permite conteúdo abaixo da área útil reservada ao rodapé.

## Arquivo afetado

- `src/components/admin/INPIResourcePDFPreview.tsx`

## Resultado esperado

O PDF deve baixar com velocidade melhor que a versão original lenta, sem rodapé atravessando texto, sem cortes no meio das linhas e mantendo o visual do papel timbrado mostrado no preview.