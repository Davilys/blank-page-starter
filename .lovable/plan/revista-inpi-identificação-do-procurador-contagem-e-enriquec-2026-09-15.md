# Revista INPI — identificação do procurador, contagem e enriquecimento

## 1. Resultado da verificação da RPI 2906 (dados já gravados)

Consulta feita na importação da RPI 2906 registrada em 15/09/2026:


| Indicador                                                                | Resultado atual                                           |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| Processos gravados                                                       | 57                                                        |
| Números de processo distintos                                            | 57                                                        |
| Linhas duplicadas                                                        | 0                                                         |
| Processos com nome da marca                                              | 30 de 57 (27 sem marca)                                   |
| Processos com titular                                                    | 0 de 57                                                   |
| Processos ligados a um processo do CRM                                   | 6                                                         |
| Processos ligados a um cliente                                           | 6                                                         |
| Publicação com texto de destituição                                      | 1 (presente, importada)                                   |
| Código de despacho preenchido                                            | 0 de 57                                                   |
| Menções encontradas (58)                                                 | não medido — o sistema não guarda contagem de ocorrências |
| Relação encontrada (procurador atual, petição, nomeação, destituição...) | não existe hoje                                           |
| Origem de cada campo (XML, CRM, INPI, manual)                            | não existe hoje                                           |


Conclusões:

- A busca **já varre o bloco `<processo>` inteiro**, não apenas a tag de procurador. Por isso os 57 processos únicos foram preservados, incluindo o de destituição.
- A **contagem de processos únicos já está correta** (57, sem duplicidade).
- O que falta é tudo o que vem depois: contagem de menções, classificação da relação, extração completa do bloco, enriquecimento e vinculação segura.
- A extração de campos está fraca: titular nunca é preenchido, código de despacho nunca é preenchido, quase metade fica sem marca. Isso ocorre porque a leitura usa buscas de texto genéricas em vez de ler a estrutura real do XML da RPI.

Não foi possível confirmar as 58 menções sem reprocessar o arquivo da RPI 2906, porque hoje nada é gravado sobre ocorrências. A primeira etapa da implementação inclui esse reprocessamento com o relatório completo.

## 2. O que será feito (após sua aprovação)

### Identificação

- Manter a varredura do bloco completo e passar a contar **cada ocorrência** do nome monitorado dentro de cada processo.
- Gravar, por processo, em qual campo o nome apareceu: procurador principal, procurador de protocolo/petição, nomeado, destituído, substituído, menção em texto complementar, múltiplas ocorrências, outra menção.
- Uma linha por número de processo por revista, guardando todas as ocorrências dentro do registro para auditoria.
- Selos na tela: Procurador atual, Petição, Nomeação, Destituição, Substituição, Outra menção.

### Destituição

- Importada normalmente, com alerta "Procurador destituído nesta publicação", enviada para a aba Publicação, sem apagar histórico, sem manter Davilys como procurador atual e sem disparo automático ao cliente. Gera pendência para conferência do responsável.

### Extração do bloco

Passar a ler a estrutura do XML e registrar: número, depósito, concessão, vigência, todos os despachos com código e nome, texto complementar, protocolos, requerentes, titulares, procuradores, marca, apresentação, natureza, classes Nice com status e especificações, classes de Viena, apostila e a relação encontrada.

### Complementação

Ordem: dados do XML, depois cruzamento por número com os processos do CRM, depois cadastro de marcas e clientes, e só então consulta individual ao INPI quando ainda faltar dado essencial. Cada campo guarda sua origem (rpi_xml, rpi_pdf, crm_brand_process, inpi_individual, manual). Dado confirmado nunca é sobrescrito por vazio.

### Vinculação ao cliente

Por número do processo, processo já cadastrado, CPF/CNPJ exato do titular, correspondência única e segura. Marca apenas como apoio, nunca sozinha. Havendo ambiguidade: sem vínculo, lista de candidatos, confirmação humana obrigatória, nenhuma comunicação automática.

### Validação final

Reprocessar a RPI 2906 e apresentar: menções encontradas, processos únicos, ausência de duplicidade, presença da destituição, relações classificadas, quantos vieram com marca do XML, quantos enriquecidos pelo CRM, quantos pela consulta individual, quantos seguiram incompletos e a taxa final de preenchimento.

## 3. Detalhes técnicos

- `supabase/functions/fetch-inpi-magazine/index.ts`: substituir `parseRpiXml` por um leitor de bloco `<processo>` estruturado (atributos e tags reais da DTD de marcas), com contador de ocorrências e classificador de relação; substituir o corte por `MAX_PROCESSES = 300` por processamento completo com controle de memória.
- `supabase/functions/process-rpi/index.ts` (upload manual): usar o mesmo leitor para XML; a IA permanece apenas como apoio para PDF.
- Migração em `rpi_entries`: `occurrences_count`, `relation_types` (texto[]), `relation_primary`, `is_destituicao`, `raw_process_block`, `field_sources` (jsonb), `deposit_date`, `concession_date`, `vigencia`, `dispatches` (jsonb), `protocols` (jsonb), `requerentes`/`titulares`/`procuradores` (jsonb), `apresentacao`, `natureza`, `ncl_specifications` (jsonb), `vienna_classes`, `apostila`, `match_candidates` (jsonb), `needs_human_review`; índice único por (`rpi_upload_id`, `process_number`).
- Nova função de enriquecimento individual reutilizando a consulta INPI já existente, executada só para lacunas.
- Interface da Revista e da aba Publicação: coluna/selo de relação, aviso de destituição, indicador de menções e de origem dos campos.

