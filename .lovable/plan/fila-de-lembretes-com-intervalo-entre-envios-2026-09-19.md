# Fila de lembretes com intervalo entre envios

Hoje, ao selecionar vários clientes e clicar em "Lembrar", os envios acontecem dentro da própria janela do navegador, um a cada 1 minuto. Se a tela for fechada, o restante não sai.

A partir de agora os lembretes entram em uma **fila no servidor**: você escolhe o intervalo, confirma, e o sistema dispara **um cliente por vez**, respeitando o tempo entre cada envio — mesmo com a tela fechada.

## Como vai funcionar

1. Você seleciona as faturas e clica em "Lembrar (11)".
2. A janela de confirmação passa a ter um campo **Intervalo entre envios**: 3, 5 (padrão), 10 ou 15 minutos.
3. Ao confirmar, as faturas entram na fila com horário previsto (o 1º sai logo, o 2º em 5 min, o 3º em 10 min...).
4. Você pode fechar a tela. O envio continua sozinho.
5. Um painel "Fila de lembretes" mostra pendentes, enviados, falhas, horário previsto de cada um, e permite **cancelar** os que ainda não saíram.
6. Envios só ocorrem em horário comercial (08h–18h, seg–sex), como já acontece na rotina automática; quem cair fora do horário aguarda a próxima janela.
7. Cada fatura tem trava de duplicidade: se já estiver na fila pendente, não entra de novo.

## Detalhes técnicos

**Banco (migração aditiva)**
- Nova tabela `lembrete_fila`: `invoice_id`, `asaas_payment_id`, `tipo` (d0/d3), `cliente_nome`, `scheduled_at`, `status` (pendente/enviado/pulado/falha/cancelado), `attempts`, `last_error`, `batch_id`, `interval_minutes`, `created_by`, timestamps.
- GRANTs para `authenticated` (select/insert/update) e `service_role` (all); RLS: somente `has_role(auth.uid(),'admin')`.
- Índice parcial em `(status, scheduled_at)` e índice único parcial em `invoice_id` para status pendente.

**Processador**
- Nova edge function `processar-fila-lembretes`: pega o item pendente vencido mais antigo (um por execução, com trava atômica via update condicional), verifica horário comercial, chama `lembrar-fatura-vencendo` e grava resultado/erro real. Nunca envia mais de um por execução.
- Agendamento com `pg_cron` a cada 1 minuto (1440 execuções/dia). Essa frequência é necessária para respeitar o intervalo escolhido com precisão de minuto; execuções sem fila pendente são consultas mínimas ao banco, mas geram uso recorrente. Alternativa mais econômica seria rodar a cada 5 minutos, com atraso de até 5 min no disparo — indico manter 1 minuto pela precisão.

**Frontend**
- `LembreteConfirmDialog.tsx`: troca o loop com `setTimeout` pelo enfileiramento (insert em `lembrete_fila`), com seletor de intervalo e resumo dos horários previstos.
- `AguardandoTab.tsx`: nova aba/painel "Fila" listando os itens com status, horário previsto e botão de cancelar pendentes.
- Nada muda no conteúdo da mensagem, nos canais (Email + WhatsApp), na função `lembrar-fatura-vencendo`, no histórico atual nem nas demais abas do financeiro.
