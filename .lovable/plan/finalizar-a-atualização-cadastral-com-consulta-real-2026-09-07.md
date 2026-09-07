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

FINALIZAR AGORA — CONSULTA CADASTRAL REAL E FUNCIONAL

A funcionalidade “Atualizar os dados” já existe na aba Contatos e a interface está aprovada.

NÃO recriar a interface.

NÃO alterar o layout.

NÃO alterar outras abas.

O objetivo agora é corrigir a integração real e entregar a funcionalidade funcionando ponta a ponta.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BLOQUEIO PRINCIPAL IDENTIFICADO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A Edge Function:

enrich-client-data

já existe no código/repositório, porém NÃO está implantada no Supabase.

A chamada atual retorna:

404 — Function not found

Por isso o CNPJ nunca chega à BrasilAPI.

A BrasilAPI já foi validada diretamente com CNPJ real e respondeu HTTP 200 com dados cadastrais válidos.

PORTANTO:

A PRIMEIRA TAREFA É GARANTIR O DEPLOY REAL DA EDGE FUNCTION.

Não considerar a tarefa concluída enquanto:

enrich-client-data

→ estiver implantada

→ estiver acessível

→ aceitar sessão administrativa

→ consultar BrasilAPI

→ retornar dados ao frontend

→ alimentar a comparação.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. AUDITAR ANTES DE ALTERAR

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verificar a implementação atual de:

- DataEnrichmentDialog

- ClientDetailSheet

- enrichmentService

- comparisonService

- mergeService

- types

- brasilApiProvider

- viaCepProvider

- cpfProvider

- enrich-client-data

- profiles

- client_activities

- migrations

- RLS

- configuração do Supabase

Não criar arquivos duplicados.

Não recriar funcionalidades que já existem.

Corrigir somente o necessário.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. DEPLOY DA EDGE FUNCTION

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Garantir que:

enrich-client-data

esteja realmente implantada no projeto Supabase utilizado pelo sistema.

Verificar:

- nome correto da função;

- estrutura da função;

- imports;

- runtime;

- configuração;

- autenticação;

- CORS;

- secrets;

- endpoint;

- permissões.

Depois do deploy, testar a função real.

CRITÉRIO OBRIGATÓRIO:

A chamada não pode mais retornar:

404 Function not found.

Se o ambiente atual não permitir realizar o deploy automaticamente, NÃO fingir que foi concluído.

Nesse caso, identificar claramente o bloqueio operacional e deixar o código pronto para deploy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. CONTRATO ÚNICO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Padronizar a resposta da função:

{

  success,

  status,

  source,

  documentType,

  data,

  message

}

Estados possíveis:

success

provider_unavailable

invalid_document

not_found

rate_limited

timeout

provider_error

unauthorized

O frontend deve consumir somente esse contrato.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. SEGURANÇA

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Antes de consultar:

1. validar sessão;

2. validar usuário;

3. validar papel/permissão de administrador;

4. validar payload;

5. validar CPF/CNPJ.

NÃO criar acesso público.

NÃO desativar RLS.

NÃO aceitar consulta anônima.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. CNPJ — CONSULTA REAL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quando houver CNPJ:

usar BrasilAPI:

[https://brasilapi.com.br/api/cnpj/v1/{CNPJ}](https://brasilapi.com.br/api/cnpj/v1/{CNPJ})

A consulta deve ser realizada pelo backend/Edge Function.

Normalizar:

- razão social;

- nome fantasia;

- situação cadastral;

- CNAE;

- data de abertura;

- capital social;

- CEP;

- logradouro;

- número;

- complemento;

- bairro;

- município;

- UF;

- telefone 1;

- telefone 2;

- e-mail.

Não usar mock.

Não usar JSON estático.

Não usar dados hardcoded.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. VIA CEP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quando necessário complementar/validar endereço:

[https://viacep.com.br/ws/{CEP}/json/](https://viacep.com.br/ws/{CEP}/json/)

Tratar:

- CEP inválido;

- CEP não encontrado;

- timeout;

- indisponibilidade.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. CPF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NÃO criar solução fictícia.

NÃO consultar bases vazadas.

NÃO fazer scraping.

NÃO utilizar fonte não autorizada.

Enquanto não houver provedor autorizado:

retornar:

status:

provider_unavailable

E frontend mostrar:

“Para este cadastro, a consulta automática de CPF ainda não está configurada.”

“Você pode continuar usando a atualização automática para empresas com CNPJ.”

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. DOCUMENTO RESOLVIDO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

O documento efetivamente usado na consulta deve ser o mesmo documento utilizado internamente para:

- selecionar o provedor;

- executar a consulta;

- gerar diagnóstico;

- auditoria.

Nunca utilizar um CPF/CNPJ diferente daquele efetivamente consultado.

Para exibição:

mascarar o documento.

Nunca gravar documento completo no log.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

9. NORMALIZAÇÃO E COMPARAÇÃO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Garantir comparação real.

TELEFONES:

Normalizar antes da comparação.

Exemplo:

(11) 99999-9999

11999999999

+55 11 99999-9999

= mesmo telefone.

Comparar:

- telefone principal;

- telefones adicionais;

- telefone 1 retornado;

- telefone 2 retornado.

Não criar duplicidade.

E-MAIL:

Ignorar:

- maiúsculas/minúsculas;

- espaços.

Comparar:

- e-mail principal;

- e-mails adicionais;

- e-mails retornados.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10. CORREÇÃO IMPORTANTE DO E-MAIL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Se:

[profiles.email](http://profiles.email)

estiver vazio

e a API retornar e-mail:

→ preencher o campo principal `email`.

Se:

[profiles.email](http://profiles.email)

já estiver preenchido

e a API retornar um e-mail diferente:

→ preservar o atual;

→ adicionar o novo em `additional_emails`.

Nunca apagar o e-mail existente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

11. TELEFONES

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Se o telefone principal estiver vazio:

→ preencher o telefone principal.

Se já existir telefone:

→ preservar.

Novo telefone:

→ adicionar em `additional_phones`.

Se já existir em qualquer formato:

→ não adicionar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

12. COMPARAÇÃO VISUAL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Manter exatamente a interface atual.

Estados:

🟢 Sem alteração

🟠 Dado atualizado encontrado

🔵 Novo dado encontrado

Cada alteração:

☐ Atualizar este dado

Novo telefone/e-mail:

☐ Adicionar

Nada deve ser salvo automaticamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

13. MERGE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Implementar merge aditivo.

Regra:

DADO EXISTENTE + DADO NOVO

=

PRESERVAR EXISTENTE + ADICIONAR NOVO

Nunca:

EXISTENTE → APAGAR → NOVO

Aplicar para:

- telefones;

- e-mails.

Para endereço e dados empresariais:

somente atualizar quando operador selecionar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

14. SALVAMENTO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ao clicar:

Atualizar dados selecionados

executar persistência REAL no Supabase.

Atualizar somente os campos selecionados.

Depois:

1. confirmar UPDATE/INSERT;

2. registrar histórico;

3. buscar novamente o cliente;

4. atualizar a ficha;

5. atualizar a aba Contatos;

6. mostrar:

“Dados atualizados com sucesso.”

Não apresentar sucesso se o banco falhar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

15. HISTÓRICO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Utilizar:

client_activities

com:

activity_type = 'atualizacao_cadastral'

metadata:

{

  source,

  fields_found,

  fields_updated,

  user_id,

  updated_at

}

Não armazenar CPF/CNPJ completo.

Se a atualização do cliente funcionar mas o histórico falhar:

NÃO informar simplesmente que tudo ocorreu com sucesso.

Tratar o erro separadamente e registrar diagnóstico técnico no backend.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

16. LOGS DA EDGE FUNCTION

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Registrar somente informações técnicas necessárias:

- provider;

- documentType;

- início;

- duração;

- status HTTP;

- resultado;

- quantidade de campos retornados.

Documento deve ser:

- mascarado;

OU

- transformado em identificador não reversível.

Nunca registrar:

- CPF completo;

- CNPJ completo;

- resposta integral da API;

- dados pessoais desnecessários.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

17. CACHE E DEDUPLICAÇÃO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Manter cache controlado por:

tipo de documento + identificador normalizado.

Impedir chamadas simultâneas duplicadas.

A consulta somente acontece após:

🔍 Verificar dados atualizados

Nunca ao abrir o modal.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

18. TESTES OBRIGATÓRIOS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Executar testes reais para:

1. CNPJ inválido

2. CNPJ válido

3. BrasilAPI HTTP 200

4. BrasilAPI 404

5. BrasilAPI 429

6. timeout

7. CPF sem provedor

8. normalização de telefone

9. normalização de e-mail

10. novo telefone

11. novo e-mail

12. telefone duplicado

13. e-mail duplicado

14. atualização de endereço

15. atualização de dados empresariais

16. falha no banco

17. falha no histórico

18. usuário sem permissão

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

19. TESTE PONTA A PONTA OBRIGATÓRIO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usar um cliente REAL do CRM com CNPJ válido.

Executar:

Ficha do cliente

→ Contatos

→ Atualizar os dados

→ Verificar dados atualizados

Confirmar:

Frontend

↓

Edge Function

↓

BrasilAPI

↓

Resposta normalizada

↓

ComparisonService

↓

Modal

↓

Seleção

↓

Supabase

↓

client_activities

↓

Ficha atualizada.

Esse fluxo precisa funcionar de verdade.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

20. TESTE DE PRESERVAÇÃO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Antes de atualizar:

registrar os telefones e e-mails atuais do cliente.

Depois da atualização:

confirmar no banco que:

✓ antigos continuam;

✓ novos foram adicionados;

✓ nenhum duplicado foi criado;

✓ campos não selecionados permaneceram iguais.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

21. CPF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Testar cliente CPF.

Resultado esperado:

“Para este cadastro, a consulta automática de CPF ainda não está configurada.”

Sem:

- mock;

- dados inventados;

- scraping;

- consulta ilegal.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

22. BUILD FINAL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Executar:

- TypeScript check;

- testes direcionados;

- build;

- validação das migrations;

- validação das RLS;

- validação da Edge Function;

- validação dos imports;

- validação do fluxo frontend/backend.

Corrigir regressões causadas por esta implementação.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITÉRIO FINAL DE ACEITE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NÃO considerar concluído porque o botão existe.

NÃO considerar concluído porque o modal abre.

NÃO considerar concluído porque o código compila.

A funcionalidade somente está CONCLUÍDA quando:

✓ enrich-client-data está implantada;

✓ não retorna 404;

✓ sessão administrativa é validada;

✓ CNPJ real é consultado;

✓ BrasilAPI responde;

✓ dados retornam ao frontend;

✓ comparação funciona;

✓ operador seleciona alterações;

✓ dados são persistidos;

✓ telefones/e-mails antigos são preservados;

✓ novos contatos são adicionados sem duplicidade;

✓ histórico é gravado;

✓ ficha é atualizada;

✓ falhas são tratadas corretamente;

✓ CPF permanece indisponível sem provedor autorizado;

✓ nenhum mock é utilizado.

NÃO afirmar “concluído” sem validar o fluxo real de CNPJ ponta a ponta.