## Escopo

Correções pontuais no módulo Recursos INPI, preservando layout, fluxo, prompts e download atual. Nada de reestrutura visual.

---

### 1. Performance na geração do rascunho (`process-inpi-resource`)

Hoje `PASS 1` e `PASS 2` já rodam em paralelo, mas em cada chamada os PDFs/imagens de entrada são reenviados por completo em base64 dentro de cada `input_file`/`input_image`. Isso multiplica o payload por 3 (extração + pass1 + pass2) e é o principal responsável pela lentidão/timeouts.

Mudanças (sem tocar em prompts):

- Fazer upload dos arquivos anexados **uma única vez** para a OpenAI Files API (`/v1/files`, `purpose=user_data`) e reutilizar o `file_id` nas 3 chamadas paralelas via `{ type: 'input_file', file_id }`.
- Para imagens, usar o mesmo `file_id` com `{ type: 'input_image', file_id }`.
- Baixar `max_output_tokens` da extração para 800 e forçar `reasoning: { effort: 'minimal' }` também no gpt-5 do adjust (hoje o `gpt-5` roda com reasoning padrão “medium”, que é o segundo gargalo).
- Aumentar `timeoutMs` interno para 140s e tratar erro 408 devolvendo o `pass1_content` já pronto quando o `pass2` estourar (o front já sabe lidar com `partial: true`).
- Registrar tempos por etapa (`console.time`) para monitorar em produção.

Isso não altera prompt, estrutura da resposta, nem o front-end.

---

### 2. Estabilidade e velocidade de "Ajustes com IA" (`adjust-inpi-resource`)

- Migrar a chamada de `chat/completions` (gpt-5, reasoning medium, 32k tokens) para `responses` com `gpt-5-mini`, `reasoning: { effort: 'minimal' }`, `text: { verbosity: 'high' }` e `max_output_tokens: 12000` — mesmo padrão já usado com sucesso em `process-inpi-resource`. Reduz o tempo de resposta de ~90–150s para ~20–40s.
- Envolver o `fetch` num `AbortController` (timeout 140s) e devolver 408 amigável em vez de travar até o Supabase matar o request.
- Tratar `429`/`5xx` retornando `{ error, retryable: true }` para o front reexibir o botão sem quebrar a UI.
- Retornar `adjusted_content` mesmo quando o modelo devolver texto idêntico ao rascunho (hoje isso vira warning apenas em log; adicionar `unchanged: true` no JSON para o front avisar o usuário).

Nenhum prompt é modificado.

---

### 3. Duas áreas de upload de evidências (Cliente × Concorrente)

Schema:

- Migration adicionando `party TEXT NOT NULL DEFAULT 'cliente' CHECK (party IN ('cliente','concorrente'))` em `public.inpi_resource_evidences`.
- Backfill: registros existentes ficam como `cliente`.

Edge function `extract-resource-evidences`:

- Aceitar `party` no body (default `cliente`) e gravar na coluna.

UI (`EvidenceGallery.tsx` + `RecursosINPI.tsx`):

- Adicionar `Tabs` no topo do diálogo: **Evidências do Cliente** | **Evidências do Concorrente**.
- Cada aba tem seu próprio botão “Anexar PDFs / imagens” que dispara `extract-resource-evidences` com `party` correspondente.
- Listagem filtrada por aba, contadores separados, e a numeração `Doc. NN` continua contínua para não quebrar marcadores `[DOC:N]` existentes.
- No botão “Evidências” do painel principal, exibir `evidenceCount` total como já é hoje.

---

### 4. IA lê e cita as evidências dentro do recurso

Hoje o pipeline principal ignora o conteúdo das evidências (só o adjust as usa). Vamos alimentar a geração inicial:

Backend (`process-inpi-resource`):

- Aceitar `evidences: [{ id, docNumber, party, caption, ocr_text, storage_path }]` no body (opcional).
- Se vier lista, montar dois blocos determinísticos no `pass1User`/`pass2User`, **antes** dos arquivos do processo:
  - `EVIDÊNCIAS DO CLIENTE (use para fundamentar uso real, boa-fé, distintividade adquirida):` seguido de `[DOC:NN] — legenda — Texto OCR: "..."`.
  - `EVIDÊNCIAS DO CONCORRENTE / OPOSITOR (use para colidência, má-fé, concorrência desleal):` no mesmo formato.
