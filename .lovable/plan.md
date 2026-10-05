# Novo Contrato — ocultar Forma de Pagamento ao selecionar Procuração

## Contexto confirmado
- Arquivo: `src/components/admin/contracts/CreateContractDialog.tsx` (diálogo "Novo Documento").
- O bloco "Forma de Pagamento *" (linha ~2818) é exibido quando `isStandardContractTemplate && !isMonitoramentoTemplate && document_type !== 'distrato_*'`.
- Causa raiz confirmada: `isStandardContractTemplate` (linhas 1365–1367) considera qualquer template cujo nome contenha "padrão". O template "Procuração INPI - Padrão" contém "padrão", então o bloco de pagamento (PIX/Cartão/Boleto) continua aparecendo mesmo sendo procuração.
- Já existe o tipo `document_type === 'procuracao'`, derivado do nome do template em `getDocumentTypeFromTemplateName` (linha 161).
- Ao trocar de template, `setPaymentMethod(null)` já é executado (linha 2265), e o salvamento já grava `payment_method: null` quando não há método escolhido (linha 1013). Não é preciso mexer no salvamento.

## Mudanças (somente este arquivo)
1. Excluir procuração da condição do bloco de pagamento: adicionar `formData.document_type !== 'procuracao'` à condição da linha ~2818. Resultado: com "Contrato Padrão" o formulário de pagamento aparece como hoje; com "Procuração INPI - Padrão" (ou qualquer procuração) o bloco "Forma de Pagamento" some por completo, inclusive o resumo "Forma selecionada".
2. Não alterar: abas, campos de valores, assunto automático, botão "Criar e Enviar Link", salvamento, modelos de documento, regras do fluxo de novo cliente (nele o template é fixo no contrato padrão, então procuração não aparece lá).

## Verificação
- Typecheck (`bunx tsgo --noEmit`).
- Teste no preview: abrir Novo Documento → selecionar "Contrato Padrão" (pagamento visível) → selecionar "Procuração INPI - Padrão" (seção de pagamento ausente) → voltar ao contrato padrão (pagamento volta).
