# Lista "Processos identificados" da Revista INPI — nova versão

Reorganizar a lista de processos da Revista INPI para que o despacho, o nível de atenção, a próxima ação e a situação do vínculo fiquem visíveis antes de abrir cada processo — no formato da prévia aprovada. Fase 1 apenas: prévia funcional, sem reprocessar produção e sem disparar mensagens, cobranças ou prazos.

## O que muda na tela

Cada processo vira um cartão horizontal com cinco blocos:

```text
[ícone]  MARCA                         [ SELO DO DESPACHO ]   Resumo em 1-2 linhas        [ Vínculo ]   →
         938671308 · NCL 42            Código: IPAS029        Próxima ação: Conferir...   Vincular     Ver processo
         JONATAS MURTA... · Procurador
```

- Marca em destaque; sem marca, aparece "Aguardando identificação da marca" com o selo "Dados incompletos", que some sozinho quando a informação chega.
- Selo colorido com o nome real do despacho e o código oficial embaixo. Vermelho para indeferimento/nulidade/caducidade, laranja para exigência e oposição, azul para publicação/petição/recurso, verde para deferimento/concessão/renovação, roxo para mudanças de procurador, cinza para não classificado.
- Resumo curto do que aconteceu e a linha "Próxima ação: ..." — apenas orientação, nunca executa nada.
- Situação do vínculo: nome do cliente quando vinculado, "Vincular cliente" quando não há, "Revisar vínculo" quando há candidatos em conferência.
- Direita: seta e "Ver processo". A linha inteira abre o mesmo painel de detalhes de hoje; o botão de vínculo não abre a linha.
- Destituição mostra o selo roxo e o aviso "Esta publicação informa a destituição de Davilys Danques de Oliveira Cunha", com a ação sugerida "Validar destituição" e marcação de conferência obrigatória.
- Prioridade (Crítico / Atenção / Informativo / Concluído) aparece como pequena borda lateral e selo, sempre com texto além da cor.

Filtros no topo com contagem: Todos, Atenção imediata, Exigências, Indeferimentos, Deferimentos, Oposições, Publicações para oposição, Recursos, Concessões, Arquivamentos, Alterações de procurador, Sem cliente vinculado, Dados incompletos, Revisão necessária. A busca passa a encontrar por número, marca, titular, cliente e código do despacho.

No celular o cartão vira vertical (prioridade, marca, número, despacho, resumo, próxima ação, vínculo, "Ver processo"), sem rolagem lateral.

## Classificação dos despachos

Uma única função classifica cada publicação, nesta ordem: código oficial do XML, nome oficial do XML, atributos do despacho, texto complementar, protocolos, mapa interno de códigos e, só em último caso, leitura do texto. Sem IA quando o código já resolve.

Os oito códigos presentes na RPI 2906 já ficam mapeados: IPAS009 (publicação para oposição), IPAS158 (concessão de registro), IPAS029 (deferimento), IPAS139 (arquivamento definitivo), IPAS024 (indeferimento), IPAS136 (exigência de mérito), IPAS270 (deferimento de petição) e IPAS360 (notificação de recurso). O mapa nasce maior, cobrindo também oposição, recurso, exigência formal, prorrogação, nulidade, caducidade, nomeação, substituição, destituição e sobrestamento.

"Outro" deixa de existir na tela. Sem classificação segura, aparece "Despacho não classificado" com o código encontrado, o nome original, o resumo original e o aviso "Revisão necessária" — e o código fica registrado para entrar no mapa depois.

## Detalhes técnicos

- Ponto de restauração dos arquivos tocados antes de qualquer alteração.
- Nova função compartilhada `src/lib/rpi/classifyDispatch.ts` retornando `dispatch_code`, `dispatch_name_original`, `dispatch_type`, `dispatch_label`, `category`, `priority`, `summary`, `suggested_action`, `confidence`, `needs_human_review`, com testes unitários cobrindo os casos exigidos (inclusive código desconhecido e ausência de código).
- Novo componente `src/components/admin/inpi/ProcessoIdentificadoRow.tsx` e a barra de filtros correspondente; `RevistaINPI.tsx` passa a renderizar esses componentes, mantendo intactos o carregamento de dados, o painel expandido, a vinculação de cliente e a gravação na aba Publicação.
- Sem migração nova: a classificação é derivada em tempo de exibição a partir de colunas que já existem (`dispatch_code`, `dispatch_type`, `dispatch_text`, `dispatches`, `protocols`, `relation_types`, `is_destituicao`, `needs_human_review`, `field_sources`, `match_candidates`, `enrichment_status`). Nenhuma coluna é removida ou renomeada.
- A origem de cada dado (XML da RPI, CRM, consulta individual do INPI, PDF, manual) aparece só no painel de detalhes; na lista fica apenas "Dados conferidos", "Dados parciais" ou "Revisão necessária".
- Integração com a aba Publicação permanece como está, com a chave idempotente RPI + processo + código do despacho + protocolo; nada de mensagem, cobrança, prazo ou mudança de etapa automática.
- Acessibilidade: linha navegável por teclado com foco visível, rótulos acessíveis nos ícones, tooltip nos códigos, área de clique confortável.

## Entrega da Fase 1

Prévia sobre os 57 processos já lidos da RPI 2906 (nenhum reprocessamento, nenhum disparo), com: comparação antes e depois, tabela por processo (número, código, nome original, classificação aplicada, prioridade, próxima ação, confiança, revisão necessária), lista de arquivos alterados e lista de códigos ainda não mapeados. A publicação em produção só acontece depois da sua aprovação expressa. APROVO A FASE 1, COM UMA VALIDAÇÃO TÉCNICA OBRIGATÓRIA ANTES DA IMPLEMENTAÇÃO.

