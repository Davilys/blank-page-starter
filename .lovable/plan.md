# Reestruturação WebMarcas — Conversão Self-Service Premium

Objetivo: transformar `/registrar` em landing page mobile-first de altíssima conversão e modernizar a Home, mantendo cores/animações atuais como base, valores dos planos e linguagem honesta (sem promessa de aprovação).

## Escopo (3 frentes isoladas)

### 1. Sistema de design global (não-destrutivo)
Arquivo: `src/index.css` + `tailwind.config.ts` + `index.html`

- Importar fontes **Sora** (display) e **DM Sans** (body) via `<link>` no `index.html` com `preconnect` (manter Inter/Space Grotesk como fallback para não quebrar componentes existentes).
- Adicionar tokens CSS extras (sem remover os existentes) em `:root` e `.dark`:
  - Cores: `--wm-primary #0F2D6E`, `--wm-primary-light #1A4BA0`, `--wm-accent #FF6B00`, `--wm-accent-hover #E55C00`, `--wm-success #1DB954`, `--wm-danger #E53935`, `--wm-warning #F59E0B`, surfaces e textos pedidos.
  - Sombras: `--wm-shadow-sm/md/lg/glow`.
  - Radius extras: `--wm-radius-sm/md/lg/xl/full`.
  - Transitions: `--wm-trans-fast/base/slow`.
- Mapear `--wm-accent` para variável Tailwind extra (`accent-cta`) e `--wm-primary` (`brand`), expostas no `tailwind.config.ts`. Os tokens HSL atuais (`--primary`, `--accent` etc.) ficam intocados para não impactar Admin/Cliente.
- Utilities: `.glass-premium`, `.cta-glow`, `.font-display-wm`, `.font-body-wm` em `@layer components`.
- Garantir altura mínima de toque 48px nos botões mobile (classe utilitária `.touch-target` já existe — reforçar).

### 2. Barra de urgência + Header novo (somente Home e /registrar)
- Novo `src/components/layout/UrgencyBar.tsx`:
  - Fixo no topo (40px), bg `--wm-accent`, texto branco, fechável com persistência em `localStorage` (`wm_urgency_dismissed=1`).
  - Desktop: "⚡ Protocolo em até 48h · Processo 100% online · Mais de 5.000 marcas registradas".
  - Mobile: versão curta.
- Atualizar `src/components/layout/Header.tsx` para deslocar `top` quando a barra estiver ativa (CSS var `--urgency-h`).
- `/registrar`: criar **MinimalHeader** dentro de `src/pages/Registrar.tsx` (já tem header próprio) — manter logo + único CTA "Falar com especialista" reduzido + theme toggle. Sem nav, foco total no funil.

### 3. Hero conversor + nova landing `/registrar`

#### 3a. Home Hero (`src/components/sections/HeroSection.tsx`)
- Refinar copy mantendo i18n: headline "Verifique agora se sua marca está disponível no INPI" com palavra "disponível" destacada em `--wm-accent` + underline SVG decorativo.
- Subheadline: "Pesquise gratuitamente, proteja sua marca a partir de R$ X e receba o protocolo em até 48h — tudo online, sem burocracia." (puxa preço de `usePricing`).
- Mover `ViabilitySearchSection` (já existente) para dentro do hero como **caixa central de busca**, redesenhada:
  - Container glass branco, `radius-xl`, `shadow-lg`.
  - Campo grande "Digite o nome da sua marca…" (56px altura).
  - Dropdown segmento com 10 opções pedidas (já existe lógica similar — adaptar lista).
  - Botão CTA `--wm-accent` fullwidth no mobile: "🔍 Verificar disponibilidade".
  - Loading: spinner + "Consultando base INPI…".
  - Submit grava `viabilityData` no `sessionStorage` e redireciona para `/registrar?marca=&classe=` (já há leitura no `Registrar.tsx`).
- Coluna direita desktop: card flutuante demonstrativo "SABOR ÚNICO ✅ Disponível — Registrar R$ X" com float animation (no mobile fica oculto).
- Microprova social abaixo da busca.
- Reforçar honestidade: badge "Garantia de protocolo, não de aprovação" abaixo do CTA.
- Espaçamentos mobile mais generosos, headline `clamp()`.

#### 3b. Página `/registrar` (`src/pages/Registrar.tsx`)
Manter o fluxo de checkout existente (Viability → Personal → Brand → Plan → Payment → Contract — não tocar nos steps internos para não quebrar). Mudanças:

- Aplicar visual premium novo: background gradient sutil `#F4F6FB → #EEF2FF` (light) / atual (dark), padrão SVG sutil.
- Remover header genérico distrativo, usar MinimalHeader.
- **Acima do fold (Step 1, mobile)**:
  - Badge "🛡️ Plataforma oficial parceira INPI".
  - H1 forte: "Proteja sua marca antes que alguém registre primeiro".
  - Subheadline: "Consulta gratuita de viabilidade no INPI + Laudo técnico em minutos".
  - Trust signals em linha: "✅ +5.000 marcas · ⭐ 4.9/5 · 🔒 Pagamento seguro".
  - Card do `ViabilityStep` com novo CTA verde/dourado fullwidth altura 56px e loading "Consultando base oficial do INPI…".
- **Resultado da viabilidade**: já gera `result.level`. Reaproveitar `ViabilityStep` mas envolver com novo banner premium por cenário:
  - `high` → header verde, "Ótima notícia! '{marca}' está disponível", card de oferta com preço do plano essencial via `usePricing`, CTA "Registrar minha marca agora →".
  - `medium` → header amarelo, "Encontramos marcas similares", lista, CTA "Quero análise profissional".
  - `low`/`blocked` → header vermelho, "A marca já está registrada", CTAs "Falar com especialista" (WhatsApp) e "Pesquisar outro nome".
  - Mantém botão "Continuar para registro" para passar ao Step 2 (preserva fluxo atual).
- **Abaixo do fold em /registrar** (visível apenas no Step 1 para SEO/conversão de scrollers):
  - Seção Benefícios (cards com ícones).
  - Seção Planos: reusar `PricingSection` modo compacto (mantém valores via `usePricing`).
  - Seção Depoimentos curtos com foto: reusar `TestimonialsSection`.
  - FAQ otimizado: reusar `FAQSection` (5–6 perguntas).
  - CTA final: "Começar consulta gratuita" → scroll para topo.
  - Footer simplificado (sem nav grande): logo + links jurídicos + selo de segurança.
- Toggle dark/light mantido (já existe).
- Sticky CTA mobile: barra inferior fixa "Verificar minha marca" que rola para o formulário (somente Step 1, mobile).

### 4. Otimização de performance e mobile
- `loading="lazy"` + `decoding="async"` em todas as imagens das novas seções; usar `.webp` quando os assets já existirem (apenas trocar `src` se houver versão).
- `font-display: swap` nas novas fontes.
- Garantir `will-change` apenas em elementos animados do hero.
- Botões mínimos 48px (`min-h-[48px]`), font-size body ≥ 16px no mobile (evita zoom iOS).
- Reduzir blobs decorativos pesados em mobile via `hidden md:block`.

## Detalhes técnicos

```text
src/
  index.css                          (+ tokens WM, fontes, utilitários — não remove nada)
  index.html                         (preconnect + link Sora/DM Sans)
  tailwind.config.ts                 (extend.colors.brand/accent-cta, fontFamily wm)
  components/layout/
    UrgencyBar.tsx                   (NOVO)
    Header.tsx                       (offset urgency bar)
  components/sections/
    HeroSection.tsx                  (redesign + busca integrada + card flutuante)
    ViabilitySearchSection.tsx       (refino visual da caixa de busca)
  components/registrar/              (NOVO diretório)
    MinimalHeader.tsx
    HeroRegistrar.tsx                (badge + H1 + subheadline + trust)
    ViabilityResultBanner.tsx        (cenários A/B/C)
    BenefitsCompact.tsx
    StickyMobileCta.tsx
    FooterMinimal.tsx
  pages/
    Registrar.tsx                    (compor blocos novos; manter steps 2-6)
    Index.tsx                        (inserir <UrgencyBar/> no topo)
```

- **i18n**: novas strings em `src/contexts/LanguageContext.tsx` (pt/en/es) sem remover chaves antigas.
- **Roteamento**: nenhuma alteração em `App.tsx`.
- **Backend/RLS**: nenhuma alteração.
- **Risco**: zero impacto nas áreas Admin/Cliente — todos os tokens novos têm prefixo `--wm-` e classes próprias; o redesenho usa wrappers em vez de modificar componentes compartilhados.

## QA pós-implementação
1. `/` em mobile (375px): hero, busca funcional, CTA acessível, sem overflow.
2. `/registrar` em mobile (375px): hero acima do fold, CTA visível sem scroll, sticky CTA, banner de resultado correto para cada `level`.
3. `/registrar` em desktop: layout 2 colunas, card flutuante.
4. Toggle dark/light em ambas as páginas.
5. Fluxo completo Step 1 → Step 6 sem regressão.
6. Lighthouse mobile: LCP < 2,5s na home.

## Itens fora do escopo (ficam para depois se quiser)
- Modal full-screen separado para resultado (substituído pelo banner inline integrado ao Step 1, que mantém o fluxo atual sem refatoração de steps).
- Reescrita do `ViabilityStep` interno (apenas embrulhado/estilizado).
