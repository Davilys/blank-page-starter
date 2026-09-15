# Botão "Notificações" no cartão Aguardando pagamento

## Contexto
Antes da reorganização do bloco "Situação das cobranças", clicar em "Aguardando pagamento" levava à página de notificações (faturas que vencem hoje ou em 3 dias). Hoje o clique no cartão só filtra a tabela, e a página ficou sem acesso visível.

A página já existe e continua ativa:
- `src/pages/admin/FinanceiroAguardando.tsx` — lembretes por email + WhatsApp para faturas que vencem hoje ou em 3 dias
- Rota `/admin/financeiro/aguardando` registrada em `src/App.tsx`

## O que será feito

### Botão "Notificações" dentro do cartão "Aguardando pagamento"
Arquivo: `src/components/admin/financeiro/BillingSituationSection.tsx`

- No cartão "Aguardando pagamento" (somente nele), adicionar abaixo da área de Clientes/Cobranças um botão **"Notificações"**, no mesmo padrão visual do botão "Abrir Central de Vencidos":
  - Estilo: pílula na cor do cartão (`bg-billing-awaiting`), ícone de sino (`Bell`), texto "Notificações"
  - Clique navega para `/admin/financeiro/aguardando` (a página que já existia)
  - `stopPropagation` para não disparar o filtro da tabela ao clicar no botão
  - O clique no restante do cartão continua apenas filtrando a tabela, como hoje
- Nenhuma outra alteração de layout, cores, textos ou comportamento nos demais cartões

## O que não muda
- Nenhuma mudança na página de notificações em si, nas rotas, no backend, em permissões ou em outras telas
- Nenhuma migração de banco

## Validação
- Clicar em "Notificações" dentro do cartão abre a página de lembretes (vencem hoje/em 3 dias)
- Clicar no restante do cartão continua ativando o filtro "Aguardando pagamento" na tabela
- Botões "Abrir Central de Vencidos", filtros e demais cartões inalterados
