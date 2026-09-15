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

Prévia sobre os 57 processos já lidos da RPI 2906 (nenhum reprocessamento, nenhum disparo), com: comparação antes e depois, tabela por processo (número, código, nome original, classificação aplicada, prioridade, próxima ação, confiança, revisão necessária), lista de arquivos alterados e lista de códigos ainda não mapeados. A publicação em produção só acontece depois da sua aprovação expressa.
