## Inserir link do boleto nas mensagens de cobrança

Apenas fluxos com cobrança (estágio de Exigência). Arquivado e Distrato não são alterados.

### Arquivo
`src/components/admin/clients/ServiceActionPanel.tsx`

### Mudanças

1. **`generateEmailTemplate`** — alterar a linha:
   - De: "...Vencimento em 10 dias."
   - Para: "...Vencimento em 10 dias. Segue link da cobrança conforme consta em contrato: `[LINK_BOLETO]`"

2. **`generateWhatsAppTemplate`** — inserir, entre o parágrafo do prazo de 60 dias e o parágrafo "Para que eu possa explicar...", um novo parágrafo:
   - "Para dar continuidade ao processo, solicitamos o pagamento da taxa de serviço no valor de R$ {valor}. Vencimento em 10 dias. Segue link da cobrança conforme consta em contrato: `[LINK_BOLETO]`"
   - Passa a usar o `valor` (remove o `void valor`).

3. **`handleSend`** — no ramo de cobrança (não-arquivado / não-distrato):
   - Remover o bloco `linkBlock` que anexava "Link de pagamento:" no fim.
   - Substituir `[LINK_BOLETO]` por `paymentLink` (ou `(link indisponível)`) tanto em `finalEmailMessage` quanto em `finalWhatsappMessage`.

Se o admin editar a textarea e mantiver `[LINK_BOLETO]`, a substituição ocorre normalmente.
