## Objetivo

Instruir o agente a **NÃO** inserir doutrina (Denis Borges Barbosa, Gama Cerqueira, Tinoco Soares) nem jurisprudência do STJ/TRF em peças de **Exigência de Mérito**, salvo se a exigência tratar expressamente de direito marcário substantivo. Mudança restrita ao tipo `exigencia_merito`.

## Mudança

### `supabase/functions/process-inpi-resource/index.ts`

Nos dois prompts de sistema do tipo exigência de mérito (`buildPass1SystemPrompt` e `buildPass2SystemPrompt`, ramo `isExigenciaMerito`), adicionar à lista de "REGRAS ABSOLUTAS PARA EXIGÊNCIA DE MÉRITO":

- NÃO citar doutrinadores (Denis Borges Barbosa, Gama Cerqueira, Tinoco Soares, Pontes de Miranda, etc.) — exigência de mérito é peça técnica de classificação/especificação, não tese acadêmica.
- NÃO citar jurisprudência do STJ, TRF-2, TRF-3 ou de qualquer tribunal — irrelevante para o cumprimento.
- Fundamentação deve se restringir a: LPI (art. específico aplicável), Manual de Marcas do INPI (capítulo/seção pertinente) e Classificação de Nice.
- Exceção única: se o próprio despacho do(a) examinador(a) discutir tese substantiva de direito marcário, aí sim doutrina/jurisprudência pode aparecer — sempre vinculada ao ponto exigido. RESUMIR O RECURSO DE EXAME DE MERITO NO MAXIMO A 5 PAGINAS 

Também reforçar a mesma regra no texto do `pass1User` e `pass2User` específicos do `exigencia_merito` em `index.ts` (linhas ~1313 e ~1321), em uma frase curta.

Nenhuma outra mudança: indeferimento, oposição, notificações e procuradores continuam com doutrina/jurisprudência completas.