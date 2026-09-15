# Sincronizar todo o Asaas na aba Financeiro

O botão "Sincronizar Asaas" do Financeiro passa a fazer a conciliação completa: percorre todas as contas de clientes do Asaas, traz todas as cobranças, cria no CRM os clientes que ainda não existem, atualiza os que já existem e recalcula os indicadores. O visual da página é preservado — muda o comportamento do botão e aparece uma barra de progresso.

## Situação atual

Hoje o botão só relê, uma a uma, as faturas que já estão no CRM com status pendente ou vencido. Cliente que existe só no Asaas nunca entra, cobrança nova nunca aparece, e o status usado é um mapeamento próprio, diferente da regra única já criada para a ficha do cliente.

## Como vai funcionar

1. Clicar em "Sincronizar Asaas" abre a barra de progresso ("Conta 340 de 1.280 — 5.912 cobranças processadas") e a tela vai processando em blocos, sem travar.
2. Cada bloco pega um lote de clientes do Asaas e todas as cobranças de cada um, página por página até o fim.
3. Cliente que não existe no CRM é criado com nome, documento, e-mail, telefone e endereço vindos do Asaas, marcado como origem Asaas. Cliente que já existe é reaproveitado (pelo vínculo Asaas, depois por CPF/CNPJ exato e único) e apenas recebe as cobranças.
4. Cobrança nova é criada; cobrança existente é atualizada em valor, vencimento, descrição, link, forma de pagamento e situação.
5. Cobrança que sumiu do Asaas é marcada como "Removida do Asaas" e sai dos totais, sem nunca ser apagada.
6. A classificação de pago / a vencer / vencido / inativo usa a mesma regra da ficha do cliente, então os cartões do topo passam a bater com o Asaas.
7. Ao terminar: "Sincronização concluída — X clientes criados, Y cobranças criadas, Z atualizadas", a lista recarrega e fica registrada a data da última sincronização.
8. Se um bloco falhar, a sincronização para naquele ponto, avisa em qual parte parou e **não remove nada** — o que já foi conciliado permanece, e basta clicar de novo para continuar.

O botão "Atualizar" ao lado continua apenas recarregando a tela, sem consultar o Asaas.

## Detalhes técnicos

**Banco** — nova tabela `asaas_full_sync_runs`: `id`, `sync_run_id`, `executed_by`, `cursor_offset`, `status` (`em_andamento` | `concluida` | `falha`), `total_clientes_asaas`, `clientes_criados`, `clientes_vinculados`, `cobrancas_encontradas`, `criadas`, `atualizadas`, `removidas`, `erro`, `started_at`, `finished_at`, com RLS admin + GRANTs. Serve de trava de execução única (um run `em_andamento` bloqueia outro) e de progresso persistido entre os blocos.

**Edge Function nova** `sync-asaas-all` (`verify_jwt = false`, valida JWT + `has_role admin` + `has_financial_permission`), chamada em blocos pelo frontend:

- entrada `{ sync_run_id?, offset }`; sem `sync_run_id` cria o run e retorna o total de clientes (`GET /customers?limit=1`);
- por chamada processa um lote fixo (20 clientes do Asaas via `/customers?limit=20&offset=N`) e, para cada um, pagina `/payments?customer=...&limit=100` até o fim;
- resolução de cliente: `profiles.asaas_customer_id` → `cpf_cnpj` normalizado com correspondência única → senão cria profile (`origin: 'asaas-sync'`, e-mail real ou placeholder `@webmarcas.local`, mesmo padrão de `find-or-create-client-from-asaas`);
- upsert em `invoices` por `asaas_invoice_id`, gravando `status` normalizado por `_shared/statusCobranca.ts`, `asaas_status_raw`, `origem: 'asaas'`, `sync_status: 'ativa'`, `ultima_sincronizacao_asaas`; parcelas de acordo mantêm `origem: 'acordo'`;
- marcação `removida_asaas` feita **por cliente**, só quando todas as páginas daquele cliente vieram OK;
- atualiza `cursor_offset` e contadores acumulados no run; retorna `{ offset_proximo, concluido, progresso }`;
- rate limit: pequena pausa entre páginas, e `429`/`5xx` do Asaas devolvem o mesmo offset para o frontend repetir o bloco com espera, sem avançar o cursor.

