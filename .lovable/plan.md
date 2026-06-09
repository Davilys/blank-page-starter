## Atualizar salário mínimo padrão para 2026

Em `src/components/admin/clients/ServiceActionPanel.tsx` (linha 37):

```ts
const SALARIO_MINIMO_2025 = 1518;
```

Será alterado para:

```ts
const SALARIO_MINIMO_2026 = 1621;
```

Todas as referências à constante na cobrança padrão serão atualizadas para o novo nome, fazendo com que o valor pré-configurado no painel de cobrança passe de R$ 1.518 para R$ 1.621.

Nenhuma outra lógica é alterada.