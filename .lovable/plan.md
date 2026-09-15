# Central de Email — correção e nova organização

Escopo: apenas a página Emails, seus componentes internos e os serviços de email. Nada de Dashboard, Leads, Clientes, Financeiro, Revista INPI, site público ou área do cliente é tocado.

## O que já foi verificado (evidências)

Recebimento automático: a tarefa automática roda a cada 2 minutos e está funcionando — 97.149 execuções, apenas 58 falhas. O problema não é o agendamento nem a interface. É por conta:

- caroline@webmarcas.net — "falha de login", 19 erros seguidos; última mensagem gravada em 3/set.
- juridico@webmarcas.net — "falha de login", 29 erros seguidos; última mensagem gravada em 4/set.
- financeiro@webmarcas.net — conexão derrubada pelo servidor, 17 erros seguidos; última entrada em 14/set.
- ola@webmarcas.net — sincronizando normalmente (última entrada hoje).

Ou seja: as senhas/credenciais de três contas pararam de funcionar e a tela nunca mostrou isso — continuou dizendo "Sincronizado". Você confirmou que vai atualizar as senhas.

Qualidade das mensagens (26.061 registros):
- 775 com acentos corrompidos no assunto
- 7.471 sem corpo salvo
- 93 com remetente "desconhecido"
- 72 sem assunto
- 10 com cabeçalho técnico aparecendo no lugar do assunto/remetente
- 7.255 sem referência ao servidor (importadas por outro caminho) — essas não podem ser reprocessadas a partir da origem

Causa: a leitura das mensagens é feita com expressões de texto e divisão manual das partes, sem um leitor MIME de verdade — falha em partes aninhadas, codificações e conjuntos de caracteres menos comuns.

## O que será feito

### 1. Leitura correta das mensagens
Substituir a interpretação artesanal por um leitor MIME completo no serviço de recebimento e no de carregamento sob demanda, com as mesmas regras nos dois. Remetente, destinatários, assunto, datas e identificadores lidos dos cabeçalhos reais (nunca de assinaturas técnicas); acentos, cabeçalhos codificados, quoted-printable, base64 e mensagens com várias partes tratados corretamente; texto, HTML, anexos e imagens embutidas separados; HTML higienizado antes de exibir; prévia curta e limpa. Guardar a origem da mensagem para permitir reprocessamento. Mensagem realmente vazia passa a ser distinta de "não foi possível carregar". Cabeçalhos técnicos só aparecem numa ação "Detalhes".

### 2. Recebimento automático confiável
Manter o serviço atual (não criar um segundo sistema). Correções:
- Controle por conta e pasta com validação do identificador do servidor: se o servidor reiniciar a numeração, o sistema detecta e não perde nem duplica mensagens.
- Mensagem com falha não avança o marcador silenciosamente: fica em uma fila de reprocessamento com novas tentativas espaçadas.
- Uma conta com problema não interrompe as demais; trava por conta evita execuções sobrepostas.
- Falha de login passa a marcar a conta como "autenticação necessária", visível na tela, com alerta ao administrador.
- Corrigir uma falha de programação encontrada no serviço (variável inexistente usada quando a mensagem não pode ser baixada), que hoje transforma esses casos em erro.

### 3. Estado real e histórico
Cada conta passa a mostrar estado verificável: Sincronizando, Atualizado (com data e hora da última execução bem-sucedida), Atrasado, Falha temporária, Autenticação necessária. Novo histórico por execução: conta, início, fim, resultado, novas/atualizadas/com falha, último sucesso, erro resumido e código para investigação. Nunca com senhas, conteúdo de mensagens ou respostas do servidor.

### 4. Nova organização visual (só nesta página)
Inspiração no Outlook, identidade WebMarcas, estilos aplicados localmente — tema e menu principal do CRM intactos.

