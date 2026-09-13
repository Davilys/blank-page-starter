# Buscador único de marcas com consulta real à API WebMarcas/INPI

## Diagnóstico (estado atual confirmado)

Hoje existem **duas implementações duplicadas** do buscador, ambas com lógica simulada no front e um backend que mistura fontes:

| Local | Componente atual | Observação |
|---|---|---|
| Página inicial (`/`) | `src/components/sections/ViabilitySearchSection.tsx` (889 linhas, usado por `HeroSection` no modo `compact`) | Formulário + animação + resultado + laudo impresso |
| `/registrar` (passo 1) | `src/components/cliente/checkout/ViabilityStep.tsx` (553 linhas) | Cópia quase idêntica da anterior |
| Área do cliente `/cliente/registrar-marca` (passo 1) | Mesmo `ViabilityStep.tsx` | Já compartilha com `/registrar` |

Simulações encontradas que serão removidas:

- Animação com temporizador fixo (5 s / 9 s) e etapas inventadas: "Buscando CNPJs similares", "Analisando presença web", "Processando com IA jurídica".
- `CommercialIntelligenceModule` (em ambos os arquivos): score de deferimento fixo em 92, risco concorrencial 15/73/91, percentuais sem base na API.
- Selos "ALTA VIABILIDADE / VIABILIDADE MÉDIA / BAIXA / BLOQUEADA" derivados de `level` calculado no servidor antigo.
- Backend `inpi-viability-check`: lista fixa `FAMOUS_BRANDS` (bloqueio automático), classes NCL por palavra-chave, busca via DuckDuckGo/Firecrawl, seções de CNPJ e redes sociais, laudo gerado por IA.
- Hand-off entre páginas via `sessionStorage('viabilityData')` com `level` (em `Registrar.tsx` linhas 96-127).
- `src/components/sections/RegistrationFormSection.tsx` não é importado em lugar nenhum (código morto) — não será tocado.

Dependência verificada e segura: `BrandDataStep` já trata `suggestedClasses` vazio ("Classes NCL serão definidas automaticamente"), então o checkout continua funcionando sem classes vindas da busca. Nenhuma alteração em CRM, checkout, contratos, pagamentos ou banco é necessária.

## O que será construído

### 1. Módulo central `src/modules/trademark-search/`

```text
src/modules/trademark-search/
  types.ts                      # TrademarkSearchJob, status, resultado normalizado
  trademarkSearchService.ts     # start(brand, activity) / getStatus(jobId) -> chama só a Edge Function
  TrademarkSearchProvider.tsx   # estado compartilhado + persistência em sessionStorage (sem segredos)
  useTrademarkSearch.ts         # hook: iniciar, polling 3 s, cancelar, tentar novamente
  components/
    TrademarkSearch.tsx         # componente único (form -> progresso -> resultado/erro)
    SearchProgress.tsx          # animação com etapas reais (queued/running -> etapas permitidas)
    SearchResult.tsx            # exibe exclusivamente dados da API
    SearchError.tsx             # mensagem oficial + "Tentar novamente"
```

- `TrademarkSearchProvider` entra em `App.tsx` junto aos providers existentes (uma linha). Guarda marca, ramo, `job_id`, status, resultado, `pdf_url`, erro e data/hora. Persistido em `sessionStorage` (chave `wm_trademark_search`), então a busca sobrevive à navegação entre `/`, `/registrar` e a aba do cliente, e ao refresh (retoma o polling pelo `job_id` se ainda não for final).
- Polling: a cada 3 s, limite de 5 min, cancelado ao desmontar/iniciar nova busca; botão desabilitado enquanto há job em andamento (sem duplo clique); mesma marca+ramo em andamento não gera novo job.
- Validação única: campos obrigatórios, trim, limite de tamanho (marca 120, ramo 160).
- Variantes visuais apenas por prop `variant="landing" | "checkout"` para manter o visual atual de cada lugar (pílula laranja e título Fraunces na home; título "Verifique a Viabilidade" no checkout). Lógica e resultado idênticos.

### 2. Edge Function segura `webmarcas-inpi-search`

- Aceita `POST { action: "start", brand, activity }` e `POST { action: "status", job_id }`.
- Valida/normaliza entradas (zod), recusa vazio, limita tamanhos, valida formato do `job_id`.
- Gera `Idempotency-Key` no servidor (UUID v4), adiciona `Authorization: Bearer` a partir do secret, timeout de 20 s por chamada à API, tratamento de 4xx/5xx/indisponibilidade.
- Normaliza a resposta da API para o formato seguro do front (o mapeamento final usa o exemplo JSON que você vai colar). Nunca repassa headers, chave ou payload bruto sensível.
- CORS restrito a: `https://webmarcas.net`, `https://www.webmarcas.net`, `https://page-creation-pro.lovable.app`, `https://id-preview--6c60bdcc-40b1-49c5-b46b-40ac18ae182b.lovable.app`, `https://*.lovableproject.com` e `http://localhost:8080`.
- Logs sem chave e sem dados pessoais. Não envia `subscriber_id`, telefone ou qualquer dado do visitante.
- Registrada em `supabase/config.toml` com `verify_jwt = false` (busca pública).
- Secrets criados via formulário seguro: `WEBMARCAS_API_BASE_URL` e `WEBMARCAS_API_KEY` (você preenche os valores reais; nada é inventado).

