# Revista INPI — identificação do procurador, contagem e enriquecimento

## 1. Resultado da verificação da RPI 2906 (dados já gravados)

Consulta feita na importação da RPI 2906 registrada em 15/09/2026:

| Indicador | Resultado atual |
|---|---|
| Processos gravados | 57 |
| Números de processo distintos | 57 |
| Linhas duplicadas | 0 |
| Processos com nome da marca | 30 de 57 (27 sem marca) |
| Processos com titular | 0 de 57 |
| Processos ligados a um processo do CRM | 6 |
| Processos ligados a um cliente | 6 |
| Publicação com texto de destituição | 1 (presente, importada) |
| Código de despacho preenchido | 0 de 57 |
| Menções encontradas (58) | não medido — o sistema não guarda contagem de ocorrências |
| Relação encontrada (procurador atual, petição, nomeação, destituição...) | não existe hoje |
| Origem de cada campo (XML, CRM, INPI, manual) | não existe hoje |

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
Nenhuma alteração de identidade visual, de outras telas do CRM ou de filas existentes.
