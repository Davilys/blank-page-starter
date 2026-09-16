# Auditoria funcional do upgrade de Recursos INPI

Objetivo: rodar o módulo de verdade com os documentos fictícios já preparados, achar as falhas, corrigir apenas o que estiver comprovadamente quebrado e entregar um relatório único. Sem publicar, sem protocolar, sem novas funcionalidades.

Escopo mantido: apenas as três modalidades (indeferimento, exigência de mérito, oposição) com os três especialistas. Papel timbrado, demais módulos, modelos e documentos históricos permanecem intocados.

## Limite conhecido, declarado desde já

As etapas que só rodam com administrador logado na tela (gerar orientação, gerar peça, revisar, aprovar, baixar o PDF pelo botão) não podem ser executadas por mim: este projeto usa um Supabase próprio e o acesso de teste não me permite entrar. Essas etapas entram no relatório como **pendentes**, nunca como aprovadas. Tudo que puder ser executado sem login será executado de verdade.

## 1. Bateria automatizada com os arquivos fictícios

Roteiro de teste executado fora da tela, chamando as mesmas rotinas que o módulo usa:

- Leitura de cada arquivo dos três conjuntos: PDF com texto, PDF digitalizado sem texto, imagem, planilha com várias abas, CSV, Word.
- Confirmação de que o PDF digitalizado fica como "Recebido"/"Parcial" e nunca como "Lido" sem processamento.
- Arquivo inválido (zip corrompido), arquivo protegido por senha e arquivo acima de 25 MB: cada um deve falhar com motivo claro, sem sumir.
- Conversão para o PDF final de cada arquivo, montagem do índice e do pacote, e checagem de que falha de conversão marca o pacote como incompleto.
- Geração dos PDFs de pacote completo e incompleto por conjunto, com conferência página a página (acentos, margens, tabelas, imagens, abas da planilha, carimbo correto, ausência de duplicação ou corte).

## 2. Verificação do caminho de upload e persistência

- Simulação do envio real ao armazenamento privado e da gravação vinculada ao caso, incluindo: envio duplicado, falha no registro após o envio (não pode deixar arquivo órfão), e recuperação da lista após recarregar.
- Conferência de que um único arquivo utilizável libera o início da minuta, com as lacunas apontadas, sem exigir todos os grupos.

## 3. Verificação das regras de servidor

Consultas diretas ao banco para confirmar, com evidência:

- Índices que impedem aprovação, revisão e pacote duplicados por versão exata (duas abas ou cliques simultâneos).
- Regras de acesso por caso e bucket privado.
- Ausência de chave de IA no navegador e nos registros.
- Registro automático de modelo, versão do prompt, resultado e falha em cada execução — é isso que permitirá montar o relatório das nove combinações depois dos seus testes.
- Conferência de que o modelo previsto é usado nas etapas e de que qualquer troca de modelo fica registrada (sem troca silenciosa).

## 4. Tela em celular e desktop

Conferência do fluxo nas duas larguras até onde a tela de login permite, mais leitura dos registros do navegador. Emulação não será apresentada como teste em Safari real; o teste em Safari/iPhone fica listado como pendente seu.

## 5. Correções

Só entram correções de falhas comprovadas nesta bateria que impeçam anexar, ler, converter, gerar, revisar, aprovar ou baixar corretamente. Cada correção é seguida da repetição apenas do teste afetado. Nada de melhorias opcionais.

## 6. Relatório final

Um documento único com: bugs encontrados, causa e correção; resultado de cada teste executado; os PDFs de homologação para download; ambientes efetivamente testados; a lista curta e objetiva das ações que exigem seu login de administrador (as nove combinações e o download pelo botão); e a confirmação do escopo preservado.

Depois que você executar as nove combinações autenticadas, eu leio os registros e consolido o resultado aprovado/falhou por combinação — esse é o fechamento da homologação. Publicação só com sua autorização.

## Detalhes técnicos

- Scripts de teste em `/tmp`, usando as rotinas de `src/lib/inpi/caseDocuments.ts` e `src/lib/inpi/packageBuilder.ts` e o gerador de PDF já existente.
- Consultas de auditoria em `inpi_resource_cases`, `inpi_case_documents`, `inpi_case_orientations`, `inpi_draft_versions`, `inpi_draft_reviews`, `inpi_case_approvals`, `inpi_export_packages`, `inpi_ai_call_logs` e `storage.objects`.
- Correções limitadas a `CasePreparationPanel.tsx`, `CaseApprovalPanel.tsx`, `RecursosINPI.tsx`, `caseDocuments.ts`, `packageBuilder.ts`, ao gerador de PDF e às funções `generate-inpi-orientation`, `read-inpi-scanned-pages`, `review-inpi-draft`, `process-inpi-resource`.
- Migrações, se necessárias, apenas aditivas.