- Menu interno em grupos: Contas (conta em destaque, endereço, troca de conta, estado de sincronização), Pastas (Entrada, Enviados, Rascunhos, Programados, Automáticos, Favoritos, Arquivados, Spam, Lixeira) e Ferramentas (Templates, Campanhas, Sequências, Automações, Configurações). Categorias atuais preservadas: Clientes, Leads, Jurídico, Financeiro, Suporte.
- Três áreas no desktop: menu, lista de mensagens, painel de leitura. IA em painel lateral recolhível.
- Barra superior: busca, filtros, estado de sincronização, "Sincronizar agora" (protegido contra cliques repetidos), histórico e "Novo email".
- Lista: remetente, assunto, prévia curta, data/hora, lido/não lido, anexo, categoria/vínculo. Textos limitados, carregamento por páginas. Conversas agrupadas pelos identificadores de encadeamento, não por assunto.
- Leitura: responder, responder a todos, encaminhar, arquivar, mover, favoritar, marcar lido/não lido, anexos, histórico da conversa, vínculos com o CRM, demais ações em menu. Conta remetente sempre explícita.
- Celular: troca entre pastas, lista e leitura sem colunas espremidas. Teclado, foco visível, rótulos e status que não dependem só de cor. Modo escuro preservado.
- Cartões grandes de métricas reduzidos para não competir com a leitura.

### 5. Contadores, filtros e ordenação
Definir e usar a mesma fonte para contadores equivalentes: total da conta, total da pasta, não lidos e resultado do filtro — todos contados no banco, nunca pelo que está carregado na tela. Atualização após ler, mover ou sincronizar. Ordenação explícita por mais recentes, com tratamento de datas inválidas sem inventar horário. Estados distintos: pasta vazia, sem resultado, carregando, falha ao carregar, sincronização pendente.

### 6. Funções preservadas
Templates, campanhas, sequências, automações, agendamento, rascunhos, anexos, vínculos, permissões por conta e o assistente de IA (análise, classificação, resumo, redação sugerida) continuam como estão. A resposta automática "Recebemos seu contato" permanece exatamente como hoje, conforme sua escolha. Nenhuma automação nova, nenhum disparo durante o desenvolvimento.

### 7. Reparo das mensagens antigas
Amostra primeiro: 30 mensagens defeituosas de uma conta piloto reprocessadas a partir da origem no servidor, com antes/depois apresentado para sua aprovação. Nada de duplicatas, nada de apagar dado válido, leitura/categorias/vínculos preservados, nenhum evento comercial disparado. As ~7,2 mil mensagens sem referência ao servidor não podem ser recuperadas — isso será informado, não reconstruído.

## Detalhes técnicos

- Frontend: `src/pages/admin/Emails.tsx` e `src/components/admin/email/*` (Sidebar, List, View, Compose, MetricsBar, Settings, AIEmailAssistant e os módulos de Templates/Campanhas/Sequências/Automações mantidos). Novos componentes locais para a barra superior, estado de sincronização e histórico. Estilos locais ao módulo, sem alterar `index.css` global nem o layout do CRM.
- Backend: `supabase/functions/sync-imap-inbox`, `cron-sync-all-emails`, `hydrate-email`, `update-imap-flag`. Parser MIME compartilhado em `supabase/functions/_shared/`. `send-email`, `email-ai-assistant` e `trigger-email-automation` não mudam de contrato.
- Migração aditiva (sem apagar nada): colunas de origem da mensagem, identificadores de encadeamento e estado de processamento em `email_inbox`; `uidvalidity`, estado e trava em `email_sync_state`; nova tabela de histórico de execuções e nova tabela de fila de reprocessamento, ambas com acesso restrito a administradores e escrita apenas pelas funções. Reversão: descartar as novas tabelas e colunas e restaurar a versão anterior das funções e dos componentes.
- Contadores via consultas com contagem exata por conta/pasta/filtro.

## Pendências

- Senhas de caroline@, juridico@ e financeiro@ precisam ser atualizadas por você em Configurações do módulo; sem isso essas contas continuam sem receber, independentemente do código.
- Teste de envio será feito apenas para um endereço de teste autorizado por você — nenhum cliente real.
- Nada será publicado em produção e nenhum reparo amplo será executado antes de eu apresentar o resultado dos testes e a amostra para aprovação.
