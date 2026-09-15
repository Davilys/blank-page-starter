# Ações de cobrança e acordo no Financeiro do cliente

Transformar cada cobrança da aba **Financeiro** da ficha do cliente em um item clicável, com painel de detalhes, envio de cobrança (WhatsApp + e-mail) e criação de acordo parcelado real no Asaas.

Decisões confirmadas: podem gerar acordo e alterar juros os administradores com permissão do módulo Financeiro; parcelas emitidas em **boleto**; data da primeira parcela escolhida no formulário (as demais seguem mensalmente na mesma data).

## O que já existe e será reaproveitado

- Envio de cobrança pronto: busca o link atualizado no Asaas, dispara WhatsApp pelo webhook do BotConversa do Financeiro, envia o e-mail e grava no histórico de cobranças. Inclui trava de 24h contra disparo repetido.
- Fluxo de renegociação real no Asaas já existente (hoje fixo em 5 parcelas, 10%, vencimento no dia 20, e só a partir da fila de devedores) — a mecânica de criar parcelas, registrar cada uma, cancelar o boleto antigo e guardar tudo no histórico auditável será reutilizada.
- Webhook do Asaas já atualiza pagamentos automaticamente.
- Resumo financeiro e lista de faturas já existem na aba, só não são clicáveis.

## Painel de detalhes da cobrança

Ao clicar em uma fatura abre um painel com: descrição do serviço, valor, vencimento, dias em atraso, situação atual no Asaas (consultada na hora), “Abrir no Asaas” quando houver link, e os botões “Cobrar cliente”, “Fazer acordo” e “Fechar”.

Faturas pagas, canceladas ou estornadas abrem apenas em modo consulta, sem botões de ação. O painel não fecha enquanto uma operação estiver em andamento.

Cores: vermelho para vencida, laranja para pendente, azul para ações, verde para acordo criado ou pagamento confirmado. Layout adaptado a celular.

## Cobrar cliente

Pede confirmação, depois envia a cobrança já existente (nunca cria fatura nova): busca o link atualizado no Asaas, dispara o WhatsApp pelo BotConversa e o e-mail cadastrado, com nome, descrição, valor, vencimento e link.

Antes de enviar valida telefone, e-mail, existência de link válido, situação pendente/vencida e sincronia com o Asaas. Faltando um canal, envia pelo outro e avisa qual não foi possível. O resultado de cada canal é mostrado separadamente e registrado no histórico do cliente com data, hora, usuário e canais. Botão bloqueado com “Enviando...” durante o processo.

## Fazer acordo

Formulário com: valor original, número de parcelas, juros em % (começa em 10%, editável, sem somar duas vezes), valor dos juros, total do acordo, valor de cada parcela, data da primeira parcela e forma de cobrança (boleto).

Cálculo: total = valor original + percentual informado. As parcelas dividem o total igualmente e a diferença de centavos vai na última, de modo que a soma seja exatamente o total.

Tela de confirmação com o resumo completo (cobrança original, valor, juros, total, parcelas com valor e vencimento) e o aviso de que a cobrança original será cancelada. Botões “Cancelar” e “Confirmar e gerar acordo”.

Validações: parcelas ≥ 1, juros ≥ 0, campos obrigatórios, máscara de moeda e percentual em padrão brasileiro, bloqueio de acordo duplicado e de operação em cobrança já paga ou cancelada.

## Ordem de execução no Asaas (obrigatória)

1. Reconsultar a situação real da cobrança original no Asaas.
2. Bloquear se estiver paga, recebida, estornada ou já cancelada.
3. Criar todas as parcelas no Asaas.
4. Validar a resposta e guardar os identificadores gerados.
5. Só depois disso, cancelar a cobrança original.
6. Atualizar os dados locais e marcar a original como “Cancelada por acordo”, mantendo-a no histórico (nunca apagada) e vinculada ao acordo.

