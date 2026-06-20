## Objetivo

Tornar o gerador de recursos da aba **Recursos INPI** muito mais elaborado nos três tipos pedidos — **Indeferimento, Exigência de Mérito e Oposição** — extraindo **imagens, prints e fotos** dos PDFs anexados, deixando você **escolher e ordenar** essas evidências numa galeria, e gerando um PDF de defesa com as imagens **embutidas no corpo do argumento** + **anexo numerado de documentos** (Doc. 01, Doc. 02…) no estilo de escritórios grandes.

## Fluxo final que você vai usar

1. Abre o recurso (indeferimento / exigência / oposição), clica **Anexar PDFs**.
2. Sistema processa cada anexo:
   - Extrai **texto** (já faz hoje).
   - Extrai **cada página como imagem** (PNG 200dpi).
   - Extrai **imagens embutidas** (logos, rótulos, fotos).
   - Roda **OCR** via Gemini multimodal em prints/escaneados sem texto.
3. Abre **"Galeria de Evidências"** — grid com todas as imagens extraídas:
   - Marcar/desmarcar quais entram.
   - Reordenar (drag-and-drop).
   - Editar legenda ("Print do site do concorrente em 12/2024").
   - Escolher **posição**: *Inline* (no meio do argumento) ou *Só no anexo final*.
4. Clica **Gerar Recurso com IA**:
   - IA recebe texto + lista de imagens com legenda/OCR.
   - Insere marcadores `[DOC: 03]` nos parágrafos certos (uso anterior, distintividade, convivência, comparação visual).
5. PDF final tem: capa → argumentação com **prints inline numerados** → **anexo de documentos** (1 doc por página, tamanho cheio) → assinatura.

## Mudanças técnicas

### Banco
- Nova tabela `inpi_resource_evidences`:
  - `id`, `resource_id` (FK `inpi_resources`), `storage_path`, `page_number`, `source_file_name`, `mime_type`, `caption`, `ocr_text`, `placement` ('inline' | 'annex'), `display_order`, `included` (bool), `created_at`.
  - RLS: admin/staff via `has_role`. GRANTs para `authenticated` + `service_role`.
- Bucket privado `inpi-resource-evidence` (Storage) com policies por role admin.

### Edge Functions
- **Nova: `extract-resource-evidences`** — recebe `resource_id` + lista de PDFs do storage. Para cada PDF:
  - `pdfjs-dist` (já usado no projeto) → renderiza páginas em PNG via canvas Deno.
  - Detecta páginas com imagem dominante / pouco texto → marca como "print".
  - Para escaneados, manda a página pro Gemini 2.5 (multimodal) com prompt de OCR + descrição.
  - Salva imagens no bucket, insere linhas em `inpi_resource_evidences`.
- **Atualizar: `process-inpi-resource`** (geração final) — passa a receber também `evidences[]` selecionadas. Prompt de sistema reforçado: "Quando argumentar Y, cite Doc. N referente à evidência Z". IA retorna texto com marcadores `[DOC:n]`.
- **Atualizar: `adjust-inpi-resource`** — mesmo: preserva marcadores `[DOC:n]` ao reescrever.

### Frontend
- **Novo: `src/components/admin/inpi/EvidenceGallery.tsx`** — grid com checkbox, drag-and-drop (`dnd-kit` já no projeto), edição de legenda, toggle placement.
- **Atualizar: `RecursosINPI.tsx`** + dialog de criação:
  - Após upload dos PDFs, chamar `extract-resource-evidences`.
  - Mostrar galeria antes do botão "Gerar".
  - Passar seleção pro `process-inpi-resource`.
- **Atualizar: `INPIResourcePDFPreview.tsx`** — trocar render texto-only por `@react-pdf/renderer` com componente que:
  - Parseia `[DOC:n]` → insere `<Image>` inline com caption "Doc. n — …".
  - Ao final, renderiza seção "ANEXOS DOCUMENTAIS" com 1 doc por página em tamanho cheio.
  - Mantém cabeçalho/rodapé/assinatura atuais.

## Modelos de IA (Lovable AI Gateway)
- OCR de prints/escaneados → `google/gemini-2.5-flash` (multimodal, barato).
- Geração de recurso → mantém modelo atual (`gpt-4o` via OPENAI_API_KEY ou migra pro gateway — sua escolha; sem mudança de chave necessária se mantiver).

## Limites honestos
- IA não inventa prints que você não anexar — ela organiza/legenda/cita o que veio nos PDFs.
- PDFs escaneados muito ruins podem ter OCR imperfeito (a legenda fica editável pra você corrigir antes de gerar).
- Cada extração de PDF grande (>50 páginas) leva 30-60s; mostro progresso.

## Fora do escopo
- Comparativo automático com banco do INPI (busca de marca anterior, fonética etc.) — feature separada, podemos planejar depois.
- Vídeos / áudio como evidência.
- Os outros tipos (notificação extrajudicial, procurador) — ficam como estão.

Confirma pra eu aplicar?