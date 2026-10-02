# Publicações: lista mais alta e auditoria da aba

## Entendimento
Ao clicar em **Total de Processos**, a visão Lista mostra poucas linhas porque sua área de rolagem tem altura fixa curta. A lista deve se estender até a parte inferior da área disponível, exibindo mais processos sem perder cabeçalho, rolagem ou paginação. O botão **Ver gráficos** deve sair do rodapé e ficar junto de **Nova** na barra de ações; os gráficos continuam opcionais. A aba Publicações também deve ficar mais clara e organizada, sem modificar o que já funciona.

## O que será feito
1. Ampliar a área visível da lista de processos com altura adaptável à tela, respeitando telas menores, a barra superior e a paginação; conservar a rolagem interna e as 20 linhas por página. Ajustar o encaixe da barra e da lista para não criar espaços vazios nem esconder controles.
2. Mover **Ver gráficos/Ocultar gráficos** para a barra ao lado de **Nova**. Manter os gráficos recolhíveis, sem empurrar a lista para baixo, e organizar a barra em telas estreitas sem cortes ou sobreposição.
3. Auditar sistematicamente **Total/Urgentes/Atrasados/Deferidos**, Lista/Kanban/Prazos, pesquisa, filtros, ordenação, paginação, seleção e ações em lote, detalhes do processo/cliente, criação/edição, vínculo, notificações, exportações, gráficos e sincronizações automáticas. Corrigir somente defeitos demonstrados na aba, com mudanças pequenas e testes de regressão; não trocar regras de prazos, critérios de vínculo ou integrações por preferência visual.
4. Fazer uma revisão visual coesa da aba: legibilidade dos números e rótulos, alinhamentos, hierarquia de ações e espaçamento em desktop e mobile, mantendo a identidade existente do CRM.

## Conferência e limites
- Verificar a compilação e os testes pertinentes; inspecionar a prévia em tamanhos de tela distintos. Onde houver acesso autenticado, exercitar os controles sem disparar cobranças, notificações reais ou alterações irreversíveis como teste.
- A área administrativa usa autenticação externa e este ambiente não dispõe de sessão de teste; se não houver acesso, não declarar que cada ação foi validada de ponta a ponta. Relatar claramente o que foi comprovado por código/teste e o que precisa ser conferido em sessão logada.
- Não alterar outras abas, banco de dados, regras jurídicas ou integrações externas. Não publicar sem pedido explícito.

## Notas técnicas
- A lista ativa está em `PublicacaoTab.tsx`, com área `h-[calc(100vh-520px)]`, limite de 20 itens e paginação independente; o botão de gráficos está ao final do componente. A visão Prazos usa outra altura e o CRM já tem rolagem própria na página. A auditoria começará por esses pontos e pelos fluxos relacionados, preservando a sincronização existente.
