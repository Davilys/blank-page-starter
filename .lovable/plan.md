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
- **`cobrar-fatura-vencida`:** reutilizada como está, com `channels` e `force`; nenhuma alteração de comportamento nas telas atuais.
- **Frontend:** novos `InvoiceActionsSheet.tsx`, `FazerAcordoDialog.tsx` e `AcordoConfirmacao.tsx` em `src/components/admin/clients/`; a aba Financeiro de `ClientDetailSheet.tsx` passa a carregar `acordos_cliente`/`acordo_parcelas` e a abrir o painel ao clicar. Permissão via `useAdminPermissions` (chave `financial`).
- **`asaas-webhook`:** passa a atualizar também as parcelas de acordo pelo `asaas_payment_id`.
- **Fora de escopo:** nenhuma outra tela, função ou fila do CRM é alterada.

## Teste antes de entregar

Executar com uma cobrança de teste: abrir o painel, enviar por WhatsApp e e-mail, criar um acordo de 4 parcelas com 10%, conferir os valores e o cancelamento da original no Asaas, clicar duas vezes para provar que não duplica, e apresentar o resumo dos arquivos, funções, endpoints e tabelas alterados.
