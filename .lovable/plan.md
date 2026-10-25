# Página de consulta: novo endereço /consultar e novo título

## O que muda
- **Endereço:** a página passa a abrir em **/consultar**. Quem acessar o endereço antigo /registrar (links do Instagram, anúncios, botões antigos) é levado automaticamente para /consultar, então nenhum link quebra.
- **Título do topo:** de "Apenas 5 minutos. Registre sua marca!" para **"Apenas 1 minuto. Consulte sua marca grátis!"** (o sublinhado laranja fica embaixo de "Consulte").
- Todos os botões do site que levavam para /registrar passam a apontar para /consultar.
- O resto da página (busca, etapas, planos, pagamento, contrato) continua igual.

## Detalhes técnicos
- `App.tsx`: rota `/consultar` com `<Registrar />`; `/registrar` e `/registro` viram `<Navigate to="/consultar" replace />` (preservando o `state` de continueSearch via componente que repassa `location.state`).
- Atualizar `navigate("/registrar")`/links em HeroSection, ViabilitySearchSection, Obrigado, StatusPedido, HomeSections, Header (item de menu e `isHomePage`).
- `Registrar.tsx` linhas ~270: trocar textos do h1.
- `public/llms.txt` e sitemap: trocar /registrar por /consultar.
