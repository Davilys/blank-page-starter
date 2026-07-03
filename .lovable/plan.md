## Diagnóstico

O preview tem largura fixa `210mm` (linha 647 do componente). Já o `handleDownloadPDF` atual (linhas 355–440) coloca o canvas em `CONTENT_W = 210 - 15*2 = 180mm` com `MARGIN_X = 15mm`. Isso comprime o layout inteiro em ~86% da largura da folha — é exatamente a "redução de ~30%" percebida (fontes menores, badge menor, cabeçalho desalinhado, tudo escalado para dentro de 180mm em vez de ocupar a folha inteira).

A logo desaparece porque o `<img src={logoWebmarcas}>` (import Vite → URL blob/hash) às vezes ainda não terminou o `decode()` quando `html2canvas` roda; sem CORS, o html2canvas pinta um placeholder vazio. A assinatura (`signatureImage`) tem o mesmo risco.

## Correção — escopo restrito a `handleDownloadPDF` em `src/components/admin/INPIResourcePDFPreview.tsx`

Nenhuma mudança em preview, CSS, HTML, tipografia, margens, espaçamentos, prompts, banco ou outros componentes. Só o pipeline de exportação.

### 1) Pré-carregar todas as imagens do preview antes do `html2canvas`

Antes de chamar `html2canvas(root, ...)`:

- Selecionar `root.querySelectorAll('img')`.
- Para cada `<img>`: aguardar `img.complete === true && img.naturalWidth > 0`, ou aguardar `img.decode()` (com `try/catch` para navegadores sem suporte, caindo em `onload`/`onerror` Promise).
- `Promise.all` de todas as imagens antes de prosseguir.

Isso remove o risco de "logo/assinatura em branco".

### 2) Embutir logo e assinatura em base64 no momento da exportação

Já existe o utilitário `imageToBase64` (linhas 205–221). Uso dedicado só para o download:

- No início de `handleDownloadPDF`, converter `logoWebmarcas` e `signatureImage` para dataURL usando `imageToBase64`.
- Reescrever temporariamente o `src` desses `<img>` dentro de `root` para o `dataURL` correspondente (guardando o `src` original em variáveis).
- Rodar o `html2canvas`.
- Restaurar os `src` originais no `finally`.

Assim o html2canvas nunca precisa buscar recurso remoto/blob durante a rasterização.

### 3) Renderizar em 210mm cheios (pixel-perfect com o preview)

O preview tem largura de `210mm` (≈ 794px @ 96dpi). O download precisa reproduzir essa largura na folha A4, sem margens laterais adicionais.

Ajustes nas constantes do `handleDownloadPDF`:

- `A4_W = 210`, `A4_H = 297` (inalterado).
- `MARGIN_X = 0` (era 15) — o preview já contém padding interno (`px-16 py-10` na linha 713), então NÃO precisamos de margem adicional da folha; usar 0 preserva o layout 1:1.
- `MARGIN_TOP = 0` e `MARGIN_BOTTOM = 0` para o slicing. O rodapé paginado ("Av. Brigadeiro… | i/total") passa a NÃO existir mais, porque ele quebrava o pixel-perfect. O preview já tem seu próprio rodapé estilizado (linhas 803–812).
- `CONTENT_W = 210`, `CONTENT_H = 297`.

Chamada do `html2canvas`:

```ts
const canvas = await html2canvas(root, {
  scale: 2,
  useCORS: true,
  allowTaint: false,
  backgroundColor: '#ffffff',
  logging: false,
  width: root.offsetWidth,        // = 794px (210mm)
  height: root.scrollHeight,
  windowWidth: root.offsetWidth,  // trava a viewport de captura na largura do preview
  windowHeight: root.scrollHeight,
});
```

Isso garante que 1px do preview vira 1px do canvas (× scale), e a proporção 210mm → 210mm é preservada quando o canvas é adicionado ao PDF.

### 4) Slicing A4 sem redução

O algoritmo de fatiamento existente já é correto — só recalcular usando as novas constantes (folha inteira, sem margem). O `addImage` fica:

```ts
pdf.addImage(sliceDataUrl, 'JPEG', 0, 0, 210, sliceHeightMM);
```

Cada página passa a mostrar 297mm de altura do preview convertida linearmente para a folha A4, sem escala reduzida.

### 5) Remover rodapé programático paginado do PDF

O loop atual (linhas 411–427) sobrescreve cada página com "Av. Brigadeiro… | i / total". Como o preview já tem rodapé próprio (linhas 803–812) e a exigência é reproduzir o preview 1:1, esse loop é removido. A paginação do arquivo continua existindo — apenas não há mais overlay adicionado programaticamente.

### 6) Fallbacks e restauração

- `try/catch/finally`: no `finally`, restaurar os `src` originais dos `<img>` mesmo em caso de erro; manter o `toast` e o `setIsGeneratingPDF(false)` como está.
- Se `imageToBase64` falhar (imagem tainted), continuar com o `src` original — a espera do passo 1 já reduz o risco.

## Fora do escopo

- CSS, HTML, componentes, margens, tipografia, espaçamentos, dimensões — nada disso muda.
- `handlePrint` (window.print) permanece inalterado.
- Prompts, `adjust-inpi-resource`, Supabase, evidências — inalterados.
- Correções anteriores (alinhamento à esquerda, cabeçalho `nowrap`, badges com cor inline) — preservadas.

## Validação

1. Abrir "Mega Robô de Led" em Indeferimento → **Download PDF**.
2. Comparar lado a lado: preview e página 1 do PDF baixado devem ter cabeçalho, badge "RECURSO ADMINISTRATIVO", metadata e primeiro parágrafo idênticos em tamanho, posição e tipografia.
3. Logo WebMarcas visível no PDF.
4. Fontes com o mesmo corpo do preview (não menores).
5. Testar em Oposição, Exigência de Mérito e Notificação Extrajudicial (mesmo componente).