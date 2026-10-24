# /registrar: tirar o menu de cima só no celular

## O que entendi
- A mudança vale só para a página /registrar.
- No celular, o menu azul de cima some (logo, botão de menu).
- O conteúdo sobe o máximo possível, ficando alinhado logo no topo da tela.
- No computador (desktop) nada muda: o menu continua igual e o espaçamento fica como está.
- As outras páginas continuam com o menu normal.

## Detalhes técnicos
- `src/pages/Registrar.tsx`: envolver `<Header />` em `<div className="hidden md:block">`.
- Trocar o espaço do topo do `<main>` de `pt-28 md:pt-36` para `pt-4 md:pt-36` (só o celular fica com espaço mínimo).
- O componente `Header.tsx` não é alterado.
- Conferir em 360/375/390/430px e em desktop 1280px.
