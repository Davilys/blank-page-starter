# Recursos INPI: reconstrução da aba, liberação por permissão e homologação real

## O que já está comprovado

Rodei os registros do servidor e o banco agora, antes de planejar:

- A geração falha sempre no mesmo ponto. O registro das 14:22 mostra o erro exato:
`ReferenceError: STALE_RUN_MS is not defined`, dentro da rotina que executa as etapas.
Uma peça de código usa um valor que não foi importado do arquivo vizinho — o processo
morre antes de preparar os documentos. É por isso que a tela fica em "Escrevendo a
primeira parte da peça…" e depois vira "Geração interrompida".
- O trabalho mais recente (caso `ae179d37…`) ficou parado na etapa de preparo e foi
encerrado pelo vigia às 14:25. Os anteriores (BANDA UAU incluso) também estão
encerrados como interrompidos. Nenhum documento ou orientação foi perdido.
- Toda a aba é hoje restrita a administradores: as 12 tabelas `inpi_*` e as quatro
funções de servidor exigem o papel de administrador. A tela já respeita a permissão
"Recursos INPI" das configurações, mas o servidor não — por isso um usuário liberado
hoje veria a tela e receberia erro em toda ação.

## O que vou fazer

### 1. Liberar o acesso por permissão (não só administrador)

Criar uma verificação única no banco: tem acesso quem for administrador **ou** quem
estiver liberado em "Recursos INPI" nas configurações (visualizar para ler, editar para
gerar/aprovar). Aplicar essa mesma verificação nas tabelas da aba, no armazenamento dos
anexos e nas quatro funções de servidor. Nenhuma outra aba muda.

### 2. Refazer o motor de geração

O arquivo do servidor cresceu para 2.500 linhas e acumulou caminhos antigos que brigam
entre si. Vou reescrevê-lo em partes pequenas e testáveis:

- controle de execução (etapas, retomada, batimento, trava de tentativa);
- preparo dos documentos (lotes, vínculo com a versão exata do acervo);
- redação em duas passagens e revisão;
- uma única porta de entrada que valida acesso e despacha.

Cada parte ganha teste próprio, para que um erro como o de hoje seja pego antes do
servidor. Os caminhos antigos não usados são removidos.

### 3. Rever o resto da aba com os mesmos olhos

Anexos, orientação, revisão, aprovação, montagem do PDF e histórico: percorro cada etapa
procurando falha real, corrijo o que estiver quebrado e mantenho o que já funciona
(numeração fixa dos documentos, marcadores de imagem por página, carimbos de minuta e
bloqueios de pacote incompleto). Não mexo em outros módulos, nos modelos de IA, nas
integrações, nem no BANDA UAU aprovado.

### 4. Testar de verdade, ponta a ponta

Numa cópia de teste do BANDA UAU: anexar os três documentos, gerar a orientação, gerar o
recurso, revisar, conferir, exportar e reabrir pelo histórico. Depois abrir o PDF e olhar
página por página (imagens nas páginas certas, legendas, referências, índice, anexos,
timbre). Também testo remoção de prova, arquivo indisponível, duas abas abertas,
recarregar no meio e retomar. Só relato como aprovado o que eu vi funcionando.

## O que preciso de você

Para fazer esse teste eu preciso entrar no sistema, e o login deste ambiente não é
gerenciado por mim. Me passe um acesso de teste (e-mail e senha de uma conta que não seja
a principal), ou crie um usuário de teste com a permissão "Recursos INPI" ligada e me
avise. Sem isso eu entrego as correções e os testes automáticos, mas a homologação com o
PDF fica como pendência declarada — não como aprovada.

## Detalhes técnicos

