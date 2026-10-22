# Nova página /formulario — proposta de registro sem busca de viabilidade

## O que muda (só na nova página; /registrar continua igual)

**Topo**

- Selo: "Proposta de Registro de Marcas · INPI"
- Título: "Em apenas 1 minuto, receba sua proposta de registro de marca!"
- Subtítulo: "Preencha seus dados para gerar sua proposta. Após sua aprovação, iniciamos imediatamente o processo de registro da sua marca junto ao INPI."

**Indicador de etapas**

- Sai a barra separada com ícones (Viabilidade, Dados Pessoais...).
- Entra uma fileira de traços finos dentro do próprio cartão do formulário, no topo. Etapas concluídas e atual em azul WebMarcas, futuras em cinza (como no exemplo, mas azul em vez de amarelo).

**Passo 1 — Informe seus dados** (substitui a consulta ao INPI)

- Título: "Informe seus dados"; texto: "Complete suas informações para prosseguir para receber a proposta"
- 5 campos: Nome da marca, Ramo de atividade, Nome completo, E-mail, Celular
- Botão: "Continuar" (sem consulta ao INPI)

**Passo 2 — Dados pessoais + dados da marca juntos**

- Mesmo formulário de hoje, mas sem pedir de novo nome, e-mail, celular, nome da marca e ramo (já vêm do passo 1).
- Ficam: CPF/CNPJ, CEP, endereço, número, bairro, cidade, estado, e a parte da marca (tem CNPJ?, razão social, classes).

**Passos seguintes** — Planos, Pagamento, Contrato: iguais ao /registrar, mesmo envio do pedido e mesma página de confirmação.

Total: 4 traços (Dados, Complemento, Planos, Pagamento/Contrato conforme o fluxo atual — 5 traços se mantivermos Pagamento e Contrato separados, que é o padrão).

## Detalhes técnicos

- Nova página `src/pages/Formulario.tsx` + rota `/formulario` em App.tsx, reaproveitando layout (Header, Footer, fundo azul) de `Registrar.tsx`.
- Novo componente `QuickLeadStep` (5 campos, validação zod: e-mail, telefone BR, limites de tamanho).
- `StepDashes` (traços azuis com `bg-primary` / `bg-muted`) dentro do `CardContent`.
- `PersonalDataStep` e `BrandDataStep` ganham prop opcional `hideBasicFields` / modo combinado, para não alterar /registrar; o passo 2 renderiza os dois em sequência com um único "Continuar".
- Sem resultado de viabilidade: classes sugeridas vazias (cliente escolhe na etapa de marca, como hoje quando não há sugestão). Envio para `create-asaas-payment` idêntico.
- Helmet com título/descrição próprios e `noindex` opcional não aplicado (página pública). ISSO RESTANTE SEGUE IGUAL REGISTRAR GERA CONTRATO TUDO EXATAMENTE IGUAL /REGISTAR O QUE MUDA QUE NAO TEM MAIS BUSCA DE VIABILIDADE 