# Classes sugeridas no /formulario

## O que entendi

No /formulario não há busca de viabilidade, mas o cliente informa o ramo de atividade. Ele deve receber a mesma sugestão de classes do /registrar e do site: **3 classes** sugeridas para o ramo, com a **classe principal (1ª) já marcada** e as outras duas opcionais. Hoje o /formulario mostra só o aviso "as classes serão definidas pelo ramo de atividade". Esse é o erro.

## O que muda

1. Quando o cliente clicar em **Continuar** na 1ª etapa, as 3 classes do ramo dele são buscadas na mesma inteligência que o sistema já usa para sugerir classes. Nenhuma consulta ao INPI é feita.
2. A classe principal entra já selecionada.
3. Na etapa "Dados pessoais e da marca", entra o mesmo bloco de classes do /registrar (as 3 classes com descrição, marcar/desmarcar, contador "X classes selecionadas"). Esse bloco substitui o aviso atual.
4. Planos, pagamento e contrato passam a usar as classes escolhidas, como no /registrar: o preço considera o número de classes, e o contrato e o pedido levam essas classes.
5. Se a sugestão falhar ou demorar, o cliente segue normalmente e vê o aviso atual, sem travar o formulário. Ele pode tentar de novo.
6. Se ele voltar e mudar o ramo, as classes são buscadas de novo.

## O que não muda

O /registrar, a busca de viabilidade, o envio do pedido, o Asaas, o contrato e o visual (traços azuis, sem barra do topo) ficam como estão.

## Detalhes técnicos

- `Formulario.tsx`, `handleQuickNext`: chamar `inpi-viability-check` com `{ brandName, businessArea, classesOnly: true }`. Esse modo já existe na Edge Function e não precisa ser alterado. Preencher `suggestedClasses`/`suggestedClassDescriptions`, limitar a 3 e definir `setSelectedClasses([classes[0]])`. Mostrar "Carregando…" no botão.
- `ComplementStep` (QuickStepsForm.tsx): receber `suggestedClasses`, `suggestedClassDescriptions`, `selectedClasses` e `onSelectedClassesChange`, e renderizar o mesmo seletor usado em `BrandDataStep`, reaproveitando o markup e o estilo.
- Etapas seguintes: passar `selectedClasses` como já é feito no /registrar (`classCount` e ContractStep).
- Verificação com Playwright em 390px e desktop até a etapa 2, sem gerar pedido, contrato ou boleto. 