**Frontend** `src/pages/admin/Financeiro.tsx`: `handleSyncAsaas` vira um laço que chama `sync-asaas-all` bloco a bloco enquanto `concluido` for falso, atualizando estado de progresso; abaixo do cabeçalho aparece uma barra (componente `Progress` já existente) com contadores; botão desabilitado durante a execução; `fetchInvoices()` ao final. Cartões do topo passam a classificar por `src/lib/financeiro/statusCobranca.ts`, excluindo canceladas/removidas dos totais ativos.

**Testes antes de publicar** (somente leitura no Asaas, nenhum boleto criado): primeiro bloco isolado, cliente já existente sem duplicar profile, cliente novo criado corretamente, cliente com muitas cobranças (paginação), interrupção no meio e retomada, Asaas indisponível (nada removido), execução simultânea bloqueada, e comparação dos totais dos quatro cartões antes/depois. PLANO APROVADO COM OS SEGUINTES ACRÉSCIMOS OBRIGATÓRIOS:

## 1. ESCOPO DO BOTÃO “SINCRONIZAR ASAAS”

O botão “Sincronizar Asaas” da página geral do Financeiro terá comportamento diferente do botão existente na ficha individual:

- Na página geral do Financeiro: sincroniza todos os clientes e cobranças do Asaas;
- Na ficha individual do cliente: sincroniza somente as contas e cobranças daquele cliente;
- O botão “Atualizar” continuará apenas recarregando os dados locais, sem consultar o Asaas.

Não misturar esses três comportamentos.

## 2. ORGANIZAÇÃO DA LISTA POR CLIENTE

Depois da sincronização, organizar a tabela pelo nome do cliente em ordem alfabética crescente, de A até Z.

As cobranças do mesmo cliente deverão ficar próximas umas das outras.

Normalizar o nome somente para ordenação, ignorando diferenças entre:

- Letras maiúsculas e minúsculas;
- Acentos;
- Espaços extras.

Não alterar o nome original salvo ou exibido.

Exemplo:

- Ágata deverá ser ordenada como Agata;
- ANA e Ana deverão ocupar a mesma posição alfabética;
- O nome exibido continuará exatamente como foi cadastrado.

A ordenação padrão será:

1. Nome do cliente, A–Z;
2. Dentro do mesmo cliente, cobranças vencidas primeiro;
3. Depois, cobranças a vencer;
4. Depois, cobranças pagas;
5. Dentro do mesmo status, vencimento mais antigo primeiro.

Permitir ordenar também ao clicar nos títulos:

- Descrição;
- Cliente;
- Valor;
- Método;
- Vencimento;
- Status.

O título da coluna deverá indicar visualmente a direção da ordenação.

## 3. PAGINAÇÃO DA TABELA

Implementar paginação real no banco, carregando inicialmente 50 cobranças por página.

Não carregar milhares de cobranças no navegador para depois esconder as excedentes.

Exibir abaixo da tabela:

“Exibindo 1–50 de 1.000”

“Anterior | Página 1 de 20 | Próximo”

Na segunda página:

“Exibindo 51–100 de 1.000”

Regras:

- “Anterior” fica desabilitado na primeira página;
- “Próximo” fica desabilitado na última;
- Exibir a página atual e o total de páginas;
- Usar 50 registros por página;
- Ao aplicar uma busca ou filtro, voltar automaticamente para a página 1;
- A quantidade total deve considerar os filtros ativos;
- Após sincronização, recalcular o total de páginas;
- Se a página atual deixar de existir, voltar para a última página válida;
- Manter busca, filtros e ordenação ao navegar entre páginas;
- Exibir estado de carregamento ao trocar de página;
- Não duplicar linhas durante a navegação.

