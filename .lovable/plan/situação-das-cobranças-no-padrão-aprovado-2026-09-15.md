# Situação das cobranças no padrão aprovado

## Resultado

Substituir apenas os indicadores atuais da página Financeiro pela direção **Moderno WebMarcas**, mantendo todo o restante da tela intacto.

## Implementação

1. Criar uma agregação segura no banco para Recebidas, Confirmadas, Aguardando pagamento e Vencidas, com pertencimento exclusivo por cobrança, valores brutos, líquidos apenas quando existentes, clientes únicos e quantidade de cobranças.
2. Aplicar período e filtros de conta Asaas, status, forma de pagamento, cliente, vencimento, pagamento e origem antes da agregação e da paginação.
3. Atualizar a listagem paginada para aceitar os mesmos filtros e manter busca, ordenação e 50 registros por página.
4. Construir o bloco aprovado com título, total do período, seletor inicial “Este mês”, filtros, quatro cartões responsivos e barras baseadas em dados reais.
5. Fazer cartões e contagens filtrarem a tabela sem recarregar, voltando à página 1 e exibindo o filtro ativo com opção de limpar.
6. Adicionar a versão gráfica com evolução temporal usando exatamente o mesmo conjunto filtrado dos cartões, sem alterar a tabela inferior.
7. Validar desktop, telas intermediárias e celular; conferir que nenhuma cobrança entra em duas situações e que valores não usam somente a página atual.

## Regras preservadas

- Verde, azul, laranja e vermelho seguem a identidade atual do CRM.
- Canceladas, removidas, estornadas, chargebacks e cobranças substituídas por acordo não entram nos totais ativos.
- Nenhuma taxa líquida será estimada; ausência de dado será indicada consistentemente.
- Nenhuma outra seção ou fluxo do Financeiro será redesenhado.

## Detalhes técnicos

- Evoluir as funções existentes de listagem e totais, mantendo validação administrativa e escopo do responsável.
- Usar a normalização única de status como base e separar `confirmed` dos status efetivamente recebidos.
- Usar o componente gráfico já instalado no projeto e os componentes de interface existentes. Plano aprovado. Está fiel ao visual escolhido e mantém todo o restante do Financeiro intacto.
  Pode executar com estas condições finais:
  - Antes de alterar, criar um ponto de restauração;
  - Usar a consulta agregada no backend, nunca apenas os 50 registros visíveis;
  - Garantir que cada cobrança pertença a uma única situação;
  - Manter `confirmed` separado de cobranças efetivamente recebidas;
  - Preservar todos os filtros ao alternar entre cartões e gráfico;
  - Não modificar sincronização, cobrança, acordo ou outras áreas;
  - Testar com dados reais somente para leitura;
  - Apresentar prévia em desktop e celular antes da publicação;
  - Informar arquivos, funções e consultas alteradas;
  - Não publicar em produção sem aprovação final.
  Pode seguir com a implementação.