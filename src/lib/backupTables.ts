/**
 * Complete list of all system tables for backup/restore
 */
export interface BackupTable {
  name: string;
  label: string;
  category: string;
}

export const ALL_BACKUP_TABLES: BackupTable[] = [
  // Dados Principais
  { name: 'leads', label: 'Leads', category: 'Dados Principais' },
  { name: 'profiles', label: 'Clientes (Profiles)', category: 'Dados Principais' },
  { name: 'contracts', label: 'Contratos', category: 'Dados Principais' },

  // Dados de Negócio
  { name: 'brand_processes', label: 'Processos de Marca', category: 'Dados de Negócio' },
  { name: 'invoices', label: 'Faturas', category: 'Dados de Negócio' },
  { name: 'documents', label: 'Documentos', category: 'Dados de Negócio' },
  { name: 'inpi_resources', label: 'Recursos INPI', category: 'Dados de Negócio' },
  { name: 'process_events', label: 'Eventos de Processo', category: 'Dados de Negócio' },
  { name: 'publicacoes_marcas', label: 'Publicações de Marcas', category: 'Dados de Negócio' },

  // Contratos (detalhes)
  { name: 'contract_attachments', label: 'Anexos de Contrato', category: 'Contratos (Detalhes)' },
  { name: 'contract_comments', label: 'Comentários de Contrato', category: 'Contratos (Detalhes)' },
  { name: 'contract_notes', label: 'Notas de Contrato', category: 'Contratos (Detalhes)' },
  { name: 'contract_tasks', label: 'Tarefas de Contrato', category: 'Contratos (Detalhes)' },
  { name: 'contract_templates', label: 'Modelos de Contrato', category: 'Contratos (Detalhes)' },
  { name: 'contract_types', label: 'Tipos de Contrato', category: 'Contratos (Detalhes)' },
  { name: 'contract_renewal_history', label: 'Histórico de Renovação', category: 'Contratos (Detalhes)' },

  // Comunicação
  { name: 'chat_messages', label: 'Mensagens do Chat', category: 'Comunicação' },
  { name: 'notifications', label: 'Notificações', category: 'Comunicação' },
  { name: 'notification_templates', label: 'Modelos de Notificação', category: 'Comunicação' },
  { name: 'email_templates', label: 'Modelos de Email', category: 'Comunicação' },
  { name: 'email_logs', label: 'Logs de Email', category: 'Comunicação' },
  { name: 'email_inbox', label: 'Caixa de Entrada', category: 'Comunicação' },
  { name: 'email_accounts', label: 'Contas de Email', category: 'Comunicação' },

  // Marketing
  { name: 'marketing_campaigns', label: 'Campanhas de Marketing', category: 'Marketing' },
  { name: 'marketing_attribution', label: 'Atribuição de Marketing', category: 'Marketing' },
  { name: 'marketing_config', label: 'Config. Marketing', category: 'Marketing' },
  { name: 'marketing_ab_tests', label: 'Testes A/B', category: 'Marketing' },
  { name: 'marketing_ab_variants', label: 'Variantes A/B', category: 'Marketing' },
  { name: 'marketing_audience_suggestions', label: 'Sugestões de Audiência', category: 'Marketing' },
  { name: 'marketing_budget_alerts', label: 'Alertas de Orçamento', category: 'Marketing' },

  // Remarketing
  { name: 'client_remarketing_campaigns', label: 'Campanhas Remarketing (Clientes)', category: 'Remarketing' },
  { name: 'client_remarketing_queue', label: 'Fila Remarketing (Clientes)', category: 'Remarketing' },
  { name: 'lead_remarketing_campaigns', label: 'Campanhas Remarketing (Leads)', category: 'Remarketing' },
  { name: 'lead_remarketing_queue', label: 'Fila Remarketing (Leads)', category: 'Remarketing' },

  // CRM/Atividades
  { name: 'client_activities', label: 'Atividades de Cliente', category: 'CRM/Atividades' },
  { name: 'client_notes', label: 'Notas de Cliente', category: 'CRM/Atividades' },
  { name: 'client_appointments', label: 'Agendamentos', category: 'CRM/Atividades' },
  { name: 'lead_activities', label: 'Atividades de Lead', category: 'CRM/Atividades' },

  // INPI/RPI
  { name: 'rpi_uploads', label: 'Uploads RPI', category: 'INPI/RPI' },
  { name: 'rpi_entries', label: 'Entradas RPI', category: 'INPI/RPI' },
  { name: 'inpi_knowledge_base', label: 'Base de Conhecimento INPI', category: 'INPI/RPI' },
  { name: 'inpi_sync_logs', label: 'Logs de Sincronização INPI', category: 'INPI/RPI' },

  // Sistema/Config
  { name: 'system_settings', label: 'Configurações do Sistema', category: 'Sistema/Config' },
  { name: 'admin_permissions', label: 'Permissões Admin', category: 'Sistema/Config' },
  { name: 'user_roles', label: 'Roles de Usuário', category: 'Sistema/Config' },
  { name: 'notification_logs', label: 'Logs de Notificação', category: 'Sistema/Config' },
  { name: 'channel_notification_templates', label: 'Templates de Canal', category: 'Sistema/Config' },
  { name: 'ai_providers', label: 'Provedores de IA', category: 'Sistema/Config' },
  { name: 'ai_usage_logs', label: 'Logs de Uso IA', category: 'Sistema/Config' },
  { name: 'login_history', label: 'Histórico de Login', category: 'Sistema/Config' },
  { name: 'signature_audit_log', label: 'Log de Assinatura', category: 'Sistema/Config' },
  { name: 'import_logs', label: 'Logs de Importação', category: 'Sistema/Config' },

  // Outros
  { name: 'award_entries', label: 'Premiação', category: 'Outros' },
  { name: 'conversations', label: 'Conversas', category: 'Outros' },
  { name: 'conversation_messages', label: 'Mensagens de Conversa', category: 'Outros' },
  { name: 'conversation_participants', label: 'Participantes de Conversa', category: 'Outros' },
  { name: 'call_signals', label: 'Sinais de Chamada', category: 'Outros' },
  { name: 'upsell_engine_config', label: 'Config. Upsell Engine', category: 'Outros' },
  { name: 'upsell_engine_weights', label: 'Pesos Upsell Engine', category: 'Outros' },
  { name: 'promotion_expiration_logs', label: 'Logs Expiração Promoção', category: 'Outros' },
  { name: 'viability_searches', label: 'Pesquisas de Viabilidade', category: 'Outros' },
];

/**
 * Map _type values to table names (for import)
 */
export const TYPE_TO_TABLE: Record<string, string> = {};
ALL_BACKUP_TABLES.forEach(t => {
  TYPE_TO_TABLE[t.name] = t.name;
  // Also map singular forms
  if (t.name.endsWith('s')) {
    TYPE_TO_TABLE[t.name.slice(0, -1)] = t.name;
  }
});
// Legacy mappings
TYPE_TO_TABLE['lead'] = 'leads';
TYPE_TO_TABLE['client'] = 'profiles';
TYPE_TO_TABLE['clients'] = 'profiles';
TYPE_TO_TABLE['contract'] = 'contracts';

/**
 * Fetch all rows from a table with pagination (bypasses 1000 row limit)
 */
export async function fetchAllFromTable(
  supabaseClient: any,
  tableName: string,
  onProgress?: (fetched: number) => void
): Promise<Record<string, unknown>[]> {
  const allData: Record<string, unknown>[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabaseClient
      .from(tableName)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.warn(`Error fetching ${tableName}:`, error.message);
      break;
    }

    if (!data || data.length === 0) break;

    allData.push(...data);
    onProgress?.(allData.length);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData;
}
