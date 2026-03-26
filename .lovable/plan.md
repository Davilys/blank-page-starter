

## Plano: Exportar e Importar TODOS os Dados do Sistema

### Problema Atual
A exportação/importação só cobre 3 tabelas (leads, profiles, contracts). O sistema tem **~50 tabelas** com dados importantes que ficam de fora.

### Solução

Expandir ambos os componentes (BackupSettings e BackupImportSection) para cobrir todas as tabelas do sistema, organizadas por categoria, com paginação para superar o limite de 1000 registros.

### Tabelas que serão incluídas

**Dados Principais (já existentes):**
- leads, profiles, contracts

**Dados de Negócio (novos):**
- brand_processes, invoices, documents, inpi_resources, process_events, publicacoes_marcas

**Contratos (detalhes):**
- contract_attachments, contract_comments, contract_notes, contract_tasks, contract_templates, contract_types, contract_renewal_history

**Comunicação:**
- chat_messages, notifications, notification_templates, email_templates, email_logs, email_inbox, email_accounts

**Marketing:**
- marketing_campaigns, marketing_ads, marketing_conversions, marketing_attribution, marketing_config, marketing_ab_tests, marketing_ab_variants, marketing_ad_performance, marketing_audience_suggestions, marketing_budget_alerts, marketing_generated_ads

**Remarketing:**
- client_remarketing_campaigns, client_remarketing_queue, lead_remarketing_campaigns, lead_remarketing_queue

**CRM/Atividades:**
- client_activities, client_notes, client_appointments, lead_activities

**INPI/RPI:**
- rpi_uploads, rpi_entries, inpi_knowledge_base, inpi_sync_logs, publicacao_logs

**Sistema/Config:**
- system_settings, admin_permissions, user_roles, notification_logs, notification_dispatch_logs, channel_notification_templates, ai_providers, ai_usage_logs, login_history, signature_audit_log, import_logs

**Outros:**
- award_entries, meetings, meeting_participants, conversations, conversation_messages, conversation_participants, call_signals, upsell_engine_config, upsell_engine_weights, upsell_monetization_logs, intelligence_process_history, promotion_expiration_logs

### Alterações Técnicas

#### 1. BackupSettings.tsx - Exportação Completa
- Criar lista completa de todas as tabelas com seus nomes amigáveis e `_type`
- Implementar função `fetchAllFromTable()` com paginação (busca em lotes de 1000 até esgotar)
- Reorganizar botões de exportação: manter os individuais (Leads, Clientes, Contratos) + adicionar botão "Tudo" que realmente exporta TUDO
- Cada registro no JSON receberá `_type` com o nome da tabela
- Mostrar progresso durante exportação completa (ex: "Exportando tabela 5 de 50...")

#### 2. BackupImportSection.tsx - Importação Completa
- Expandir o `ImportTarget` type para incluir todas as tabelas
- Expandir o mapeamento no `switch/case` do `importData` para reconhecer todos os `_type` e direcionar para a tabela correta
- Melhorar auto-detecção para mais tipos de dados
- Adicionar todas as tabelas no Select de destino, organizadas por categoria

#### 3. Paginação na Exportação
- Função helper que faz queries em loop com `.range(from, to)` até não retornar mais dados
- Garante que tabelas com mais de 1000 registros sejam exportadas completamente

### Arquivos Modificados
- `src/components/admin/settings/BackupSettings.tsx`
- `src/components/admin/settings/BackupImportSection.tsx`

### Sem Impacto
- Nenhuma tabela existente será alterada (sem migrations)
- Nenhuma lógica de negócio existente será modificada
- Apenas a UI de exportação/importação será expandida

