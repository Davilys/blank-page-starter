## Plano de validação do PDF de Recurso INPI

O código atual do `handleDownloadPDF` em `src/components/admin/INPIResourcePDFPreview.tsx` (linhas 355–462) já contém as correções combinadas:

- Logo/assinatura embutidos em base64 antes do `html2canvas` (linhas 370–386).
- Espera de `decode()`/`onload` de todas as `<img>` do preview (linhas 388–402).
- Captura em largura nativa do preview (210 mm ≈ 794 px), sem `MARGIN_X`/`MARGIN_TOP` (linhas 406–419).
- Fatiamento A4 sem redução, `addImage` em `(0, 0, 210, sliceHeightMM)` (linhas 428–444).
- Rodapé programático removido; rodapé do preview é preservado.
- Restauração dos `src` originais em `finally` (linhas 455–461).

Como estou em plan mode, não posso executar Playwright/build. Proponho validar assim que aprovado:

### Passos de validação (execução após aprovação)

1. **Build check** — rodar typecheck para garantir que nenhuma edição anterior deixou erro.
2. **Playwright headless** contra `http://localhost:8080`:
   - Restaurar sessão Supabase via env vars.
   - Navegar até `/admin/recursos-inpi`, abrir um recurso já aprovado (ex.: "Mega Robô de Led").
   - Screenshot do preview (`preview.png`).
   - Interceptar `jsPDF.save` via `page.evaluate` para capturar o blob do PDF gerado, salvar em `/tmp/browser/recurso/out.pdf`.
   - Converter página 1 do PDF com `pdftoppm -jpeg -r 150` e comparar visualmente com `preview.png`.
3. **Checklist visual** (bug-hunt, não confirmação):
   - Logo WebMarcas visível no PDF.
   - Cabeçalho "RECURSO ADMINISTRATIVO" ocupando a mesma largura relativa do preview.
   - Badges com texto branco sobre azul.
   - Corpo do texto alinhado à esquerda, sem indent, sem justificação.
   - Assinatura renderizada.
   - Rodapé do preview presente (sem overlay duplicado).
   - Proporções 1:1 entre preview e PDF (sem 30% de redução).
4. **Testar tipos adicionais**: Oposição, Exigência de Mérito, Notificação Extrajudicial — mesmo componente, mesmo pipeline.
5. Se algum item falhar, listar defeitos e propor correção pontual (ainda dentro de `handleDownloadPDF`, sem tocar no preview/CSS).

### Fora do escopo

Nenhuma alteração de código nesta etapa — apenas verificação. Qualquer correção necessária será proposta em novo plano.
