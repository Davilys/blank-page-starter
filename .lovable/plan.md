## Adicionar Plano do Cliente ao CRM

Hoje o card do cliente mostra só o valor (R$ 699). Você quer mostrar **qual plano** o cliente assinou (Essencial, Premium ou Corporativo) e poder selecionar/alterar o plano na edição de valor, com a forma de pagamento aparecendo só **depois** de escolher o plano.

### O que será feito

#### 1. Banco de dados — coluna `plan_type` em `contracts`
Migração nova adicionando:
- `contracts.plan_type TEXT CHECK (plan_type IN ('essencial','premium','corporativo'))` (nullable).
- Backfill automático nos contratos existentes baseado no `payment_method`/`contract_value`:
  - `payment_method = 'avista'` ou valor entre R$ 600–800 → `essencial`
  - valor mensal recorrente ~R$ 398 → `premium`
  - valor mensal recorrente ~R$ 1.621 → `corporativo`
  - resto (exigência, personalizado) → fica `null`

#### 2. Card do Kanban (`ClientKanbanBoard.tsx`)
- Adicionar campo `plan_type` em `ClientWithProcess`.
- Na query de `Clientes.tsx`, trazer `plan_type` do contrato mais recente (ou via join `contracts`).
- Renderizar **badge colorido do plano** ao lado do valor:
  - Essencial → azul (`Shield`)
  - Premium → roxo/primário (`Crown`) — destaque "Mais popular"
  - Corporativo → âmbar (`Infinity`)
- Quando não houver plano definido, não mostra badge (mantém visual atual).

#### 3. Diálogo "Selecionar Valor" (`ClientDetailSheet.tsx`)
Reformular o fluxo em **2 etapas dentro do mesmo modal**:

```text
Etapa 1 — Plano                      Etapa 2 — Forma de pagamento
┌──────────────────────────┐        ┌──────────────────────────┐
│ ◉ Plano Essencial        │        │ Plano selecionado: Premium│
│   R$ 698,97 à vista       │   →    │ ◉ À vista PIX  R$ 398/mês │
│ ○ Plano Premium          │        │ ○ Cartão 6x               │
│   R$ 398/mês recorrente  │        │ ○ Boleto recorrente       │
│ ○ Plano Corporativo      │        │ ○ Valor Personalizado     │
│   R$ 1.621/mês recorrente│        └──────────────────────────┘
└──────────────────────────┘                 [Voltar] [Confirmar]
```

- Etapa 1: cards de plano (mesma estética de `PlanSelectionStep.tsx`).
- Etapa 2: opções de pagamento filtradas pelo plano escolhido + opção "Valor Personalizado" + opção legacy "Exigência/Publicação".
- Botão "Confirmar" salva no banco: `contract_value`, `payment_method` e `plan_type` no contrato mais recente do cliente (ou cria registro mínimo se não houver contrato).
- Após salvar, o `onUpdate()` recarrega os clientes e o badge do plano aparece automaticamente no card do Kanban.

#### 4. Persistência
- `handleSaveQuickChanges` passa a atualizar também `contracts.plan_type` (último contrato `signed`/mais recente do `user_id`). Se o cliente não tem contrato ainda, salva `plan_type` em `profiles.metadata` (jsonb) como fallback temporário até existir contrato.
- Log de mudança (`activity_logs`) registra "Plano alterado: X → Y".

### Arquivos alterados

- `supabase/migrations/<novo>.sql` — coluna + backfill
- `src/integrations/supabase/types.ts` — regenerado automaticamente após migração
- `src/components/admin/clients/ClientKanbanBoard.tsx` — interface + badge no card
- `src/components/admin/clients/ClientDetailSheet.tsx` — diálogo em 2 etapas + persistência
- `src/pages/admin/Clientes.tsx` — incluir `plan_type` na query de clientes

### Resultado visual

No card do Kanban, abaixo do valor, aparecerá uma linha extra:
```text
$ R$ 699          [👑 Premium]
```
Cor e ícone variando por plano. Ao editar o valor pelo lápis no detalhe do cliente, primeiro escolhe o plano, depois a forma de pagamento, salva, e o badge aparece imediatamente no card.
