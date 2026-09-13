# Buscador único de marcas com consulta real à API WebMarcas/INPI

## Diagnóstico (estado atual confirmado)

Hoje existem **duas implementações duplicadas** do buscador, ambas com lógica simulada no front e um backend que mistura fontes:


| Local                                                | Componente atual                                                                                             | Observação                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Página inicial (`/`)                                 | `src/components/sections/ViabilitySearchSection.tsx` (889 linhas, usado por `HeroSection` no modo `compact`) | Formulário + animação + resultado + laudo impresso |
| `/registrar` (passo 1)                               | `src/components/cliente/checkout/ViabilityStep.tsx` (553 linhas)                                             | Cópia quase idêntica da anterior                   |
| Área do cliente `/cliente/registrar-marca` (passo 1) | Mesmo `ViabilityStep.tsx`                                                                                    | Já compartilha com `/registrar`                    |


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
2. Preencher os secrets `WEBMARCAS_API_BASE_URL` e `WEBMARCAS_API_KEY` no formulário seguro quando solicitado. Plano aprovado, com as seguintes correções obrigatórias:
  1. O Idempotency-Key não deve ser um UUID novo a cada tentativa. Gere um request_id único no frontend no início da busca, preserve-o no Provider/sessionStorage e envie para a Edge Function. A Edge Function deverá validar esse identificador e gerar uma chave estável. Assim, uma repetição por falha de rede não criará consultas duplicadas.
  2. Como verify_jwt = false, implemente proteção contra abuso com limite de consultas por IP e sessão anônima. Sugestão: máximo de 10 novas buscas a cada 15 minutos. O polling de um job já existente não deve contar como uma nova busca. Retornar HTTP 429 quando exceder.
  3. No CORS, nunca use Access-Control-Allow-Origin: * nem reflita qualquer origem recebida. Autorize os domínios exatos informados e valide de forma segura os subdomínios permitidos do Lovable.
  4. Quando uma consulta concluída for restaurada após navegação ou atualização da página, consulte novamente o status pelo job_id para obter um pdf_url novo. Não confie permanentemente no link salvo no sessionStorage, pois ele é assinado e pode expirar.
  5. Mapear as conclusões da API desta forma:
  - requires_legal_review: “Foram encontradas ocorrências que exigem análise técnica antes do pedido.” CTA “Solicitar análise”.
  - no_matches_in_searched_terms: “Nenhuma ocorrência foi encontrada nos termos pesquisados.” Sem declarar garantia de disponibilidade.
  - inconclusive: não mostrar resultado; apresentar a mensagem de erro e “Tentar novamente”.
  6. Na primeira entrega, não apague ViabilitySearchSection.tsx, ViabilityStep.tsx nem a função antiga. Apenas remova suas importações e deixe-os sem uso, identificados como legado. Isso reduz o risco e facilita a reversão. Só poderão ser excluídos depois da homologação completa.
  7. Antes de remover ou alterar checkViability, pesquise todas as referências no projeto. Se houver uso fora dos três buscadores, preserve a função. Não quebre dependências existentes.
  8. Manter a gravação em viability_searches usando a estrutura e as permissões atuais. Não alterar tabela, RLS ou banco. Gravar somente marca, ramo, data e status real resumido. Nunca gravar segredo, link assinado ou resultado simulado.
  9. A resposta normalizada deve preservar todos os campos reais retornados:
  - job_id;
  - status;
  - delivery;
  - result.brand;
  - result.activity;
  - result.queried_at;
  - result.source;
  - result.searches;
  - result.records;
  - result.conclusion;
  - result.scope;
  - pdf_url.
  10. Não publicar em produção automaticamente. Primeiro implementar e testar no preview. Entregar o relatório dos arquivos alterados, testes e resultado da busca por WEBMARCAS para revisão final.
  Permanece a regra principal: modificar somente o mecanismo compartilhado de busca da página inicial, /registrar e /cliente/registrar-marca. Não alterar CRM, login, checkout dos passos 2 a 6, contratos, pagamentos, banco de clientes, BotConversa ou demais sistemas.
  Pode iniciar a implementação com essas correções. Seguem as três definições para executar:
  1. Use este exemplo real da resposta completed da API:
  {
    "job_id": "c88ccb232f8846f093e535110924dca7",
    "status": "completed",
    "delivery": "not_sent",
    "result": {
      "brand": "WEBMARCAS",
      "activity": "Serviços de propriedade intelectual",
      "queried_at": "2026-09-10T18:52:48-03:00",
      "source": "[https://busca.inpi.gov.br/pePI/](https://busca.inpi.gov.br/pePI/)",
      "searches": [
        {
          "mode": "exata",
          "term": "WEBMARCAS",
          "total": 2,
          "pages": 1,
          "source_timestamp": "10/09/2026 às 18:52:20",
          "records": [
            {
              "process": "923059563",
              "priority": "25/05/2021",
              "brand": "WebMarcas",
              "status": "Pedido definitivamente arquivado",
              "holder": "WEBMARCAS PATENTES EIRELI",
              "nice": "NCL(11) 45",
              "source_url": "[https://busca.inpi.gov.br/pePI/servlet/MarcasServletController?Action=detail&CodPedido=4547310](https://busca.inpi.gov.br/pePI/servlet/MarcasServletController?Action=detail&CodPedido=4547310)"
            },
            {
              "process": "930072960",
              "priority": "12/04/2023",
              "brand": "WebMarcas",
              "status": "Registro de marca em vigor",
              "holder": "WEBMARCAS PATENTES EIRELI",
              "nice": "NCL(12) 45",
              "source_url": "[https://busca.inpi.gov.br/pePI/servlet/MarcasServletController?Action=detail&CodPedido=5274301](https://busca.inpi.gov.br/pePI/servlet/MarcasServletController?Action=detail&CodPedido=5274301)"
            }
          ]
        },
        {
          "mode": "radical",
          "term": "WEBMARCAS",
          "total": 2,
          "pages": 1,
          "source_timestamp": "10/09/2026 às 18:52:48",
          "records": [
            {
              "process": "923059563",
              "priority": "25/05/2021",
              "brand": "WebMarcas",
              "status": "Pedido definitivamente arquivado",
              "holder": "WEBMARCAS PATENTES EIRELI",
              "nice": "NCL(11) 45",
              "source_url": "[https://busca.inpi.gov.br/pePI/servlet/MarcasServletController?Action=detail&CodPedido=4547310](https://busca.inpi.gov.br/pePI/servlet/MarcasServletController?Action=detail&CodPedido=4547310)"
            },
            {
              "process": "930072960",
              "priority": "12/04/2023",
              "brand": "WebMarcas",
              "status": "Registro de marca em vigor",
              "holder": "WEBMARCAS PATENTES EIRELI",
              "nice": "NCL(12) 45",
              "source_url": "[https://busca.inpi.gov.br/pePI/servlet/MarcasServletController?Action=detail&CodPedido=5274301](https://busca.inpi.gov.br/pePI/servlet/MarcasServletController?Action=detail&CodPedido=5274301)"
            }
          ]
        }
      ],
      "records": [
        {
          "process": "923059563",
          "priority": "25/05/2021",
          "brand": "WebMarcas",
          "status": "Pedido definitivamente arquivado",
          "holder": "WEBMARCAS PATENTES EIRELI",
          "nice": "NCL(11) 45",
          "source_url": "[https://busca.inpi.gov.br/pePI/servlet/MarcasServletController?Action=detail&CodPedido=4547310](https://busca.inpi.gov.br/pePI/servlet/MarcasServletController?Action=detail&CodPedido=4547310)"
        },
        {
          "process": "930072960",
          "priority": "12/04/2023",
          "brand": "WebMarcas",
          "status": "Registro de marca em vigor",
          "holder": "WEBMARCAS PATENTES EIRELI",
          "nice": "NCL(12) 45",
          "source_url": "[https://busca.inpi.gov.br/pePI/servlet/MarcasServletController?Action=detail&CodPedido=5274301](https://busca.inpi.gov.br/pePI/servlet/MarcasServletController?Action=detail&CodPedido=5274301)"
        }
      ],
      "conclusion": "requires_legal_review",
      "scope": "Pesquisa textual exata e radical, sem filtro de classe."
    },
    "pdf_url": "[https://api-webmarcas.exemplo/v1/reports/job_id.pdf?expires=valor&signature=assinatura](https://api-webmarcas.exemplo/v1/reports/job_id.pdf?expires=valor&signature=assinatura)"
  }
  O pdf_url acima é apenas ilustrativo. A API devolverá o endereço assinado real.
  2. Quando a consulta encontrar ocorrências, trocar o botão “REGISTRE AGORA” por **“SOLICITAR ANÁLISE”**. Encontrar ocorrências não significa impedimento definitivo, portanto o cliente deve ser direcionado ao WhatsApp da WebMarcas com a mensagem:
  “Olá! Fiz a consulta da marca {marca} e foram encontradas ocorrências. Gostaria de solicitar uma análise técnica.”
  3. Manter o registro na tabela viability_searches, pois ela não pertence ao CRM e alimenta a prova social do site. Preservar a estrutura atual e salvar somente:
  - marca;
  - ramo;
  - data;
  - status resumido da consulta real.
  Não salvar chave da API, link assinado do PDF, dados pessoais nem resultados simulados.
  Continue respeitando o escopo: alterar somente o mecanismo compartilhado de busca da página inicial, /registrar e aba “Registrar” da área do cliente. Não modificar CRM, autenticação, checkout, pagamentos, contratos ou outras partes do sistema.