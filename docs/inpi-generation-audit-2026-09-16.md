# Recursos INPI — auditoria técnica e correções candidatas (16/09/2026)

**STATUS: NÃO APROVADO PARA PRODUÇÃO.**

Esta entrega NÃO representa homologação completa nem uma auditoria exaustiva
concluída. Há defeitos remanescentes, falta implantação em teste e o fluxo real
não chegou à revisão/PDF. Não mesclar este candidato na produção.

Base inicial: `c604e62db302fd0b60c2d43d1eaa99c200cf8f1e`.
Reconciliado com `bc7ceb5e07289a083aa17db9712d8a07c3ccc428`, preservando a
correção de STALE_RUN_MS e as permissões por módulo adicionadas durante a auditoria. Alterações restritas aos
serviços de Recursos INPI, componentes da aba e tipos correspondentes às
migrações aditivas. Nenhum caso aprovado foi modificado. Nenhuma publicação,
mensagem, protocolo, alteração de credencial ou execução de migração remota.

## Fluxo inspecionado

`RecursosINPI` → `CasePreparationPanel` → armazenamento privado e
`inpi_case_documents` → extração local / `read-inpi-scanned-pages` →
`generate-inpi-orientation` → `process-inpi-resource` (prepare, pass1, pass2) →
`inpi_resources` → `CaseApprovalPanel` / `review-inpi-draft` →
`caseInventory` / `packageBuilder` / `INPIResourcePDFPreview`.

Serviços associados inspecionados: `adjust-inpi-resource`,
`extract-resource-evidences`, `sign-inpi-evidence`, `chat-inpi-legal`.
Tabelas relacionadas: casos, documentos, orientações, trabalhos de geração,
versões, aprovações, revisões, pacotes, evidências legadas e registros de IA.
Foram examinadas as migrações/RLS correspondentes. Isso não comprova que o
banco publicado tem exatamente o mesmo esquema nem todas as mesmas políticas.
Nem todo texto de prompt/layout legado foi revisado linha a linha.

## Problemas e tratamento no candidato

| Problema / causa no código | Impacto | Arquivos | Tratamento |
|---|---|---|---|
| IA mantém execução Edge aberta por até 300 s; heartbeat não elimina limites do worker | Interrupção e repetição de trabalho | process-inpi-resource/index.ts | Responses em background, identificador persistido, consultas curtas |
| Streaming podia terminar sem evento terminal confirmado | Texto parcial anunciado como peça | index.ts, durableResponse.ts | Exigir completed, texto não vazio e ausência de recusa |
| Trabalho não guardava ID da resposta; tentativas antigas podiam assumir execução nova | Cobrança duplicada, corrida entre workers | runControl.ts, index.ts | Reserva única por operação, tentativa/etapa/token e comparação do heartbeat observado |
| Retomada confundia preparo parcial com completo | Anexos omitidos ou reprocessados | index.ts | Preservar etapa prepare até concluir; erros transitórios de arquivo não viram ausência |
| Parte 2 recebia só 6.000 caracteres da parte 1, sem mesmos anexos | Argumentação desconectada de provas | index.ts | Texto anterior integral e mesmos arquivos preparados |
| Extração inválida era silenciosamente substituída por dados vazios | Minuta incompleta | index.ts | Falha explícita de extração/JSON |
| Finalização repetida inseria mais de uma minuta; vínculo falho era ignorado | Duplicação e perda de relação com caso | RecursosINPI.tsx, migração | generation_job_id único e confirmação de gravação |
| Após recarga, frontend não lia o trabalho salvo nem a orientação | Usuário perde o acompanhamento | CasePreparationPanel.tsx, RecursosINPI.tsx | Recuperar orientação e botão Retomar geração existente |
| Orientação podia começar durante OCR; atualização is_stale não era executada | Análise de acervo ainda incompleto | CasePreparationPanel.tsx | Bloquear enquanto lendo/enviando; await na atualização; travas imediatas de ação |
| Confirmação baixava novamente todos os anexos no celular | Memória/rede desnecessárias | CasePreparationPanel.tsx | Enviar caseId e utilizar arquivos já armazenados |
| OCR gravava data de conclusão antes da IA e ignorava falha da gravação final | Leitura malsucedida reutilizada como sucesso | read-inpi-scanned-pages, migração | Reserva temporal separada da conclusão, CAS por token, checagem do resultado e da persistência |
| Revisão aceitava JSON {} como lista sem problemas; confiava nos hashes do cliente | Falsa revisão limpa / versão incorreta | review-inpi-draft, inpiReviewValidation | Schema mínimo, status terminal, cálculo de hashes no servidor e reconferência do acervo |
| Assinador de evidências e chat não verificavam sessão administrativa no handler | Controle de acesso insuficiente | sign-inpi-evidence, chat-inpi-legal, INPILegalChatDialog | getUser + has_inpi_resources_access e token de sessão real no frontend |
| Pacote considerava conversão pendente como completo | Falso pacote concluído | packageBuilder.ts | Exigir convertido e conteúdo não vazio |

