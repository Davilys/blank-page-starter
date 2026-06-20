## Resposta direta: SIM, é possível

Hoje o sistema já consegue:
- Extrair imagens embutidas dos PDFs anexados (via `extract-resource-evidences`).
- Citar essas imagens no corpo do recurso usando marcadores `[DOC:01]`, `[DOC:02]`… e renderizá-las no PDF final, tanto inline quanto na seção "ANEXOS DOCUMENTAIS".

O que **falta** para ficar como o seu exemplo (consulta INPI com logo da marca + dados do processo dentro da peça) é tratar **dois tipos especiais** de imagem com destaque visual no topo do recurso, antes mesmo de o usuário escolher:

1. **Logo da marca mista** (figura extraída do PDF de consulta INPI ou enviada como JPG/PNG).
2. **Print da consulta INPI** (página inteira da base de dados do INPI, mostrando situação, classe NCL, titular, despachos).

Esses dois devem aparecer automaticamente em um **bloco "IDENTIFICAÇÃO VISUAL DO PROCESSO"** logo após o cabeçalho timbrado e antes da seção I — exatamente como na imagem que você anexou.

## Plano

### 1. Detecção automática no upload (etapa "Documento")
No `extract-resource-evidences/index.ts`, ao processar cada PDF/imagem, classificar a evidência em uma nova coluna `kind`:
- `brand_logo` — imagem pequena, proporção próxima de quadrado/retangular curto, OCR vazio ou só com o nome da marca. Heurística: primeira imagem JPEG embutida com largura < 600px e OCR curto (<40 chars).
- `inpi_consulta` — página com OCR contendo "Consulta à Base de Dados do INPI" + "Nº do Processo" + "Situação".
- `evidence` (default) — todo o resto (prints de concorrente, fotos de produto, decisões).

A IA de OCR (Gemini multimodal) já recebe a imagem — basta acrescentar no prompt: "Responda também `kind`: brand_logo | inpi_consulta | evidence". Salvar em nova coluna `inpi_resource_evidences.kind`.

### 2. Renderização de cabeçalho visual no PDF
Em `INPIResourcePDFPreview.tsx`, logo após o bloco timbrado fixo (Webmarcas / "RECURSO ADMINISTRATIVO" / dados do processo), inserir:

```text
┌─────────────────────────────────────────────┐
│  [LOGO DA MARCA]      Nº Processo: 942829000│
│      80x80px          Marca: Elbratec…      │
│                       Classe NCL: 09        │
│                       Situação: Aguardando…│
└─────────────────────────────────────────────┘

[PRINT DA CONSULTA INPI — página inteira, largura total]
Fig. 1 — Consulta à base de dados do INPI em <data>
```

- Renderiza apenas se existirem evidências com `kind = brand_logo` e/ou `kind = inpi_consulta`.
- Logo: aspect-ratio preservado, máx 100px altura.
- Print consulta INPI: largura total da página A4 com legenda numerada.
- Funciona tanto na preview HTML quanto no `jsPDF` (mesmo caminho de `addImage` que já usamos para `[DOC:NN]`).

### 3. Citação automática no texto gerado
Em `adjust-inpi-resource` e em `process-inpi-resource` (geração inicial), quando existir uma evidência `kind = inpi_consulta`, instruir a IA a citá-la na seção "I — DOS FATOS" com frase do tipo:
> "Conforme se verifica da consulta à base de dados do INPI ([DOC:01]), o pedido nº 942829000 encontra-se na situação 'Aguardando manifestação sobre oposição'…"

Logo (`brand_logo`) não recebe marcador `[DOC:N]` — vai apenas no cabeçalho visual, sem citação textual.

### 4. UI — Galeria de Evidências (`EvidenceGallery.tsx`)
Mostrar etiqueta visual por `kind`:
- 🏷️ "Logo da marca" (azul)
- 📄 "Consulta INPI" (verde)
- 📎 "Evidência" (cinza)

Usuário pode reclassificar manualmente via dropdown se a heurística errar.

### 5. Migração SQL
```sql
ALTER TABLE public.inpi_resource_evidences
  ADD COLUMN kind text NOT NULL DEFAULT 'evidence'
  CHECK (kind IN ('brand_logo','inpi_consulta','evidence'));
```

## Arquivos afetados
- `supabase/functions/extract-resource-evidences/index.ts` — classificação `kind` no OCR.
- `supabase/functions/process-inpi-resource/index.ts` — instruir IA a citar consulta INPI.
- `supabase/functions/adjust-inpi-resource/index.ts` — idem ao regenerar.
- `src/components/admin/INPIResourcePDFPreview.tsx` — bloco "Identificação visual do processo" (HTML + jsPDF).
- `src/components/admin/inpi/EvidenceGallery.tsx` — chip de `kind` + reclassificação manual.
- Nova migration para coluna `kind`.

## Fora de escopo
- Geração de logos sintéticos (se o cliente não enviar, nada é renderizado — sem placeholder).
- Edição visual livre do header (continua sendo o timbrado fixo Webmarcas + o novo bloco visual).
- Reposicionar imagens com drag-and-drop dentro do corpo do texto (continua via marcador `[DOC:NN]`).

Posso seguir com a implementação?
