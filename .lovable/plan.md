# Excluir cobrança e criar nova fatura (aba Financeiro do cliente)

Duas novas ações na ficha do cliente, reaproveitando a integração Asaas já existente.

## 1. Excluir (cancelar) a cobrança

No painel que abre ao clicar numa cobrança pendente ou vencida, entra o botão **"Excluir cobrança"** (vermelho, só para administradores com permissão financeira).

- Pede confirmação com um motivo curto obrigatório.
- Reconsulta o status real no Asaas antes de agir: se estiver paga, confirmada ou estornada, a ação é recusada com aviso claro.
- Cancela a cobrança no Asaas usando a rotina de cancelamento já usada no acordo (nunca marca como cancelada sem confirmação da API).
- A fatura passa a "Cancelada" na ficha, continua visível no histórico com etiqueta **"Cancelada manualmente"**, e sai do resumo de pendente/vencido.
- Se o cancelamento falhar no Asaas, nada muda no CRM e aparece o erro com opção de tentar de novo.
- Registro completo no histórico de cobrança: quem fez, data/hora, motivo, resposta resumida do Asaas.
- Cobranças com acordo ativo vinculado não podem ser excluídas por aqui.

## 2. Criar nova fatura

Botão **"Nova fatura"** no topo da aba Financeiro (mesma permissão financeira).

Formulário:
- Descrição do serviço
- Valor (máscara em reais)
- Vencimento
- Forma de cobrança: Boleto, Pix ou Cartão
- Caixa de seleção "Avisar o cliente por WhatsApp e e-mail" (desmarcada por padrão)

Ao confirmar, cria a cobrança de verdade no Asaas para o cliente e ela aparece na lista já com o link de pagamento. Se o cliente não tiver CPF/CNPJ válido, a fatura é criada apenas no CRM, com aviso explícito de que não houve cobrança no Asaas.

Se a caixa de aviso estiver marcada, o envio por WhatsApp e e-mail usa o mesmo caminho do botão "Cobrar cliente", confirmando cada canal separadamente; falha de envio não desfaz a fatura criada.

Proteções: botão bloqueado no primeiro clique ("Criando..."), chave de idempotência para não duplicar por clique repetido, validação de valor maior que zero, vencimento não anterior a hoje e descrição preenchida.

## Detalhes técnicos

- Nova ação `excluir` na Edge Function `criar-acordo-cliente` (já valida JWT + `has_financial_permission`), usando `cancelarCobrancaAsaas` de `_shared/crmCobranca.ts` e `registrarTratamento` com motivo `outra`.
- Migração: colunas `cancelado_em`, `cancelado_por`, `cancelamento_motivo` em `invoices`; nenhuma tabela nova.
- Criação de fatura reaproveita a Edge Function `create-admin-invoice` (já suporta boleto/pix/cartão, Asaas + fallback local); acréscimo de `crm_action_id` para idempotência e marcação `originado_pelo_crm`.
- Frontend: botão e diálogo de exclusão em `InvoiceActionsSheet.tsx`; novo `NovaFaturaDialog.tsx`; botão "Nova fatura", recarregamento da lista e recálculo do resumo (canceladas fora de pendente/vencido) em `ClientDetailSheet.tsx`.
- Cores existentes: vermelho para exclusão, azul para ações, verde para sucesso. Modal não fecha durante a operação.

## Testes

Cobrança paga no Asaas mas vencida no CRM (exclusão recusada), falha de cancelamento no Asaas, clique duplo em excluir e em criar, cliente sem CPF/CNPJ, cliente sem telefone ou sem e-mail com aviso marcado, administrador sem permissão financeira, resumo financeiro após exclusão.