A auditoria anterior informou que os 57 registros atualmente gravados da RPI 2906 possuem:

- 0 códigos de despacho preenchidos;
- 0 titulares preenchidos;
- 30 marcas identificadas;
- 27 marcas ausentes.

Por isso, não presuma que `dispatch_code`, `dispatches`, `protocols`, `relation_types`, `is_destituicao`, `field_sources`, `match_candidates` e `enrichment_status` já estejam criados e preenchidos.

## 1. VERIFICAÇÃO DO BANCO E DOS TIPOS

Antes de alterar a interface:

1. Consulte o schema real de `rpi_entries`;
2. Consulte os tipos TypeScript gerados pelo Supabase;
3. Informe quais das colunas citadas realmente existem;
4. Para cada coluna existente, informe quantos dos 57 registros possuem valor;
5. Identifique de qual campo a tela atual obtém “Outro”;
6. Verifique se o código e o nome do despacho estão dentro de algum JSON já gravado;
7. Não crie referências no frontend para colunas inexistentes;
8. Não apresente dados fictícios para completar a prévia.

Entregue uma tabela:


| Campo | Existe no banco | Tipo | Registros preenchidos | Pode ser usado na Fase 1 |
| ----- | --------------- | ---- | --------------------- | ------------------------ |


## 2. FONTE TEMPORÁRIA PARA A PRÉVIA

Se os códigos oficiais não estiverem gravados nos 57 registros atuais, a Fase 1 poderá utilizar uma fonte temporária somente para demonstração, desde que os valores sejam reais.

Ordem permitida:

1. Campos reais já gravados;
2. JSON real armazenado no registro;
3. Arquivo XML original da RPI 2906 em modo de leitura;
4. Resultado real previamente extraído do XML;
5. Classificação textual somente quando não houver código.

Identifique visualmente os dados temporários como:

“Prévia derivada do XML — ainda não gravada”

Não reprocessar, atualizar ou sobrescrever os registros em produção.

## 3. CLASSIFICAÇÃO CORRETA DOS OITO CÓDIGOS

O classificador deverá reconhecer inicialmente:

- `IPAS009` — Publicação para oposição;
- `IPAS158` — Concessão de registro;
- `IPAS029` — Deferimento;
- `IPAS139` — Arquivamento definitivo;
- `IPAS024` — Indeferimento;
- `IPAS136` — Exigência de mérito;
- `IPAS270` — Deferimento de petição;
- `IPAS360` — Notificação de recurso.

Esses códigos deverão ser confirmados no XML ou em fonte oficial existente no projeto. Não associar códigos por suposição.

## 4. IMPLEMENTAÇÃO VISUAL

Após a verificação, implementar a prévia funcional exatamente no formato aprovado:

- Cartão horizontal com cinco blocos no desktop;
- Cartão vertical no celular;
- Marca ou “Aguardando identificação da marca”;
- Selo do despacho real;
- Código oficial;
- Prioridade;
- Resumo de até duas linhas;
- Próxima ação;
- Situação do vínculo;
- Ação “Ver processo”;
- Linha inteira clicável;
- Botão “Vincular cliente” independente do clique da linha;
- Filtros com contagem;
- Busca por processo, marca, titular, cliente e código;
- Sem rolagem horizontal no celular.

Preservar o painel de detalhes existente. Não recriar outra tela de detalhes.

## 5. PROIBIÇÃO DO RÓTULO “OUTRO”

Remover “Outro” somente da apresentação visual.

Quando a classificação não for segura, exibir:

“Despacho não classificado”

Também mostrar:

- Código encontrado;
- Nome original;
- Resumo original;
- “Revisão necessária”.

Não alterar o valor original do banco nesta fase.

## 6. SEM MIGRAÇÃO NESTA FASE

A afirmação “sem migração” somente será válida se todas as colunas usadas realmente existirem.

Se alguma coluna não existir:

- Não criar migração agora;
- Não simular que ela existe;
- Calcular a classificação em memória para a prévia;
- Informar quais campos serão necessários na implementação definitiva;
- Separar claramente “dado persistido” de “dado derivado”.

## 7. PONTO DE RESTAURAÇÃO

Antes das alterações:

- Registrar o commit ou estado atual;
- Listar exatamente os arquivos que serão tocados;
- Não desfazer alterações de outras funcionalidades;
- Não alterar Edge Functions;
- Não alterar banco;
- Não reprocessar a RPI;
- Não publicar em produção.

## 8. ENTREGA

Entregar a Fase 1 com:

1. Resultado da inspeção real do banco;
2. Prévia funcional com os 57 processos;
3. Identificação da fonte usada em cada classificação;
4. Comparação visual antes e depois;
5. Tabela dos 57 processos;
6. Códigos identificados;
7. Códigos ainda não mapeados;
8. Arquivos criados;
9. Arquivos alterados;
10. Testes executados;
11. Resultado em desktop;
12. Resultado em celular;
13. Confirmação de que o painel atual continua abrindo;
14. Confirmação de que “Vincular cliente” funciona separadamente;
15. Confirmação de que nenhuma mensagem, cobrança, prazo, publicação ou mudança de etapa foi disparada.

Pode executar agora somente a Fase 1. Não aplicar em produção e não fazer alterações no banco até minha aprovação expressa.