Se a criação falhar, nada é cancelado. Se as parcelas forem criadas mas o cancelamento falhar, o acordo não é refeito: o erro fica registrado, um alerta aparece no painel e um botão permite repetir **apenas** o cancelamento. Uma chave de idempotência impede acordos duplicados por clique repetido.

## Depois do acordo

As parcelas passam a aparecer na aba Financeiro identificadas como “Parcela 1 de X”, com selo “Acordo ativo”, quantidade de parcelas, juros, total e saldo, cada uma com seu link. O resumo financeiro do cliente é recalculado, o webhook do Asaas mantém os status atualizados e há um botão para enviar o acordo ao cliente por WhatsApp e e-mail.

## Histórico

Cada ação grava quem fez, data e hora, cobrança original, valor, percentual e valor dos juros, total, número de parcelas, identificadores gerados no Asaas, resultado do cancelamento e os envios por WhatsApp e e-mail.

## Detalhes técnicos

- **Banco (migração):** nova tabela `acordos_cliente` (fatura original, `user_id`, valor original, percentual e valor de juros, total, nº de parcelas, primeira data, `crm_action_id` único para idempotência, status do cancelamento, `created_by`) e `acordo_parcelas` (acordo, número, valor, vencimento, `asaas_payment_id`, status, `invoice_url`), com GRANTs para `authenticated`/`service_role`, RLS via `has_role(auth.uid(),'admin')` e trigger de `updated_at`. Coluna `acordo_id` em `invoices` para ligar original e parcelas.
- **Edge function nova `criar-acordo-cliente`:** valida JWT e a permissão `financial`, reconsulta o pagamento no Asaas, cria as parcelas (`POST /payments`, `billingType: BOLETO`, `externalReference: acordo:<id>:<n>`), grava tudo, chama `cancelarCobrancaAsaas` de `_shared/crmCobranca.ts` e registra em `cobranca_tratamentos` via `registrarTratamento`. Ação `retry-cancelamento` para o caso de falha parcial. Idempotência pelo `crm_action_id` único.
- `**cobrar-fatura-vencida`:** reutilizada como está, com `channels` e `force`; nenhuma alteração de comportamento nas telas atuais.
- **Frontend:** novos `InvoiceActionsSheet.tsx`, `FazerAcordoDialog.tsx` e `AcordoConfirmacao.tsx` em `src/components/admin/clients/`; a aba Financeiro de `ClientDetailSheet.tsx` passa a carregar `acordos_cliente`/`acordo_parcelas` e a abrir o painel ao clicar. Permissão via `useAdminPermissions` (chave `financial`).
- `**asaas-webhook`:** passa a atualizar também as parcelas de acordo pelo `asaas_payment_id`.
- **Fora de escopo:** nenhuma outra tela, função ou fila do CRM é alterada.

## Teste antes de entregar

Executar com uma cobrança de teste: abrir o painel, enviar por WhatsApp e e-mail, criar um acordo de 4 parcelas com 10%, conferir os valores e o cancelamento da original no Asaas, clicar duas vezes para provar que não duplica, e apresentar o resumo dos arquivos, funções, endpoints e tabelas alterados. PLANO APROVADO COM OS SEGUINTES AJUSTES OBRIGATÓRIOS:

1. FALHA DURANTE A CRIAÇÃO DAS PARCELAS

Como as parcelas serão criadas individualmente no Asaas, pode ocorrer falha depois de algumas já terem sido emitidas.

Nesse caso:

- Não cancelar a cobrança original;
- Cancelar automaticamente no Asaas todas as parcelas que já tiverem sido criadas nessa tentativa;
- Registrar os identificadores e o resultado dessa compensação;
- Marcar o acordo como “Falha na criação”;
- Não mostrar o acordo como ativo;
- Se alguma parcela criada não puder ser cancelada, mostrar alerta crítico e impedir uma nova tentativa até a pendência ser resolvida.

2. VENCIMENTOS MENSAIS

As parcelas seguintes devem vencer mensalmente no mesmo dia escolhido para a primeira parcela.

Quando esse dia não existir no mês, utilizar o último dia válido daquele mês.

