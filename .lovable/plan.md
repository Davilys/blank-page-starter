
# Corrigir seletor de plano: por cadastro, não global

## O que está errado hoje

O seletor de plano (Essencial / Premium / Corporativo) foi colocado como um "plano global" no topo da aba Premiação e em Configurações, definindo um único plano para toda a contagem. **Isso não é o que você quer.**

## O que será feito

O plano passa a ser uma propriedade **de cada cadastro individual** de Registro de Marca. No diálogo "Novo Cadastro" (e "Editar Registro"), quando o tipo for **Registro de Marca**, aparece primeiro o seletor de Plano e, em seguida, a Forma de Pagamento — cuja lista muda conforme o plano escolhido.

### Fluxo no diálogo "Novo Cadastro" → Registro de Marca

```
TIPO *                  [ Registro de Marca ▾ ]
NOME DO CLIENTE *       [ ... ]
NOME DA MARCA *         [ ... ]
QTD MARCAS *  [ 1 ]     DATA PGTO *  [ __/__/____ ]

PLANO *                 [ Plano Essencial ▾ ]   ← NOVO, vem antes
                          • Plano Essencial
                          • Plano Premium
                          • Plano Corporativo

FORMA DE PAGAMENTO *    [ ... ▾ ]                ← opções dependem do plano
```

### Opções de "Forma de Pagamento" por plano

- **Essencial** (mantém o atual):
  - À Vista — R$ 699,99
  - Parcelado — R$ 1.194,00
  - Promoção — Valor Personalizado
- **Premium**:
  - Boleto — R$ 398,00/mês
  - Cartão — R$ 398,00/mês
- **Corporativo**:
  - Boleto — R$ 1.621,00/mês
  - Cartão — R$ 1.621,00/mês

### Cálculo da premiação por entrada

`calcRegistroMarcaPremium` passa a olhar o campo `plan` de **cada entrada** (não mais um plano global):

- Entrada com `plan = 'essencial'` → mantém regra atual (R$ 50/marca; após meta de 30: R$ 100 à vista / R$ 50 parcelado).
- Entrada com `plan = 'premium'` → R$ 100 fixos por marca, sempre (também conta na meta de 30, mas o valor não muda após a meta).
- Entrada com `plan = 'corporativo'` → R$ 200 fixos por marca, sempre.

A meta única de 30 marcas continua sendo a mesma; ela soma todas as marcas independentemente do plano.

### Remover o seletor "global"

- Remover do topo da página `/admin/premiacao` o card "PLANO DE PREMIAÇÃO ATIVO" e o `<Select>` de plano global.
- Remover de **Configurações → Premiação** a seção "Plano de Premiação" que escolhia um plano único. Em seu lugar, deixar apenas os parâmetros editáveis de cada plano (valor por marca, mensalidade) caso o Master Admin queira alterar os defaults — sem `plan` ativo.

### Persistência

A tabela `award_entries` já tem coluna livre? Vou usar uma nova coluna `plan` (text). Como o projeto é Lovable Cloud / Supabase, será necessário criar uma **migration** adicionando `plan text not null default 'essencial'` em `award_entries`. Entradas antigas ficam automaticamente como `essencial` (preservando os cálculos existentes).

O campo `payment_type` continua existindo e passa a aceitar também `'boleto'` e `'cartao'` (são apenas strings; o cálculo do Premium/Corporativo ignora esse campo de qualquer forma).

## Detalhes técnicos

**Arquivos a alterar:**
- `src/pages/admin/Premiacao.tsx`
  - Adicionar estado `formPlan` no formulário do diálogo.
  - Renderizar `<Select>` de Plano dentro do bloco `formType === 'registro_marca'`, **antes** do Select de Forma de Pagamento.
  - Tornar as opções do Select "Forma de Pagamento" dependentes de `formPlan`.
  - Resetar `formPaymentType` quando `formPlan` muda (para evitar valor inválido).
  - Passar `formPlan` no `insert`/`update` do `award_entries`.
  - Refatorar `calcRegistroMarcaPremium(entries, cfg)` para iterar e aplicar a regra conforme `entry.plan` de cada entrada.
  - Remover o card "PLANO DE PREMIAÇÃO ATIVO", o `<Select>` global e a `savePlanMutation`.
  - Exibir badge do plano na lista de entradas (Essencial/Premium/Corporativo) ao lado do badge de Forma de Pagamento.
- `src/components/admin/settings/AwardSettings.tsx`
  - Remover o seletor de "plano ativo".
  - Manter apenas os blocos de parâmetros (`rate_per_brand`, `monthly_price`) caso o Master Admin queira editar os defaults usados como referência informativa. (Opcional — se preferir, removo a seção inteira; me avise.)
- `src/integrations/supabase/types.ts` — atualizado automaticamente após a migration.

**Migration necessária:**
```sql
alter table public.award_entries
  add column if not exists plan text not null default 'essencial'
  check (plan in ('essencial','premium','corporativo'));
```

## Fora de escopo

- Cobrança real das mensalidades de Premium/Corporativo via Asaas.
- Histórico de mudança de plano por cliente.
