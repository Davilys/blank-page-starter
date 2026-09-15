# Enriquecimento automático de processos na aba Revista INPI

Ao abrir um processo da lista "Processos identificados", o sistema consulta o INPI pelo número do processo (rota já publicada da API WebMarcas) e completa apenas as informações que estiverem faltando. Nada acontece em lote, nada é disparado para clientes.

## Comportamento na tela

- O clique no cartão abre os detalhes como hoje, mostrando imediatamente o que já existe.
- Se faltarem dados e não houver consulta recente, aparece "Consultando dados do processo no INPI…" apenas naquele cartão; o resto da página continua utilizável.
- Cliques repetidos e aberturas simultâneas não geram consultas duplicadas; a resposta sempre volta para o processo certo, mesmo se o usuário abrir outro cartão antes.
- Com sucesso: cartão e painel atualizam sem recarregar. "Aguardando identificação da marca" é substituído pelo nome real quando houver; "Dados incompletos" só some se os campos realmente ficarem preenchidos. Aparecem a data/hora da consulta e o link "Ver no INPI".
- Quando os detalhes adicionais não vierem: "Dados principais consultados. Detalhes adicionais indisponíveis neste momento."
- Botão "Consultar novamente no INPI", com bloqueio contra cliques repetidos e limite no servidor.
- Falha (rede, tempo esgotado, resposta inválida, consulta inconclusiva): nada é apagado, aparece "Não foi possível atualizar os dados deste processo no INPI agora. As informações existentes foram mantidas." com "Tentar novamente". Após falha, nova tentativa automática só depois de 5 minutos.
- Processo inexistente: "Processo não localizado nesta consulta. Confira o número e tente novamente."
- Falha de autenticação da integração: mensagem técnica ao administrador, sem expor a chave.
- Consulta bem-sucedida com gravação falha nunca é anunciada como salva.

## Regras de preenchimento

- Preenche somente campos vazios ou com marcadores conhecidos ("Marca não identificada", "Aguardando identificação da marca", "—").
- Nunca sobrescreve valor existente ou corrigido manualmente, nunca grava vazio por cima de dado preenchido.
- `priority_date` não vira data de depósito; sem `filing_date`, a data existente fica intacta.
- Classe NCL guardada no formato oficial completo; múltiplas classes preservadas.
- Divergência entre dado existente e retorno oficial: mantém o existente e mostra o oficial ao lado, para conferência.
- Antes de gravar, o registro é relido e a gravação é condicional, para não atropelar uma edição manual feita durante a consulta.

## Publicação histórica preservada

Código IPAS, texto e tipo do despacho, número e data da RPI, prazos, TAG, vínculo com cliente e etapa do CRM não são tocados. A situação atual consultada aparece em campo separado do despacho histórico. Nenhum prazo é recalculado e nenhum processo é movimentado.

## Detalhes técnicos

**Backend (novo)** — `supabase/functions/inpi-process-lookup/index.ts`:
- Exige sessão válida (JWT verificado em código) e permissão de admin via `has_role`; sem sessão/permissão retorna 401/403.
- Valida no servidor que o número tem exatamente 9 dígitos ASCII (string, zeros à esquerda preservados).
- `POST {WEBMARCAS_API_BASE_URL}/v1/processes/lookup` com `Authorization: Bearer WEBMARCAS_API_KEY` (secrets já configurados), corpo `{"process_number":"..."}`, timeout 45 s, sem polling e sem Idempotency-Key.
- Valida a estrutura da resposta e exige `process.process_number` igual ao solicitado; devolve só os campos necessários, nunca corpo bruto, HTML ou headers. Mapeia 400/401/404 `not_found`/503 `inconclusive` para códigos próprios. Limite de concorrência e de frequência por usuário/processo; sem retentativa automática em laço.

**Migração aditiva** — nova tabela `public.rpi_process_lookups` (cache isolado, não altera o comportamento de `rpi_entries`): `process_number`, campos oficiais retornados, `source_url`, `queried_at`, `detail_status`, `lookup_status`, `last_error_at`. GRANTs + RLS restritos a admin (`has_role(auth.uid(),'admin')`), somente a função de backend grava. Resultados das últimas 24 h são reutilizados; cache antigo continua visível com a data e permite atualização manual. `rpi_entries` recebe apenas a gravação condicional dos campos vazios, pelos mesmos caminhos já existentes — sem colunas novas e sem triggers (a tabela não possui nenhum).

**Frontend** — novo hook `src/hooks/useProcessLookup.ts` (deduplicação por número, cancelamento/associação correta da resposta, estados de carregando/erro/cache) e ajustes no painel expandido de `src/pages/admin/RevistaINPI.tsx` e no cartão `src/components/admin/inpi/ProcessoIdentificadoRow.tsx` (rótulo de dados incompletos, data da consulta). Nenhuma chamada direta do navegador à API WebMarcas; a chave nunca chega ao front.

**Fora do escopo:** busca por nome de marca no site, /registrar, área do cliente, BotConversa, PDFs, clientes, vínculos, contratos, cobranças, notificações, prazos, automações e permissões existentes.

## Testes

Número inválido (letras, 8 e 10 dígitos), zeros à esquerda, sem sessão/permissão, número divergente na resposta, duplo clique, dois cartões em sequência, edição manual durante a consulta, detalhe indisponível, não encontrado, 401/503/timeout/resposta malformada, falha de gravação, cache e nova consulta manual, marca figurativa sem nome, preservação de despacho/IPAS/RPI/TAG/vínculo, ausência da chave no bundle e nos logs, nenhum disparo de WhatsApp/PDF/cobrança/notificação/prazo. Homologação real com o processo 931053021, validando os dados retornados no momento do teste.

## Entrega

Ao final: arquivos e funções alterados, migração aplicada, resultado dos testes, resultado da consulta real e como reverter apenas esta alteração (remover a função, a tabela de cache e o hook).