## 4. BUSCA E FILTROS NO SERVIDOR

A busca deverá funcionar em todas as cobranças, não apenas nas 50 linhas visíveis.

Permitir busca por:

- Nome do cliente;
- CPF/CNPJ;
- Número ou identificador da cobrança;
- Descrição;
- Serviço;
- ID do Asaas.

Aplicar os filtros e a ordenação no banco antes da paginação.

Os cartões do topo não podem ser calculados apenas com as 50 cobranças visíveis. Eles deverão utilizar os totais completos de todas as cobranças válidas no banco.

## 5. CRIAÇÃO DE CLIENTE PELO ASAAS

Quando um cliente do Asaas ainda não existir no CRM:

- Procurar primeiro pelo `asaas_customer_id`;
- Depois por CPF/CNPJ exato, normalizado e único;
- Nunca vincular automaticamente apenas por nome, telefone ou e-mail;
- Se houver correspondência ambígua, não criar vínculo automático;
- Registrar para análise manual.

Ao criar um cliente novo:

- Marcar `origin: 'asaas-sync'`;
- Salvar `asaas_customer_id`;
- Importar nome, CPF/CNPJ, e-mail, telefone e endereço disponíveis;
- Não inventar CPF/CNPJ, telefone ou endereço;
- Não enviar mensagem de boas-vindas;
- Não criar contrato, serviço, tarefa ou usuário de acesso;
- Não disparar automações comerciais;
- Não contabilizar esse cliente como um novo lead de venda.

Se o e-mail não existir, não utilizar um endereço falso como identidade principal do cliente. Um placeholder técnico só poderá ser usado se o banco exigir, deverá ser claramente marcado e nunca poderá receber e-mails.

## 6. RETOMADA SEGURA DA SINCRONIZAÇÃO

A sincronização precisa sobreviver a:

- Atualização da página;
- Fechamento da aba;
- Perda momentânea da internet;
- Erro 429;
- Erro 5xx;
- Timeout.

A execução não pode depender exclusivamente de um laço mantido aberto no navegador.

O progresso deverá ficar persistido em `asaas_full_sync_runs`.

Ao retornar à página:

- Consultar se existe sincronização `em_andamento`;
- Recuperar o progresso real;
- Continuar do último bloco confirmado;
- Não começar novamente do zero;
- Não criar uma segunda execução simultânea.

Se a arquitetura não permitir processamento contínuo no backend, o frontend poderá solicitar cada bloco, mas o cursor, a trava e os resultados deverão permanecer no banco.

## 7. RETENTATIVAS E ERROS

Em `429` ou erro temporário `5xx`:

- Respeitar `Retry-After`, quando enviado;
- Utilizar espera progressiva;
- Limitar as tentativas;
- Não avançar o cursor enquanto o bloco não for confirmado;
- Não somar novamente os contadores de um bloco repetido;
- Usar uma chave idempotente por `sync_run_id + offset`.

Depois do limite de tentativas:

- Marcar o run como `falha`;
- Registrar conta, cliente, offset e página em que parou;
- Mostrar botão “Continuar sincronização”;
- Retomar exatamente do bloco não confirmado.

## 8. MARCAÇÃO DE COBRANÇAS REMOVIDAS

A marcação de `removida_asaas` poderá acontecer por cliente somente quando:

- Todas as páginas daquele cliente forem consultadas;
- A resposta estiver completa;
- O customer ID estiver confirmado;
- Não houver timeout ou erro;
- A coleção completa tiver sido comparada.

Não marcar cobranças como removidas com base apenas nas 100 primeiras cobranças.

Cobranças encontradas em blocos anteriores permanecem conciliadas se um bloco posterior falhar.

