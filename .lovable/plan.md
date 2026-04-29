## Objetivo

Adicionar um botão **Ativar/Desativar bonificação** em cada card de "Bônus de Milestone" (Publicações e Cobranças) na aba **Configurações → Premiação**, e fazer com que o estado do botão realmente afete a contagem de bônus na aba **Premiação**.

## Estado atual

- `AwardSettings.tsx` já tem um toggle global `enabled` no topo, mas **não** existe um toggle específico para a bonificação de milestone (o card laranja "Bônus de Milestone" mostrado no print).
- `Premiacao.tsx` calcula sempre `bonus = milestones * milestone_bonus` sem checar se a bonificação está ativa — ou seja, hoje desativar não tem efeito real, só se o usuário zerar o valor manualmente.

## Mudanças

### 1. `src/components/admin/settings/AwardSettings.tsx`
- Adicionar campo `milestone_enabled: boolean` (default `true`) nas interfaces e DEFAULT_CONFIG, dentro de `publicacao` e `cobranca`.
- No card "Bônus de Milestone" da seção **Publicações**: adicionar `<Switch>` no header com label "Ativada"/"Desativada". Quando desativado, escurecer (opacity) os inputs `A cada` e `Bônus`, mantendo-os desabilitados.
- Mesma coisa no card "Bônus de Milestone" da seção **Cobranças**.
- Salvar normalmente (já é serializado em `system_settings.award_config`).

### 2. `src/pages/admin/Premiacao.tsx`
- Adicionar `milestone_enabled: boolean` nas interfaces `AwardConfig.publicacao` e `AwardConfig.cobranca` + DEFAULT_CONFIG (default `true` para compatibilidade com configs antigas).
- Em `calcPublicacaoMilestoneBonus`: se `cfg.milestone_enabled === false`, retornar `{ bonus: 0, milestones: 0, nextAt: cfg.milestone_interval }`.
- Em `calcCobrancaMilestoneBonus`: mesma lógica.
- No JSX dos dois cards de exibição de milestone (publicação/cobrança): quando desativado, mostrar badge "Desativada" e zerar o display do bônus, sem quebrar layout.

### 3. Comportamento garantido
- Ao desativar e salvar: na próxima carga/refresh da página Premiação, o card de milestone mostrará R$ 0,00 e o `totalMilestoneBonus` global e o `premium` por usuário não somarão mais o bônus.
- Ao reativar: volta a contar normalmente, sem perder os valores configurados de intervalo e bônus.

## Arquivos modificados

- `src/components/admin/settings/AwardSettings.tsx`
- `src/pages/admin/Premiacao.tsx`

Nenhuma migração de banco — usa o JSON existente em `system_settings.award_config`. Configs antigas sem o flag continuam funcionando como "ativada" por padrão.
