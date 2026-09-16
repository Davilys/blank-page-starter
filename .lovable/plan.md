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
aprovado ou qualquer outro módulo.
