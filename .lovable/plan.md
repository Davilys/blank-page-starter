# Centralizar Devedores em "Vencidos" (Premium)

## Objetivo

Unificar todas as visões de inadimplência em **uma única tela** acessada ao clicar no card "Vencido" do Financeiro. Hoje a informação está espalhada em duas páginas:

- `/admin/financeiro/vencidos` — faturas vencidas até 30 dias.
- `/admin/devedores` — devedores 30 dias e devedores 60+ dias com histórico.

O botão "Devedores" no header do Financeiro será removido. Tudo passa a viver dentro da nova tela "Vencidos".

## Nova tela `/admin/financeiro/vencidos`

Layout premium: cabeçalho com gradiente sutil, 4 cards de resumo no topo e um sistema de **abas** organizando cada faixa de atraso + histórico.

### Abas

1. **Vencidos até 30 dias** — faturas Asaas vencidas há 1–30 dias (conteúdo atual de `FinanceiroVencidos`).
2. **Devedores +30 dias** — agrupado por cliente (atual aba "Devedor 30 dias").
3. **Devedores +60 dias** — agrupado por cliente, com renegociação +10% (atual aba "Devedores 60 dias").
4. **Histórico de cobranças** — unificado, com filtro por faixa.

Cada aba mantém: busca por nome/CPF/descrição, filtros de período quando aplicável, ações já existentes (WhatsApp, Email, abrir ficha do cliente, sincronizar Asaas, marcar como pago) e badges coloridos por faixa (laranja 30, vermelho 60+).

### Cards de resumo (topo)

- Total de devedores únicos
- Valor em aberto até 30 dias
- Valor em aberto +30 dias
- Valor em aberto +60 dias (com acréscimo)

### Acabamento "premium"

- Hero com gradiente suave (tokens do design system) e ícone de alerta.
- Cards com hover, contagem animada e ícones temáticos.
- Tabs com indicador deslizante e contagem entre parênteses.
- Skeleton loaders durante o fetch.
- Estado vazio ilustrado por aba.
- Linhas com hover e ações em ícones com tooltip.

## Mudanças no Financeiro

- `Financeiro.tsx`: remover o botão **Devedores** do header (≈ linha 447). O acesso a tudo passa pelo card "Vencido", que continua navegando para `/admin/financeiro/vencidos`.

## Roteamento

- `/admin/financeiro/vencidos` continua sendo a rota principal.
- `/admin/devedores` vira **redirect** para `/admin/financeiro/vencidos` (compatibilidade com links antigos e sidebar).
- Atualizar `AdminLayout` / `MobileBottomNav` se houver link "Devedores" para apontar para a nova rota.

## Detalhes técnicos

- Reescrever `src/pages/admin/FinanceiroVencidos.tsx` como container com `Tabs`.
- Extrair conteúdo em componentes em `src/components/admin/financeiro/vencidos/`:
  - `Vencidos30DiasTab.tsx` (lógica atual de `FinanceiroVencidos`)
  - `Devedores30DiasTab.tsx` (extraído de `Devedores.tsx`)
  - `Devedores60DiasTab.tsx` (extraído de `Devedores.tsx`)
  - `HistoricoCobrancasTab.tsx` (unifica `historico_cobranca` + `negociacoes_devedores`)
- Reaproveitar `loadClientForSheet`, `ClientDetailSheet` (lazy) e edge functions já existentes (`list-debtors-30-grouped`, `sync-overdue-30`, `cobrar-fatura-vencida`, `asaas-debtors-api`).
- `Devedores.tsx` passa a renderizar `<Navigate to="/admin/financeiro/vencidos" replace />`.
- Sem mudanças de schema, RLS ou migrations.

## Fora de escopo

- Alterar lógica de juros/acréscimo.
- Novas integrações Asaas.
- Mudar templates de email/WhatsApp.
