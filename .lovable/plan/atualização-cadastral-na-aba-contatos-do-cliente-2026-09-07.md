# Atualização cadastral na aba Contatos do cliente

## O que o usuário vai ver

Na ficha do cliente, aba **Contatos**, aparece um botão **↻ Atualizar os dados**, ao lado do bloco "Dados Pessoais".

Ao clicar, abre a janela **Atualização cadastral** mostrando nome e CPF/CNPJ já cadastrados e a frase "Vamos verificar se existem dados cadastrais mais recentes". Nada é consultado até o operador clicar em **🔍 Verificar dados atualizados**.

Durante a consulta: "Consultando dados..." com indicador de progresso e botão bloqueado. Depois: "Consulta concluída" e uma comparação **Cadastro atual × Dados encontrados**, campo a campo, com marcação:

- 🟢 Sem alteração
- 🟠 Dado atualizado encontrado
- 🔵 Novo dado encontrado

Cada divergência tem uma caixa de seleção "Atualizar este dado" (para telefone/e-mail novos: "Adicionar"). No rodapé: **Cancelar** e **Atualizar dados selecionados** (desabilitado enquanto nada estiver marcado). Ao salvar: "Dados atualizados com sucesso." e a ficha se atualiza na hora.

No desktop a comparação fica lado a lado; no celular empilhada (atual → encontrado → ação).

## Regras de dados

- Nunca sobrescrever nada automaticamente; só o que for marcado.
- Telefones e e-mails existentes nunca são apagados: novos são **somados** aos atuais.
- Comparação normalizada — `(11) 99999-9999`, `11999999999` e `+55 11 99999-9999` são o mesmo telefone; e-mail compara sem diferenciar maiúsculas/espaços. Sem duplicidade.
- Endereço e dados da empresa (razão social, nome fantasia, situação cadastral, CNAE, abertura, capital social) só mudam com confirmação.
- Se faltar CPF e CNPJ: mensagem "Não foi possível realizar a consulta porque falta CPF ou CNPJ no cadastro." e atalho "Editar cadastro".
- CPF: nenhum provedor autorizado configurado hoje → mensagem "Consulta de CPF não disponível no momento." (sem erro técnico, sem dados falsos). Nenhuma base ilegal, nenhum scraping.

## Histórico

Cada atualização registra no histórico do cliente: "Atualização cadastral realizada", com usuário, data/hora, fonte consultada (BrasilAPI/ViaCEP), campos encontrados e campos efetivamente atualizados. CPF/CNPJ não são gravados por extenso no log.

## Detalhes técnicos

**Banco (migração)** — a tabela `profiles` hoje só tem um telefone e um e-mail. Acréscimos, sem mexer nos campos atuais:

- `additional_phones text[] default '{}'`, `additional_emails text[] default '{}'`
- `address_number text`, `address_complement text`
- `trade_name text`, `registration_status text`, `cnae text`, `opening_date date`, `share_capital numeric`
- Auditoria reutiliza a tabela existente `client_activities` (`activity_type = 'atualizacao_cadastral'`, detalhes em `metadata`).

**Camada de serviços** (`src/lib/dataEnrichment/`), sem lógica de consulta em componentes:

- `providers/brasilApiProvider.ts`, `providers/viaCepProvider.ts`, `providers/cpfProvider.ts` (retorna `unavailable`)
- `enrichmentService.ts` (escolhe provedor: CNPJ > CPF > nome; timeout, rate limit, cache em memória por CNPJ)
- `comparisonService.ts` (normalização de telefone/e-mail/CEP e cálculo de status por campo)
- `mergeService.ts` (merge aditivo, sem duplicidade)
- `types.ts` com a interface de provedor para plugar Serpro/provedor pago depois.

**Edge Function** `enrich-client-data`: proxy das consultas (BrasilAPI/ViaCEP), validação de CNPJ, timeout e mensagens de erro amigáveis. Deixa o ponto de entrada pronto para provedores pagos com chaves em Secrets — nenhuma chave no frontend.

**UI**: novo componente `src/components/admin/clients/DataEnrichmentDialog.tsx` (shadcn Dialog, cards/badges do padrão atual). Em `ClientDetailSheet.tsx` só entram o botão na aba Contatos e o render do diálogo; nenhuma outra aba é tocada.

**Erros tratados**: API fora do ar, nenhum dado novo, CNPJ inválido, CPF indisponível — todos com texto amigável, sem stack trace ou URL interna.

