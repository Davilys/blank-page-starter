# Dashboard por período + ícone de Leads no menu mobile

## 1. Menu inferior (mobile)
Substituir o botão "Chat" por "Leads" na barra fixa inferior do painel admin.

- Ícone: `UserPlus` (verde), rota `/admin/leads`, permissão `leads`.
- "Chat ao Vivo" passa para a lista do botão "Mais" (mantendo ícone e permissão atuais), para não perder o acesso.

## 2. Dashboard: período como visão principal

Hoje o painel abre com números acumulados (total de clientes, processos, receita histórica) e calcula tendências comparando total x mês anterior — o que gera distorções como "+8723% vs mês anterior".

Nova estrutura, com seletor de período no topo:

```text
PERÍODO:  [ Hoje | Semana | Este mês* | Mês passado | Este ano | Total ]
```

Padrão ao abrir: **Este mês**.

### Indicadores de fluxo (mudam com o período)
- Novos clientes
- Leads recebidos
- Novos processos
- Processos concluídos
- Receita recebida
- Faturas pagas
- Ticket médio (receita ÷ faturas pagas)

Cada card mostra o valor do período, a variação real contra o período anterior equivalente e, em letra menor, o acumulado histórico (ex.: "Total: 3.123").

### Indicadores de posição (sempre atuais, marcados com selo "atual")
- Total de clientes
- Processos ativos
- Faturas pendentes
- Leads em aberto

### Correção da taxa de conversão
Passa a ser: clientes novos do período ÷ leads recebidos no período × 100, limitada a exibição coerente (ex.: 27/91 = 29,7%). Some o cálculo atual total-clientes ÷ leads-ativos.

### Barras de performance
- "Faturas pagas" passa a usar pagas ÷ (pagas + pendentes) do período, em vez da fórmula atual baseada em clientes.
- "Leads qualificados" deixa de ser um valor inventado (conversão + 20) e passa a usar leads com status qualificado/convertido no período; se o dado não existir, a barra é removida.

### Visão Ano e Total
"Este ano" mostra o acumulado de janeiro até o mês corrente. "Total" reproduz exatamente os números históricos de hoje, para consulta patrimonial.

## Detalhes técnicos
- `src/components/admin/MobileBottomNav.tsx`: trocar item Chat por Leads em `primaryNavItems`; incluir Chat em `moreItems`.
- `src/pages/admin/Dashboard.tsx`:
  - novo estado `period` e helper `getRange(period)` devolvendo `{ start, end, prevStart, prevEnd }`;
  - `fetchStats` refeito: contagens com `head: true, count: 'exact'` filtradas por `created_at` para `profiles`, `leads` e `brand_processes`; receita e faturas por `invoices` usando `payment_date` quando preenchido (fallback `created_at`) e status em `paid|confirmed|received`; mesma consulta repetida para o período anterior;
  - indicadores de posição continuam como consultas sem filtro de data;
  - variação = (atual − anterior) ÷ anterior × 100, com "—" quando o período anterior é zero (elimina os percentuais absurdos);
  - `LiveTicker` e o cabeçalho passam a rotular o período selecionado (ex.: "Setembro/2026").
- Layout, cores e animações atuais mantidos; muda o conteúdo dos cards e o seletor no topo.
- Componentes de gráfico existentes (`RevenueChart`, `ConversionFunnel` etc.) ficam inalterados nesta etapa.
