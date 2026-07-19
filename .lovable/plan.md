# Rebrand visual — Landing Pública WebMarcas

## Referência visual (como vai ficar)

<presentation-artifact path="webmarcas-rebrand-mockup.jpg" mime_type="image/jpeg"></presentation-artifact>

## Regra de ouro (o que NÃO muda)

- ❌ **Nenhum texto/copy** é alterado (títulos, subtítulos, CTAs, badges de trust, stats).
- ❌ **Nenhum componente ou seção** é adicionado, removido ou reordenado.
- ❌ **Nenhuma lógica**, rota, edge function, banco, hook ou contexto é tocado.
- ❌ **Área Admin** (`/admin/*`) e **Área do Cliente** (`/cliente/*`) permanecem com o tema atual, sem qualquer mudança visual.

## O que MUDA (apenas visual, apenas rota pública)

### 1. Tokens de design (`src/index.css`)

Atualizar variáveis HSL da rota pública para paleta azul saturado + laranja:

- `--primary`: azul saturado `220 92% 54%` (era `#0066CC`) — para chips, links, título "poucos passos", CTA azul do form.
- `--accent`: laranja vibrante `20 100% 55%` — para CTAs principais ("Consultar Minha Marca", scribble, checkmarks, badges).
- `--hero-background`: azul profundo gradient (`220 92% 48%` → `225 95% 42%`) — fundo do Hero.
- `--hero-foreground`: branco puro para textos sobre o azul.
- `--card` do formulário: branco com shadow suave e radius `1.25rem`.

Adicionar tokens novos:
- `--brand-orange`, `--brand-orange-glow`
- `--gradient-hero-blue`
- `--shadow-card-hero`
- `--wave-divider` (para as ondas SVG entre seções)

### 2. Tipografia (`tailwind.config.ts` + `index.html`)

- Adicionar `Fraunces` (Google Fonts, weights 600/700/900) como `font-display`.
- Manter `Inter` como `font-sans` (body).
- Aplicar `font-display` nos H1/H2 das seções públicas (`hero.title`, títulos de `BenefitsSection`, `PricingSection`, `FAQSection`, etc.) via classe existente `font-display` — nenhum texto é reescrito.

### 3. Componentes de seção pública (só estilo, zero lógica)

Ajustes exclusivamente em `className` e wrappers visuais:

- `src/components/sections/HeroSection.tsx`
  - Fundo: `bg-hero-gradient` → azul saturado full.
  - Título: cor branca + font-display Fraunces chunky.
  - Palavra "registro" (via span existente ou wrap novo puramente visual): adicionar SVG scribble laranja animado embaixo (novo componente `ScribbleUnderline.tsx` só decorativo).
  - Card do formulário à direita: fundo branco, radius maior, shadow-card-hero.
  - Chips (`Protocolo em 48h`, etc.): pill branco/translúcido com checkmark laranja.
  - Avatares (AC/MR/JP): manter estrutura, apenas trocar cores para orange/green/blue.
- `src/components/layout/Header.tsx`
  - Sobre hero azul: logo/menu em branco quando na home.
  - Botão "CONSULTAR MINHA MARCA" → variant laranja (`bg-accent`).
  - Botão "ÁREA DO CLIENTE" → outlined branco.
- `src/components/sections/*` (Benefits, HowItWorks, Pricing, Blockchain, Testimonials, BlogPreview, FAQ, CTA)
  - Alternar bandas: `bg-background` (creme suave) e `bg-primary/5`.
  - CTAs principais: cor `accent` (laranja); CTAs secundários: `primary` (azul).
  - Divisores SVG wave entre seções (novo asset SVG).
- `src/components/layout/Footer.tsx`
  - Fundo azul escuro (`--primary` dark variant), texto branco, links laranja no hover.
- `src/components/sections/RegistrationFormSection.tsx`
  - Card branco, badge "CONSULTA GRATUITA" laranja pill, CTA `FALAR COM ESPECIALISTA` azul saturado.

### 4. Novos arquivos criados (todos só visuais)

- `src/components/decorative/ScribbleUnderline.tsx` — SVG path animado com `stroke-dashoffset`.
- `src/components/decorative/WaveDivider.tsx` — SVG wave reutilizável entre seções.
- `src/assets/rebrand/seal-48h.svg` — selo circular rotativo "48h no INPI" (substitui o atual se existir).

### 5. Arquivos NÃO tocados (garantia)

Todo `src/pages/admin/**`, `src/pages/cliente/**`, `src/components/admin/**`, `src/components/cliente/**`, `src/components/chat/**`, `supabase/**`, hooks, contexts (exceto `ThemeContext` que não muda), integrações, edge functions, migrations.

## Escopo restrito — arquivos que serão modificados

```
src/index.css                                    (tokens HSL rota pública)
tailwind.config.ts                               (fontFamily display: Fraunces)
index.html                                       (Google Fonts Fraunces)
src/components/layout/Header.tsx                 (cores dos botões)
src/components/layout/Footer.tsx                 (fundo azul escuro)
src/components/sections/HeroSection.tsx          (fundo azul + scribble)
src/components/sections/BenefitsSection.tsx      (cores)
src/components/sections/HowItWorksSection.tsx    (cores)
src/components/sections/PricingSection.tsx       (cores)
src/components/sections/BlockchainBanner.tsx     (cores)
src/components/sections/TestimonialsSection.tsx  (cores)
src/components/sections/BlogPreviewSection.tsx   (cores)
src/components/sections/FAQSection.tsx           (cores)
src/components/sections/CTASection.tsx           (cores)
src/components/sections/RegistrationFormSection.tsx (card + badges)
src/components/sections/ClientLogosSection.tsx   (bg claro)
src/components/sections/ViabilitySearchSection.tsx (card branco)
```

Novos:
```
src/components/decorative/ScribbleUnderline.tsx
src/components/decorative/WaveDivider.tsx
```

## Validação após implementação

1. Preview visual da rota `/` comparada à mockup de referência acima.
2. Navegar em `/admin` e `/cliente` para confirmar **zero mudança visual** nessas áreas (tema atual preservado).
3. Confirmar que nenhum texto/copy foi alterado (diff apenas em `className` e wrappers).
4. Rodar `bun run build` para garantir zero erros de tipo.

## Detalhe técnico — isolamento admin/cliente

O `ThemeContext` já governa `dark`/`light` global. Para garantir que a mudança de paleta atinja apenas a landing pública, os novos tokens (`--brand-orange`, `--hero-background`) são adicionados **globalmente** em `:root`, mas as classes que os consomem (`bg-hero-gradient`, `bg-accent`) são aplicadas **apenas nos componentes de `src/components/sections/*` e no `Header`/`Footer` da rota pública**. Como Admin e Cliente usam seus próprios layouts (`AdminLayout`, `ClientLayout`) sem essas classes, ficam intocados.
