# Fazer a atualização cadastral funcionar para CNPJ e CPF

## Diagnóstico confirmado

- A tela da imagem está funcionando como foi programada: ao detectar CPF, ela encerra a consulta com `provider_unavailable` porque o provedor de CPF é hoje apenas um bloqueio de segurança.
- CNPJ já está ligado à BrasilAPI; CEP já está ligado à ViaCEP.
- A consulta oficial de CPF do SERPRO exige CPF e data de nascimento, autenticação OAuth2 e contratação com e-CNPJ. Não há conexão pronta no projeto nem data de nascimento no cadastro atual.
- O fluxo deve continuar restrito a administradores e nunca usar bases vazadas, scraping ou uma chave no navegador.

## Implementação

1. **Completar os dados necessários do cliente**
   - Adicionar `data de nascimento` ao cadastro do cliente e à edição na aba Contatos.
   - Exigir uma data válida somente para iniciar uma consulta de CPF; CNPJ continua sem essa exigência.
   - Mostrar uma orientação objetiva quando a data estiver ausente, com ação para completar o cadastro.

2. **Conectar o provedor oficial de CPF**
   - Integrar a API Consulta CPF do SERPRO na função protegida já criada.
   - Implementar obtenção e renovação do token OAuth2 no servidor, sem expor credenciais no navegador ou nos registros.
   - Validar CPF, data de nascimento, resposta e códigos do provedor antes de devolver qualquer dado à tela.
   - Solicitar as credenciais do contrato SERPRO pelo formulário seguro somente depois que a estrutura estiver pronta.

3. **Manter e reforçar CNPJ e CEP**
   - Preservar BrasilAPI como fonte de CNPJ e ViaCEP como complemento de endereço.
   - Validar todos os retornos e manter timeout, limite de chamadas, cache e mensagens amigáveis.
   - Corrigir a recuperação do conteúdo de erro da função para que `não autorizado`, `limite excedido`, `não encontrado` e `serviço indisponível` não apareçam todos como erro genérico.

4. **Comparação e atualização segura**
   - Exibir lado a lado apenas campos realmente retornados pela fonte autorizada.
   - Manter os estados verde, laranja e azul existentes.
   - Nunca apagar telefone ou e-mail atual; adicionar contatos novos normalizados e sem duplicidade.
   - Gravar somente campos marcados e registrar a atualização no histórico com fonte e campos alterados, sem guardar documento completo.

5. **Testes completos**
   - Testar CNPJ válido real, inválido, inexistente, timeout e limite de chamadas.
   - Testar CPF válido com data, CPF sem data, inválido, inexistente, credencial ausente/expirada e indisponibilidade do SERPRO.
   - Testar autorização de administrador e rejeição de acesso sem sessão.
   - Testar comparação, seleção, merge aditivo e histórico sem sobrescrever contatos.
   - Validar TypeScript, testes automatizados, abertura da tela e o fluxo autenticado no navegador.

## Dependência externa

A parte de CPF só poderá responder com dados reais depois da contratação da API Consulta CPF do SERPRO e do fornecimento seguro de `Consumer Key` e `Consumer Secret`. A contratação é feita pelo titular com e-CNPJ; a aplicação não pode criar essas credenciais automaticamente. Até elas existirem, a tela continuará funcional e informará exatamente o que falta, sem fingir uma consulta bem-sucedida.
