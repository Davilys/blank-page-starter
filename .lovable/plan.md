Plano para corrigir a tela branca e validar a área do cliente inteira:

1. Corrigir a causa atual da tela branca em Meus Processos
   - Arquivo principal: `src/pages/cliente/ProcessoDetalhe.tsx`.
   - O erro atual vem de `PUB_STATUS_CONFIG[pub.status].bg` quando o status da publicação não existe no mapa.
   - Criar fallback seguro para status de publicação, incluindo `default`, `depositada`, `em_andamento`, `publicado_rpi`, `em_exame` e qualquer status inesperado vindo do banco.
   - Substituir todos os usos diretos de `PUB_STATUS_CONFIG[status]` por helper seguro.

2. Blindar datas inválidas no detalhe do processo
   - Criar helper de data segura no `ProcessoDetalhe.tsx`.
   - Evitar `format(new Date(...))`, `parseISO(...)`, `differenceInDays(...)` e `isBefore(...)` quando a data vier vazia, nula ou inválida.
   - Aplicar isso em: dados do processo, timeline, publicações RPI, documentos e tabela de despachos.

3. Revisar componentes da aba Meus Processos
   - `src/components/cliente/PublicacoesCliente.tsx`: confirmar fallback seguro já aplicado e ajustar qualquer ponto restante.
   - `src/components/cliente/ProcessList.tsx`: garantir fallback para status nulo/desconhecido.
   - `src/components/cliente/ClientProcessKanban.tsx`: validar configuração do kanban vinda de `system_settings`; se vier inválida, usar etapas padrão sem quebrar.

4. Auditar todas as abas da área do cliente contra tela branca
   - Rotas a validar:
     - `/cliente/dashboard`
     - `/cliente/registrar-marca`
     - `/cliente/processos`
     - `/cliente/processos/:id`
     - `/cliente/documentos`
     - `/cliente/financeiro`
     - `/cliente/analise-inteligente`
     - `/cliente/suporte`
     - `/cliente/configuracoes`
   - Procurar e corrigir padrões perigosos:
     - `CONFIG[valor].bg/color/label` sem fallback.
     - `.map(...)` em valor que pode vir nulo.
     - `format/parseISO/new Date` com data inválida.
     - dados opcionais do Supabase usados como obrigatórios.

5. Melhorar proteção de erro por seção
   - Se necessário, colocar fallback local em blocos sensíveis da área do cliente para impedir que um único card/publicação derrube a página inteira.
   - Manter o visual e fluxo atual, sem redesenhar a área do cliente.

6. Testar antes de concluir
   - Testar navegação real com Playwright no preview local.
   - Clicar nas abas do menu lateral da área do cliente.
   - Entrar em Meus Processos, alternar Lista/Kanban e abrir um processo em andamento.
   - Verificar console/runtime errors após cada rota.
   - Só considerar resolvido se não aparecer mais tela branca nem erro `Cannot read properties of undefined (reading 'bg')`.

7. Publicação
   - Após correção e teste completo, publicar apenas se a validação passar sem erro.