## 4. Fora de escopo

Nenhuma alteração de identidade visual, de outras telas do CRM ou de filas existentes.PLANO APROVADO COM OS SEGUINTES AJUSTES OBRIGATÓRIOS:

## 1. RESULTADO DE REFERÊNCIA DA RPI 2906

Considerar como resultado esperado:

- 58 menções ao nome monitorado;
- 57 números de processos únicos;
- Zero linhas duplicadas;
- 30 processos com marca diretamente no XML;
- 27 processos sem marca diretamente no XML;
- 57 processos com pelo menos um titular diretamente no XML;
- 57 processos com código e nome do despacho no XML;
- Uma publicação de destituição incluída.

O fato de o banco atual possuir zero titulares e zero códigos de despacho comprova falha do parser atual. Esses dados estão presentes no arquivo XML original.

## 2. PARSER XML ESTRUTURADO

Não utilizar regex ou pesquisas genéricas de texto para interpretar os campos.

Criar um parser estrutural que respeite:

- Elementos;
- Atributos;
- Hierarquia;
- Entidades XML;
- Campos opcionais;
- Listas;
- Múltiplos titulares;
- Múltiplos procuradores;
- Múltiplos despachos;
- Procuradores dentro de protocolos;
- Texto complementar.

A busca pelo nome monitorado poderá considerar todo o bloco `<processo>`, mas a extração dos dados deverá ser estrutural.

## 3. PROCESSAMENTO POR STREAMING

O `RM2906.xml` possui aproximadamente 56 MB.

Não carregar todo o XML em memória e não criar uma árvore DOM completa.

Usar processamento incremental por streaming, SAX, eventos ou estratégia equivalente:

1. Ler até abrir `<processo>`;
2. Acumular somente aquele bloco;
3. Interpretar o processo;
4. Verificar as ocorrências do procurador;
5. Salvar ou descartar;
6. Liberar a memória;
7. Continuar para o próximo processo.

Remover o limite `MAX_PROCESSES = 300`, mas manter proteção por:

- Tempo de execução;
- Memória;
- Progresso persistido;
- Lotes;
- Retomada;
- Idempotência.

Se uma única Edge Function não suportar o arquivo completo, dividir o processamento em etapas persistidas. Não resolver o problema aumentando indiscriminadamente o limite de memória.

## 4. NÃO GRAVAR O XML COMPLETO EM CADA LINHA

Não salvar `raw_process_block` integralmente em todos os registros sem medir tamanho e impacto.

Isso poderá:

- Aumentar excessivamente o banco;
- Duplicar o conteúdo já existente no arquivo original;
- Tornar consultas e backups mais lentos;
- Expor dados desnecessários;
- Prejudicar a interface.

Manter o arquivo XML original no armazenamento e registrar em `rpi_entries`:

- Referência ao arquivo;
- Número da RPI;
- Número do processo;
- Hash do bloco;
- Dados normalizados;
- Ocorrências encontradas;
- Campos de auditoria.

Se for indispensável preservar o bloco individual, salvar de forma comprimida no armazenamento, não como texto pesado na tabela principal.

## 5. OCORRÊNCIAS DO PROCURADOR

Guardar todas as ocorrências encontradas em uma estrutura auditável, preferencialmente JSONB:

- Caminho do campo;
- Tipo da relação;
- Texto encontrado;
- Número do protocolo, quando existir;
- Código do despacho;
- Trecho contextual limitado;
- Ordem da ocorrência.

Exemplo:

`procurador_principal`

`despacho.protocolo.procurador`

`despacho.texto_complementar.destituicao`

Não depender somente de um array simples de tipos, pois um processo pode possuir duas ocorrências diferentes do mesmo tipo.

O contador de menções será a quantidade total dessas ocorrências.

## 6. CLASSIFICAÇÃO DE DESTITUIÇÃO E NOMEAÇÃO

A classificação não deve depender apenas da presença do nome em `texto-complementar`.

Analisar o contexto textual normalizado:

- “Destituído o procurador...”;
- “Nomeado novo representante...”;
- “Substituído...”;
- “Passa a ser representado...”;
- Variações de acentuação, caixa e espaços.

Guardar separadamente:

- Procurador anterior;
- Procurador novo;
- Tipo da movimentação;
- Texto original;
- Confiança da classificação;
- Necessidade de revisão humana.

Nunca marcar Davilys como procurador atual quando o despacho informar sua destituição.

## 7. EXTRAÇÃO DOS TITULARES

O XML da RPI 2906 possui titular nos 57 processos identificados.

Extrair todos os elementos:

`<titulares><titular ... /></titulares>`

Guardar:

- Nome ou razão social;
- País;
- UF;
- Ordem;
- Existência de cotitularidade.

