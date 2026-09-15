# Auditoria da aba Revista INPI — plano de execução

Etapa somente de leitura e análise. Nenhum arquivo do sistema, banco, função ou integração será alterado. Nenhuma mensagem, cobrança ou publicação será disparada.

## O que será auditado

A aba fica em `/admin/il-inpi` (página `RevistaINPI.tsx`, ~2.070 linhas), com apoio de: importação/baixa da revista, processamento do arquivo, lembretes automáticos e a aba Publicações, que consome o que a Revista gera.

Peças já identificadas nesta exploração inicial:

- Tela: `src/pages/admin/RevistaINPI.tsx`; acesso pelo menu lateral e pelo menu inferior do celular, com permissão `inpi_magazine`.
- Funções de servidor: `fetch-inpi-magazine` (baixa do portal do INPI), `process-rpi` (lê o arquivo e cria os registros), `check-rpi-reminders` (lembretes).
- Tabelas: `rpi_uploads`, `rpi_entries`, `publicacoes_marcas`, `brand_processes`, `profiles`, `notifications`, `client_activities`, além de armazenamento de arquivos.

## Como a auditoria será feita

1. Leitura completa da tela e de todos os seus estados, botões, filtros, busca, tabelas, painéis, modais, ações individuais e em lote.
2. Leitura completa das funções de servidor envolvidas: entrada, saída, autenticação, tratamento de erro, repetição, proteção contra duplicidade, registro de histórico.
3. Consultas somente de leitura ao banco: estrutura das tabelas, regras de acesso, gatilhos, índices, volume de registros, datas mais antiga e mais recente, e contagem das inconsistências (publicações sem cliente, sem marca, duplicadas, números fora de padrão, prazos vencidos ou sem responsável).
4. Verificação dos agendamentos existentes (se há rotina automática, em que dia e horário) e do que é apenas manual.
5. Levantamento dos códigos de despacho tratados pelo sistema e do que cada um provoca: etapa, prazo, tarefa, aviso ao cliente. Também a lista dos códigos que ainda não têm regra.
6. Conferência manual de alguns registros para validar os números mostrados nos indicadores.
7. Avaliação de uso diário: clareza, ordem das informações, risco de perder prazo, risco de avisar o cliente errado, uso no celular, velocidade.

## Entrega

Relatório único, em português, com as seções pedidas: resumo executivo, finalidade da aba, fluxo atual (entrada da revista até o acompanhamento pelo responsável, marcando o que existe e o que não existe), inventário de telas, tabela de funções, origem de cada dado, sincronizações, códigos de despacho, vínculos com clientes/marcas/processos, prazos, automações, banco, funções de servidor e agendamentos, busca/filtros/paginação, indicadores, permissões, experiência de uso, desempenho, tabela de problemas classificados (crítico, alto, médio, baixo) e dúvidas pendentes.

Cada afirmação virá marcada como: confirmado no código, confirmado no banco, confirmado na tela, inferência ou não confirmado.

## Ponto que precisa da sua decisão antes de começar

Os prints numerados exigem entrar na área administrativa. Este projeto usa uma conta Supabase externa, e por isso eu não consigo criar uma sessão de teste por conta própria — sem isso, só consigo capturar a tela de login.

Opções:

- A) Faço a auditoria completa por código e banco agora e entrego o relatório sem prints; você me envia os prints das telas depois, ou eu capturo quando houver sessão disponível.
- B) Você abre a aba no preview e envia as imagens das áreas pedidas; eu as numero e uso no relatório.
- C) Você autoriza um acesso de teste para eu navegar e capturar tudo automaticamente.

Nenhuma ação que envie mensagem, gere cobrança ou altere processo real será executada em qualquer das opções.
