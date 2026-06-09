## Correção no template de Email

No arquivo `src/components/admin/clients/ServiceActionPanel.tsx` (linha 55), a saudação atual é:

```
Prezad@ ${nome},
```

Será alterada para:

```
Prezado ${nome},
```

### Escopo
- Apenas a função `generateEmailTemplate` (template de Email).
- A mensagem do WhatsApp (`Olá, {primeiroNome}`) permanece inalterada.
- Nenhuma outra lógica, variável ou template é tocado.