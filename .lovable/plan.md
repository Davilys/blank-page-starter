# Módulo Anuidades — plano

## O que entendi
- Novo botão **"Anuidades"** ao lado de "Nova Fatura" no Financeiro. Ao clicar, abre uma página própria (`/admin/financeiro/anuidade`). Abrir a página **não gera nenhuma cobrança**.
- A anuidade (R$ 398,00) é cobrada **uma vez por ano, em dezembro**. Cada ano é uma **campanha separada** (exercício 2026, 2027...). Quando a de um ano termina, ela fica registrada; no ano seguinte você seleciona o novo exercício, clica em "Gerar anuidade" e um novo ciclo começa. Nada é ativado sozinho para o ano seguinte.
- Regra de ouro: **uma única anuidade por cliente por exercício**, mesmo que ele tenha várias marcas/processos. Clicar de novo só retoma, nunca duplica.

## Como vai funcionar
1. **Gerar anuidade**: o sistema varre todos os clientes no servidor, exclui quem tem distrato assinado, separa para revisão quem tem contrato ausente/divergente, sem e-mail ou sem CPF/CNPJ, e monta a fila. Antes de 10/12/2026 fica "Programado para 10/12/2026".
2. **Lotes diários**: a partir de 10/12, até 200 clientes por dia (horário inicial 09h, São Paulo), rodando sozinho no servidor — fechar a página não interrompe. Pausar/retomar/cancelar.
3. **Boleto Asaas** avulso, descrição "Anuidade contratual WebMarcas — [exercício]", vencimento em 5 dias corridos; se cair sexta, sábado ou domingo, passa para segunda. A cobrança aparece também no Financeiro geral (mesmo registro, sem duplicar).
4. **Somente e-mail**, com o modelo curto do comando (cláusulas 5.2 e 10.1), sem WhatsApp/SMS. Notificações automáticas do Asaas desligadas só para essas cobranças, para não enviar duas vezes.
5. **Falhas**: "Não gerada — ação manual" (com notificação interna, Abrir Asaas, Tentar novamente, Vincular cobrança manual); "Gerada — falha no e-mail" (Reenviar, reaproveita o boleto); "Em reconciliação" (consulta o Asaas antes de repetir).
6. **Página**: indicadores (identificados, elegíveis, excluídos, geradas, falhas, e-mails, pagas, vencidas, processados hoje, saldo diário, previsão), tabela e Kanban (A gerar, Programadas, Ação manual, Pendentes, Vencidas, Pagas, Canceladas), aba de Excluídos/Revisão com motivo, filtros, exportação, prévia do e-mail, configurações e painel de detalhes com histórico.
7. **Pagamentos** atualizados pelo webhook Asaas já existente e por conciliação periódica.
8. Acesso só para master e usuários com permissão financeira, controlado também no banco. Toda ação fica registrada (quem, quando, o quê).

## Pontos a confirmar durante a implementação
- Qual coluna do Kanban jurídico/comercial representa "Distrato" e como o distrato assinado é identificado nos documentos — verificarei nos dados antes de excluir alguém.
- Remetente `ola@webmarcas.net` precisa estar autorizado no serviço de e-mail atual.
- Testes serão feitos sem emitir boletos reais nem enviar e-mails a clientes.

## Detalhes técnicos
- Tabelas novas: `annuity_campaigns` (exercício, config, status, auditoria), `annuity_items` (cliente canônico, documento normalizado, status de geração/e-mail/financeiro separados, invoice_id, due_date, emitted_at, motivo, lease), `annuity_events` (auditoria), `annuity_daily_quota` (cota 200 clientes + 200 e-mails/dia). Único `(exercicio, client_id)`. GRANTs + RLS via `has_financial_permission(auth.uid())`.
- Cobranças gravadas em `invoices` com `origem='anuidade'` e `externalReference` único `anuidade:{exercicio}:{client_id}` (idempotência e reconciliação no Asaas).
- Edge functions: `annuity-scan` (varredura paginada), `annuity-worker` (pg_cron a cada 5 min; reserva atômica via `FOR UPDATE SKIP LOCKED`; cria boleto reaproveitando lógica de `create-asaas-payment`; envia via `send-email`), `annuity-actions` (pausar, retomar, retry, vincular manual, reenviar, prévia).
- Função pura `calcAnnuityDueDate` com testes para todos os exemplos da tabela e virada de mês/ano.
- `asaas-webhook` passa a atualizar o status financeiro do item quando `origem='anuidade'`.
- Frontend: botão em `Financeiro.tsx`, rota nova em `App.tsx`, página `FinanceiroAnuidade.tsx` com componentes no padrão visual atual; atualização em tempo real via Realtime em `annuity_items`.
