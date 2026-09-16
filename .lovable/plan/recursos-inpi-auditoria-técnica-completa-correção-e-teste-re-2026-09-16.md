# Recursos INPI — auditoria técnica completa, correção e teste real

## Onde está o bloqueio de acesso (resposta direta)

O banco e o login deste projeto são um Supabase **seu** (externo, ref `scpbqsvwojhbxihyqbdz`). Nesse modo, a plataforma não me deixa criar uma sessão de teste automática — ela responde que o backend é gerenciado pelo usuário. Não é falta de permissão no seu painel: é a forma como o projeto está conectado.

Não existe permissão que você possa marcar para resolver isso. O que resolve é uma das duas:

1. Você me envia aqui **e-mail e senha** de um usuário já existente (você escolheu esta opção — por exemplo `caroline@webmarcas.net`). Uso a senha só para abrir o navegador de teste e percorrer a aba. Recomendo trocar a senha depois.
2. Esse usuário precisa estar liberado em **Configurações > permissões > Recursos INPI** com ver e editar (ou ser administrador).

Enquanto a senha não chegar, eu executo tudo o que não depende de login e deixo o restante marcado como NÃO VALIDADO — nunca como aprovado.

## 1. Auditoria (antes de mexer em qualquer coisa)

Leitura completa e mapeamento do caminho real da aba, ponta a ponta:

- Tela: `RecursosINPI.tsx`, `CasePreparationPanel.tsx`, `CaseApprovalPanel.tsx`, `EvidenceGallery.tsx`, `INPIResourcePDFPreview.tsx`, `InpiLookupPanel.tsx`, `INPILegalChatDialog.tsx`.
- Bibliotecas: `caseDocuments.ts`, `caseInventory.ts`, `packageBuilder.ts`, `orientationDisplay.ts`, `runControl.ts`.
- Servidor: `process-inpi-resource`, `generate-inpi-orientation`, `review-inpi-draft`, `adjust-inpi-resource`, `read-inpi-scanned-pages`, `extract-resource-evidences`, `sign-inpi-evidence`.
- Banco: as onze tabelas `inpi_*`, as regras de acesso, os índices únicos, o contador de numeração de documentos e o bucket privado.

O que vou procurar, com evidência em log ou consulta para cada achado: exceções engolidas, chamadas duplicadas, corridas entre abas, tempos de espera sem fim, estados que ficam para sempre em "processando", estouro de CPU/memória no servidor, divergência entre o que a tela mostra e o que o servidor gravou, código antigo ainda no caminho, e comportamento em celular.

Já há uma causa confirmada e corrigida na rodada anterior (um valor usado sem estar importado derrubava a geração antes de preparar os documentos). A auditoria parte daí, não dela como conclusão.

## 2. Correção

Corrijo apenas causas comprovadas por log, consulta ou execução. Sem remendo que esconda erro, sem duplicar código, sem remover o que funciona, sem tocar em outros módulos, nos modelos de IA, nas integrações ou no BANDA UAU já aprovado.

Regra que passa a valer para todo o fluxo: nenhum trabalho pode ficar preso. Toda falha termina em estado conhecido, com motivo legível na tela e um "Tentar de novo" que retoma só o que faltou, sem reaproveitar provas de uma versão antiga dos documentos.

## 3. Teste real (com o login)

Cópia do BANDA UAU, criada só para o teste. O caso aprovado original não é tocado.

Percurso completo, com console, rede e logs do servidor abertos: anexar os documentos → conferir leitura e numeração → gerar orientação → gerar o recurso → revisar → conferir → exportar o PDF → reabrir pelo histórico.

Cenários de borda: campo vazio, arquivo inválido, envio duplicado, dois cliques, duas abas, recarregar durante o processamento, sair da tela e voltar, falha de API, tempo esgotado, resposta vazia, erro de banco, nova tentativa depois do erro, remoção de uma prova, arquivo indisponível no armazenamento, e a execução inteira na largura de celular.

Conferência visual do PDF: imagens na página certa dentro do argumento, legendas com documento e página, referências, índice, anexos, papel timbrado e legibilidade. Pendência documental ou jurídica mantém o carimbo de minuta — não forço aprovação para fechar teste.

Depois, regressão nas partes vizinhas que usam as mesmas tabelas e o mesmo armazenamento.

## 4. Relatório final

Entrego um documento único com: problemas encontrados e causa raiz de cada um; o que foi alterado e por quê; cada teste com cenário, ação, esperado, obtido e PASSOU/FALHOU; logs, status HTTP e resultado no banco como evidência; o PDF de homologação para baixar; e a validação separada de tela, servidor, banco, integrações, fluxo completo, celular e regressão.

Fecha com uma única linha: APROVADO PARA PRODUÇÃO ou NÃO APROVADO, e, se não aprovado, exatamente o que falta. Publicação só depois da sua autorização.

## Detalhes técnicos

- Execução do fluxo autenticado via Playwright no sandbox contra `localhost:8080`, com login pelo formulário usando a credencial enviada (usada só em memória, nunca registrada em arquivo, log ou captura de tela).
- Verificação de servidor por chamadas diretas às funções com o token do usuário de teste, conferindo 401/403/200 conforme a permissão, e leitura dos logs de cada execução.
- Verificação de banco por consultas às tabelas `inpi_*` antes e depois de cada etapa, confirmando estado, `run_token`, `heartbeat_at`, `prepared_files`, numeração dos documentos e unicidade de revisão/aprovação/pacote.
- Migrações, se necessárias, apenas aditivas, pelo mecanismo de migração — nunca editando arquivos de migração à mão.
