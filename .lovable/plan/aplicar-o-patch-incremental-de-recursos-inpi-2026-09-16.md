# Aplicar o patch incremental de Recursos INPI

## Conferência de conflitos (feita)

Todos os trechos que o patch altera continuam iguais no projeto:

- a checagem antiga de execução interna está nas linhas 1336-1337 e 2170 da função de geração;
- a orientação ainda é exibida como texto bruto em JSON no painel de preparação (linha 421);
- a tela de Recursos INPI ainda mostra barra de progresso simulada durante o processamento (linhas 480 e 2715 em diante);
- os dois arquivos novos do patch não existem no projeto.

Nenhum conflito. Nada do que foi corrigido nas rodadas anteriores é desfeito.

## O que muda

1. **Execução interna do servidor confiável de verdade.** A verificação passa a
  exigir chave de servidor presente e válida junto do cabeçalho interno; um
   pedido com login de usuário comum nunca é tratado como execução interna.
2. **Leitura do caso na etapa automática.** Quando o servidor continua o trabalho
  sozinho, ele consulta o caso e os documentos com a credencial de servidor;
   quando o pedido vem do navegador, continua com as regras de acesso do
   administrador logado. Caso não encontrado e falha de leitura passam a ter
   mensagens distintas, sem perder documentos.
3. **Progresso honesto.** Nas três modalidades novas, a barra simulada some: fica
  só a etapa real. Se a geração falhar, a tela mostra "Geração interrompida"
   sem barra nem etiquetas animadas.
4. **Orientação legível.** Os itens da análise deixam de aparecer como JSON e
  passam a texto ("Cotejo — Comparar conjuntos. · Fontes: DOC:01"). O botão
   mostra "Analisando documentos…" enquanto roda.

## Detalhes técnicos

- Novos: `supabase/functions/_shared/inpiInternalAuth.ts` (`isTrustedInpiStep`),
`src/lib/inpi/orientationDisplay.ts` (`orientationItemText`),
`src/lib/inpi/generationFixes.test.ts` (27 asserções já escritas).
- `process-inpi-resource/index.ts`: usa `isTrustedInpiStep` nos dois pontos;
`caseClient = isInternalStep ? supabaseAdmin : supabase`; erros `case_read_failed`
(500) e `case_not_found` (404).
- `RecursosINPI.tsx`: intervalo de progresso e blocos visuais condicionados a
`!processingError && !UPGRADED_MODALITIES.includes(resourceType)`.
- `CasePreparationPanel.tsx`: `orientationItemText` no `listOf` e rótulo do botão.

## Validação

- Rodar os testes do pacote e a checagem de tipos.
- Publicar no preview apenas `process-inpi-resource` e o frontend.
- Retomar o caso de teste existente (documentos e orientação preservados),
gerar até a revisão e abrir o PDF.
- Se o login de administrador não estiver disponível para mim, isso fica
registrado como pendência — não como aprovado.

Fora do escopo: outros módulos, modelos de IA, integrações e o caso BANDA UAU  
aprovado. Nada é publicado em produção. Execute o plano até a validação final em preview, sem novas rodadas de planejamento. Preserve os documentos e a orientação do caso de teste. Ao concluir, apresente os resultados dos testes e o PDF gerado. Se a geração falhar, informe o erro exato; não declare concluído. Não altere o BANDA UAU aprovado nem publique em produção.