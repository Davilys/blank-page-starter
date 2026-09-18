# Afastar a ficha do cliente da borda direita do CRM

## O que entendi
Hoje o **ClientDetailSheet** (ficha do cliente) abre colado na borda direita da tela — sem nenhum respiro lateral, topo ou rodapé. Você quer puxá-lo para dentro (~32px), criando uma margem entre a ficha e a borda direita, para que não fique "escondido/colado" no canto. Apenas ajuste de posicionamento visual — sem mexer em conteúdo, abas, lógica, dados, nem em outros componentes/sheets do app.

## Alteração
Arquivo único: `src/components/admin/clients/ClientDetailSheet.tsx`

Linha 1387 — `<SheetContent className="w-full sm:max-w-2xl p-0 overflow-hidden flex flex-col">`

Trocar por uma classe que afasta a ficha ~32px das bordas direita, topo e rodapé (efeito painel flutuante), mantendo largura e comportamento atuais:

```tsx
<SheetContent className="w-full sm:max-w-2xl p-0 overflow-hidden flex flex-col !right-8 !top-8 !bottom-8 rounded-2xl">
```

- `!right-8 !top-8 !bottom-8` — sobrepõe `right-0 inset-y-0` do variant padrão do Sheet (`src/components/ui/sheet.tsx`), criando a margem de 32px nos três lados.
- `rounded-2xl` — cantos arredondados combinam com o efeito flutuante.
- Largura (`sm:max-w-2xl`), `w-full` no mobile, `p-0`, `overflow-hidden` e `flex flex-col` permanecem iguais.
- Não toca no `SheetContent` compartilhado em `sheet.tsx` — só nesta instância da ficha do cliente. Outros sheets do app continuam colados como antes.

## Verificação
- Abrir a ficha de um cliente no CRM e confirmar o respiro de ~32px na direita/topo/rodapé.
- Checar mobile (360–430px): a ficha continua em largura cheia (`w-full`), sem o afastamento lateral (já que `!right-8` só aparece a partir de `sm`). Confirmar que `!top-8 !bottom-8` não causa problemas no mobile — se cortar conteúdo, restringir o afastamento de topo/rodapé também ao breakpoint `sm`.
- Typecheck/build para garantir nada quebrou.
