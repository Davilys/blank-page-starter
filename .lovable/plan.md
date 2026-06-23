## Botão "Cobrar" em parcelas vencidas do histórico de negociações

### Objetivo
No Financeiro → Devedores → Histórico, ao expandir uma negociação/acordo, cada parcela com status **Vencida** ganha um botão **Cobrar** que dispara em um clique:
- 1 e-mail (template formal)
- 1 mensagem de WhatsApp (template informal)
ambos contendo o **valor da parcela** e o **link do boleto vencido**.

Disponível **apenas** para parcelas do histórico (negociações/renegociações) que estejam vencidas. Parcelas pagas ou a vencer não exibem o botão.

### Conteúdo das mensagens

**Email** — assunto: `Parcela do acordo em aberto — WebMarcas`
```
Prezado(a) [NOME],

Identificamos que uma das parcelas do acordo firmado para regularização
do seu débito encontra-se pendente de pagamento.

Lembramos que esta condição foi concedida de forma excepcional para
facilitar a regularização dos valores em aberto e manter as condições
negociadas entre as partes.

Solicitamos, por gentileza, a verificação da parcela pendente para
evitar o cancelamento dos benefícios concedidos na renegociação e
eventual retorno do débito às condições originais.

Segue o boleto vencido — valor [VALOR]: [LINK_BOLETO]

Caso o pagamento já tenha sido realizado, pedimos desconsiderar este aviso.

Permanecemos à disposição para qualquer esclarecimento.

Atenciosamente,
Financeiro WebMarcas
(11) 91112-0225
```

**WhatsApp**
```
Olá, [NOME]. Tudo bem?

Verificamos que a parcela do acordo realizado anteriormente encontra-se
em aberto.

Como essa condição foi criada especialmente para regularização do seu
débito, pedimos a gentileza de verificar o pagamento para evitar o
cancelamento dos benefícios concedidos na negociação.

Segue o boleto vencido — valor [VALOR]: [LINK_BOLETO]

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.

Estamos à disposição.
```

Placeholders substituídos: `[NOME]` (profiles.full_name), `[VALOR]` (formatado BRL da parcela), `[LINK_BOLETO]` (`invoiceUrl`/`bankSlipUrl` da parcela; se ausente, link do pagamento no Asaas).

### Alterações técnicas

1. **`src/components/admin/publicacao/cobrancaTemplates.ts`**
   - Adicionar `PARCELA_ACORDO_VENCIDA_TEMPLATE` com `buildEmail({ nome, valor, linkBoleto })` e `buildWhatsapp({...})`.

2. **`src/pages/admin/Devedores.tsx` — `ParcelasPanel`**
   - Para cada parcela com status `Vencida`, renderizar botão **Cobrar** (ícone `Send`, variant outline).
   - Ao clicar: abrir `CobrarParcelaAcordoDialog` com preview do e-mail e WhatsApp já preenchidos.
   - Botão "Enviar agora" chama a Edge Function `send-multichannel-notification` com:
     ```ts
     {
       event_type: 'parcela_acordo_vencida',
       client_id,
       channels: ['email','whatsapp'],
       payload: { nome, valor, link_boleto, parcela_numero, negociacao_id }
     }
     ```
   - Registrar em `cobranca_historico` (status `enviada`, canal `email+whatsapp`, referência à parcela).

3. **`src/components/admin/financeiro/CobrarParcelaAcordoDialog.tsx` (novo)**
   - Dialog com 2 abas (Email / WhatsApp) mostrando preview.
   - Botões: Cancelar / Enviar.
   - Mostra toast de sucesso/erro.

4. **`supabase/functions/send-multichannel-notification/index.ts`**
   - Adicionar branch para `event_type === 'parcela_acordo_vencida'`:
     - Monta e-mail e WhatsApp com os templates novos.
     - Envia via Resend (e-mail) e gateway WhatsApp já usado pelos outros eventos.
     - Insere registro em `cobranca_historico`.

### Fora do escopo
- Não altera regras de filtragem de vencidos já implementadas.
- Não cria nova tabela; reaproveita `cobranca_historico` para auditoria.
- Não envia para parcelas pagas ou a vencer.
