## Ajustes na central "Aguardando"

### 1. Botão "Sincronizar com Asaas"
- Adicionar botão no topo da página `/admin/financeiro/aguardando` (ao lado do título), com ícone de refresh.
- Ao clicar: chama a edge function existente de sync do Asaas (a mesma usada em `Financeiro.tsx` para atualizar faturas). Mostra toast "Sincronizando..." → "Lista atualizada".
- Após sucesso, refaz o `refetch()` da query das faturas aguardando.

### 2. Remover modo "Simular"
- Remover o botão/opção "Simular" do `LembreteConfirmDialog.tsx`.
- Remover parâmetro `dry_run` da chamada da edge function `lembrar-fatura-vencendo`.
- Ao clicar em **Enviar**, dispara o envio real imediatamente (Email + WhatsApp via webhook BotConversa) — sem preview de JSON.

### 3. Delay automático entre envios (envio em lote)
- Quando o admin seleciona múltiplos clientes e clica em "Enviar lembrete":
  - Loop no frontend: para cada fatura selecionada, chama `lembrar-fatura-vencendo` sequencialmente.
  - Entre cada chamada, aguarda **delay aleatório entre 5s e 10s** (humaniza o disparo e evita bloqueio do webhook, mesmo padrão do fluxo de vencidos).
  - Progresso visível: "Enviando 2 de 15..." com barra de progresso no dialog.
  - Ao final: toast com resumo "15 lembretes enviados com sucesso" (ou X sucessos / Y falhas).
- Envio individual (1 cliente): dispara imediatamente sem delay.

### 4. Confirmação antes do envio
- O dialog passa a ser apenas de **confirmação** (não mais simulação):
  - Lista resumida: "Você vai enviar N lembretes por Email + WhatsApp"
  - Mostra alguns nomes de exemplo (primeiros 3 + "e mais X...")
  - Botões: **Cancelar** | **Enviar agora** (destaque)
- Após clique em "Enviar agora", começa o loop com delay e mostra progresso ao vivo.

### Arquivos a editar
- `src/pages/admin/FinanceiroAguardando.tsx` — adicionar botão de sync Asaas no header
- `src/components/admin/financeiro/aguardando/LembreteConfirmDialog.tsx` — remover simular, adicionar progresso, delay 5–10s entre envios
- `src/components/admin/financeiro/aguardando/AguardandoTab.tsx` — remover referências a dry-run
- `supabase/functions/lembrar-fatura-vencendo/index.ts` — remover branch `dry_run` (envio sempre real)

### Detalhes técnicos
- Delay: `await new Promise(r => setTimeout(r, 5000 + Math.random() * 5000))` entre cada invoke.
- Sync Asaas: reutiliza a edge function que `Financeiro.tsx` já invoca (identifico o nome ao entrar em build mode; provavelmente `sync-asaas-invoices` ou similar).
- Idempotência dos 20h da edge function permanece — evita duplicar se admin clicar duas vezes.
