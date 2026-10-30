# LAUDO PDF — PADRÃO FIXO APROVADO (2026-10-29 19:29, Davilys, WhatsApp)

"Aprovado ficou perfeito 👍 coloque como regra ser sempre assim para não alterar
regra imutável ser assim o PDF" (WhatsApp 19:29:44, em resposta ao PDF de prévia
enviado com aviso de marca TESTE e FAQ ausente).
Baseline: função webmarcas-inpi-search v108 (ezbr 51fbad759ea0), idêntica à
preview v15 aprovada. Só mudam por consulta: marca, atividade, data, protocolo,
resultados da busca e classes conforme o ramo. Estrutura/visual NÃO mudam sem
ordem explícita do Davilys.

## Invariantes de regressão (verificar em qualquer mudança futura)

1. TIMBRADO: logo recortado à esquerda + contatos à direita com
   ola@webmarcas.net, CNPJ 39.528.012/0001-29, Av. Brigadeiro Luís Antônio 2696,
   São Paulo/SP. Faixa navy + filete dourado full-width no topo; dupla régua
   cinza+gold full-width sob o cabeçalho. NUNCA juridico@ no laudo.
2. RODAPÉ: "WebMarcas e Patentes | (11) 91112-0225 | ola@webmarcas.net |
   www.webmarcas.net" centrado + tarja "RESULTADO PRELIMINAR | CONSULTA TEXTUAL
   AO INPI" à esquerda + "Página N de M" à direita. Corpo nunca sobrepõe o
   rodapé (BODY_BOTTOM = 82).
3. ORIENTAÇÃO JURÍDICA: 3 classes REAIS do ramo em caixas (barra azul), cada
   uma "CLASSE N — título Nice" + papel (PRIORIDADE PRINCIPAL / COBERTURA
   COMPLEMENTAR / EXPANSÃO CONDICIONADA) + explicação do escopo com condição
   clara; complementares nunca afirmadas como necessidade universal. Ramo
   genérico: NÃO inventar classes — só pedido mínimo de detalhamento.
4. CAIXA AZUL: "REGISTRE NAS ... CLASSES INDICADAS QUE CORRESPONDAM À SUA
   ATUAÇÃO. SE O ORÇAMENTO ESTIVER LIMITADO, PRIORIZE A CLASSE X." com a classe
   principal NOMEADA (dinâmica por ramo). Título "Prioridade conforme seu
   orçamento" sempre junto da caixa (nunca órfão de página).
5. PAGINAÇÃO: sem página órfã; CONCLUSÃO TÉCNICA + AVISOS sempre juntos
   (ensure 215 antes da seção 6).
6. CONCLUSÃO: distingue "Classe principal sugerida" (negrito) de "Classes
   complementares, condicionadas à atuação efetiva sob a marca".
7. FAQ comercial: AUSENTE até decisão do usuário (taxa/prazo/telefone
   divergem de fontes oficiais atuais). Não reintroduzir sem aprovação.
8. Zero resultados NUNCA apresentado como disponibilidade; datas nulas do INPI
   (1900-01-01) renderizam "não informada", nunca 31/12/1899.
9. Sem assinatura do Davilys no laudo (assinatura só em recursos INPI).

## Casos de validação (INPI ao vivo)
- Jurídico ("serviços jurídicos de registro de marcas"): 45/41/42, 3 páginas.
- Restaurante (BARBIE): 43/30/35, caixa azul prioriza 43, 10 páginas c/ 51 registros.
- Ramo genérico ("consultoria", marca inexistente): 2 páginas, sem classes.