### 3. Substituição nos três locais (alterações mínimas)

- `HeroSection.tsx`: troca `<ViabilitySearchSection compact />` por `<TrademarkSearch variant="landing" />`.
- `Registrar.tsx` e `cliente/RegistrarMarca.tsx`: o passo 1 passa a renderizar `<TrademarkSearch variant="checkout" onNext=... />` com a mesma assinatura `onNext(brandName, businessArea, result)` já usada (result compatível, `classes: []`). O bloco que lia `sessionStorage('viabilityData')` em `Registrar.tsx` é substituído por leitura do Provider: se já houver consulta concluída vinda da home, a página mostra o resultado no passo 1 e o botão de continuar leva ao passo 2. Nada mais nessas páginas muda.
- `ViabilitySearchSection.tsx` e `ViabilityStep.tsx` são removidos (ficam apenas no histórico do Git para reversão). `src/lib/api/viability.ts` é mantido só pelo tipo `ViabilityResult`, que o checkout ainda importa; a função `checkViability` é removida.
- A Edge Function antiga `inpi-viability-check` deixa de ser chamada pelo site; não será apagada nesta entrega (reversão simples).
- Gravação em `viability_searches` mantida (marca, ramo e status resumido da consulta real), pois alimenta a prova social e não é CRM.

### 4. Interface e textos

- Etapas reais da animação: Preparando consulta -> Enviando consulta segura -> Consultando a base do INPI -> Processando busca exata e radical -> Validando resultados -> Gerando relatório -> Consulta concluída. O avanço acompanha o status real (`queued`, `running`, `completed`); sem percentual fabricado.
- Removidos: módulo "Análise Inteligente da Marca", scores, seções CNPJ/Internet, selos de "alta viabilidade", menções a IA jurídica, busca fonética/figurativa, cards "Laudo Técnico / IA especializada".
- Resultado (`completed`): marca, ramo, data/hora, busca exata, busca radical, quantidade real, tabela de processos (número, marca, titular, situação, classe quando existirem), conclusão técnica e limitações retornadas, botão "Abrir relatório PDF" só se `pdf_url` existir.
- Textos responsáveis fixos: "Resultado preliminar", "A consulta não substitui análise técnica completa", "A disponibilidade poderá depender da classe, afinidade mercadológica, semelhança fonética e elementos figurativos"; sem ocorrências: "Nenhuma ocorrência foi encontrada nos termos pesquisados".
- Com ocorrências relevantes: aviso "Foram encontradas ocorrências que exigem análise técnica antes do pedido." e o CTA vira **"Solicitar análise à equipe WebMarcas"** (abre o WhatsApp já usado pelo site). Sem ocorrências: CTA "Registre agora sua marca" continua.
- Erro/inconclusive/timeout: mensagem oficial ("Não foi possível concluir a consulta na base do INPI neste momento. Nenhum resultado foi gerado...") + botão "Tentar novamente". Nunca resultado parcial.
- Impressão do laudo local é substituída pelo PDF da API (quando houver).

## Testes previstos

- Unitários (vitest): validação, normalização da resposta da API, máquina de estados do polling (queued -> running -> completed / inconclusive / timeout), deduplicação de cliques, persistência/retomada.
- Edge Function: entradas vazias, tamanho excedido, API indisponível (503), timeout, `job_id` inválido; confirmação de que a resposta nunca contém a chave.
- Navegador (Playwright no preview): busca em `/`, `/registrar` e área do cliente; duplo clique; navegação entre as três telas durante a consulta; refresh durante a consulta; PDF presente/ausente; verificação de que nenhuma requisição do navegador vai direto para a API WebMarcas e de que a chave não aparece no bundle nem no console.
- Marca de consistência: **WEBMARCAS** deve exibir os processos reais retornados (nunca "0 ocorrências" automático).
- Regressão rápida: login, CRM, checkout passos 2-6, contratos e pagamentos continuam abrindo normalmente.

## Fora do escopo (não será tocado)

CRM, contatos, cadastro, autenticação, permissões, painel admin, checkout (passos 2-6), pagamentos, contratos, planos, banco/tabelas, automações, SEO, Pixel/Analytics/Ads, BotConversa, rotas, layout geral, `RegistrationFormSection.tsx`.

## Reversão

Reverter apenas o commit desta entrega restaura `ViabilitySearchSection.tsx`, `ViabilityStep.tsx`, `checkViability` e o uso da função `inpi-viability-check`; a nova Edge Function e os secrets podem ser removidos depois sem impacto.

## Pendências suas

1. Colar o exemplo JSON da resposta `completed` de `GET /v1/searches/{job_id}` (define o mapeamento final dos campos).
2. Preencher os secrets `WEBMARCAS_API_BASE_URL` e `WEBMARCAS_API_KEY` no formulário seguro quando solicitado.
