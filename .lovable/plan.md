## Objetivo

Substituir o envio direto do botão "Cobrar" (parcelas vencidas de acordo no Histórico de Devedores) por um **diálogo de pré-visualização editável**, no mesmo padrão do "Notificar Cliente" da Publicação.

## Comportamento do novo diálogo

Ao clicar em **Cobrar** na linha da parcela vencida, abre `CobrarParcelaAcordoDialog` com:

- **Cabeçalho**: "Cobrar parcela do acordo — [NOME DO CLIENTE]" + subtítulo com nº da parcela / vencimento / valor.
- **Card de contato**: nome, email, WhatsApp e badge de status (igual ao modelo da Publicação).
- **Canais de envio** (checkboxes): ☑ Email ☑ WhatsApp — pelo menos um obrigatório. Desabilita o canal se o contato correspondente estiver vazio.
- **Abas Email / WhatsApp** com:
  - Campo **Assunto** (apenas aba Email), editável, pré-preenchido.
  - **Textarea grande** com a mensagem pré-preenchida (template já existente em `buildCobrarAcordoMessages`), totalmente editável. Email mantém formato texto/HTML simples; WhatsApp em texto puro.
  - Rodapé indicando placeholders já substituídos ([NOME], [VALOR], [LINK_BOLETO]).
- **Rodapé**: botão **Cancelar** + botão **Enviar** (label dinâmico: "Enviar por Email", "Enviar por WhatsApp", ou "Enviar pelos dois"). Mostra `Loader2` durante envio e toast de sucesso/erro.

## Envio

- Mesma função `send-multichannel-notification` já usada, com `event_type: 'parcela_acordo_vencida'`.
- Faz 1 chamada por canal selecionado, passando `custom_subject`, `custom_html`/`custom_message` editados.
- Registra em `cobranca_historico` com `status: 'enviada'` e os canais efetivamente usados.

## Arquivos

- **Novo**: `src/components/admin/financeiro/CobrarParcelaAcordoDialog.tsx` — componente do diálogo (props: `open`, `onOpenChange`, `parcela`, `clienteNome`, `clienteEmail`, `clienteWhatsapp`, `clienteCpfCnpj`, `onSent`).
- **Editar**: `src/pages/admin/Devedores.tsx` — em `ParcelasPanel`:
  - Remover `handleCobrarParcela` direto; o botão **Cobrar** passa a apenas abrir o diálogo com a parcela selecionada (`useState` local `cobrandoParcela`).
  - Buscar email/whatsapp do cliente uma vez (via `profiles` por `cpfCnpj`) ao abrir o diálogo.
  - Reaproveitar `buildCobrarAcordoMessages` movendo-o para dentro do novo dialog (ou exportando) para gerar os defaults.

Sem mudanças de schema, sem nova edge function.
