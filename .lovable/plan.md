# Corrigir exportação do PDF (logo + texto do badge) sem tocar no preview

## Diagnóstico
- O texto "RECURSO ADMINISTRATIVO" já é um nó de texto real no DOM — o problema está na captura do html2canvas (clone interno pode perder fonte/letter-spacing e posição do scroll).
- A logo é convertida para base64, mas a troca acontece no DOM real; o clone que o html2canvas usa pode ser capturado antes da imagem decodificar dentro do clone.
- A largura de captura usa `root.offsetWidth`, que pode divergir de 794px (210mm) se o container estiver escalado/limitado no diálogo, mudando a quebra de linhas em relação ao preview.

## Alterações (apenas em `handleDownloadPDF` de `src/components/admin/INPIResourcePDFPreview.tsx`)
1. **Callback `onclone` do html2canvas**:
   - Reaplicar as imagens em base64 diretamente nos `<img>` do clone (logo e assinatura), garantindo que o clone já contenha data URLs.
   - Normalizar o badge no clone: garantir `color:#ffffff`, `background:#1e3a5f`, remover `letter-spacing` problemático e forçar o texto como nó direto (estilos inline explícitos) para eliminar qualquer falha de renderização do texto branco.
2. **Corrigir deslocamento de scroll**: adicionar `scrollX: 0` e `scrollY: -window.scrollY` na configuração do html2canvas (bug clássico que desloca/oculta conteúdo quando a página está rolada).
3. **Largura fixa de captura**: capturar sempre a 794px (largura nativa A4 do preview) em vez de `root.offsetWidth`, garantindo quebras de linha idênticas ao preview.
4. Manter todo o restante intacto: fatiamento A4, qualidade JPEG, restauração dos `src` no `finally`, e nenhum estilo/cor/fonte do preview será alterado.

## Validação
- Typecheck/build.
- Não é possível teste E2E autenticado (Supabase externo), então após implementar peço que baixe o PDF de um recurso aprovado e compare lado a lado com o preview.
