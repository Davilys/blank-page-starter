# Fixar a consulta ao INPI no card do processo (Revista INPI)

## Problema confirmado
Na Revista INPI → Processos, o bloco "Situação atual consultada no INPI" some ao fechar e reabrir o processo. A causa: o resultado da consulta é gravado corretamente na tabela `rpi_process_lookups` (confirmei que a consulta do processo 937929034 está salva), mas a tela guarda o resultado apenas em memória e nunca lê o que já está gravado — ao reabrir, o painel mostra "Nenhuma consulta realizada para este processo".

## Correção (frontend apenas, sem migração)

1. **`src/hooks/useProcessLookup.ts`** — adicionar uma hidratação do estado a partir do banco:
   - Nova função `hydrate(processNumber)`: faz uma leitura direta em `rpi_process_lookups` pelo número do processo (permissão de leitura para administradores já existe) e, se houver registro, preenche o estado com os dados salvos (situação, marca, titular, classe, apresentação, natureza, procurador, datas, especificação, link do INPI e data da consulta).
   - A hidratação não chama o INPI novamente — apenas lê o que já foi gravado. O resultado aparece como "reaproveitado" com a data real da última consulta.
   - Se não houver registro salvo, mantém o comportamento atual.

2. **`src/components/admin/inpi/InpiLookupPanel.tsx`** — ao abrir o card do processo:
   - Se ainda não há estado em memória para aquele processo, chama `hydrate` para exibir a última consulta gravada.
   - Mantém intacta a consulta automática para processos com dados incompletos e o botão "Consultar novamente no INPI" (que força nova consulta real e continua gravando por cima do registro salvo).

## O que não muda
- Nenhuma alteração no banco de dados, nas permissões, na função de consulta ao INPI, no cache de 24 h, no vínculo de clientes ou em qualquer outra tela.
- O botão "Consultar novamente no INPI" continua fazendo consulta real quando o operador pedir.

## Verificação
- Typecheck (`tsgo --noEmit`).
- Conferência estática do fluxo: abrir processo já consultado → dados aparecem com data da consulta; fechar e reabrir → dados continuam visíveis; clicar em "Consultar novamente" → nova consulta e gravação.
