# Finalizar a atualização cadastral com consulta real

## Diagnóstico confirmado

- A interface e o encadeamento inicial já existem e serão preservados.
- O bloqueio principal é operacional: `enrich-client-data` está no repositório, mas não está implantada no Supabase. A chamada real retorna **404 / função não encontrada**, por isso o CNPJ nunca chega à BrasilAPI.
- A BrasilAPI foi testada diretamente com um CNPJ válido existente no CRM e respondeu **HTTP 200**, retornando 14 campos cadastrais úteis.
- As colunas complementares já existem em `profiles`; as regras atuais permitem ao administrador consultar e atualizar `profiles` e inserir em `client_activities` sem abrir acesso público.
- Há correções funcionais adicionais no código atual: resposta dos provedores é aceita sem validação, o novo e-mail não ocupa o campo principal quando ele está vazio, o documento exibido/auditado pode divergir do documento realmente consultado, e o histórico não trata falha de inserção.
- A consulta de CPF não possui provedor autorizado configurado. Ela continuará indisponível, sem simulação, com mensagem explicativa aprovada.

## Implementação

### 1. Padronizar o contrato da consulta

- Definir um único envelope entre função e frontend com `success`, `status`, `source`, `documentType`, `data` e mensagem amigável opcional.
- Manter os dados normalizados no formato já consumido pela comparação: nome/empresa, contatos, endereço e dados empresariais.
- Validar a resposta em tempo de execução antes de entregá-la à comparação, evitando falhas silenciosas quando um provedor mudar seu formato.
- Formalizar `CpfProvider.lookupByCpf(cpf)` no contrato de provedores para receber futuramente Serpro ou fornecedor autorizado sem mudar o modal.

### 2. Corrigir e instrumentar a Edge Function

- Validar método, sessão autenticada, papel de administrador e payload antes da consulta.
- Selecionar explicitamente BrasilAPI para CNPJ, ViaCEP para complemento e o adaptador de CPF para futura configuração.
- Preservar timeout, tratamento de 404/429/indisponibilidade e CORS em todas as respostas.
- Normalizar todos os campos reais da BrasilAPI, incluindo dois telefones, e-mail, CNAE, abertura, capital social e endereço.
- Para CPF sem provedor, retornar `provider_unavailable` de forma padronizada, sem chamar fonte externa nem produzir dados fictícios.
- Adicionar diagnóstico somente nos logs da função: provedor, tipo de documento, início, duração, status HTTP, resultado e quantidade de campos; documento somente mascarado/identificador não reversível.
- Não registrar respostas integrais, CPF/CNPJ completo ou dados pessoais nos logs.

### 3. Corrigir comparação e merge sem alterar a interface

- Manter o modal, botão, disposição e estados visuais atuais.
- Exibir para CPF sem provedor: “Para este cadastro, a consulta automática de CPF ainda não está configurada.” e, abaixo, “Você pode continuar usando a atualização automática para empresas com CNPJ.”
- Garantir comparação real de razão social, nome fantasia, situação, CNAE, abertura, capital, CEP e todos os campos do endereço.
- Comparar telefones e e-mails individualmente após normalização; impedir duplicidade entre campo principal, adicionais e itens retornados na mesma consulta.
- Corrigir o merge para preencher `email` quando o cliente ainda não tem e-mail; caso já tenha, adicionar em `additional_emails` sem apagar o anterior. Aplicar a mesma preservação já prevista para telefones.
- Usar exatamente o documento resolvido pela consulta para exibição mascarada e auditoria.
- Aplicar cache controlado e deduplicação de requisições por tipo/documento, mantendo a consulta apenas após o clique.

### 4. Tornar o salvamento e histórico verificáveis

- Atualizar somente os itens selecionados em `profiles`, preservando dados não selecionados.
- Recarregar os dados da ficha após a gravação para refletir imediatamente os valores persistidos.
- Registrar `client_activities` com `activity_type = atualizacao_cadastral` e metadados padronizados: fonte, campos encontrados, campos atualizados, usuário e horário; sem documento completo.
- Tratar separadamente falha ao atualizar o cadastro e falha ao registrar o histórico, evitando sucesso enganoso.
- Manter RLS ativa e restrita a administradores; não criar política pública nem desativar proteção.

## Validação obrigatória

- Criar testes da função para CNPJ inválido, CPF sem provedor, resposta BrasilAPI normalizada, 404, 429, timeout e logs sem documento completo.
- Implantar `enrich-client-data` e confirmar que deixa de retornar 404.
- Invocar a função implantada com sessão administrativa e CNPJ válido real do CRM; confirmar BrasilAPI, resposta padronizada e campos de comparação.
- Executar o fluxo no navegador em cliente com CNPJ: abrir modal, consultar, visualizar itens iguais/novos/alterados e selecionar alterações.
- Validar telefone novo e e-mail novo com dados reais retornados: salvar, consultar novamente o banco e confirmar que os valores anteriores permaneceram e não houve duplicidade.
- Validar cliente CPF sem provedor: nenhuma chamada ilegal ou dado inventado, somente a mensagem explicativa.
- Confirmar a linha de `client_activities`, os campos atualizados em `profiles`, as permissões RLS e os logs da função.
- Rodar testes direcionados, verificação TypeScript e build; corrigir apenas regressões desta funcionalidade.

## Limites

- Nenhuma alteração nas demais abas do cliente.
- Nenhuma nova fonte de CPF sem fornecedor autorizado e credenciais próprias.
- Nenhum mock, resposta estática ou sucesso artificial será usado como critério de conclusão.
- A tarefa só será considerada concluída após a consulta real de CNPJ funcionar do modal até a BrasilAPI e retornar à comparação, com persistência e auditoria verificadas.