Exemplo:

- Primeira parcela: 31/01;
- Segunda: 28/02 ou 29/02;
- Terceira: 31/03;
- Quarta: 30/04.

Não calcular os vencimentos simplesmente adicionando 30 dias.

3. PROTEÇÃO CONTRA DUPLICIDADE

Além do `crm_action_id`, impedir mais de um acordo ativo para a mesma fatura original.

A idempotência deve funcionar no backend, não apenas pelo bloqueio visual do botão.

Desativar “Confirmar e gerar acordo” imediatamente após o primeiro clique e mostrar “Gerando acordo...”.

4. PERMISSÃO FINANCEIRA

Validar a permissão `financial` obrigatoriamente:

- No frontend;
- Na Edge Function;
- Nas políticas de acesso às tabelas, quando tecnicamente aplicável.

Não confiar somente no papel geral de administrador. Usuário administrador sem permissão financeira não poderá consultar detalhes sensíveis, gerar acordo, alterar juros ou repetir cancelamento.

5. RECÁLCULO DO RESUMO FINANCEIRO

Depois do acordo:

- A cobrança original com status “Cancelada por acordo” não poderá continuar compondo o saldo pendente;
- Apenas as parcelas ativas do acordo devem compor o novo saldo;
- Parcelas pagas devem entrar no valor pago;
- Parcelas vencidas devem entrar no saldo vencido;
- Não duplicar o valor da cobrança original com o valor das parcelas.

6. JUROS E ARREDONDAMENTO

Fazer todos os cálculos monetários em centavos inteiros no backend.

O valor exibido pelo frontend deverá ser apenas uma prévia. O valor definitivo será calculado novamente pela Edge Function.

A diferença do arredondamento ficará exclusivamente na última parcela.

7. CANCELAMENTO DA COBRANÇA ORIGINAL

Antes de cancelar, conferir novamente se:

- Todas as parcelas foram efetivamente criadas no Asaas;
- Todas foram registradas no banco;
- Os valores somados correspondem exatamente ao total do acordo;
- Nenhuma parcela está sem `asaas_payment_id`;
- A cobrança original ainda permanece pendente ou vencida.

Somente depois dessas validações executar `cancelarCobrancaAsaas`.

8. ENVIO DO ACORDO

O envio por WhatsApp e e-mail deve ocorrer somente depois da criação completa do acordo e do cancelamento confirmado da cobrança original.

A mensagem deverá conter:

- Valor total do acordo;
- Juros aplicados;
- Quantidade de parcelas;
- Valor e vencimento de cada parcela;
- Links individuais dos boletos.

Não enviar acordo incompleto ou com falha de cancelamento sem uma confirmação manual do administrador responsável.

9. AUDITORIA

Guardar também no histórico:

- Respostas resumidas da API do Asaas;
- Tentativas que falharam;
- Parcelas compensadas/canceladas após falha parcial;
- Tentativa de clique duplicado bloqueada;
- Valores calculados no frontend e recalculados no backend;
- Endereço IP ou identificação técnica da sessão, se o projeto já possuir esse padrão.

Não armazenar tokens, segredos ou dados sensíveis completos da API nos logs.

10. TESTES ADICIONAIS

Além do teste principal, testar:

- Vencimento no dia 29, 30 e 31;
- Falha na segunda parcela de um acordo com quatro parcelas;
- Clique duplo;
- Repetição da mesma requisição;
- Cobrança paga no Asaas, mas ainda vencida no CRM;
- Cliente sem telefone;
- Cliente sem e-mail;
- Falha somente no cancelamento da cobrança original;
- Usuário administrador sem permissão `financial`;
- Atualização de pagamento recebida pelo webhook;
- Correção do resumo financeiro sem duplicar valores.

Com esses ajustes incluídos, pode executar a implementação. Não alterar nenhuma funcionalidade fora do escopo definido e, antes de publicar em produção, apresentar o resultado do teste, as migrações realizadas e a lista completa dos arquivos modificados.