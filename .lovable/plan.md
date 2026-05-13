# Sincronizar contrato do /registrar com o modelo da aba "Modelos de Contrato"

## Diagnóstico

O fluxo de assinatura em `/registrar` (checkout) **não usa** o modelo cadastrado em **Admin → Modelos de Contrato**. Ele carrega um texto fixo embutido no código.

Local exato do bug — `src/hooks/useContractTemplate.ts` (linhas 372–389):

```ts
if (plan === 'premium' || plan === 'corporativo' || plan === 'essencial') {
  const defaultTemplate = getDefaultTemplateForPlan(plan);
  setTemplate({ ...defaultTemplate, ... });   // <-- usa constante hardcoded
  return;                                     // <-- nunca consulta o banco
}
```

Esse `return` antecipado pula a consulta a `contract_templates`. Resultado:

- Aba "Modelos de Contrato" edita a tabela `contract_templates` (já existem os 3 modelos: Padrão, Premium, Corporativo — confirmado no banco).
- `/registrar` ignora essas edições e mostra/assina sempre o texto das constantes `DEFAULT_CONTRACT_TEMPLATE`, `PREMIUM_CONTRACT_TEMPLATE`, `CORPORATE_CONTRACT_TEMPLATE`.
- O contrato visualizado pelo cliente e o PDF assinado ficam diferentes do modelo padrão exibido no admin.

A pré-visualização no `ContractStep` e o HTML enviado para assinatura (`generateContractPrintHTML`) usam a mesma fonte (`template.content`), então corrigir a origem do template resolve as duas pontas (visualização e assinado).

## Correção proposta

Em `src/hooks/useContractTemplate.ts`, função `fetchTemplate`:

1. Remover o atalho que retorna direto a constante para planos `essencial | premium | corporativo`.
2. Sempre tentar primeiro buscar no banco pelo nome exato do template do plano:
   - `essencial` → "Contrato Padrão - Registro de Marca INPI"
   - `premium` → "Contrato Premium - Registro de Marca INPI"
   - `corporativo` → "Contrato Corporativo - Registro de Marca INPI"
   - usar `.eq('name', ...).eq('is_active', true).maybeSingle()` (match exato, sem `ilike` ambíguo).
3. Se encontrar → usar o conteúdo do banco.
4. Se não encontrar (ou erro) → fallback para a constante embutida (mantém robustez offline).
5. Manter a lógica de `replaceContractVariables` intacta — os modelos do banco já usam as mesmas variáveis `{{...}}`.

## Verificação

1. Editar o "Contrato Padrão - Registro de Marca INPI" em Admin → Modelos (ex.: adicionar um marcador único na cláusula 1.1).
2. Abrir `/registrar`, escolher plano Essencial, ir até a etapa Contrato.
3. Confirmar que a pré-visualização exibe o marcador.
4. "Baixar PDF" e confirmar que o PDF tem o marcador.
5. Concluir assinatura e abrir o PDF assinado salvo em `documents` — deve conter o marcador.
6. Repetir rápido para Premium e Corporativo.

## Arquivos afetados

- `src/hooks/useContractTemplate.ts` (única alteração de código)
