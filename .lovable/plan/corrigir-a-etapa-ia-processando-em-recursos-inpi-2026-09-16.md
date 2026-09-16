# Corrigir a etapa "IA Processando" em Recursos INPI

## O que está acontecendo (confirmado nos registros)

Na geração do recurso de indeferimento às 02:30, o servidor registrou:

- "Documentos carregados do caso: 7 | falhas: 0" — os arquivos chegam bem;
- preparo dos anexos levando 5,7 segundos;
- "PASS 1 and PASS 2: Generating all sections in parallel...";
- em seguida: **"CPU Time exceeded"** e desligamento.

Como o servidor é interrompido no meio, ele não devolve nada, e a tela mostra
o erro "Unexpected end of JSON input". Ou seja: não é erro do texto nem dos
documentos — a geração inteira (leitura dos anexos + as duas partes da peça)
está sendo feita dentro de uma única chamada, que estoura o tempo permitido
por execução.

Hoje a tela também trata qualquer resposta como se sempre viesse um resultado,
então uma interrupção vira uma mensagem técnica sem sentido para quem usa.

## Como vai funcionar depois da correção

1. Ao clicar em gerar, o pedido é registrado e a tela recebe uma confirmação
   imediata, com o andamento real: "preparando documentos", "escrevendo a
   primeira parte", "escrevendo a segunda parte", "finalizando".
2. O trabalho passa a rodar em etapas separadas, cada uma dentro do limite do
   servidor. Terminada uma etapa, a seguinte começa sozinha.
3. A tela acompanha o andamento. Pode fechar e reabrir: ao voltar, o caso
   mostra onde parou e continua.
4. Se algo falhar, aparece o motivo em português e um botão "Tentar de novo"
   que retoma da etapa que falhou, sem refazer o que já ficou pronto.
5. Nada de silêncio: interrupção, falta de crédito, documento ilegível e
   demora excessiva têm mensagem própria.

Escopo intacto: só as três modalidades (indeferimento, exigência de mérito e
manifestação à oposição) e os três agentes. Nada de protocolo, envio de
mensagens ou alteração no recurso BANDA UAU já aprovado.

## Detalhes técnicos

- Nova tabela `inpi_generation_jobs` (migração aditiva): `case_id`,
  `resource_type`, `stage`, `status`, `attempt`, `extracted_data`,
  `pass1_content`, `result_content`, `error_message`, `error_code`,
  `updated_at`; RLS administrativa via `has_role(auth.uid(),'admin')` mais
  os GRANTs obrigatórios; índice único por caso para job ativo (idempotência
  contra cliques repetidos).
- `process-inpi-resource` ganha três ações: `start` (cria/recupera o job e
  devolve o id na hora), `status` (consulta) e `step` (executa uma etapa).
  Cada etapa roda em `EdgeRuntime.waitUntil` e, ao terminar, dispara a etapa
  seguinte por auto-invocação — assim cada execução recebe orçamento de CPU
  novo, que é exatamente o limite estourado hoje.
- Fim do paralelismo pass 1 + pass 2 na mesma execução: passam a ser etapas
  distintas, com o resultado intermediário salvo no job.
- Redução de CPU no preparo: a conversão dos arquivos para base64 hoje é feita
  caractere a caractere (`btoa` sobre string montada em laço). Troca por envio
  direto dos bytes à API de arquivos (`multipart`), sem essa conversão.
- Cliente (`RecursosINPI.tsx`): `processDocument` passa a iniciar o job e fazer
  polling com backoff; leitura defensiva da resposta (nunca `.json()` cego),
  estado por etapa na tela de processamento, retomada ao reabrir o caso e botão
  de nova tentativa. Mantém o inventário de provas e a revisão como estão.
- Correção do aviso de `ref` em `CasePreparationPanel` (`forwardRef`), que hoje
  polui o console da página.

## Teste antes de publicar

Rodar, em cópia de teste, o caso de indeferimento com os mesmos 7 documentos
que falharam agora, mais um caso de exigência de mérito e um de manifestação à
oposição: gerar até a revisão, fechar e reabrir no meio, forçar uma falha e
usar "Tentar de novo", e conferir o PDF final (imagens no corpo, índice e
anexos). Só depois disso, publicar.
