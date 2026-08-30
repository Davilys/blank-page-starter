# Central de Vencidos — Cobrança pelo link do Asaas, Situação da cobrança e baixa manual

## 1. Cobrar (aba "Vencidos até 30 dias")

Hoje o botão "Cobrar" envia a mensagem usando o link salvo localmente (`invoice_url`), que pode estar vazio ou desatualizado.

Mudança: antes de enviar, o sistema consulta a fatura diretamente no Asaas pelo ID do pagamento e usa o link oficial de pagamento daquela fatura em atraso (link da fatura / boleto / Pix). Nenhuma fatura nova é criada.

- Se o Asaas devolver que a fatura já foi paga, a cobrança não é enviada; o registro é atualizado como paga.
- O link recuperado é salvo de volta na fatura do CRM.
- Se a fatura não tiver vínculo com o Asaas, mantém o comportamento atual (link salvo) e avisa o usuário.

As abas "Devedores +30 dias" e "Devedores +60 dias" continuam exatamente como estão na Lista.

## 2. Coluna "Situação da cobrança" nos três Históricos

Nos históricos das três abas, a coluna "Próx. ação" é substituída por "Situação da cobrança":

- **Recebida** (verde) — fatura/parcela paga.
- **Aguardando pagamento** (âmbar) — cobrança ou acordo enviado e ainda dentro do prazo.
- **Vencida** (vermelho) — prazo passou sem pagamento.
- **Negativado** (etiqueta escura) — cliente já marcado como negativado.

Ordem das colunas no histórico de "Vencidos até 30 dias": Data · Cliente · Canais · Status · Situação da cobrança · Responsável.
Nos históricos de +30 e +60 dias, a nova coluna entra na mesma posição (antes de "Responsável"), calculada a partir das parcelas do acordo/negociação.

## 3. Confirmar pagamento manual (Pix em outra conta)

Em cada linha do histórico, quando a situação não for "Recebida", aparece o botão **Confirmar pagamento**:

1. Pede confirmação (valor, data do pagamento e observação opcional).
2. Dá baixa em dinheiro no Asaas na fatura correspondente (recebimento externo).
3. Atualiza o CRM: fatura como paga, histórico como `confirmada_paga` e parcela do acordo como paga, quando houver.
4. A linha passa a exibir "Recebida" em verde.

## 4. Negativação (ação manual)

Quando uma cobrança fica vencida há mais de 30 dias após o envio/acordo, a linha mostra o botão **Negativar**:

- Ao clicar, o sistema busca todos os débitos em aberto do cliente pelo nome/CPF/CNPJ e apresenta o total consolidado para confirmação.
- Confirmando, o cliente recebe a etiqueta **Negativado**, visível no histórico e na ficha do cliente.
- É possível remover a etiqueta caso o cliente quite os débitos (a quitação total remove automaticamente).
- Sem integração com birô de crédito — a marcação é interna ao CRM.

## Detalhes técnicos

- **Banco**: adicionar em `cobranca_historico` os campos `situacao` (recebida | aguardando | vencida), `pago_em`, `pago_manual`, `pago_obs`. Adicionar em `profiles` os campos `negativado` (bool), `negativado_em`, `negativado_total`. Migração com grants/RLS conforme padrão do projeto.
- **Edge function `cobrar-fatura-vencida**`: nova etapa que chama `GET /payments/{id}` no Asaas (via `ASAAS_API_KEY`) para obter `invoiceUrl` / `bankSlipUrl` / status atualizado; persiste em `invoices.invoice_url` e usa no WhatsApp/e-mail.
- **Nova edge function `confirmar-pagamento-manual**`: valida entrada (Zod), chama `POST /payments/{id}/receiveInCash` no Asaas, atualiza `invoices`, `cobranca_historico`, `parcelas_devedor` / `parcelas_renegociadas`.
- **Nova edge function `negativar-cliente**`: agrega débitos abertos por `user_id` e por CPF/CNPJ normalizado, grava a marcação no perfil e registra em `client_activities`.
- **Front**: `src/components/admin/financeiro/vencidos/Vencidos30DiasTab.tsx` (coluna + ações no histórico) e `src/pages/admin/Devedores.tsx` (coluna nos dois históricos). Novo diálogo compartilhado `ConfirmarPagamentoDialog.tsx` e `NegativarClienteDialog.tsx` em `src/components/admin/financeiro/`.
- Nada muda nas listas de +30/+60 dias, nos fluxos de negociação/renegociação nem no webhook do Asaas existente (que continua marcando pagamentos automáticos). 