Não foi demonstrada a causa exata da captura histórica de “Geração interrompida”:
ela exige os logs daquele trabalho. As falhas de código acima são evidências
estáticas, não atribuição retrospectiva de um erro específico.

## Teste real na versão publicada (não contém o candidato)

Acesso administrativo foi obtido por formulário seguro. Foram usados os três
PDFs fornecidos pelo usuário em um caso separado. Os documentos e conteúdo do
cliente não são incluídos neste repositório público.

| Cenário / ação | Esperado | Obtido | Resultado |
|---|---|---|---|
| Entrar e abrir Recursos INPI | Tela acessível com sessão administrativa | Tela abriu | PASSOU |
| Modalidade ainda não selecionada | Avanço bloqueado | Botão Escolher Estratégia Jurídica desabilitado | PASSOU |
| Preparação sem anexos | Não gerar peça | Orientação e confirmação desabilitadas | PASSOU |
| Upload dos três PDFs em categorias distintas | Arquivos visíveis | Três documentos apareceram | PASSOU |
| Leitura do principal e OCR das provas/comprovante | 1 + 2 + 1 páginas interpretadas | Interface mostrou exatamente essas contagens | PASSOU no caminho normal, sem conferência humana de cada transcrição |
| Estado enquanto OCR trabalha | Orientação aguarda leitura | Orientação já estava habilitada | FALHOU |
| Gerar orientação real | Orientação baseada nos documentos | Texto exibiu análise das provas e pagamento | PASSOU tecnicamente; conteúdo não recebeu validação jurídica |
| Conferência funcional da orientação | Não exigir protocolo anterior à redação | Texto pediu recibo/protocolo antes de redigir | FALHOU — defeito remanescente de prompt/conteúdo |
| Iniciar geração da minuta de homologação | Avançar até revisão | Chegou a “Escrevendo a primeira parte da peça…” | NÃO CONCLUÍDO |
| Recarregar durante geração e reabrir preparação | Recuperar trabalho e orientação | Voltou ao histórico; documentos reapareceram, orientação e acompanhamento não | FALHOU |
| Revisão, aprovação, pacote e PDF desse teste | Resultado final inspecionável | Não alcançados | NÃO FOI POSSÍVEL VALIDAR ESTA ETAPA |

O console acessível foi consultado: registros observados incluíam mensagens da
extensão do navegador, que não foram atribuídas ao CRM. Não foram obtidos
Network completo, respostas HTTP da geração ou logs do backend. Não se afirma
ausência de 4xx/5xx, erro de servidor ou Promise rejeitada.

## Testes locais do candidato