Não considerar o texto interno do elemento, porque os dados aparecem principalmente nos atributos, como `nome-razao-social`, `pais` e `uf`.

Essa provavelmente é a causa de atualmente existirem zero titulares preenchidos.

## 8. EXTRAÇÃO DOS DESPACHOS

Extrair diretamente:

`<despachos><despacho codigo=\"...\" nome=\"...\">`

Guardar todos os despachos, contendo:

- Código;
- Nome;
- Texto complementar;
- Protocolos internos;
- Ordem;
- Dados do requerente;
- Procurador do protocolo.

Definir também um despacho principal para exibição, sem descartar os demais.

Essa correção deve preencher os códigos que atualmente aparecem vazios.

## 9. ENRIQUECIMENTO SEM SOBRESCRITA INDEVIDA

Aplicar precedência por campo, não por registro inteiro.

Exemplo:

- Marca pode vir do CRM;
- Titular pode vir do XML;
- Texto do despacho pode vir do XML;
- Situação atual pode vir da consulta individual.

Nunca substituir um objeto completo por outro parcialmente vazio.

Para cada campo, guardar:

- Valor;
- Fonte;
- Data da consulta;
- Confiança;
- Última atualização.

Precedência sugerida:

1. Consulta individual oficial do INPI atualizada;
2. XML oficial da RPI para a publicação;
3. Processo já confirmado no CRM;
4. PDF oficial;
5. Preenchimento manual confirmado.

A precedência poderá variar conforme o campo. O XML deve continuar sendo a fonte oficial do despacho publicado naquela edição, mesmo que a consulta individual mostre uma situação posterior.

## 10. TESTAR A CONSULTA INDIVIDUAL ANTES DE IMPLEMENTAR EM LOTE

A frase “reutilizando a consulta INPI já existente” precisa ser comprovada.

Antes de consultar automaticamente os 27 processos incompletos, testar somente:

- 938671308;
- 938652451;
- 937425370;
- 931053021;
- &nbsp;

937020893. &nbsp;

Informar para cada processo:

- Se a consulta respondeu;
- Se encontrou a marca;
- Quais campos retornou;
- Tempo de resposta;
- Se exige sessão ou CAPTCHA;
- Se possui limite;
- Se é permitido executar no backend;
- Qual foi a fonte consultada.

Somente ativar o enriquecimento automático em lote se esse teste for aprovado.

## 11. FILA DE ENRIQUECIMENTO

Não executar dezenas de consultas individuais simultaneamente.

Criar fila controlada com:

- Limite de concorrência;
- Retentativas progressivas;
- Registro da tentativa;
- Último erro;
- Próxima tentativa;
- Status;
- Bloqueio contra duplicidade.

Status sugeridos:

- `pendente`;
- `consultando`;
- `enriquecido`;
- `parcial`;
- `falha_temporaria`;
- `revisao_humana`.

Se o INPI estiver indisponível, o processamento da RPI não poderá ser perdido. Os dados do XML devem ser publicados e os campos ausentes enriquecidos depois.

## 12. VINCULAÇÃO COM A ABA PUBLICAÇÃO

Atualizar ou criar a publicação usando uma chave idempotente composta por:

- RPI;
- Número do processo;
- Código do despacho;
- Número do protocolo, quando existir.

Não criar publicações duplicadas ao:

- Reprocessar a mesma RPI;
- Enriquecer dados;
- Editar manualmente;
- Repetir uma consulta individual.

O enriquecimento deve atualizar a publicação já criada, não criar outra.

## 13. REPROCESSAMENTO SEGURO

Antes de reprocessar a RPI 2906:

- Criar ponto de restauração;
- Registrar os dados atuais;
- Executar modo de prévia;
- Não enviar mensagens;
- Não criar cobranças;
- Não alterar etapas;
- Não gerar prazos automaticamente;
- Não apagar edições manuais confirmadas.

Mostrar a comparação:

- Antes;
- Depois proposto;
- Campos novos;
- Campos alterados;
- Vínculos sugeridos;
- Conflitos;
- Publicações que seriam atualizadas.

Somente aplicar depois da aprovação.

## 14. RELATÓRIO FINAL DO TESTE

Entregar:

- Total de menções;
- Total de processos únicos;
- Memória máxima utilizada;
- Tempo de processamento;
- Processos por segundo;
- Titulares extraídos;
- Despachos extraídos;
- Marcas obtidas pelo XML;
- Marcas obtidas pelo CRM;
- Marcas obtidas pela consulta individual;
- Registros incompletos;
- Falhas;
- Ambiguidades;
- Destituições;
- Nomeações;
- Petições;
- Publicações que seriam atualizadas.

Também entregar cinco exemplos completos:

1. Processo com todos os dados no XML;
2. Processo sem marca enriquecido;
3. Processo vinculado automaticamente ao cliente;
4. Processo ambíguo mantido sem vínculo;
5. Processo de destituição.

Com esses ajustes, pode iniciar a implementação em ambiente de teste e apresentar a prévia do reprocessamento da RPI 2906. Não aplicar em produção e não disparar automações antes da aprovação final.