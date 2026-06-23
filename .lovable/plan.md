## Objetivo

Criar a etiqueta **"CLIENTE ESPECIAL"** na ficha do cliente. Quando marcada, qualquer movimentação no card de **Serviços → Painel de Ação (Notificação + Cobrança)** envia somente a notificação ao cliente, **sem gerar fatura/cobrança de honorários**.

## Comportamento

1. **Etiqueta na ficha** (cabeçalho vermelho, ao lado do nome do cliente na parte de cima do ficheiro uma vez selecionado essa etiqueta o cliente passa ser especial :
  - Novo chip **"⭐ Cliente Especial"** (dourado), visível apenas quando ativo.
  - Toggle "Cliente Especial (sem cobrança de honorários)" no diálogo **Editar Cliente** (e também no menu/ações da ficha) — somente admins.
2. **Painel de Ação – Serviços** (`ServiceActionPanel`):
  - Ao abrir, se `profile.is_special_client === true`:
    - Banner amarelo no topo do painel: *"Cliente Especial — notificação enviada sem cobrança de honorários."*
    - Esconde toda a seção de **Cobrança** (valor, vencimento, parcelamento, método).
    - Templates de email/WhatsApp passam a usar versão "somente notificação" (remove os parágrafos sobre taxa de serviço, valor e link de boleto; mantém apenas a explicação da publicação e instruções de continuidade do processo).
    - Trata o envio como `isNotificationOnly = true` (pula `create-admin-invoice`, não gera link de boleto, registra `event_type: 'notificacao_sem_cobranca'` e `cobranca_historico.tipo_acao = 'notificacao_isenta'`).
  - Quando NÃO especial: comportamento atual permanece igual (notificação + cobrança).
3. **Histórico/Financeiro**: como nenhuma fatura é criada, o cliente especial não aparece em Devedores/Vencidos para essas movimentações. Fica registro em `cobranca_historico` apenas como notificação isenta (para auditoria).

## Mudanças técnicas

**Banco (migration)**

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_special_client boolean NOT NULL DEFAULT false;
```

(sem novas policies — coluna herda as RLS existentes de profiles)

**Frontend**

- `src/pages/admin/Clientes.tsx` — incluir `is_special_client` no SELECT e no tipo do card; renderizar chip dourado no cabeçalho da ficha quando `true`.
- Diálogo de edição do cliente (provavelmente `EditarClienteDialog` ou equivalente em `src/components/admin/clients/`) — adicionar `<Switch>` "Cliente Especial — isento de honorários nas movimentações INPI" + UPDATE em profiles. Restrito a admins.
- `src/components/admin/clients/ServiceActionPanel.tsx`:
  - Receber/buscar `is_special_client` do cliente.
  - Novo `isSpecialClient` → forçar `isNotificationOnly = true` e ocultar bloco de cobrança.
  - Criar `generateEmailTemplateSemCobranca()` e `generateWhatsAppTemplateSemCobranca()` (versões enxutas, sem cláusula 10.3, sem valor, sem link de boleto).
  - Ajustar `event_type` / `cobranca_historico` conforme acima.

Sem mudanças em edge functions.

## Arquivos

- **Migration**: `add_is_special_client_to_profiles`
- **Editar**: `src/pages/admin/Clientes.tsx`, `src/components/admin/clients/ServiceActionPanel.tsx`, diálogo de edição de cliente (a identificar na implementação)