- `supabase/functions/process-inpi-resource/index.ts:4` importa `isRunStale`,
`documentsSignature` e `INTERRUPTED_MESSAGE` de `./runControl.ts`, mas a linha 2131 usa
`STALE_RUN_MS`, que não é importado — `ReferenceError` em todo `runStep`.
- Nova função `public.has_inpi_resources_access(_user_id uuid, _need_edit boolean)`
(security definer): `has_role(_user_id,'admin')` ou linha em `admin_permissions` com
`permission_key='inpi_resources'` e `can_view`/`can_edit`. Substitui `has_role` nas
policies de `inpi_resource_cases`, `inpi_case_documents`, `inpi_case_orientations`,
`inpi_draft_versions`, `inpi_draft_reviews`, `inpi_case_approvals`,
`inpi_export_packages`, `inpi_generation_jobs`, `inpi_resource_evidences`,
`inpi_ai_call_logs` e nas policies do bucket `inpi-recursos-docs`. Migração aditiva.
- Servidor: `requireAdmin` vira `requireInpiAccess` em `process-inpi-resource`,
`generate-inpi-orientation`, `review-inpi-draft`, `adjust-inpi-resource`;
`isTrustedInpiStep` (chave de servidor) continua como está para as etapas internas.
- Quebra de `process-inpi-resource/index.ts` em `runControl.ts` (já existe), `prepare.ts`,
`generate.ts`, `auth.ts` e `index.ts` só com o despacho; testes em `src/lib/inpi/*` e
Deno tests por módulo; `tsgo` e build no fim.
- Trabalhos travados permanecem como `interrompido`; a retomada segue por etapa
(prepare → pass1 → pass2) e revalida a assinatura do acervo.

Fora de escopo: publicar em produção, protocolar, enviar mensagens, alterar o BANDA UAU  
aprovado ou qualquer outro módulo. AUDITORIA TÉCNICA COMPLETA + CORREÇÃO + TESTE REAL DESTA ABA

Atue como um engenheiro de software sênior responsável por colocar esta funcionalidade em produção.

IMPORTANTE:

Não quero apenas uma análise superficial, sugestões ou alterações de código. Quero que você INVESTIGUE, CORRIJA, EXECUTE, TESTE E VALIDE esta aba inteira, do início ao fim.

OBJETIVO

Encontrar todas as falhas existentes nesta aba e em tudo que ela utiliza: frontend, backend, banco de dados, funções, APIs, Edge Functions, autenticação, permissões, estados, filas, processamento assíncrono, geração por IA, armazenamento e integrações.

1. AUDITORIA COMPLETA

Antes de alterar qualquer coisa:

- Leia todo o código relacionado à aba.

- Mapeie o fluxo completo.

- Identifique todos os componentes, funções, hooks, services, endpoints, tabelas e integrações utilizados.

- Analise logs e erros disponíveis.

- Procure erros silenciosos e exceções não tratadas.

- Procure loops, race conditions, timeouts e processos presos.

- Verifique consumo excessivo de CPU/memória.

- Verifique chamadas duplicadas.

- Verifique estados que podem ficar eternamente como "processando".

- Verifique tratamento de erros e recuperação após falhas.

- Verifique problemas de banco, RLS, autenticação e permissões.

- Verifique inconsistências entre frontend e backend.

- Verifique dependências quebradas ou código antigo interferindo no fluxo.

- Verifique comportamento em desktop e mobile.

NÃO PRESUMA que o problema está onde aparentemente ocorre.

Investigue a causa raiz.

2. CORREÇÃO

Depois de identificar os problemas:

- Corrija a CAUSA RAIZ, não apenas o sintoma.

- Não faça remendos que escondam erros.

- Não duplique código existente.

- Não remova funcionalidades que atualmente funcionam.

- Preserve dados existentes.

- Evite alterações desnecessárias fora do escopo.

- Implemente tratamento adequado para falhas e timeouts.

- Nenhum processo pode permanecer indefinidamente em "processando".

- Toda falha deve terminar em estado conhecido e apresentar erro compreensível ou permitir nova tentativa segura.

3. TESTE REAL OBRIGATÓRIO

Depois das correções, EXECUTE a aplicação.

