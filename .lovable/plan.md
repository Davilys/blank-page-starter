## Problema

Na aba Recursos INPI → Troca de Procurador (e Nomeação), após gerar o recurso e abrir a revisão, o cabeçalho aparece todo com "N/I":

```
MARCA: N/I
Processo INPI nº: /
Marca: N/I
Classe NCL (12ª Ed.): N/I
Titular/Requerente: N/I
Examinador(a): N/I
```

Mesmo o usuário tendo preenchido o formulário "Dados para Troca de Procurador" com Titular, Marca, Processo, NCL, etc.

## Causa raiz

Fluxo atual da Troca/Nomeação de Procurador:

1. Usuário preenche `procuradorData` no formulário (titular, marca, processo, ncl_class, cpf_cnpj, endereço, motivo, procurador antigo).
2. `processProcurador()` em `src/pages/admin/RecursosINPI.tsx` chama `process-inpi-resource` enviando `procuradorData`.
3. A edge function NÃO injeta um cabeçalho determinístico — delega 100% para a IA via `buildProcuradorPrompt`. A IA frequentemente não escreve o bloco no formato canônico esperado.
4. A função retorna `extracted_data: {}` (vazio).
5. O cliente insere em `inpi_resources` os campos vindos do `procuradorData` (process_number, brand_name, ncl_class, holder), mas `setExtractedData(data.extracted_data)` ⇒ sobrescreve com objeto vazio.
6. Ao clicar "Solicitar Ajuste" / "Reformular", `handleRequestAdjustment` envia `extractedData` vazio para `adjust-inpi-resource`. A função reaplica o header determinístico, mas com tudo "N/I" porque `passedData` está vazio.
7. Mesmo que o usuário não ajuste, a IA da pass inicial escreveu campos faltantes ⇒ aparece "N/I" na revisão e no PDF (papel timbrado também lê `resource.brand_name`/`process_number` do banco — esses estão OK — mas o BODY do texto vem com "N/I" pois foi a IA que escreveu).

## Correção (escopo: APENAS troca_procurador e nomeacao_procurador)

### 1. `supabase/functions/process-inpi-resource/index.ts` — bloco PROCURADOR (linhas ~1026–1055)

- Após receber a resposta da IA (`finalContent`), **prepend determinístico** do cabeçalho oficial usando `procuradorData`, no mesmo formato dos outros recursos:
  ```
  RECURSO ADMINISTRATIVO – PETIÇÃO DE TROCA DE PROCURADOR

  MARCA: {marca uppercase}

  EXCELENTÍSSIMO SENHOR PRESIDENTE DA DIRETORIA DE MARCAS,
  PATENTES E DESENHOS INDUSTRIAIS DO INSTITUTO NACIONAL
  DA PROPRIEDADE INDUSTRIAL – INPI

  Processo INPI nº: {processo}
  Marca: {marca}
  Classe NCL (12ª Ed.): {ncl_class}
  Titular/Requerente: {titular}
  Procurador: Davilys Danques de Oliveira Cunha – CPF 393.239.118-79
  ```
  **Sem linha "Examinador(a)"** (não se aplica a procurador).
- Detectar e remover qualquer cabeçalho duplicado que a IA tenha escrito (regex similar à já usada em `INPIResourcePDFPreview`), localizando o primeiro `\nI[\s.\-–—]` ou `1[\s.\-–—]` ou `O titular` para preservar o corpo.
- Retornar `extracted_data` populado a partir de `procuradorData`:
  ```ts
  extracted_data: {
    process_number: procuradorData.processo_inpi,
    brand_name: procuradorData.marca,
    ncl_class: procuradorData.ncl_class,
    holder: procuradorData.titular,
    examiner_or_opponent: null,
  }
  ```

### 2. `supabase/functions/adjust-inpi-resource/index.ts` (linhas 158–188)

- Quando `resourceType` for `troca_procurador` ou `nomeacao_procurador`, gerar header SEM a linha `Examinador(a):` / `Oponente:` (atualmente sempre inclui `personLabel: 'Examinador(a)'` com "N/I").
- Header para procurador:
  ```
  RECURSO ADMINISTRATIVO – PETIÇÃO DE TROCA DE PROCURADOR
  MARCA: {brand_name}
  EXCELENTÍSSIMO ...
  Processo INPI nº: ...
  Marca: ...
  Classe NCL (12ª Ed.): ...
  Titular/Requerente: ...
  Procurador: Davilys Danques de Oliveira Cunha – CPF 393.239.118-79
  ```

### 3. `src/pages/admin/RecursosINPI.tsx` — `processProcurador()`

- Antes (ou ao invés de) `setExtractedData(data.extracted_data)`, usar fallback do próprio `procuradorData` para garantir que o estado nunca fique vazio:
  ```ts
  setExtractedData(data.extracted_data && Object.keys(data.extracted_data).length > 0
    ? data.extracted_data
    : {
        process_number: procuradorData.processo_inpi,
        brand_name: procuradorData.marca,
        ncl_class: procuradorData.ncl_class,
        holder: procuradorData.titular,
        examiner_or_opponent: null,
      });
  ```
- Já está inserindo corretamente no DB (linha 742–756), só conferir que `process_number` não seja string vazia (já trata com `|| null`).

### 4. Prompt do `buildProcuradorPrompt` (process-inpi-resource)

- Acrescentar instrução explícita: "NÃO escrever cabeçalho/endereçamento (será injetado externamente). Iniciar diretamente pela Seção I com 'O titular da marca, ...'".
- Garantir que IA também respeite que **a única peça anexada é a procuração assinada** (já faz parte da seção 5).

## Garantia de não-regressão

- Mudanças são gateadas por `if (resourceType === 'troca_procurador' || resourceType === 'nomeacao_procurador')`.
- Os fluxos de `indeferimento`, `exigencia_merito`, `oposicao`, `notificacao_extrajudicial` e `resposta_notificacao_extrajudicial` permanecem intactos.

## Resultado esperado

Cabeçalho na revisão e no PDF "Papel Timbrado":

```
MARCA: AGROPECUÁRIA SOARES EIRELI ME

EXCELENTÍSSIMO SENHOR PRESIDENTE DA DIRETORIA DE MARCAS,
PATENTES E DESENHOS INDUSTRIAIS DO INSTITUTO NACIONAL
DA PROPRIEDADE INDUSTRIAL – INPI

Processo INPI nº: 90000000
Marca: NOME DA MARCA
Classe NCL (12ª Ed.): NCL(11) 35
Titular/Requerente: AGROPECUARIA SOARES EIRELI ME
Procurador: Davilys Danques de Oliveira Cunha – CPF 393.239.118-79

I. ...
```

Sem linha "Examinador(a)", com todos os dados preenchidos pelo usuário.
