# Permitir mover qualquer cliente para o funil Jurídico

## O que muda
Hoje, ao clicar em Mover > Jurídico na ficha do cliente, aparece o aviso "Cliente precisa ter um contrato assinado para ir ao funil jurídico" e nada acontece. Esse aviso só vale para contratos assinados dentro do CRM novo, por isso trava clientes cujo contrato veio do CRM antigo.

Depois da mudança, qualquer cliente pode ir para o Jurídico, com ou sem contrato no CRM. O resto continua igual: o processo vai para "Protocolado", o histórico registra a mudança e a volta para o Comercial funciona como hoje.

## Detalhes técnicos
Em `src/components/admin/clients/ClientDetailSheet.tsx`, função `handleMoveFunnel`: remover a busca por contrato `signed` e o `return` com o toast de erro. Nenhuma alteração no banco ou nas permissões.