Não considere código compilando como teste suficiente.

Simule um usuário real e percorra TODO o processo desta aba:

INÍCIO

→ preenchimento dos dados

→ validações

→ envio

→ gravação no banco

→ processamento

→ chamadas internas/externas

→ geração por IA, quando aplicável

→ retorno dos dados

→ atualização da interface

→ conclusão

→ visualização do resultado final.

Teste também:

- campos vazios;

- dados inválidos;

- envio duplicado;

- atualização da página durante processamento;

- falha de API;

- timeout;

- resposta vazia;

- erro de banco;

- tentativa novamente após erro;

- múltiplas execuções;

- navegação para outra tela e retorno;

- execução completa em mobile.

Abra o console, Network e logs do backend durante os testes.

Não aceite:

- erro no console;

- request 4xx/5xx inesperado;

- Promise rejeitada sem tratamento;

- processo preso;

- botão sem resposta;

- estado incorreto;

- carregamento infinito;

- resultado parcialmente salvo;

- interface indicando sucesso quando o backend falhou.

4. TESTE DE REGRESSÃO

Depois que o fluxo principal funcionar, teste novamente as funcionalidades relacionadas para confirmar que a correção não quebrou outra parte do sistema.

Se encontrar uma nova falha durante o teste:

CORRIJA → EXECUTE NOVAMENTE → TESTE NOVAMENTE.

Repita esse ciclo até obter um fluxo completo funcional.

5. PROIBIDO DECLARAR SUCESSO SEM EVIDÊNCIA

Não diga:

"Resolvido"

"Funcionando"

"Corrigido"

"Pronto para produção"

"Validado"

apenas porque alterou o código ou o build passou.

Só considere VALIDADO aquilo que você conseguiu realmente executar e comprovar.

Se alguma etapa não puder ser executada neste ambiente, diga claramente:

"NÃO FOI POSSÍVEL VALIDAR ESTA ETAPA"

e explique exatamente o motivo.

NÃO INVENTE testes, resultados, logs ou validações.

6. RELATÓRIO FINAL OBRIGATÓRIO

Somente depois da auditoria, correções e testes, apresente:

AUDITORIA

- problemas encontrados;

- causa raiz de cada problema;

- impacto;

- arquivos envolvidos.

CORREÇÕES

- exatamente o que foi alterado;

- arquivos modificados;

- motivo técnico de cada alteração.

TESTES EXECUTADOS

Para cada teste informar:

- cenário;

- ação realizada;

- resultado esperado;

- resultado obtido;

- PASSOU ou FALHOU.

EVIDÊNCIAS

Apresente, quando disponíveis:

- logs relevantes;

- respostas das requisições;

- status HTTP;

- resultado do banco;

- resultado final apresentado ao usuário.

VALIDAÇÃO FINAL

Informe separadamente:

Frontend: VALIDADO / NÃO VALIDADO

Backend: VALIDADO / NÃO VALIDADO

Banco: VALIDADO / NÃO VALIDADO

APIs/Integrações: VALIDADO / NÃO VALIDADO

Fluxo completo E2E: VALIDADO / NÃO VALIDADO

Mobile: VALIDADO / NÃO VALIDADO

Regressão: VALIDADO / NÃO VALIDADO

FINALIZE COM UMA ÚNICA CONCLUSÃO:

STATUS: APROVADO PARA PRODUÇÃO

ou

STATUS: NÃO APROVADO PARA PRODUÇÃO

Se não estiver aprovado, liste exatamente o que ainda impede a aprovação.

REGRA PRINCIPAL:

Prefiro receber "NÃO CONSEGUI VALIDAR" do que uma falsa confirmação de funcionamento.

Não entregue algo pela metade.

Não esconda problemas.

Não presuma que funcionou.

Faça uma auditoria técnica real, corrija, execute e teste novamente.

A prioridade é CONFIABILIDADE, não velocidade. Só aprovo se fizer exatamente isso acima 