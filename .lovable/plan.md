# Desativar Bônus por Milestone por padrão

## Situação atual
- O toggle `milestone_enabled` **já existe** em Configurações › Premiação (`AwardSettings.tsx`), separado para Publicações e Cobranças.
- O cálculo em `Premiacao.tsx` (`calcPublicacaoMilestoneBonus` / `calcCobrancaMilestoneBonus`) **já respeita** `milestone_enabled === false` e retorna bônus zero.
- **Problema:** o valor padrão de `milestone_enabled` é `true`, então o bônus aparece e soma sozinho na aba Premiação mesmo sem o admin ter ativado nada. E o card "Bônus por Milestone — A cada 10 resolvidas" continua visível (apenas esmaecido) quando desligado.

## Mudanças

### 1. `src/components/admin/settings/AwardSettings.tsx`
- Trocar defaults `milestone_enabled: true` → `false` (Premium e Corporativo).
- Manter toggle visual já existente (sem alterações de UI).

### 2. `src/pages/admin/Premiacao.tsx`
- Trocar defaults `milestone_enabled: true` → `false` nas configurações default (`publicacao` e `cobranca`).
- Na renderização do bloco "Bônus por Milestone — A cada 10 resolvidas" (linhas ~1066–1180): só renderizar o card de Publicações se `cfg.publicacao.milestone_enabled`, e o de Cobranças se `cfg.cobranca.milestone_enabled`. Se ambos estiverem desativados, **não exibir** a seção inteira.
- O cálculo já zera quando desativado, então `totalMilestoneBonus`, ranking e totais já ficam corretos sem mais mudanças.

### 3. Migração de dados existentes
- Como a configuração fica em `system_settings` (JSON), contas já salvas continuarão com `milestone_enabled: true`. Aplicar migração leve para virar `false` em registros existentes (UPDATE no JSON da chave `awards`/equivalente). Vou confirmar a chave exata antes de gerar a migração.

## Resultado
- Por padrão o Bônus por Milestone fica **desligado**.
- O card só aparece e o bônus só é somado quando o admin ativa em **Configurações › Premiação** (toggle por plano, Publicações e/ou Cobranças).