| Cenário | Ação / esperado | Obtido |
|---|---|---|
| Reinício, concorrência e reserva de IA | Transportes simulados: um POST e retomada por GET | PASSOU |
| Timeout ambíguo no POST / erro ao salvar checkpoint | Não reenviar cobrando novamente | PASSOU |
| GET 429/500/503 | Consultar mesmo ID | PASSOU |
| Resposta de outro trabalho, parcial, vazia ou recusada | Bloquear conclusão | PASSOU |
| Acervo alterado | Rejeitar mistura de versões | PASSOU |
| Revisão JSON ausente/malformado, bloqueante indevidamente falso | Rejeitar ou manter bloqueio | PASSOU |
| Sem sessão, API key sem usuário, usuário comum, falha na consulta de papel | Negar acesso | PASSOU com cliente simulado |
| Anexo pendente/parcial/falho/vazio | Pacote incompleto | PASSOU |
| Marcadores, páginas e inventário | Preservar referência correta e isolamento | PASSOU |
| Suíte src/lib/inpi | Vitest | 75 testes passaram; não são 75 testes E2E |
| Cinco funções alteradas | Bundle esbuild | PASSOU (não executa Deno remoto) |
| Frontend | Vite build | PASSOU, 56,67 s; avisos existentes de CSS/chunks |
| Migrações | Aplicar duas vezes em PostgreSQL/PGlite isolado; conferir unicidade e grants | PASSOU; NÃO é teste do Supabase real |
| TypeScript global | tsc --noEmit | FALHOU: cinco erros existentes em PublicacaoTab, ClientDetailSheet e RevistaINPI; nenhum erro restante atribuído aos arquivos alterados |

## Bloqueios remanescentes: não esconder nem considerar resolvidos

1. Falta implantar migrações, funções e frontend no mesmo ambiente de teste e
   executar o candidato com o modelo real. GitHub e login do CRM não fornecem
   acesso de deploy/logs do Supabase. Nada foi mesclado em main.
2. Não há varredor independente da tela para avançar/encerrar todos os trabalhos.
   O modelo continua em background, mas etapas seguintes dependem do polling.
   Falha ambígua antes de persistir response_id exige investigação. Repetir a
   mesma tentativa com erro terminal salvo não corrige configuração sozinho.
3. Orientação, revisão, ajuste e OCR ainda precisam de orquestração durável
   completa. Limitar espera não substitui essa solução. OCR continua limitado
   a 12 páginas por pedido; leitura em lotes e relação exata de páginas mistas
   ainda precisam ser concluídas. A contagem proposta é conservadora, não soma
   páginas potencialmente repetidas.
4. Aprovação final precisa de transação/validação no servidor. Há caminhos
   legados de aprovação e edição que não asseguram todos os vínculos de versão.
   CaseApprovalPanel ainda tem gravações e invalidações a endurecer.
5. PDF precisa de homologação real: Word convertido só como texto pode perder
   imagens; PDF rasterizado não preserva assinatura digital; memória de arquivos
   grandes, impressão direta, versão histórica e persistência do manifesto ainda
   exigem correção/conferência. Não foi aberto um PDF novo nesta execução.
6. Fingerprints usados por orientação/aprovação ainda não incluem toda mudança
   de OCR e ordenação; recuperação de caso histórico/aprovado precisa de vínculo
   explícito para não reutilizar o caso errado. Documentos não foram apagados.
7. Prompts contêm exigências artificiais de bibliografia/protocolo; conferência
   de fontes não pode ser apenas uma instrução à IA. Não há certificação jurídica.
8. Falhas reais de API/banco, permissões com segunda identidade, dois navegadores,
   mobile e regressão E2E das três modalidades não foram executadas. Não foi
   provocado incidente no serviço publicado para simular indisponibilidade.

## Validação final

Frontend: NÃO VALIDADO integralmente.
Backend: NÃO VALIDADO no ambiente real.
Banco: NÃO VALIDADO no ambiente real.
APIs/Integrações: NÃO VALIDADAS integralmente.
Fluxo completo E2E: NÃO VALIDADO (recarga falhou; revisão/PDF não alcançados).
Mobile: NÃO VALIDADO.
Regressão: NÃO VALIDADA integralmente.

**STATUS: NÃO APROVADO PARA PRODUÇÃO.**

## Implantação e reversão, somente após resolver os bloqueios

As migrações são aditivas. O transporte usa `background: true, store: true`,
preserva o modelo configurado e salva respostas no banco privado. Confirmar
compatibilidade e retenção da conta real antes da ativação. Aplicar primeiro as
migrações, depois funções e frontend correspondentes em ambiente isolado.
Para reverter, restaurar os arquivos anteriores; deixar colunas/tabelas novas
sem uso até não haver trabalhos ativos. Não apagar dados nem aprovações.

Referências técnicas consultadas:
- https://supabase.com/docs/guides/functions/limits
- https://developers.openai.com/api/docs/guides/background