Ao final: verificação de TypeScript e build. Sim. **Esse texto está muito bom e já está no nível de especificação técnica para o Lovable.** Eu só faria um ajuste importante: deixar explícito que o Lovable deve **primeiro inspecionar a estrutura atual e só então executar a migração**, evitando criar campos/tabelas que já existam.

Se você quiser colar no Lovable agora, eu usaria exatamente esta versão final:

```text
IMPLEMENTAR — ATUALIZAÇÃO CADASTRAL NA ABA “CONTATOS” DO CLIENTE

IMPORTANTE:
Antes de alterar qualquer arquivo ou banco, analise a implementação atual do módulo de clientes, especialmente:
- ClientDetailSheet.tsx
- aba Contatos
- tabela profiles
- tabela client_activities
- políticas RLS existentes
- estrutura atual de contatos
- Edge Functions existentes

NÃO recrie estruturas que já existam.
NÃO altere funcionalidades que não sejam necessárias para esta implementação.
NÃO mexa nas abas Geral, Serviços, Agenda ou Anexos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. INTERFACE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Na ficha do cliente → aba “Contatos”, adicionar ao lado do bloco “Dados Pessoais” o botão:

↻ Atualizar os dados

Ao clicar, abrir o componente:

src/components/admin/clients/DataEnrichmentDialog.tsx

Utilizar o padrão visual atual do sistema e shadcn/ui.

Título:

Atualização cadastral

Exibir:

Nome:
[Nome cadastrado]

CPF/CNPJ:
[CPF/CNPJ cadastrado]

Texto:

“Vamos verificar se existem dados cadastrais mais recentes.”

Botão:

🔍 Verificar dados atualizados

IMPORTANTE:
Nenhuma consulta deve ser realizada ao abrir o diálogo.
A consulta só começa após o clique no botão.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. DURANTE A CONSULTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Após clicar:

🔍 Verificar dados atualizados

Exibir:

“Consultando dados...”

Mostrar indicador de carregamento/progresso.

Bloquear o botão durante a consulta.

Evitar chamadas duplicadas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. RESULTADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Após concluir:

“Consulta concluída”

Mostrar comparação:

CADASTRO ATUAL | DADOS ENCONTRADOS

Comparar campo por campo.

Estados:

🟢 Sem alteração
O dado encontrado é igual ao atual.

🟠 Dado atualizado encontrado
Foi encontrado valor diferente.

🔵 Novo dado encontrado
Foi encontrado um dado que ainda não existe no CRM.

Cada divergência deve possuir checkbox.

Para alteração:

☐ Atualizar este dado

Para novo telefone/e-mail:

☐ Adicionar

O botão inferior:

Atualizar dados selecionados

deve permanecer desabilitado enquanto nenhum item estiver selecionado.

Rodapé:

Cancelar | Atualizar dados selecionados

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. REGRA CRÍTICA DE PRESERVAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NUNCA sobrescrever automaticamente informações existentes.

Somente alterar aquilo que o operador selecionar.

TELEFONES:

Nunca apagar telefone existente.

Se existir:

(11) 99999-9999

e for encontrado:

(11) 98888-8888

o resultado deve ser:

Telefone existente:
(11) 99999-9999

Novo telefone:
(11) 98888-8888

☐ Adicionar

Após confirmar, os dois devem permanecer cadastrados.

E-MAILS:

Aplicar exatamente a mesma lógica.

Nunca apagar e-mail existente.

Novos e-mails são adicionados.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. NORMALIZAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Criar:

src/lib/dataEnrichment/comparisonService.ts

Normalizar telefones antes da comparação.

Exemplo:

(11) 99999-9999
11999999999
+55 11 99999-9999

devem ser considerados o mesmo número.

Normalizar e-mails:

- remover espaços desnecessários;
- comparar sem diferenciar maiúsculas/minúsculas.

Normalizar CEP.

Nunca criar duplicidades.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. ENDEREÇO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Comparar:

CEP
Logradouro
Número
Complemento
Bairro
Cidade
Estado

Se houver alteração:

🟠 Dado atualizado encontrado

☐ Atualizar este dado

O endereço só deve ser alterado depois da confirmação do operador.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. DADOS DA EMPRESA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quando o cliente possuir CNPJ, comparar também:

- Razão social
- Nome fantasia
- Situação cadastral
- CNAE
- Data de abertura
- Capital social
- Endereço
- Telefones
- E-mail

Nenhum desses dados pode ser alterado automaticamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. BANCO DE DADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRIMEIRO verificar se esses campos já existem.

Caso não existam, criar MIGRATION adicionando, sem remover ou alterar os campos atuais:

profiles:

additional_phones text[] DEFAULT '{}'
additional_emails text[] DEFAULT '{}'
address_number text
address_complement text
trade_name text
registration_status text
cnae text
opening_date date
share_capital numeric

IMPORTANTE:

Não modificar os campos atuais de telefone e e-mail.

Os novos campos são complementares.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. HISTÓRICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reutilizar a tabela existente:

client_activities

Criar atividade:

activity_type = 'atualizacao_cadastral'

metadata deve registrar:

- usuário responsável;
- data/hora;
- fonte consultada;
- campos encontrados;
- campos efetivamente atualizados.

NÃO armazenar CPF/CNPJ completo no log.

Não registrar informações pessoais desnecessárias.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. CAMADA DE SERVIÇOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Criar:

src/lib/dataEnrichment/

providers/
├── brasilApiProvider.ts
├── viaCepProvider.ts
└── cpfProvider.ts

enrichmentService.ts
comparisonService.ts
mergeService.ts
types.ts

NÃO colocar lógica de API dentro dos componentes React.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. INTERFACE DE PROVEDOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Criar uma interface genérica de provedor para permitir futuramente adicionar:

- Serpro
- provedor comercial de CPF
- outros provedores autorizados

Sem precisar alterar a UI.

O cpfProvider.ts deve retornar:

unavailable

enquanto nenhum provedor autorizado estiver configurado.

NÃO criar dados fictícios.

NÃO simular uma consulta de CPF.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. CNPJ — BRASILAPI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para CNPJ utilizar inicialmente:

https://brasilapi.com.br/api/cnpj/v1/{CNPJ}

Consultar, quando disponíveis:

- razão social;
- nome fantasia;
- situação cadastral;
- endereço;
- CEP;
- telefone;
- segundo telefone;
- e-mail;
- CNAE;
- data de abertura;
- capital social.

Validar o CNPJ antes da consulta.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. CEP — VIA CEP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Utilizar ViaCEP para validação/complementação de endereço quando necessário.

Endpoint:

https://viacep.com.br/ws/{CEP}/json/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. CPF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NÃO utilizar:

- bases vazadas;
- bancos clandestinos;
- scraping;
- dados obtidos ilegalmente;
- APIs não autorizadas.

Como nenhum provedor autorizado de CPF está configurado:

mostrar:

“Consulta de CPF não disponível no momento.”

Não mostrar erro técnico.

A arquitetura deve ficar preparada para futura integração.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. EDGE FUNCTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Criar:

enrich-client-data

Responsabilidades:

- receber a identificação do cliente;
- validar CNPJ;
- executar consultas autorizadas;
- consultar BrasilAPI;
- consultar ViaCEP quando necessário;
- aplicar timeout;
- tratar rate limit;
- retornar resposta padronizada;
- esconder detalhes técnicos;
- preparar integração futura com provedores pagos.

Nenhuma API Key deve ficar no frontend.

Secrets devem permanecer no ambiente seguro das Edge Functions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
16. enrichmentService
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Criar lógica de prioridade:

CNPJ → provedor CNPJ

CPF → provedor CPF

Nome → somente quando existir um provedor autorizado que suporte essa consulta.

NÃO realizar pesquisa genérica na internet para descobrir dados pessoais.

Implementar:

- timeout;
- tratamento de erro;
- rate limit;
- cache em memória por CNPJ;
- prevenção de chamadas duplicadas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
17. mergeService
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Criar:

src/lib/dataEnrichment/mergeService.ts

Regra:

DADO EXISTENTE + DADO NOVO = PRESERVAR OS DOIS

Nunca:

apagar → substituir.

Sempre:

preservar → adicionar/atualizar mediante confirmação.

Para arrays de telefones e e-mails:

- normalizar;
- comparar;
- remover duplicidade;
- preservar existentes;
- adicionar somente novos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
18. FALTA DE CPF/CNPJ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Se não existir CPF nem CNPJ:

mostrar:

“Não foi possível realizar a consulta porque falta CPF ou CNPJ no cadastro.”

Mostrar botão:

Editar cadastro

Ao clicar, abrir o fluxo existente de edição do cliente.

Não criar um novo formulário de edição se já existir um.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
19. ERROS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tratar:

CNPJ inválido:

“O CNPJ informado não é válido.”

API indisponível:

“Não foi possível consultar os dados agora. Tente novamente.”

Nenhum dado novo:

“Nenhuma atualização cadastral encontrada.”

CPF:

“Consulta de CPF não disponível no momento.”

Nunca mostrar:

- stack trace;
- erro SQL;
- URL interna;
- detalhes da Edge Function;
- API Keys;
- mensagens técnicas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
20. SALVAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ao clicar:

Atualizar dados selecionados

executar somente os campos marcados.

Depois:

1. Salvar no banco.
2. Registrar atividade em client_activities.
3. Atualizar a ficha do cliente imediatamente.
4. Fechar o diálogo ou apresentar confirmação.
5. Mostrar:

“Dados atualizados com sucesso.”

Não recarregar a página inteira se não for necessário.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
21. RESPONSIVIDADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Desktop:

CADASTRO ATUAL | DADOS ENCONTRADOS | AÇÃO

Mobile:

CADASTRO ATUAL
↓
DADOS ENCONTRADOS
↓
AÇÃO

O diálogo deve funcionar perfeitamente em desktop, tablet e celular.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
22. SEGURANÇA / LGPD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Utilizar somente fontes autorizadas.

Não utilizar bases ilegais.

Não utilizar scraping de dados pessoais.

Não expor dados pessoais desnecessariamente.

Não armazenar respostas completas das APIs se não forem necessárias.

Respeitar as políticas RLS existentes.

Não criar permissões mais amplas que as necessárias.

Somente usuários autorizados do CRM podem executar a atualização cadastral.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
23. CLIENTDETAILSHEET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Em:

ClientDetailSheet.tsx

alterar somente o necessário para:

1. adicionar o botão na aba Contatos;
2. controlar abertura do DataEnrichmentDialog;
3. passar o ID/dados do cliente;
4. atualizar os dados exibidos após o salvamento.

NÃO refatorar o arquivo inteiro.

NÃO alterar as outras abas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
24. CRITÉRIOS DE ACEITAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A tarefa somente estará concluída quando:

✓ botão “↻ Atualizar os dados” aparecer na aba Contatos;

✓ diálogo abrir corretamente;

✓ nenhuma consulta ocorrer antes do clique;

✓ CNPJ puder ser consultado pela BrasilAPI;

✓ CEP puder ser consultado pela ViaCEP;

✓ CPF retornar corretamente “indisponível” enquanto não houver provedor;

✓ dados atuais e encontrados forem comparados;

✓ alterações forem destacadas;

✓ operador puder selecionar cada alteração;

✓ telefones existentes forem preservados;

✓ novos telefones forem adicionados;

✓ e-mails existentes forem preservados;

✓ novos e-mails forem adicionados;

✓ duplicidades forem evitadas;

✓ endereço só seja alterado mediante confirmação;

✓ dados empresariais só sejam alterados mediante confirmação;

✓ histórico seja registrado;

✓ CPF/CNPJ não apareça completo no log;

✓ erros sejam tratados amigavelmente;

✓ nenhuma API Key fique exposta;

✓ nenhuma base ilegal seja utilizada;

✓ RLS continue seguro;

✓ desktop e mobile funcionem corretamente;

✓ nenhum outro módulo seja quebrado.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
25. VERIFICAÇÃO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Depois da implementação:

1. executar TypeScript check;
2. executar build;
3. verificar imports;
4. verificar migrations;
5. verificar RLS;
6. verificar Edge Function;
7. verificar possíveis erros de React;
8. verificar duplicidade de registros;
9. verificar atualização da ficha sem refresh completo;
10. corrigir automaticamente qualquer erro causado pela implementação.

NÃO considerar a tarefa concluída se existir erro de TypeScript, build, migration ou runtime relacionado a esta implementação.

IMPORTANTE:

NÃO criar mocks fingindo que APIs responderam.

NÃO inventar dados.

NÃO afirmar que uma consulta foi realizada se a fonte real não respondeu.

A funcionalidade deve trabalhar com dados reais das fontes configuradas.
```

**Essa versão eu considero pronta para execução no Lovable.** Ela deixa o escopo fechado e, principalmente, impede que o Lovable invente uma solução de CPF ou destrua os telefones/e-mails que já estão cadastrados.