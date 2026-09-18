# Ajustar tamanho e organização do resultado da busca de viabilidade

## O que entendi
Hoje o bloco de resultado da busca de viabilidade (no site) está grande demais e "esticado": o card de status é muito alto, os três cards de resumo têm muito espaço vazio vertical, e os valores dentro deles estão desproporcionalmente grandes. Você quer:

1. **Reduzir ~30% do tamanho geral** (status card + cards de resumo) para o site não ficar esticado — sem ficar microscópico, só mais compacto.
2. **Ajustar o texto do cabeçalho** "Nenhuma ocorrência relevante encontrada" + badge "Base oficial INPI", deixando mais organizado (badge alinhada ao título, não solta abaixo).
3. **Diminuir dentro dos quadrados** (cards de resumo) também, na mesma proporção.

Não alterar lógica, API, dados, buscas, PDF, botões funcionais nem fluxo de registro — só UI/UX e tamanhos.

## Alterações (arquivo único: `src/modules/trademark-search/components/SearchResult.tsx`)

### Card de status (linhas ~130–154)
- Padding: `p-5 sm:p-6` → `p-4 sm:p-5`
- Ícone circular: `h-14 w-14` → `h-11 w-11`; ícone interno `h-8 w-8` → `h-6 w-6`
- Título: `text-xl sm:text-2xl` → `text-base sm:text-lg`
- Badge "Base oficial INPI": passar de bloco abaixo do título (`mt-2`) para **inline ao lado do título** (mesma linha, `mt-0`), deixando o cabeçalho mais organizado e compacto
- Texto de corpo: `text-base font-semibold` → `text-sm font-semibold`; `text-sm` → `text-[13px]`
- Espaçamento interno: `mt-4` → `mt-3`, `space-y-2` → `space-y-1.5`, `sm:ml-[4.5rem]` → `sm:ml-[3.25rem]`

### Cards de resumo (linhas ~157–181)
- Padding: `p-3.5` → `p-2.5`
- Ícone: `h-10 w-10` → `h-9 w-9`; interno `h-5 w-5` → `h-4 w-4`
- Valor principal (ex.: "0"): `text-xl font-black` → `text-base font-black`
- Rótulos: manter `text-[11px]` (já pequeno)
- Gap entre ícone e texto: `gap-3` → `gap-2.5`
- Espaço interno entre linhas: `mt-1` → `mt-0.5`, `mt-2` → `mt-1`

### Demais seções
- "Resumo da análise" título `text-2xl` → `text-xl`; accordion `min-h-20` → `min-h-16`
- "Rastreabilidade" e CTA: manter (já compactos); apenas reduz `min-h-14` dos botões? **Não** — manter área de toque dos CTAs (regra de acessibilidade).

## Verificação
- Typecheck/build.
- Prévia mobile (360–430px) e desktop: confirmar redução ~30%, sem texto cortado, sem overflow, badge alinhada ao título, cards de resumo mais compactos.
- Confirmar que nenhum dado/funcionalidade foi alterado.
