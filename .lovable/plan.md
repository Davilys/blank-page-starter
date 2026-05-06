# Vincular Contratos ao Ficheiro do Cliente

## Diagnóstico

Auditei a tabela `contracts` (3.264 contratos no total):
- **42 contratos** estão com `user_id = NULL` (órfãos — não aparecem na ficha de nenhum cliente)
- **21 desses** têm `signatory_name` preenchido
- **14 deles** têm um cliente correspondente em `profiles` pelo nome (match exato case-insensitive)

A aba "Anexos/Contratos" da ficha do cliente (`ClientDetailSheet.tsx`) busca contratos por `user_id = client.id` (linha 922-923). Sem o `user_id` vinculado, o contrato não aparece, mesmo existindo na aba Contratos.

## O Que Será Feito

### 1. Migração de vínculo automático (SQL)
Para cada contrato com `user_id IS NULL`, tentar localizar o cliente em `profiles` na seguinte ordem de prioridade:
1. Match por **CPF/CNPJ** (`signatory_cpf` ou `signatory_cnpj` vs `profiles.cpf`, `profiles.cnpj`, `profiles.cpf_cnpj`) — mais confiável
2. Match por **nome exato** (case-insensitive, trim) — `signatory_name` vs `profiles.full_name`
3. Match por **email** se existir no contrato

Quando houver match único, atualizar `contracts.user_id`. Casos com múltiplos matches ou sem match ficam registrados num log para revisão manual (não vincula automaticamente para evitar erro).

### 2. Trigger para novos contratos
Criar um trigger `BEFORE INSERT/UPDATE` em `contracts` que, se `user_id` vier nulo mas houver `signatory_cpf` ou `signatory_name`, tenta resolver o `user_id` automaticamente pelo CPF (prioritário) ou nome.

### 3. UI: botão "Vincular cliente" na aba Contratos
Em `src/pages/admin/Contratos.tsx`, para contratos sem cliente vinculado (`profile` null), exibir um pequeno botão na linha que abre um diálogo com:
- Sugestão automática (cliente encontrado por nome/CPF)
- Campo de busca para escolher manualmente outro cliente
- Botão "Vincular" → atualiza `contracts.user_id`

Isso resolve casos ambíguos que a migração não resolveu sozinha.

## Detalhes Técnicos

**Arquivos alterados:**
- `supabase/migrations/<novo>.sql` — backfill + trigger de auto-vínculo
- `src/pages/admin/Contratos.tsx` — botão "Vincular cliente" + diálogo
- (opcional) `src/components/admin/contracts/LinkClientDialog.tsx` — novo componente

**Validação pós-deploy:**
- Após a migração, rodar `SELECT COUNT(*) FROM contracts WHERE user_id IS NULL` — esperar redução de ~14 contratos
- Abrir a ficha de um dos clientes vinculados (ex.: Lídia Mininel Alves) e confirmar que o contrato aparece na aba Anexos/Contratos
