# Plano: Seletor de Plano de Premiação (Essencial / Premium / Corporativo)

## Objetivo

Adicionar na aba **Premiação** (`/admin/premiacao`) e em **Configurações → Premiação** um seletor de plano que define como a premiação de **Registro de Marca** é calculada. A premiação por Publicação e Cobrança continua igual nos três planos.

## Regras de cada plano

| Plano | Valor por marca | Meta mensal | Comportamento após a meta | Forma de pagamento (do plano em si) |
|---|---|---|---|---|
| **Essencial** | Mantém a regra atual (R$ 50 base; após meta: R$ 100 à vista / R$ 50 parcelado) | 30 | Igual ao atual | — (sistema vigente) |
| **Premium** | **R$ 100 fixo por marca** | 30 (continua contando após meta) | Continua **R$ 100** por marca acima da meta | Boleto ou Cartão — **R$ 398,00 mensal** |
| **Corporativo** | **R$ 200 fixo por marca** | 30 (continua contando após meta) | Continua **R$ 200** por marca acima da meta | Boleto ou Cartão — **R$ 1.621,00 mensal** |

Observações:
- Premium e Corporativo ignoram o campo "à vista vs parcelado" da entrada — o valor é sempre fixo.
- A meta de 30 continua existindo apenas como referência visual de progresso (a contagem segue, mas o valor unitário não muda).
- Publicações e Cobranças permanecem inalteradas independentemente do plano selecionado.

## Mudanças

### 1. Tipo `AwardConfig` (em `Premiacao.tsx` e `AwardSettings.tsx`)

Adicionar:
```ts
plan: 'essencial' | 'premium' | 'corporativo';   // plano ativo
plan_payment_method?: 'boleto' | 'cartao';       // forma de pagamento do plano (Premium/Corporativo)
plans: {
  essencial: { /* mantém estrutura atual de registro_marca */ },
  premium:   { rate_per_brand: 100, monthly_goal: 30, monthly_price: 398 },
  corporativo:{ rate_per_brand: 200, monthly_goal: 30, monthly_price: 1621 },
}
```
`DEFAULT_CONFIG.plan = 'essencial'`. Persistido na mesma chave `system_settings.award_config`, mantendo retrocompatibilidade (se o campo `plan` não existir, assume `'essencial'`).

### 2. Cálculo `calcRegistroMarcaPremium`

Adaptar para receber também o plano:
- Se `plan === 'essencial'` → comportamento atual (já implementado).
- Se `plan === 'premium'` → `total = totalMarcas * 100`.
- Se `plan === 'corporativo'` → `total = totalMarcas * 200`.

A meta de 30 continua sendo usada apenas para exibir progresso na UI.

### 3. UI — `src/pages/admin/Premiacao.tsx`

No topo (próximo aos filtros de período/usuário) adicionar um **Select de Plano** com 3 opções (Essencial / Premium / Corporativo). Trocar o plano:
- Atualiza `system_settings.award_config.plan` (apenas Master Admin pode trocar; demais visualizam read-only).
- Recalcula imediatamente os totais via `useQuery` invalidate.

Card de resumo do plano vigente mostrando: nome do plano, valor por marca, meta, e (se Premium/Corporativo) preço mensal + forma de pagamento.

### 4. UI — `src/components/admin/settings/AwardSettings.tsx`

Nova seção **"Plano de Premiação"** acima do bloco "Registro de Marca":
- Select com Essencial / Premium / Corporativo.
- Quando Premium ou Corporativo selecionado:
  - Mostrar campos: `rate_per_brand`, `monthly_goal`, `monthly_price`, e radio `plan_payment_method` (Boleto / Cartão).
  - Esconder ou desabilitar a seção "Registro de Marca" antiga (regras de à vista / parcelado / acima da meta) já que não se aplicam.
- Quando Essencial: comportamento atual permanece visível e editável.

Salvar tudo no mesmo `system_settings.award_config` (botão Salvar já existente).

### 5. Persistência

Não requer migration — `system_settings.value` é JSONB. Apenas adicionar novos campos ao objeto serializado.

## Arquivos a modificar

- `src/pages/admin/Premiacao.tsx` — tipo, DEFAULT_CONFIG, cálculo, UI do seletor, card de resumo.
- `src/components/admin/settings/AwardSettings.tsx` — tipo, DEFAULT_CONFIG, nova seção "Plano de Premiação", lógica condicional dos campos.

## Fora de escopo

- Cobrança real do plano (R$ 398 / R$ 1.621) via Asaas — apenas exibição informativa.
- Histórico de troca de plano (pode ser adicionado depois se necessário).
