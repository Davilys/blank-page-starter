# Corrigir a falha na etapa "IA Processando" (Recursos INPI)

## O que os registros mostram

Três falhas distintas, todas confirmadas nos registros da função de geração:

1. **01:14 — texto cortado.** A parte 1 da peça terminou como "resposta incompleta (motivo: max_output_tokens)". O modelo usa raciocínio em nível alto, e esse raciocínio consome o mesmo orçamento de texto; com a peça exigindo no mínimo 3.400 palavras, o orçamento acabava antes do fim.
2. **01:14 — conexão encerrada.** A geração levou 149,5 segundos e o ambiente encerra a requisição aos 150 segundos sem resposta ("connection closed before message completed").
3. **01:19 — envio do arquivo interrompido.** A função nem chegou a chamar a IA: falhou ao ler o corpo da requisição ("end of file before message length reached"). Os PDFs são convertidos em texto base64 e enviados dentro da mensagem, o que infla o envio em ~33% e quebra em conexões instáveis (celular).

As correções da rodada anterior (resposta em fluxo contínuo e limite de texto maior) foram publicadas em preview mas ainda não passaram por uma execução completa bem-sucedida — a tentativa seguinte morreu no envio do arquivo (item 3).

## O que será feito

**1. Acabar com o corte do texto**
- Reduzir o esforço de raciocínio da geração de "alto" para "médio" nas três modalidades, mantendo o modelo dedicado atual (sem troca silenciosa de modelo).
- Ampliar o orçamento de resposta de cada parte para caber o raciocínio mais o texto exigido.
- Se ainda assim vier incompleto, continuar automaticamente de onde parou (uma única continuação) em vez de descartar tudo; só falhar se a continuação também não fechar.

**2. Não perder mais o envio do arquivo**
- Quando a geração vier da tela de preparação do caso, os documentos já estão no armazenamento privado: a função passa a buscá-los lá pelo caminho, em vez de receber o arquivo inteiro convertido em texto. O envio do navegador fica pequeno e deixa de quebrar.
- O caminho antigo (arquivo enviado direto) continua funcionando para as demais telas, com leitura defensiva do corpo: se o envio for interrompido, a tela mostra "o envio do arquivo foi interrompido, tente novamente" com botão de repetir, em vez de tela em branco.

**3. Confirmar que a resposta longa sobrevive
- Manter o envio contínuo já implementado e validar na prática que uma geração acima de 150 segundos chega ao fim.

**4. Testar de verdade**
- Executar a geração ponta a ponta com os documentos fictícios de homologação (indeferimento, exigência de mérito e oposição), conferindo nos registros: modelo usado, duração, se a resposta veio completa e o tamanho do texto.
- Repetir a parte 1 e a parte 2 e conferir que a peça chega à tela de revisão.
- Como o login de administrador é necessário na tela, os testes automatizados serão feitos chamando a função diretamente com os documentos fictícios; o que depender da tela autenticada fica listado como pendente para você conferir.

## Detalhes técnicos

- `supabase/functions/_shared/recursosInpiModel.ts`: `reasoningEffort` das três modalidades de `high` para `medium`.
- `supabase/functions/process-inpi-resource/index.ts`: `max_output_tokens` de pass1/pass2 para 32000; em `callOpenAI`, quando `incomplete_details.reason === 'max_output_tokens'`, disparar uma continuação com o texto já produzido como contexto e concatenar; leitura do corpo em `try/catch` com erro `body_incomplete` (HTTP 400) e mensagem em português; novo caminho que, recebendo `caseId`, carrega os documentos do bucket `inpi-recursos-docs` via service role e monta as `input_file` parts no servidor.
- `src/pages/admin/RecursosINPI.tsx`: quando `override.caseId` existir, enviar apenas `caseId` (sem base64); tratar `body_incomplete` com toast e opção de tentar novamente; manter o restante do fluxo intacto.
- Escopo preservado: nenhuma outra modalidade, módulo ou integração é alterada; nada é publicado, protocolado ou enviado.
