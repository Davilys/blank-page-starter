# Financeiro da ficha do cliente — conciliação real com o Asaas

Objetivo: a aba Financeiro passa a refletir exatamente o que existe hoje no Asaas, com totais corretos, cobranças clicáveis e histórico auditável. O visual atual (topo colorido, cores, ícones, cartões) é preservado — muda a ordem, os rótulos citados e as regras de cálculo.

## Causa confirmada dos valores errados

As faturas locais gravam status no padrão do Asaas (`received`, `canceled`, `overdue`, `pending`, `confirmed` — hoje há 386 canceladas, 205 recebidas, 189 vencidas, 140 pendentes), mas a tela soma procurando `paid` e ignora apenas `cancelled`/`refunded` (com dois "l"). Resultado: nada entra em "Pago" e **toda cobrança cancelada é somada como pendente** — é exatamente o caso do R$ 9.408,79 do print. A correção central é normalizar status em um único lugar.

## O que muda

### 1. Botões do topo (só a ordem)
Frequentes: Chat, E-mail, Notificar, Detalhes do Processo. Administrativas: Mover, Nova Fatura, Cliente Especial, Resetar Senha. Destrutiva, separada ao final: Excluir (mantém confirmação e permissão). Nenhuma ação financeira vira botão de topo.

### 2. Ordem e rótulos da aba
Resumo financeiro consolidado → Vencidas (mais antiga primeiro) → A vencer (vencimento mais próximo) → Pagas → Canceladas/removidas (recolhido, "Ver histórico"). Cada linha ganha um selo discreto de origem: Asaas, Fatura interna ou Acordo.

### 3. Cartão "Cobranças Asaas"
Rótulo "Em aberto" passa a "A vencer"; valor e quantidade em cada indicador; contador do cabeçalho vira "N contas Asaas" (nunca contagem de boletos). Botão "Atualizar" vira "Sincronizar" (mesmo ícone, estilo e posição), com "Sincronizando...", bloqueio de cliques, mensagem de sucesso/falha e "Última sincronização: dd/MM/yyyy às HH:mm".

### 4. Sincronização real
"Sincronizar" varre o Asaas ao vivo: resolve todas as contas do cliente (asaas_customer_id, CPF/CNPJ, e-mail), percorre toda a paginação de cobranças, cria no CRM o que falta, atualiza valor, vencimento, descrição, link e status do que existe, e reclassifica tudo. Se qualquer página falhar, der timeout ou retornar parcial, **nada é removido** e a tela avisa que a sincronização foi incompleta.

### 5. Sumidas e canceladas
Cobrança que não existe mais no Asaas sai da lista ativa e de todos os totais, fica marcada como "Removida do Asaas" e só aparece no histórico — nunca é apagada do banco. Cancelada/estornada idem: fora dos totais, sem botões de cobrar ou acordo.

### 6. Resumo financeiro
Recalculado após cada sincronização e após cada evento (pagamento, cancelamento, acordo, webhook), sem recarregar a página: Total ativo (a vencer + vencidas válidas), Pago, A vencer (vencimento hoje ou futuro), Vencido (vencimento passado). Ficam de fora pagas, canceladas, estornadas, removidas e originais substituídas por acordo.

### 7. Sem duplicidade interna/Asaas
Fatura interna e cobrança Asaas são fundidas em uma linha única quando houver vínculo real (`asaas_invoice_id`, externalReference, invoice_id, acordo). O status do Asaas manda; o vínculo interno é preservado. Nunca deduplicar por valor igual.

### 8. Cobranças clicáveis
Cada cobrança ativa abre o painel já existente com descrição, origem, valor, vencimento, dias em atraso, status no Asaas, "Abrir no Asaas", "Cobrar cliente", "Fazer acordo" e "Fechar" — sem fechar durante uma operação. Pagas, canceladas, estornadas e removidas abrem só em consulta.

Cobrar cliente e Fazer acordo continuam como já estão (reuso de `cobrar-fatura-vencida` e `criar-acordo-cliente`, trava de 24 h, juros 10 % editável em centavos, vencimento no mesmo dia do mês, criação das parcelas antes do cancelamento da original, idempotência e permissão financeira). O acordo passa a fixar boleto como forma de cobrança e as parcelas aparecem como "Parcela X de Y" com selo "Acordo ativo".

## Detalhes técnicos

**Migração** em `invoices`: `sync_status` (`ativa` | `removida_asaas`), `removida_em`, `ultima_sincronizacao_asaas`, `origem` (`asaas` | `interna` | `acordo`), índice por `user_id, sync_status`. Nova tabela `asaas_sync_logs` (cliente, usuário, contas consultadas, cobranças encontradas/criadas/atualizadas/removidas, sucesso/falha, duração) com RLS admin e GRANTs.

**Edge Function nova** `sync-asaas-client-invoices` (valida JWT + admin, permissão financeira para detalhes sensíveis): resolve os customer IDs, pagina `/payments?customer=...` até o fim por conta, faz upsert em `invoices` por `asaas_invoice_id` (índice único já existe), marca ausentes como `removida_asaas` **apenas** quando todas as páginas de todas as contas retornaram OK, grava `asaas_sync_logs` e devolve totais por conta + resumo. `list-asaas-payments-for-client` passa a ser só leitura rápida do cache local.

**Frontend**: novo utilitário `src/lib/financeiro/statusCobranca.ts` com a normalização única de status (`received`/`confirmed`/`received_in_cash`/`dunning_received` → pago; `overdue`/`dunning_requested` ou pendente vencida → vencido; `canceled`/`cancelled`/`refunded`/`chargeback` → fora dos totais) usada pelo resumo, pelas listas e pelo painel de ações. `ClientDetailSheet.tsx` reordena os botões e as seções, consome a nova função e o log de sincronização; `InvoiceActionsSheet.tsx` recebe origem e trava ações em cobranças não ativas. `asaas-webhook` passa a gravar `ultima_sincronizacao_asaas` e a manter `sync_status` coerente.

**Testes** antes de publicar, com dados reais de leitura (sem criar boletos): cliente com paga, a vencer, vencida, cancelada, com várias contas Asaas, paginação, API indisponível (nada removido), fatura interna vinculada, valores iguais em serviços diferentes, sincronização repetida sem duplicar, admin sem permissão financeira e o caso do print com indicadores zerados. Entrego resultado dos testes, arquivos e funções alterados, migrações, endpoints e a comparação dos valores antes/depois — só então publicamos.