- Acrescentar a instrução “Cite cada `[DOC:NN]` pelo menos uma vez no parágrafo argumentativo apropriado; não descreva a imagem, apenas insira o marcador literal `[DOC:NN]`.” — isto **complementa** o prompt, não substitui nada.
- Além do texto OCR, subir cada imagem `.jpg/.png` como `input_image` (via `file_id`) para o modelo realmente enxergar a evidência. PDFs de decisão vão como `input_file`.

Front (`RecursosINPI.tsx`):

- Antes de chamar `process-inpi-resource`, buscar `inpi_resource_evidences` do resource (já existe query similar), montar signed URLs curtas e enviar array `evidences` no body — igual ao que o adjust já faz.

Resultado: o rascunho gerado já vem com `[DOC:NN]` inseridos no lugar certo.

---

### 5. Imagens dentro do PDF final (não apenas anexo)

O `INPIResourcePDFPreview.tsx` já resolve `[DOC:NN]` inline (linhas 634–667). Ajustes:

- Confirmar que `evidenceByNum` inclui evidências das duas partes (cliente e concorrente) — trocar filtro para não depender de `placement === 'inline'`; qualquer `[DOC:NN]` presente no texto vira `<figure>` inline no PDF.
- Manter a seção “Anexo — Evidências” ao final apenas para as evidências que **não** foram citadas no corpo (evita duplicidade). As citadas ficam apenas inline.
- Legenda no PDF passa a mostrar `Doc. NN — {caption} ({party === 'concorrente' ? 'evidência do concorrente' : 'evidência do cliente'})`.

Sem mudanças no algoritmo de paginação, quebra de página, cabeçalho ou rodapé — só o conteúdo dos marcadores.

---

## Detalhes técnicos

- Migration nova: `ALTER TABLE public.inpi_resource_evidences ADD COLUMN party TEXT NOT NULL DEFAULT 'cliente' CHECK (party IN ('cliente','concorrente'));`
- Edge functions redeployadas: `process-inpi-resource`, `adjust-inpi-resource`, `extract-resource-evidences`.
- OpenAI Files API upload usa `multipart/form-data`; cache in-memory por request (Map `sha256(base64)->file_id`) para deduplicar quando o mesmo arquivo aparece em `pass1`/`pass2`/extração.
- Nenhum prompt jurídico é alterado.
- Nenhum componente visual do painel Recursos INPI é reestruturado — apenas as `Tabs` dentro do diálogo de evidências.

## Riscos

- Uploads muito grandes (>25 MB por arquivo) precisam continuar em base64 embutido — a Files API tem limite. Fallback mantém o comportamento atual.
- Se a OpenAI ficar instável, o `pass2` pode falhar; já cobrimos devolvendo `pass1_content` com `partial: true`.

## O que fica igual

