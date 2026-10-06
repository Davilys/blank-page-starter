# Corrigir erro ao excluir contratos

## Causa (confirmada no banco)
O contrato não pode ser apagado porque está ligado a registros das tabelas de teste da jornada (vínculos de documento, links de prévia, assinaturas simuladas e registro de teste Asaas). Essas ligações foram criadas sem regra de exclusão, então o banco bloqueia o apagamento. O mesmo bloqueio aconteceria com contratos que tenham faturas vinculadas.

As demais ligações (comentários, anexos, tarefas, notas, histórico, auditoria de assinatura, documentos, pedidos BotConversa) já tratam a exclusão corretamente.

## O que será feito (apenas no banco, sem mudar telas ou permissões)
- Registros de teste da jornada ligados ao contrato: apagados junto com o contrato.
  - journey_document_bindings, journey_test_preview_links, journey_simulated_signature_events, journey_test_asaas_ledger
- Faturas ligadas ao contrato: preservadas (Asaas é a fonte da verdade); apenas perdem o vínculo com o contrato excluído.

Quem já pode excluir (master e usuários com permissão) continua igual — nenhuma regra de acesso muda.

## Detalhes técnicos
Migração aditiva: recriar as 4 FKs `journey_*_document_id_fkey` com `ON DELETE CASCADE` e `invoices_contract_id_fkey` com `ON DELETE SET NULL`. Depois, validar excluindo um contrato de teste "[TESTE SEM VALOR JURÍDICO]".
