# Premiação passa a obedecer as Configurações

## Causa encontrada
O cálculo do valor em R$ já lê o que você salva em Configurações > Premiação. Mas as **metas e textos que aparecem na tela** estão fixos no código:
- Cards "Faltam X": meta fixa em 30 (marcas) e 50 (publicações).
- Barras de progresso: alvo fixo em 30 / 50 / 20.
- Textos explicativos ("Antes da meta: R$ 50", "Até 49: R$ 50", "50 ou mais: R$ 100") e as dicas do diálogo "Novo Cadastro" ("meta de 30", "R$ 100/marca", "R$ 200/marca") também fixos.
- Além disso, a tela guarda as configurações por 5 minutos, então mesmo o cálculo pode demorar a refletir uma alteração.

## O que vou corrigir (só na Premiação)
1. Cards de resumo e barras de progresso passam a usar a meta salva (Registro de Marca e Publicação) — ex.: meta 50 mostra "Faltam 48".
2. Textos explicativos mostram os valores reais configurados (valor base, valor após a meta, à vista/parcelado, faixas de cobrança).
3. Diálogo "Novo Cadastro": valores dos planos Premium/Corporativo e a meta vêm das Configurações.
4. Ao salvar em Configurações, a Premiação recarrega na hora; ao abrir a Premiação, sempre busca a versão mais recente.

Não muda nada em banco, regras de cálculo, lançamentos já feitos nem outras abas.

## Detalhes técnicos
- `src/pages/admin/Premiacao.tsx`: substituir `30`/`50` por `cfg.registro_marca.monthly_goal` / `cfg.publicacao.monthly_goal`; `GoalCard` recebe textos a partir de `cfg`; cobrança usa meta de marcos (`cfg.cobranca`) ou mantém 20 se não houver campo; `staleTime` → 0 com `refetchOnMount: 'always'`; merge profundo de `DEFAULT_CONFIG` com o valor salvo (evita perder subcampos).
- `src/components/admin/settings/AwardSettings.tsx`: após salvar, `queryClient.invalidateQueries({ queryKey: ['award-config'] })`.
- Verificação: typecheck.
