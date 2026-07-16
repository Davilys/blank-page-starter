## Objetivo

Fazer com que **todas as evidências anexadas (Cliente e Concorrente) apareçam embutidas dentro do corpo do recurso**, no ponto onde a IA as cita, e **remover a seção duplicada de anexos no final**. A numeração `Doc. NN` continua existindo (para referência jurídica no texto), mas a imagem só é renderizada uma única vez, inline.

## Escopo das mudanças

### 1. `supabase/functions/process-inpi-resource/index.ts`
- Reforçar o prompt do Pass 2 (redação) para tornar **obrigatória** a citação de **cada** evidência via `[DOC:NN]` em um parágrafo adequado da fundamentação:
  - Evidências `[CLIENTE]` → citadas nos tópicos de comprovação de uso/notoriedade/anterioridade da requerente.
  - Evidências `[CONCORRENTE]` → citadas nos tópicos de colidência/má-fé/prints do infrator.
- Adicionar validação pós-geração: se algum `[DOC:NN]` esperado não aparecer no texto, injetar automaticamente uma linha `Conforme se verifica em [DOC:NN] — <legenda>.` no bloco temático mais próximo, garantindo 100% inline.

### 2. `supabase/functions/adjust-inpi-resource/index.ts`
- Mesma regra: prompt de ajuste preserva todos os `[DOC:NN]` existentes e não permite removê-los, para não "quebrar" imagens inline após um ajuste.

### 3. `src/components/admin/INPIResourcePDFPreview.tsx`
- **Remover a renderização da seção final de anexos numerados** (bloco "ANEXOS — Doc. 01, Doc. 02…").
- Manter apenas o render inline no ponto do marcador `[DOC:NN]` com legenda curta abaixo da imagem (`Doc. NN — <caption>`).
- Se uma evidência marcada como `included` não tiver marcador correspondente no texto (fallback de segurança), anexá-la ao final do último parágrafo temático como figura inline — nunca criar página de anexos separada.
- Ajustar paginação para tratar figuras como blocos indivisíveis (não cortar imagem no meio da página — já existe boundary-snap, apenas incluir `.legal-figure` no seletor).

### 4. `src/pages/admin/RecursosINPI.tsx`
- Nenhuma mudança de UI obrigatória. O botão "Regenerar com evidências" continua igual.
- Remover badge/contador "X no anexo" se existir, já que a noção de anexo desaparece.

### 5. Banco de dados
- Sem migração. O campo `placement` (`inline`/`annex`) fica no schema mas passa a ser ignorado pela renderização — todas as evidências viram inline. Preservado para retrocompatibilidade caso queira reverter.

## Detalhes técnicos

- **Ordem de citação**: Cliente antes de Concorrente dentro de cada tópico jurídico, respeitando a numeração `display_order` já existente.
- **Legenda inline**: fonte 10pt, itálico, centralizada abaixo da imagem, formato `Doc. NN — <caption OCR>`.
- **Largura da imagem inline**: máx. 70% da coluna de texto, altura auto, `object-fit: contain`.
- **Fallback IA falha**: se a IA gerar texto sem nenhum `[DOC:NN]`, o pós-processamento no backend injeta um parágrafo final "Documentos comprobatórios anexos: [DOC:01] [DOC:02]…" para garantir que as imagens apareçam.
- **PDF**: sem mudança no motor (`html2canvas`+`jsPDF`), apenas o DOM muda. As correções anteriores (hífen, alinhamento, badges brancos, quebra em fronteiras seguras) são preservadas.
- **Retrocompatibilidade de recursos antigos**: se um recurso já gerado tiver `<seção de anexos>` no HTML salvo, o preview detecta e não renderiza duplicado.

## Fora de escopo

- Não altero o fluxo de upload nem a galeria de evidências (abas Cliente/Concorrente permanecem).
- Não mudo o modelo de IA nem a estrutura de 2-pass.
- Não removo a coluna `placement` do banco.
- Não altero PDF de procurador/notificação extrajudicial.

## Validação após implementar

1. Gerar recurso novo com 2 evidências Cliente + 2 Concorrente.
2. Confirmar no preview: 4 imagens inline, zero seção "ANEXOS" no final.
3. Baixar PDF e conferir mesma paginação.
4. Rodar "Ajustar com IA" e confirmar que os `[DOC:NN]` sobrevivem.