## 9. BARRA DE PROGRESSO

Preservar o visual atual e utilizar o componente `Progress` já existente.

Mostrar:

- Clientes processados;
- Total de clientes;
- Cobranças processadas;
- Percentual concluído;
- Etapa atual;
- Tempo decorrido, se disponível.

Exemplo:

“Conta 340 de 1.280 — 5.912 cobranças processadas”

A barra deverá usar os números confirmados em `asaas_full_sync_runs`, nunca uma animação artificial.

Estados:

- Preparando sincronização;
- Sincronizando clientes;
- Conciliando cobranças;
- Atualizando indicadores;
- Concluída;
- Falha;
- Interrompida, com opção de continuar.

## 10. INDICADORES FINANCEIROS

Os quatro cartões devem considerar toda a base conciliada, independentemente da página atual:

- Total faturado;
- A vencer;
- Recebido;
- Vencido.

Excluir dos totais ativos:

- Canceladas;
- Removidas do Asaas;
- Estornadas;
- Chargebacks;
- Cobranças originais substituídas por acordo.

A soma dos componentes deve seguir uma regra única e auditável.

Não usar o frontend para somar apenas as linhas carregadas. Criar uma consulta agregada no backend.

## 11. DESEMPENHO

Criar ou confirmar índices para:

- `invoices.asaas_invoice_id`;
- `invoices.user_id`;
- `invoices.status`;
- `invoices.sync_status`;
- `invoices.due_date`;
- `profiles.asaas_customer_id`;
- CPF/CNPJ normalizado;
- Nome utilizado na pesquisa e ordenação, se necessário.

Evitar uma consulta individual ao banco para cada cobrança quando for possível fazer upsert em lote.

Não executar milhares de requisições simultâneas ao Asaas.

## 12. TESTES ADICIONAIS

Acrescentar aos testes:

1. Paginação com mais de 1.000 cobranças;
2. Texto “Exibindo 1–50 de X”;
3. Navegação entre primeira, intermediária e última página;
4. Busca por cliente localizado em página diferente;
5. Ordenação alfabética com acentos;
6. Cliente com várias cobranças agrupadas;
7. Filtros mantendo paginação e ordenação;
8. Cartões mostrando o total completo, não somente a página;
9. Fechamento da tela durante a sincronização;
10. Retomada do mesmo `sync_run_id`;
11. Repetição do mesmo bloco sem duplicar contadores;
12. Erro 429 com nova tentativa;
13. Cliente sem e-mail;
14. Cliente com CPF/CNPJ duplicado;
15. Cliente Asaas criado sem disparar automações comerciais;
16. Duas sincronizações iniciadas simultaneamente;
17. Cobrança removida fora das primeiras 100 posições;
18. Resultado com zero clientes no Asaas, sem remover toda a base automaticamente.

## 13. CRITÉRIOS DE ACEITE

A implementação estará concluída quando:

- A sincronização geral importar todos os clientes e cobranças do Asaas;
- Clientes novos forem criados sem duplicidade e sem automações comerciais;
- Clientes existentes forem vinculados corretamente;
- A lista estiver organizada por nome do cliente;
- As cobranças do mesmo cliente estiverem próximas;
- A tabela carregar somente 50 registros por página;
- A paginação mostrar intervalo, total, página atual e total de páginas;
- Busca e filtros funcionarem em toda a base;
- Os cartões mostrarem totais completos;
- A barra utilizar o progresso real;
- Uma sincronização interrompida puder ser retomada;
- Blocos repetidos não duplicarem cobranças nem contadores;
- Nenhuma cobrança for removida após resposta parcial;
- O botão “Atualizar” continuar somente recarregando a página;
- O visual atual permanecer preservado.

Com esses acréscimos, o plano pode ser executado. Primeiro rodar em ambiente de teste ou modo de leitura controlada e apresentar a comparação antes/depois antes de publicar em produção.