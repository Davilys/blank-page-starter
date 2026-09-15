# Upgrade do módulo Recursos INPI — três modalidades

Escopo travado: apenas a aba Recursos INPI e os serviços que ela usa diretamente. Nada de Emails, CRM, site, Revista INPI, cobranças, contratos, BotConversa, prazos ou automações. Nenhum protocolo e nenhum envio de mensagem. Entrega em preview, sem publicar, até sua aprovação.

## O que existe hoje (inspecionado)

- Tela: `src/pages/admin/RecursosINPI.tsx` (2.757 linhas) com etapas `select-type → select-agent → upload → processing → review → approved`; três agentes (Mazzola, Guerra, Nascimento) definidos no próprio arquivo.
- PDF: `src/components/admin/INPIResourcePDFPreview.tsx` (papel timbrado atual — será preservado).
- Funções: `process-inpi-resource` (geração em 2 passes, OpenAI Responses API, **gpt-5-mini**, reasoning "minimal"), `adjust-inpi-resource` (**gpt-5-mini**), `extract-resource-evidences` (OCR), `chat-inpi-legal` (**gpt-5**), `sign-inpi-evidence`.
- Tabelas: `inpi_resources`, `inpi_resource_evidences`, `inpi_knowledge_base`.
- Upload atual: genérico, até 10 arquivos, sem categoria, com provas também na etapa Revisão.
- Nomes de agente e rótulos de modalidade circulam por props mas alguns textos da tela e prompts são fixos — é daí que vem "Mazzola" aparecendo com outro agente selecionado.

## Modelo dedicado

Nova configuração isolada `RECURSOS_INPI_MODEL` (valor `gpt-5.6-sol`), lida somente pelas funções destas três modalidades. `OPENAI_MODEL` e os demais consumidores (`chat-inpi-legal`, outras modalidades, outros módulos) ficam exatamente como estão. Antes de ativar, faço uma chamada mínima real, sem dado de cliente, para confirmar acesso, endpoint, parâmetros aceitos, entrada multimodal e saída estruturada; se o modelo não responder, o módulo mostra falha de configuração ao administrador e preserva o trabalho — nunca troca de família silenciosamente. Esforço de raciocínio alto nas etapas jurídicas, limites de saída dimensionados e detecção de truncamento/recusa/estrutura inválida. Log por chamada: modelo usado, versão do prompt, operação, duração, consumo e identificador de correlação, sem conteúdo sensível.

## Fases (cada uma entregue e conferida antes da seguinte)

**Fase 1 — Base e correções de identidade.** Migração aditiva: caso de trabalho persistente (modalidade, agente, versões), documentos categorizados, orientação, versões de minuta, aprovações, log de chamadas de IA. Modelo dedicado + probe. Textos dinâmicos corrigidos: modalidade e agente exibidos e usados nos prompts sempre os selecionados. Investigação dos erros não-2xx de indeferimento e manifestação com causa identificada (sem presunção).

**Fase 2 — Documentos classificados.** Upload por grupos (documento principal do INPI, provas do cliente, procuração, guia e comprovante, pedido/espelhos/anterioridades, complementares), múltiplos arquivos por grupo. Formatos com leitor real e testado: PDF, JPG/JPEG, PNG, WEBP, DOCX, XLSX/XLS, CSV. Validação de MIME real, integridade, tamanho, páginas/abas e proteção; estado explícito para arquivo ilegível. OCR quando necessário, preservando o original e marcando trechos incertos. Planilhas lidas por aba/cabeçalho/célula com abas ocultas sinalizadas. Hash, categoria, autor, data, versão, status de extração, deduplicação, remover/substituir/recategorizar com histórico. Basta um arquivo utilizável para prosseguir; lacunas são informadas, não bloqueiam.

**Fase 3 — Consultoria preparatória.** Botão "Gerar orientação com IA" produzindo as seções A–G, com recomendações documentais específicas (o que pedir, que fato comprova, a qual argumento serve, prioridade, alternativa). Botão "Copiar lista para solicitar ao cliente", sem envio. Salvar/retomar, "Atualizar análise com novos documentos" mostrando alterações propostas sem sobrescrever edição humana, e registro da versão confirmada que alimenta o agente.

**Fase 4 — Matriz de evidências e base jurídica.** Relação fato → alegação → documento → página/aba/célula → trecho → estado de conferência → efeito na peça, separando documento oficial, declaração, prova particular, inferência e desconhecido. Número de processo tratado como texto de nove dígitos. Conteúdo de anexo tratado como evidência, nunca como instrução. Citações só com fonte conferida; sem verificação, saem da peça e ficam registradas como limitação no relatório interno.

**Fase 5 — Redação, revisão e aprovação.** Instruções comuns às três modalidades com as regras específicas de cada uma, mantidas as três estratégias e seus históricos. Upload de provas removido da Revisão e concentrado em Documentos. Revisão com texto editável, ajustes com IA, documentos vinculados e referências clicáveis. Revisão automática de consistência, fontes, datas, nomes, pedidos, placeholders e contradições. Separação entre aprovação interna do texto e conferência para protocolo; sem conferência, o PDF sai identificado como minuta com pendências. Registro de quem aprovou, quando e qual versão; alteração posterior cria nova versão e invalida a aprovação daquela versão.

**Fase 6 — PDF final.** Timbre, logo, cores, dados institucionais, cabeçalho e rodapé atuais preservados; corrijo apenas defeitos de composição (espaçamento, acentos, cortes, margens, tabelas, quebras, paginação). Montagem: peça → índice de anexos → todos os anexos na ordem aprovada, uma vez cada. Anexos não citados também entram no inventário. Orientação, prompts e relatório interno ficam fora. Provas preservadas sem timbre sobreposto; PDF assinado sinalizado para envio separado. Planilhas convertidas em páginas legíveis, conferíveis antes da aprovação. Falha de conversão impede anunciar pacote completo. Verificação final de páginas, texto extraível, acentos, índice e contagem de anexos antes de liberar o download.

**Fase 7 — Confiabilidade e testes.** Estados reais (extração, análise, aguardando documentos, geração, revisão, falha, PDF), sem percentual simulado; operação longa acompanhada por tarefa persistida. Retries limitados e idempotentes, bloqueio de duplo clique, proteção contra mistura de casos e resposta antiga sobrescrevendo versão nova. Acesso verificado no servidor, armazenamento privado e links temporários. Homologação identificada, PDFs marcados "SIMULAÇÃO — NÃO PROTOCOLAR", as nove combinações rodadas, mais os cenários da auditoria e as falhas (modelo inacessível, limite de API, resposta incompleta, conversão falha, documento protegido, planilha extensa, anexo assinado, erro de gravação, recarregamento, clique repetido, acesso indevido). Comprovação do modelo usado em cada etapa e de que os demais módulos seguem com a configuração anterior.

## Entrega

Ao final de cada fase: arquivos, funções e migrações alterados, causa das falhas encontradas, testes executados, PDFs de homologação, limitações e caminho de reversão isolada. Nada vai a produção nem reprocessa histórico antes da sua aprovação.
