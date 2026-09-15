# Vínculo automático do cliente após a consulta ao INPI

Sim, é possível. Quando a consulta do processo trouxer os dados oficiais (marca, titular, classe, datas), o sistema tenta encontrar o cliente correspondente e, havendo certeza, faz o vínculo sozinho e organiza a marca na ficha dele.

## Quando vincula sozinho (certeza absoluta)

1. O número do processo já existe em uma marca cadastrada no CRM: vincula ao dono dessa marca.
2. O titular retornado pelo INPI bate por CPF/CNPJ exato com um único cliente.

Nada além disso vincula automaticamente. Semelhança de nome de marca ou de titular nunca vincula: vira **sugestão** no cartão, com o nome do candidato e um botão para confirmar com um clique. Havendo mais de um candidato, o cartão mostra a lista e espera a sua escolha.

## O que acontece após o vínculo

- O cartão da Revista INPI passa a mostrar o cliente vinculado, com a etiqueta "Vinculado automaticamente pela consulta ao INPI".
- Na ficha do cliente, aba **Marcas**: se ele já tiver aquela marca/processo, os campos vazios são completados (nº do processo, classes NCL, data de depósito, situação atual, apresentação, natureza); nada preenchido à mão é sobrescrito. Se não tiver, a marca é criada com os dados oficiais.
- Duplicidade: marcas do mesmo cliente com o mesmo número de processo são unificadas em um único registro, mantendo o mais completo e preservando o que foi editado manualmente. Registros vazios criados por engano (sem número e sem nome) deixam de ser exibidos.
- O cartão da aba **Publicação** é criado/atualizado pela mesma regra já existente (RPI + processo), sem duplicar.
- **Nenhuma notificação, mensagem, cobrança ou prazo é disparada no vínculo automático.** O registro fica no histórico de atividades do cliente.

## Como desfazer

Cada vínculo automático fica registrado com data, origem e valores anteriores dos campos preenchidos, permitindo desvincular pelo próprio cartão sem perder edições manuais.

## Detalhes técnicos

- `supabase/functions/inpi-process-lookup/index.ts`: após gravar o cache e preencher `rpi_entries`, roda a resolução de cliente.
  - Passo 1: `brand_processes.process_number = <processo>` → `user_id`.
  - Passo 2: dígitos do documento do titular (quando a API retornar) via `profiles_by_doc_digits`, exigindo resultado único.
  - Sem correspondência exata: monta `match_candidates` (busca por nome do titular e nome da marca em `profiles` e `brand_processes`) e grava `needs_human_review`, sem escrever `matched_client_id`.
  - Em vínculo confirmado: grava `matched_client_id`, `matched_process_id`, `linked_at` em `rpi_entries` com atualização condicional (só quando continua nulo), insere/atualiza `brand_processes` (apenas campos nulos) e chama o mesmo caminho de `publicacoes_marcas` usado no vínculo manual — sem o bloco de `notifications`.
  - Deduplicação: `brand_processes` do mesmo `user_id` com o mesmo `process_number` são consolidadas (mantém a mais antiga com dados, migra referências de `publicacoes_marcas`/`rpi_entries`, marca as demais como removidas em vez de apagar).
  - Auditoria em `rpi_enrichment_field_log` (já existente) + novas colunas aditivas em `rpi_entries`: `auto_linked_at`, `auto_link_source`.
- Frontend: `InpiLookupPanel.tsx` mostra o resultado do vínculo (vinculado / sugestões com botão confirmar / sem candidatos); `ProcessoIdentificadoRow.tsx` reflete o novo estado de vínculo; `RevistaINPI.tsx` recarrega o registro após a consulta. O diálogo manual de vinculação continua funcionando como hoje.
- Migração aditiva apenas (duas colunas + índice por `process_number` em `brand_processes`), reversível.
- Correção incluída: a consulta atual pode estourar o tempo limite da função (erro 504 IDLE_TIMEOUT). O tempo de espera da chamada externa passa a ser encerrado com folga e a função responde com "tente novamente" em vez de ficar pendurada.

## Testes

Processo já cadastrado no CRM; titular com CNPJ exato; titular homônimo (não vincula, mostra candidatos); marca com mesmo nome de outro cliente (não vincula); cliente sem marca cadastrada (cria); cliente com marca incompleta (completa vazios); campo editado à mão (preservado); duplicatas do mesmo processo (unificadas); reconsulta do mesmo processo (sem duplicar nada); verificação de que nenhum WhatsApp, e-mail, cobrança, prazo ou notificação foi disparado. Homologação com 931053021 e com um processo real já vinculado.
