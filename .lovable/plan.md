# Destravar a etapa "IA Processando" em Recursos INPI

## O patch anexado já está aplicado

Conferi no projeto: os arquivos do patch (verificação da execução interna, texto
legível da orientação, progresso sem barra falsa) já existem e estão em uso.
Reaplicar duplicaria código. O travamento atual tem outra causa, confirmada nos
registros.

## O que está acontecendo (confirmado agora)

- Existem dois trabalhos parados em "escrevendo a primeira parte" desde 04:14 e
  04:20, ainda marcados como "em processamento", sem mensagem de erro.
- Nos registros da função, às 04:23: **"CPU Time exceeded"** seguido de
  desligamento.

Ou seja: a primeira parte ainda faz tudo numa única execução — baixar e preparar
os documentos e escrever a peça. Quando o servidor estoura o limite e é morto na
hora, ninguém consegue marcar o trabalho como falho. O registro fica "em
processamento" para sempre e a tela gira indefinidamente, sem erro e sem opção
de tentar de novo.

## Como vai funcionar depois da correção

1. **Preparar documentos vira uma etapa própria.** Baixar os arquivos do caso e
   enviá-los ao provedor de IA passa a acontecer antes da escrita, numa execução
   separada. Os arquivos preparados ficam guardados no trabalho; a escrita da
   parte 1 e da parte 2 apenas os reaproveita, sem refazer o preparo.
2. **Sinal de vida.** Cada etapa grava periodicamente que está viva. Se o
   servidor for morto no meio, a ausência de sinal denuncia a interrupção.
3. **Fim do giro infinito.** Trabalho sem sinal de vida por alguns minutos é
   marcado como interrompido, com a mensagem "Geração interrompida — o servidor
   foi encerrado no meio da etapa" e o botão "Tentar de novo", que retoma da
   etapa parada sem refazer o que já ficou pronto.
4. **A tela nunca mais fica presa.** Se o andamento não mudar dentro do tempo
   esperado, a própria tela mostra a interrupção e o botão de nova tentativa,
   em vez de continuar exibindo "Escrevendo a primeira parte…".
5. **Os dois trabalhos travados de agora** são encerrados como interrompidos,
   liberando os casos para nova tentativa. Nenhum documento nem orientação é
   apagado.

## Detalhes técnicos

- `inpi_generation_jobs`: colunas aditivas `heartbeat_at` (timestamptz) e
  `prepared_files` (jsonb) via migração; nenhuma coluna existente muda.
- `process-inpi-resource`:
  - nova etapa `prepare` antes de `pass1`: carrega os documentos do caso pelo
    bucket privado com a credencial de servidor, envia ao provedor e guarda os
    identificadores em `prepared_files`;
  - `pass1`/`pass2` passam a receber `prepared_files` em vez de reconstruir os
    anexos — corta o grosso do consumo de CPU por execução;
  - `heartbeat` a cada ~10s durante a etapa (intervalo simples gravando
    `heartbeat_at`), limpo ao terminar;
  - em `status`, trabalho `processing` com `heartbeat_at` mais velho que 3
    minutos é reclassificado como `error`/`interrompido` antes de responder;
  - `retry` continua retomando por `stage` (`prepare` → `pass1` → `pass2`).
- `RecursosINPI.tsx`: o polling passa a interpretar `interrompido` como falha
  visível ("Geração interrompida" + "Tentar de novo") e aplica o mesmo corte de
  tempo no cliente, caso a resposta não evolua.

## Validação

- Testes do pacote (`src/lib/inpi`), checagem de tipos e compilação; erros
  preexistentes separados dos introduzidos.
- Deploy de `process-inpi-resource` e do frontend no preview.
- Retomar o caso travado preservando documentos e orientação: preparar → parte 1
  → parte 2 → revisão → prévia em PDF; conferir imagens nas páginas corretas,
  referências, índice, anexos e papel timbrado.
- Pendências documentais ou jurídicas mantêm o carimbo de minuta e os bloqueios;
  nada é forçado para "aprovado".
- Se o login de administrador não estiver disponível para mim, isso é registrado
  como pendência explícita, não como aprovado.

Fora do escopo: outras modalidades, outros módulos, modelos de IA e integrações.
Nada é protocolado, enviado ou publicado em produção; o BANDA UAU aprovado
permanece intacto.
