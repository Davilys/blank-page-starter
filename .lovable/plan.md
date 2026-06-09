Diagnóstico encontrado:

- O erro atual não é mais do agente selecionado.
- O console mostra `React error #31` com objeto `{ article, description }`, que significa: a tela está tentando renderizar um objeto diretamente no React.
- A função `process-inpi-resource` finaliza com sucesso (`TWO-PASS GENERATION COMPLETE`), então o backend gera o recurso; o crash acontece depois, ao entrar na etapa de revisão.
- O ponto crítico é `src/pages/admin/RecursosINPI.tsx`, na grade de “Dados Extraídos do Documento”: `extractedData.legal_basis` às vezes vem da IA como objeto, por exemplo `{ article, description }`, e a tela renderiza esse valor diretamente em `<p>{item.value}</p>`.

Plano de correção:

1. Normalizar os dados extraídos no frontend
   - Criar uma função segura para converter qualquer valor da IA em texto.
   - Converter objetos `{ article, description }` para texto legível, como `Art. ... — descrição`.
   - Converter arrays/objetos inesperados sem quebrar a tela.
   - Usar essa normalização antes de `setExtractedData`, antes de salvar no banco e antes de montar o PDF.

2. Proteger o conteúdo do recurso
   - Garantir que `resource_content` sempre seja string antes de ir para `<pre>` e banco.
   - Se vier objeto por falha da IA, transformar em texto em vez de derrubar a página.

3. Corrigir a função Edge `process-inpi-resource`
   - Adicionar sanitização no retorno de `extracted_data`.
   - Forçar `process_number`, `brand_name`, `ncl_class`, `holder`, `examiner_or_opponent` e `legal_basis` a serem strings.
   - Ajustar o prompt de extração para pedir explicitamente que `legal_basis` seja string, nunca objeto.

4. Revisar os pontos de renderização
   - Trocar o render direto de `item.value` por render seguro.
   - Evitar que qualquer campo futuro retornado pela IA cause novamente `Algo deu errado`.

Arquivos a alterar:

- `src/pages/admin/RecursosINPI.tsx`
- `supabase/functions/process-inpi-resource/index.ts`

Resultado esperado:

- O processamento pode chegar a 100% e abrir a revisão sem cair na tela “Algo deu errado”.
- O fundamento legal aparecerá em texto mesmo quando a IA retornar `{ article, description }`.
- A função continuará gerando o recurso, mas com saída mais previsível e segura para a interface.