# Anuidades — Configurações editáveis + teste real para Davilys

## Problema
Hoje o botão "Configurações" fica desativado enquanto não existe campanha no exercício, e só dá para mudar algumas coisas (data, horário, limite, valor). O texto do e-mail não pode ser editado.

## O que vai mudar

### 1. Botão Configurações sempre funcionando
Abre um painel com abas, mesmo antes de gerar a campanha:

**Cobrança**
- Valor da anuidade (ex.: R$ 398,00 hoje; R$ 450,00 no ano que vem).
- Descrição do boleto no Asaas (com campos automáticos como exercício e marca).
- Dias para vencer (5 hoje) e a regra de passar para segunda quando cair em sexta, sábado ou domingo (pode ligar ou desligar).

**Agenda**
- Dia e mês de início (10/12 hoje), horário diário, limite de clientes por dia (até 200).
- Período de referência (ex.: "Exercício 2027").

**E-mail**
- Assunto e texto do e-mail, totalmente editáveis.
- Nome do remetente e e-mail de resposta.
- Texto do botão ("Acessar boleto") e rodapé (contato, WhatsApp, site).
- Lista de campos automáticos para inserir com um clique: nome do cliente, valor, exercício, período, vencimento, link do boleto, marcas.
- Prévia ao lado, atualizada enquanto edita, e botão "Enviar teste".
- Botão "Restaurar texto padrão".

**Regras de elegibilidade**
- Exigir ou não a cláusula de anuidade no contrato (ligado hoje).
- Palavra que identifica a cláusula (padrão "anuidade").

### 2. Como os valores se aplicam
- Existe um **modelo padrão**, usado por todos os anos futuros.
- Ao gerar a anuidade de um exercício, esse modelo é **copiado** para a campanha daquele ano. Mudanças depois disso valem só para os boletos e e-mails que ainda não saíram. Os boletos já emitidos ficam como estão.
- Dentro da campanha você escolhe: "Salvar só para este exercício" ou "Salvar também como padrão para os próximos anos".
- Toda alteração fica no histórico (quem mudou, quando, o quê).
- Antes de salvar, o sistema confere se faltam campos obrigatórios no e-mail (por exemplo, o link do boleto) e avisa.

### 3. Teste real para Davilys (davillys@gmail.com)
- Novo botão **"Teste real com cliente"**, só para quem tem permissão financeira: você escolhe um cliente e o sistema emite um boleto real de anuidade no Asaas e manda o e-mail real.
- Ele não entra na fila da campanha, não gasta a cota de 200 por dia e fica marcado como "TESTE" no histórico. A cobrança aparece no Financeiro como anuidade.
- Depois de aprovado, faço o primeiro disparo para **Davilys cunha (davillys@gmail.com)**: R$ 398,00, vencimento em 13/10/2026 (5 dias depois de hoje) e o texto atual do e-mail. Envio para você o ID e o link do boleto.
- Uma única cobrança: se o teste for repetido para o mesmo cliente, o sistema reaproveita o boleto e só reenvia o e-mail.

## Detalhes técnicos
- Nova tabela `annuity_settings` (uma linha padrão, id fixo) com: `amount_cents`, `due_days`, `weekend_shift`, `start_day`, `start_month`, `daily_hour`, `daily_limit`, `boleto_description_tpl`, `email_subject_tpl`, `email_body_tpl`, `email_button_label`, `email_footer`, `sender_name`, `reply_to`, `require_clause`, `clause_keyword`. Leitura via `has_financial_permission`; gravação só pelo servidor.
- `annuity_campaigns` ganha `settings jsonb`, uma cópia das configurações no momento em que a campanha começa. O worker usa essa cópia.
- `rules.ts`: `buildAnnuityEmail` passa a montar o e-mail a partir do modelo, com troca segura das `{{variáveis}}` e escape do HTML. A conferência de campos obrigatórios fica mantida. `calcAnnuityDueDate(emission, dueDays, weekendShift)`. Ajustar os testes do vencimento.
- Novas ações no servidor: `get_settings`, `save_settings` (padrão ou campanha) e `real_test` (cliente específico; `externalReference` `anuidade-teste:{ex}:{client}`; marcado como teste; sem cota).
- Frontend: novo `AnnuitySettingsDialog` com abas Cobrança / Agenda / E-mail / Regras, editor com os campos automáticos e prévia em tempo real; o botão Configurações deixa de ser desativado; novo botão "Teste real com cliente".
