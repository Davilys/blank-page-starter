## Diagnóstico

O PDF ficou lento porque a correção anterior passou a capturar cada parágrafo/seção individualmente com `html2canvas` em `scale: 2`. Em um recurso longo, isso gera dezenas ou centenas de canvases sequenciais, além de converter cada imagem em JPEG antes de montar o PDF. Isso preservou a formatação, mas aumentou muito o tempo de download.

## Plano de correção

1. **Manter a qualidade visual já corrigida**
   - Não voltar para o método antigo `jsPDF.text()`, pois ele causava palavras/letras espaçadas e tabelas cortadas.
   - Preservar o CSS jurídico atual: justificação por palavra, quebras seguras, tabelas responsivas e anexos.

2. **Trocar a geração de PDF para captura por página, não por parágrafo**
   - Renderizar o documento em um contêiner temporário otimizado para A4.
   - Capturar blocos maiores/páginas completas em vez de cada `data-pdf-section` isolado.
   - Isso reduz drasticamente a quantidade de chamadas ao `html2canvas`.

3. **Usar escala inteligente**
   - Reduzir `scale` de `2` para algo entre `1.35` e `1.5`, suficiente para impressão A4 legível, mas muito mais rápido.
   - Usar JPEG comprimido com qualidade controlada para evitar PDF pesado.

4. **Evitar reprocessamento desnecessário de imagens**
   - Remover ou não usar conversões duplicadas de evidências para `dataUrl` quando o PDF já consegue capturar as imagens assinadas pelo DOM.
   - Manter pré-carregamento apenas quando necessário para evitar imagem faltando no PDF.

5. **Melhorar feedback visual**
   - Alterar o botão para mostrar etapas como “Preparando páginas...” e “Montando PDF...”, para o usuário saber que está funcionando.
   - Impedir cliques duplicados enquanto gera.

6. **Validar no navegador**
   - Abrir a aba `/admin/recursos-inpi` e testar a geração com Playwright quando possível.
   - Verificar se o botão deixa de ficar preso em “Gerando PDF...” e se o download inicia.
   - Conferir que o preview, impressão e PDF continuam sem estouro de margem, sem letras espalhadas e sem tabelas cortadas.

## Arquivo principal

- `src/components/admin/INPIResourcePDFPreview.tsx`

## Resultado esperado

O download do PDF deve ficar sensivelmente mais rápido, sem retornar ao erro anterior de espaçamento quebrado, texto fora da margem ou tabelas excedendo a página.