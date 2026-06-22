## Problema

Para recursos do tipo **oposição**, o documento gerado (preview + PDF + impressão) mostra o título genérico **"RECURSO ADMINISTRATIVO"**, o que é tecnicamente impreciso — em oposição apresenta-se uma **manifestação**, não um recurso.

O `RESOURCE_TYPE_LABELS` em `INPIResourcePDFPreview.tsx` já tem `oposicao: 'MANIFESTAÇÃO À OPOSIÇÃO'`, mas o badge e o título não usam esse mapa quando o tipo é oposição — caem no fallback "RECURSO ADMINISTRATIVO".

## Correção

Em `src/components/admin/INPIResourcePDFPreview.tsx`, ajustar 3 pontos para tratar `resourceType === 'oposicao'`:

1. **`documentTitle`** (linha ~307): adicionar ramo `isOposicao ? 'Manifestação à Oposição'`.
2. **Badge do PDF** (linha ~419/425): substituir o fallback `'RECURSO ADMINISTRATIVO'` para usar `documentTitleUpper` (ou ramo explícito `'MANIFESTAÇÃO À OPOSIÇÃO'` quando oposição).
3. **Badge da pré-visualização** (linha ~1027/1028): mesma troca do fallback.

Também ajustar o nome do arquivo PDF para `Manifestacao_Oposicao_<marca>_<data>.pdf` quando for oposição.

Os demais tipos (indeferimento, exigência de mérito, etc.) continuam com **"RECURSO ADMINISTRATIVO"**, que é o termo tecnicamente correto para esses.

## Escopo

Mudança apenas de apresentação/UI em um único arquivo. Não afeta o conteúdo gerado pela IA nem o banco de dados.