- Layout, tipografia, fluxo do usuário, cabeçalho, rodapé, paginação e download do PDF.
- Prompts do agente e do ajuste (só adicionamos o bloco de evidências, sem tocar no conteúdo jurídico).
- Numeração `[DOC:NN]` e comportamento do preview. não implemente apenas "parcialmente" o que você espera.
  ### 1. Garantir que nenhuma funcionalidade existente seja quebrada (muito importante)
  Acrescente:
  > **Compatibilidade obrigatória:** Todas as funcionalidades atuais devem continuar funcionando exatamente como hoje. As alterações devem ser totalmente retrocompatíveis. Nenhum endpoint, prompt, fluxo, preview, download ou integração existente pode ser removido ou ter seu comportamento alterado.
  ---
  ### 2. Não gerar "alucinações" ao interpretar evidências
  Hoje você pede para a IA analisar imagens.
  Mas acrescente uma regra:
  > A IA deve utilizar apenas informações realmente identificáveis nas evidências anexadas. Não deve presumir fatos inexistentes nem criar descrições que não possam ser verificadas na imagem ou no OCR.
  Isso evita recursos jurídicos contendo informações inventadas.
  ---
  ### 3. Prioridade das evidências
  Isso é extremamente importante.
  Adicionar:
  > Quando houver conflito entre o conteúdo dos autos do INPI e as evidências anexadas, o conteúdo oficial dos autos deverá prevalecer. As evidências servirão apenas para complementar a fundamentação.
  ---
  ### 4. Ordem das evidências
  Especifique isso.
  Por exemplo:No recurso, as evidências devem aparecer exatamente na ordem em que forem citadas no texto.
  Exemplo:
  Argumentação...
  [DOC:01]
  (imagem)
  Continuação...
  [DOC:02]
  (imagem)
  ...
  Assim evita todas as imagens aparecerem no final do documento.
  ---
  ### 5. Não repetir evidências
  Adicionar:
  > Se a mesma evidência for utilizada diversas vezes, inserir a imagem apenas na primeira citação e, nas demais, apenas manter o marcador [DOC:NN].
  Isso deixa o PDF mais limpo.
  ---
  ### 6. Melhorar OCR
  Hoje você cita OCR.
  Eu acrescentaria:
  > Para imagens contendo texto, utilizar OCR antes da geração do recurso. Para logotipos ou fotografias, utilizar análise visual (Vision) em conjunto com OCR quando disponível.
  Assim ele entende que nem toda imagem possui texto.
  ---
  ### 7. Cache das evidências
  Muito importante.
  Adicionar:
  ```

  ```
  ```
  Se o usuário gerar novamente o recurso sem alterar as evidências, reutilizar a análise anterior das imagens e OCR, evitando novo processamento desnecessário.
  ```
  Isso diminui muito o tempo.
  ---
  ### 8. Barra de progresso
  Eu pediria isso.
  ```

  ```
  ```
  Durante a geração do recurso, informar o andamento.

  Exemplo:

  ✓ Extraindo processo
  ✓ Analisando documentos
  ✓ Analisando evidências
  ✓ Elaborando fundamentação
  ✓ Revisando texto
  ✓ Finalizando PDF

  ```
  O usuário percebe que não travou.
  ---
  ### 9. Retry automático
  Você tratou 429.
  Eu acrescentaria:
  ```

  ```
  ```
  Antes de retornar erro ao usuário, realizar até 2 novas tentativas automáticas em erros transitórios (429, 500, 502, 503 e 504), utilizando backoff exponencial.
  ```
  Isso reduz muito os erros percebidos.
  ---
  ### 10. Logs completos
  Adicionar:
  ```

  ```
  ```
  Registrar em log:

  - tempo de upload
  - tempo da IA
  - tempo do OCR
  - tempo do PDF
  - quantidade de tokens
  - tamanho dos arquivos
  - modelo utilizado
  - quantidade de evidências
  - falhas por etapa

  ```
  Depois fica muito mais fácil descobrir gargalos.
  ---
  ### 11. Não diminuir a qualidade jurídica
  Eu colocaria essa observação.
  ```

  ```
  ```
  As otimizações de performance não podem reduzir a qualidade técnica da fundamentação jurídica nem simplificar a argumentação produzida pelo agente.
  ```
  ---
  ### 12. Critério de aceite (faltou)
  Eu sempre adiciono um bloco de aceite.
  ```

  ```
  ```
  Critérios de Aceite

  ✔ Geração do rascunho concluída sem timeout.

  ✔ Ajustes com IA concluídos sem erros.

  ✔ Evidências do Cliente e Concorrente separadas.

  ✔ IA cita corretamente os marcadores [DOC:NN].

  ✔ As imagens aparecem dentro do PDF exatamente onde são citadas.

  ✔ Evidências não citadas permanecem apenas no anexo.

  ✔ Nenhuma funcionalidade existente foi alterada.

  ✔ O preview e o PDF possuem exatamente o mesmo conteúdo.

  ✔ Downloads DOCX e PDF preservam as imagens inline.

  ✔ O usuário consegue regenerar o recurso sem reenviar as evidências.

  ```