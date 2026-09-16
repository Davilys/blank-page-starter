# Provas e PDF em Recursos INPI — correção do vínculo documento → peça → anexos

Escopo: apenas as três modalidades (indeferimento, exigência de mérito, manifestação à oposição) com os três agentes. Em preview. Sem publicar, protocolar, enviar mensagens, e sem tocar no recurso aprovado BANDA UAU (será usado apenas em cópia de teste).

## O que a leitura do código já confirma

Há **duas listas de documentos que não conversam entre si**:

1. `inpi_case_documents` — a lista do caso, alimentada pela etapa "Documentos" (CasePreparationPanel), com arquivo no armazenamento privado, páginas lidas, OCR e conversão.
2. `inpi_resource_evidences` — uma galeria antiga de imagens, anexada na etapa de Revisão pelo botão "Anexar evidências (prints/imagens)".

A prévia e o PDF (`INPIResourcePDFPreview`) leem **somente a lista 2**. Consequências observadas no código, que explicam exatamente os achados da auditoria:

- `[IMG:marca_cliente]` é procurado por semelhança de nome dentro da lista 2 (`findEvidenceBySlug`). Não achando, o texto vira o rótulo `(Imagem)` e nenhuma figura é desenhada — na prévia e no PDF. É esta a linha responsável.
- Os anexos do pacote (índice + páginas dos documentos originais) só existem quando o painel de aprovação prepara o pacote na sessão atual (`exportPackage`). Reabrir pelo histórico gera PDF **sem índice e sem anexos**, mesmo com documentos no caso.
- Nada, hoje, liga um `[DOC:NN]` do texto ao documento real do caso — daí citações a Doc. 01/02/03 sem pacote correspondente.

## O que será feito

### 1. Inventário único de provas por caso e versão
Uma única fonte: os documentos do caso. Cada documento recebe número de Doc. estável, finalidade, hash, páginas lidas e, quando for imagem ou página relevante, a imagem real derivada do arquivo original (sem redesenhar, sem gerar imagem por IA). Consultoria, geração, revisão, aprovação e exportação passam a receber esse mesmo inventário e a mesma versão. A galeria antiga continua legível para os recursos históricos, mas deixa de ser a única origem.

### 2. Resolver marcadores contra o inventário real
`[DOC:NN]` e `[IMG:...]` passam a resolver para documentos/páginas do inventário, com legenda (documento, página) e link para abrir a página integral. Marcador sem correspondência deixa de virar `(Imagem)` silencioso: aparece como pendência visível na prévia e bloqueia o anúncio de pacote completo. Referência repetida no mesmo parágrafo ("(Doc. 02) (Doc. 02)") é normalizada.

### 3. Anexos centralizados na etapa Documentos
O botão "Anexar evidências" da Revisão é substituído por "Gerenciar documentos", que volta à etapa inicial preservando texto, orientação e histórico. A lista de provas permanece visível na revisão, com as páginas. Adicionar, substituir, remover ou recategorizar prova cria nova versão do inventário e sinaliza que orientação, peça e conferência precisam ser refeitas — preservando as edições humanas e sem destruir a versão aprovada.

### 4. Leitura e preservação dos formatos
PDF com texto, PDF digitalizado ou misto, JPG/JPEG/PNG/WEBP, Word, Excel e CSV. Detecção do formato real, integridade, tamanho e proteção; OCR/leitura visual por página com registro de quais páginas foram lidas, parcialmente lidas ou falharam. "Recebido" continua diferente de "Lido". Imagens mantêm proporção, orientação e resolução legível; planilhas mantêm a relação com aba e células em conversão paginada.

### 5. Um só montador de PDF em todos os caminhos
Prévia, download na revisão, download após aprovação e download pelo histórico passam a usar o mesmo montador e a mesma versão do inventário: peça com as imagens dentro dos argumentos → índice de anexos com páginas → todos os documentos originais, uma vez cada, na ordem conferida. Recorte no corpo e original no anexo convivem (é intencional); a deduplicação por hash não elimina páginas diferentes de um mesmo PDF. Timbre atual preservado na peça e não sobreposto às provas. Os ativos são aguardados antes de exportar.

Marcador não resolvido, arquivo inacessível, conversão falha ou anexo faltante impedem "pacote completo para protocolo" e liberam apenas prévia carimbada com o motivo real. O carimbo de minuta não é removido por o histórico dizer "Aprovado": aprovação interna e conferência para protocolo continuam separadas e presas à versão exata.

### 6. Conteúdo jurídico — validações das três modalidades
- Apresentação da marca (nominativa/mista), titular, número e serviços vêm do documento oficial; contradição entre cabeçalho e corpo passa a ser apontada e bloqueante.
- Autoridade de endereçamento correta, sem combinar cargos.
- A especificação genérica da classe não pode ser apresentada como a especificação concreta do pedido.
- Nenhuma citação jurídica entra na versão final sem conferência registrada em fonte oficial (número, relator, data, fundamento, resultado, pertinência). Lista "pré-validada" deixa de ser aceita como prova de conferência. Especificamente, o REsp 1.188.105/RJ não pode ser apresentado como favorável à coexistência; sem conferência do inteiro teor, sai da peça e a limitação fica registrada internamente. Doutrina exige obra/edição/localização.
- Código de serviço e valor passam a ser exibidos como campo a conferir na tabela vigente na data do ato (o Manual consultado indica 3000 para recurso contra indeferimento; a peça atual traz 271), sem declarar correto ou errado sem confirmação. Pagamento mencionado sem comprovante no acervo do caso é removido.
- Publicação na RPI, prazo, procuração e vinculação da GRU conferidos; data da decisão não se confunde com a publicação. Peça não protocolada não exige recibo de protocolo para exportar.
- Art. 220 deixa de ser tratado como saneamento geral; confronto com arts. 218, 219, 221 e 214 quando pertinente.
- Uso em shows ou Instagram, isoladamente, não prova prioridade, notoriedade nem ausência de confusão; o contexto carnavalesco do cartaz precisa ser enfrentado; sem prova, não se atribui ano ao cartaz; "UAU" não é declarado fraco por ser interjeição. Fatos provados, inferências e teses ficam separados.
- Fim do mínimo artificial de palavras; redução de repetição e de pedidos genéricos. Lacuna documental permite minuta, mas impede indicação de conferência concluída.

## Testes que serão executados

Cópia isolada do caso BANDA UAU, identificada como teste, sem alterar o aprovado: anexar/recuperar → ler → orientar → gerar → revisar → conferir → exportar → reabrir pelo histórico. O PDF gerado será aberto e conferido visualmente (Instagram e cartaz no contexto do argumento com legenda e página; originais de 2 páginas e comprovante de 1 página nos anexos; índice correto; marcadores resolvidos; timbre preservado; sem conteúdo de outro caso). Também: PDF sem texto, JPG/PNG, arquivo ilegível, imagem inacessível, recarregar a página, alterar prova depois da aprovação, dois casos simultâneos e exportação pelo histórico. As outras duas modalidades são verificadas com documentos fictícios em testes direcionados do mesmo fluxo, sem repetir nove gerações caras. A autenticação não será desativada; o que exigir login de administrador será entregue como pendência nomeada.

## Entrega
Uma resposta final com: causas encontradas, arquivos alterados, testes executados e resultado, PDF de teste para conferência e pendências reais. A correção só é declarada validada depois de abrir e conferir o PDF. Nenhuma promessa de validade jurídica ou de deferimento — a conferência do responsável pela peça continua necessária.
