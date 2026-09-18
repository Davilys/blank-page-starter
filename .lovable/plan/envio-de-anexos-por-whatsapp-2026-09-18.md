# Envio de anexos por WhatsApp

## Implementação
- Alterar exclusivamente a aba **Anexos** da ficha do cliente.
- Exibir seleção individual apenas em arquivos reais; contratos virtuais continuam sem seleção.
- Exibir **Enviar por WhatsApp (N)** com bloqueio e indicador durante o envio.
- Validar o telefone, exigir a sessão autenticada e enviar `client_id`, `document_ids`, `process_id` e `publication_id` para a função já publicada.
- Preservar a mensagem real de erro retornada e limpar a seleção somente após sucesso.

## Validação
- Conferir o comportamento na prévia autenticada da ficha do cliente.
- Executar a compilação completa e corrigir apenas erros relacionados à alteração.

## Limites
- Nenhuma alteração em banco, função publicada, webhook, outras abas ou regras do CRM.
