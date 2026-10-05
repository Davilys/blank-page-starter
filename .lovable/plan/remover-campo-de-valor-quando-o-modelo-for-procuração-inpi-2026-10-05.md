# Remover campo de valor quando o modelo for Procuração INPI

## Objetivo
No diálogo "Novo Documento" (aba Contratos), quando o modelo selecionado for uma procuração, nenhum campo de valor/preço pode aparecer — procuração não tem cobrança.

## Estado atual (confirmado no código)
- A seção "Forma de Pagamento" já é ocultada para procuração (correção anterior).
- Mas o campo **"Valor do Documento"** (linha ~2392 de `CreateContractDialog.tsx`) só é ocultado para `distrato_multa` — por isso continua aparecendo com valor "699" quando o modelo é "Procuração INPI - Padrão".

## Mudança
Arquivo único: `src/components/admin/contracts/CreateContractDialog.tsx`

1. Ocultar o campo "Valor do Documento" também quando `document_type === 'procuracao'` (a condição passa a excluir procuração, além de distrato_multa).
2. Ao salvar uma procuração, gravar `contract_value` como `null` (sem valor), garantindo que nenhum valor residual (ex.: o padrão "699") seja registrado no documento.
3. Nada mais muda: Contrato Padrão, Monitoramento e Distrato continuam exibindo seus campos de valor normalmente; demais abas, fluxos e integrações intactos.

## Validação
- Compilação (typecheck) sem erros.
- Conferência estática do fluxo: procuração → sem "Valor do Documento" e sem "Forma de Pagamento"; voltar para Contrato Padrão → campos reaparecem.
- Observação: a área administrativa usa autenticação externa, então a validação visual logada no preview não é possível daqui — será indicado ao usuário como conferir na tela.
