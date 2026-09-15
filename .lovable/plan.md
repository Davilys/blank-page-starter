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

**Testes antes de publicar** (somente leitura no Asaas, nenhum boleto criado): primeiro bloco isolado, cliente já existente sem duplicar profile, cliente novo criado corretamente, cliente com muitas cobranças (paginação), interrupção no meio e retomada, Asaas indisponível (nada removido), execução simultânea bloqueada, e comparação dos totais dos quatro cartões antes/depois.
