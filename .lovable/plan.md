# Painel Executivo WebMarcas — auditoria e reconstrução (somente Dashboard)

Escopo: rota `/admin/dashboard` e os arquivos usados exclusivamente por ela (`src/pages/admin/Dashboard.tsx` e `src/components/admin/dashboard/*`). Nenhum outro módulo, rota, tabela, migração ou componente compartilhado será alterado.

## O que a auditoria encontrou

Consultei o banco antes de planejar. Situação real hoje:

- **91 leads no total**, todos com origem "site" (uma única origem), 24 marcados como convertidos, 23 com cliente vinculado.
- **3.123 clientes** — a maioria criada em abril/2026 por importação, sem qualquer lead de origem. Por isso o funil atual (3.123 clientes ÷ 91 leads = 3.431,9%) não tem sentido: são universos diferentes.
- **26 contratos de 3.661** têm lead vinculado.
- Último lead recebido em **agosto/2026** — em setembro não há leads, então o período atual precisa de estado vazio honesto.
- **2.385 processos sem ramo informado**, **612 clientes sem estado** — isso é qualidade de dado, não resultado.
- Processos: só 27 com data de concessão e 41 com data de depósito, contra ~3.000 registros. As taxas de deferimento/tempo médio que hoje aparecem como "0%" na verdade são falta de dados.
- Faturas: 193 recebidas, 137 pendentes, 172 vencidas, 356 canceladas, 1 confirmada.
- Os blocos Inteligência Preditiva e Motor de Monetização já leem funções do banco, mas exibem zeros quando não há base.

Componentes com números acumulados que ignoram o período selecionado: Funil, Origem dos Leads, Ramos de Atividade, Distribuição Geográfica, Evolução da Receita.

## O que será feito

### 1. Filtro de período único
O período escolhido no topo (Hoje | Esta semana | Este mês | Mês passado | Este ano | Personalizado) passa a valer para **todos** os blocos de fluxo. Adiciono a opção "Personalizado" com calendário. A Inteligência Executiva continua acumulada, mas rotulada "Visão geral — acumulado".

### 2. Funil por coorte real
O funil passa a usar apenas os leads criados dentro do período e o que aconteceu com eles:

```text
Leads do período           91
  -> Convertidos em cliente 23   (leads com cliente vinculado)
  -> Com contrato            X   (contratos ligados àqueles leads)
  -> Concluídos              X   (processos desses clientes já registrados)
```

Cada etapa mostra a própria taxa. Se o período não tiver leads, aparece "Sem leads neste período" em vez de percentual. Nada de estimativa por proporção.

### 3. Comparações honestas
Variação = (atual − anterior) ÷ anterior. Quando o período anterior é zero: "Novo". Sem base: "Sem dados". Nunca +8723%.

### 4. Zero x ausência de dados
Taxa de deferimento, taxa de recurso e tempo médio de protocolo passam a mostrar "—" com a explicação ("apenas 27 processos com decisão registrada") quando a amostra é insuficiente. Preditivo e Monetização ganham estado "aguardando volume mínimo" em vez de fileiras de zeros.

### 5. Receita com nomes corretos
- **Receita do período** — o que foi efetivamente recebido.
- **Receita em carteira** — contratos assinados ainda a receber (hoje chamada "projetada").
- **Receita pendente** — cobranças em aberto/vencidas.

O gráfico de evolução separa receita (eixo esquerdo, R$) de leads e clientes (eixo direito, quantidade), com tooltip e mês zerado mostrado como zero.

### 6. Origem, ramo e geografia
Como só existe uma origem hoje, o bloco vira um ranking com quantidade, percentual e conversão por origem, exibindo "Origem não informada" quando for o caso. Ramo e estado ganham ranking e, quando o vazio é dominante, um aviso do tipo "78% dos processos não têm ramo informado — oportunidade de melhoria de cadastro".

### 7. Qualidade dos dados e alertas
Novo bloco "Qualidade dos dados" (completude de origem, ramo, estado, telefone) e "Atenção executiva" com alertas gerados só quando a condição existe de fato (faturas pendentes altas, queda de conversão, cadastro incompleto, receita acima do mês anterior).

### 8. Atividade recente
Ordenação real por data/hora, exibição de horário, clique só quando existe destino válido, estado vazio próprio.

### 9. Apresentação
Mantenho a identidade atual, reduzindo poluição: menos gradientes decorativos, hierarquia clara, esqueleto de carregamento, estados de erro e vazio em todos os blocos, tooltips explicando cada métrica, e grade que reorganiza para 1 coluna no celular sem estouro horizontal.

## Detalhes técnicos

- Novo `src/pages/admin/dashboard/` interno? Não: mantenho `src/pages/admin/Dashboard.tsx` como página e crio módulos locais em `src/components/admin/dashboard/`:
  - `lib/period.ts` — `PeriodKey`, `getRange()` (inclui `custom`), rótulos.
  - `lib/metrics.ts` — funções puras de agregação/derivação (fluxo, posição, variação, conversão, qualidade de dados, alertas) recebendo linhas já buscadas.
  - `hooks/useDashboardData.ts` — um único carregamento paralelo com React Query (`staleTime` curto), compartilhado por todos os blocos; elimina as consultas duplicadas que hoje cada gráfico faz por conta própria.
  - `DashboardPeriodContext` local à página, para não criar filtro global.
- Funil: consulta `leads` do período (`id, status, converted_to_client_id, converted_at, origin, created_at`), depois `contracts.lead_id in (...)` e `brand_processes.user_id in (clientes convertidos)` — em lotes de 200 ids.
- Métricas com `count: 'exact', head: true` sempre que só o número importa; faturas agregadas por `payment_date` com fallback `created_at`; status pagos = `paid|received|confirmed`.
- Tipo de resultado por bloco: `{ status: 'loading' | 'ready' | 'empty' | 'error', data }`, para que loading/empty/error existam sem lógica no JSX.
- `PredictiveIntelligenceSection`, `MonetizationEngineSection` e `CEOIntelligenceSection` continuam usando as RPCs existentes (`calculate_predictive_score`, `get_class_ranking`, `get_annual_evolution`) — só muda a apresentação e os limiares de amostra mínima; nenhuma função do banco é alterada.
- Sem migrações, sem alteração de RLS, sem escrita no banco. O painel só lê.
- Ao final: lint, typecheck, build e verificação visual em desktop, tablet e celular.
