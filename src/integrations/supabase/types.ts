export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acordo_parcelas: {
        Row: {
          acordo_id: string
          asaas_payment_id: string | null
          compensacao_resposta: Json | null
          compensacao_status: string | null
          created_at: string
          data_vencimento: string
          id: string
          invoice_url: string | null
          link_boleto: string | null
          numero_parcela: number
          status: string
          updated_at: string
          valor_centavos: number
        }
        Insert: {
          acordo_id: string
          asaas_payment_id?: string | null
          compensacao_resposta?: Json | null
          compensacao_status?: string | null
          created_at?: string
          data_vencimento: string
          id?: string
          invoice_url?: string | null
          link_boleto?: string | null
          numero_parcela: number
          status?: string
          updated_at?: string
          valor_centavos: number
        }
        Update: {
          acordo_id?: string
          asaas_payment_id?: string | null
          compensacao_resposta?: Json | null
          compensacao_status?: string | null
          created_at?: string
          data_vencimento?: string
          id?: string
          invoice_url?: string | null
          link_boleto?: string | null
          numero_parcela?: number
          status?: string
          updated_at?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "acordo_parcelas_acordo_id_fkey"
            columns: ["acordo_id"]
            isOneToOne: false
            referencedRelation: "acordos_cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      acordos_cliente: {
        Row: {
          asaas_customer_id: string | null
          asaas_payment_id_original: string | null
          auditoria: Json
          billing_type: string
          bloqueado_por_pendencia: boolean
          cancelamento_em: string | null
          cancelamento_resposta: Json | null
          cancelamento_status: string
          cliente_nome: string | null
          compensacao_resultado: Json | null
          created_at: string
          created_by: string | null
          crm_action_id: string
          enviado_canais: string[] | null
          enviado_em: string | null
          id: string
          invoice_original_id: string | null
          juros_centavos: number
          juros_percentual: number
          num_parcelas: number
          primeira_parcela_data: string
          status: string
          total_centavos: number
          updated_at: string
          user_id: string | null
          valor_original_centavos: number
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_payment_id_original?: string | null
          auditoria?: Json
          billing_type?: string
          bloqueado_por_pendencia?: boolean
          cancelamento_em?: string | null
          cancelamento_resposta?: Json | null
          cancelamento_status?: string
          cliente_nome?: string | null
          compensacao_resultado?: Json | null
          created_at?: string
          created_by?: string | null
          crm_action_id: string
          enviado_canais?: string[] | null
          enviado_em?: string | null
          id?: string
          invoice_original_id?: string | null
          juros_centavos?: number
          juros_percentual?: number
          num_parcelas: number
          primeira_parcela_data: string
          status?: string
          total_centavos: number
          updated_at?: string
          user_id?: string | null
          valor_original_centavos: number
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_payment_id_original?: string | null
          auditoria?: Json
          billing_type?: string
          bloqueado_por_pendencia?: boolean
          cancelamento_em?: string | null
          cancelamento_resposta?: Json | null
          cancelamento_status?: string
          cliente_nome?: string | null
          compensacao_resultado?: Json | null
          created_at?: string
          created_by?: string | null
          crm_action_id?: string
          enviado_canais?: string[] | null
          enviado_em?: string | null
          id?: string
          invoice_original_id?: string | null
          juros_centavos?: number
          juros_percentual?: number
          num_parcelas?: number
          primeira_parcela_data?: string
          status?: string
          total_centavos?: number
          updated_at?: string
          user_id?: string | null
          valor_original_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "acordos_cliente_invoice_original_id_fkey"
            columns: ["invoice_original_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_permissions: {
        Row: {
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          permission_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          permission_key: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          permission_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_providers: {
        Row: {
          api_key: string | null
          created_at: string
          id: string
          is_active: boolean
          is_fallback: boolean
          model: string
          name: string
          provider_type: string
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_fallback?: boolean
          model: string
          name: string
          provider_type: string
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_fallback?: boolean
          model?: string
          name?: string
          provider_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          module: string
          provider: string
          response_time_ms: number | null
          success: boolean
          task_type: string | null
          tokens_used: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          module: string
          provider: string
          response_time_ms?: number | null
          success?: boolean
          task_type?: string | null
          tokens_used?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          module?: string
          provider?: string
          response_time_ms?: number | null
          success?: boolean
          task_type?: string | null
          tokens_used?: number | null
        }
        Relationships: []
      }
      asaas_full_sync_runs: {
        Row: {
          ambiguidades: Json
          atualizadas: number
          clientes_criados: number
          clientes_processados: number
          clientes_vinculados: number
          cobrancas_encontradas: number
          criadas: number
          cursor_offset: number
          erro: string | null
          etapa: string | null
          executed_by: string | null
          finished_at: string | null
          id: string
          removidas: number
          started_at: string
          status: string
          sync_run_id: string
          total_clientes_asaas: number | null
          ultimo_bloco_aplicado: number
          updated_at: string
        }
        Insert: {
          ambiguidades?: Json
          atualizadas?: number
          clientes_criados?: number
          clientes_processados?: number
          clientes_vinculados?: number
          cobrancas_encontradas?: number
          criadas?: number
          cursor_offset?: number
          erro?: string | null
          etapa?: string | null
          executed_by?: string | null
          finished_at?: string | null
          id?: string
          removidas?: number
          started_at?: string
          status?: string
          sync_run_id?: string
          total_clientes_asaas?: number | null
          ultimo_bloco_aplicado?: number
          updated_at?: string
        }
        Update: {
          ambiguidades?: Json
          atualizadas?: number
          clientes_criados?: number
          clientes_processados?: number
          clientes_vinculados?: number
          cobrancas_encontradas?: number
          criadas?: number
          cursor_offset?: number
          erro?: string | null
          etapa?: string | null
          executed_by?: string | null
          finished_at?: string | null
          id?: string
          removidas?: number
          started_at?: string
          status?: string
          sync_run_id?: string
          total_clientes_asaas?: number | null
          ultimo_bloco_aplicado?: number
          updated_at?: string
        }
        Relationships: []
      }
      asaas_sync_logs: {
        Row: {
          ambiguous_customer_ids: string[]
          client_id: string
          created_at: string
          customer_ids: string[]
          duracao_ms: number | null
          erro: string | null
          executed_by: string | null
          id: string
          incompleta: boolean
          sucesso: boolean
          sync_run_id: string
          totais_antes: Json | null
          totais_depois: Json | null
          total_atualizadas: number
          total_criadas: number
          total_encontradas: number
          total_removidas: number
        }
        Insert: {
          ambiguous_customer_ids?: string[]
          client_id: string
          created_at?: string
          customer_ids?: string[]
          duracao_ms?: number | null
          erro?: string | null
          executed_by?: string | null
          id?: string
          incompleta?: boolean
          sucesso?: boolean
          sync_run_id: string
          totais_antes?: Json | null
          totais_depois?: Json | null
          total_atualizadas?: number
          total_criadas?: number
          total_encontradas?: number
          total_removidas?: number
        }
        Update: {
          ambiguous_customer_ids?: string[]
          client_id?: string
          created_at?: string
          customer_ids?: string[]
          duracao_ms?: number | null
          erro?: string | null
          executed_by?: string | null
          id?: string
          incompleta?: boolean
          sucesso?: boolean
          sync_run_id?: string
          totais_antes?: Json | null
          totais_depois?: Json | null
          total_atualizadas?: number
          total_criadas?: number
          total_encontradas?: number
          total_removidas?: number
        }
        Relationships: []
      }
      award_entries: {
        Row: {
          brand_name: string | null
          brand_quantity: number | null
          client_name: string
          created_at: string | null
          created_by: string | null
          entry_date: string
          entry_type: string
          id: string
          installments_paid: number | null
          observations: string | null
          payment_date: string | null
          payment_form: string | null
          payment_type: string | null
          plan: string
          pub_quantity: number | null
          publication_type: string | null
          responsible_user_id: string
          total_resolved_value: number | null
          updated_at: string | null
        }
        Insert: {
          brand_name?: string | null
          brand_quantity?: number | null
          client_name: string
          created_at?: string | null
          created_by?: string | null
          entry_date?: string
          entry_type: string
          id?: string
          installments_paid?: number | null
          observations?: string | null
          payment_date?: string | null
          payment_form?: string | null
          payment_type?: string | null
          plan?: string
          pub_quantity?: number | null
          publication_type?: string | null
          responsible_user_id: string
          total_resolved_value?: number | null
          updated_at?: string | null
        }
        Update: {
          brand_name?: string | null
          brand_quantity?: number | null
          client_name?: string
          created_at?: string | null
          created_by?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          installments_paid?: number | null
          observations?: string | null
          payment_date?: string | null
          payment_form?: string | null
          payment_type?: string | null
          plan?: string
          pub_quantity?: number | null
          publication_type?: string | null
          responsible_user_id?: string
          total_resolved_value?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      brand_processes: {
        Row: {
          brand_name: string
          business_area: string | null
          created_at: string | null
          deposit_date: string | null
          expiry_date: string | null
          grant_date: string | null
          id: string
          inpi_protocol: string | null
          ncl_classes: number[] | null
          next_step: string | null
          next_step_date: string | null
          notes: string | null
          perfex_project_id: string | null
          pipeline_stage: string | null
          process_number: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          brand_name: string
          business_area?: string | null
          created_at?: string | null
          deposit_date?: string | null
          expiry_date?: string | null
          grant_date?: string | null
          id?: string
          inpi_protocol?: string | null
          ncl_classes?: number[] | null
          next_step?: string | null
          next_step_date?: string | null
          notes?: string | null
          perfex_project_id?: string | null
          pipeline_stage?: string | null
          process_number?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          brand_name?: string
          business_area?: string | null
          created_at?: string | null
          deposit_date?: string | null
          expiry_date?: string | null
          grant_date?: string | null
          id?: string
          inpi_protocol?: string | null
          ncl_classes?: number[] | null
          next_step?: string | null
          next_step_date?: string | null
          notes?: string | null
          perfex_project_id?: string | null
          pipeline_stage?: string | null
          process_number?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_processes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_signals: {
        Row: {
          call_type: string | null
          caller_id: string
          conversation_id: string
          created_at: string
          id: string
          processed: boolean | null
          receiver_id: string | null
          signal_data: Json | null
          signal_type: string
        }
        Insert: {
          call_type?: string | null
          caller_id: string
          conversation_id: string
          created_at?: string
          id?: string
          processed?: boolean | null
          receiver_id?: string | null
          signal_data?: Json | null
          signal_type: string
        }
        Update: {
          call_type?: string | null
          caller_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
          processed?: boolean | null
          receiver_id?: string | null
          signal_data?: Json | null
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_notification_templates: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          message: string
          name: string
          trigger_event: string
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message: string
          name: string
          trigger_event: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message?: string
          name?: string
          trigger_event?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_activities: {
        Row: {
          activity_type: string
          admin_id: string | null
          created_at: string | null
          description: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          activity_type: string
          admin_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          activity_type?: string
          admin_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_appointments: {
        Row: {
          admin_id: string
          completed: boolean | null
          created_at: string | null
          description: string | null
          google_event_id: string | null
          google_meet_link: string | null
          id: string
          scheduled_at: string
          title: string
          user_id: string
        }
        Insert: {
          admin_id: string
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          scheduled_at: string
          title: string
          user_id: string
        }
        Update: {
          admin_id?: string
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          scheduled_at?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_appointments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          admin_id: string
          content: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_id: string
          content: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_id?: string
          content?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_remarketing_campaigns: {
        Row: {
          body: string | null
          channels: string[] | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string | null
          target_status: string[] | null
          total_opened: number | null
          total_queued: number | null
          total_sent: number | null
          type: string
        }
        Insert: {
          body?: string | null
          channels?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          target_status?: string[] | null
          total_opened?: number | null
          total_queued?: number | null
          total_sent?: number | null
          type?: string
        }
        Update: {
          body?: string | null
          channels?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          target_status?: string[] | null
          total_opened?: number | null
          total_queued?: number | null
          total_sent?: number | null
          type?: string
        }
        Relationships: []
      }
      client_remarketing_queue: {
        Row: {
          body: string | null
          campaign_id: string | null
          channel: string
          client_id: string
          created_at: string
          error_message: string | null
          id: string
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          campaign_id?: string | null
          channel?: string
          client_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          campaign_id?: string | null
          channel?: string
          client_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_remarketing_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "client_remarketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_remarketing_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_historico: {
        Row: {
          canais: string[]
          cliente_email: string | null
          cliente_nome: string | null
          cliente_phone: string | null
          created_at: string
          enviada_em: string
          id: string
          invoice_id: string
          message_email_html: string | null
          message_email_subject: string | null
          message_whatsapp: string | null
          metadata: Json | null
          pago_em: string | null
          pago_manual: boolean
          pago_obs: string | null
          proxima_acao_em: string | null
          situacao: string
          status: string
          tipo: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          canais?: string[]
          cliente_email?: string | null
          cliente_nome?: string | null
          cliente_phone?: string | null
          created_at?: string
          enviada_em?: string
          id?: string
          invoice_id: string
          message_email_html?: string | null
          message_email_subject?: string | null
          message_whatsapp?: string | null
          metadata?: Json | null
          pago_em?: string | null
          pago_manual?: boolean
          pago_obs?: string | null
          proxima_acao_em?: string | null
          situacao?: string
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          canais?: string[]
          cliente_email?: string | null
          cliente_nome?: string | null
          cliente_phone?: string | null
          created_at?: string
          enviada_em?: string
          id?: string
          invoice_id?: string
          message_email_html?: string | null
          message_email_subject?: string | null
          message_whatsapp?: string | null
          metadata?: Json | null
          pago_em?: string | null
          pago_manual?: boolean
          pago_obs?: string | null
          proxima_acao_em?: string | null
          situacao?: string
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_historico_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_tratamentos: {
        Row: {
          asaas_customer_id: string | null
          asaas_payment_id_original: string | null
          cancelamento_em: string | null
          cancelamento_resposta: Json | null
          cancelamento_status: string
          cliente_cpf_cnpj: string | null
          cliente_nome: string | null
          cliente_user_id: string | null
          cobranca_original_id: string | null
          created_at: string
          crm_action_id: string
          id: string
          invoice_original_id: string | null
          motivo: string
          negociacao_id: string | null
          nova_cobranca_asaas_id: string | null
          novo_boleto_url: string | null
          novo_valor: number | null
          novo_vencimento: string | null
          novos_boletos_asaas_ids: string[]
          observacao: string | null
          renegociacao_id: string | null
          responsavel_id: string | null
          status_negociacao: string
          tipo_acao: string
          updated_at: string
          valor_original: number | null
          vencimento_original: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_payment_id_original?: string | null
          cancelamento_em?: string | null
          cancelamento_resposta?: Json | null
          cancelamento_status?: string
          cliente_cpf_cnpj?: string | null
          cliente_nome?: string | null
          cliente_user_id?: string | null
          cobranca_original_id?: string | null
          created_at?: string
          crm_action_id: string
          id?: string
          invoice_original_id?: string | null
          motivo: string
          negociacao_id?: string | null
          nova_cobranca_asaas_id?: string | null
          novo_boleto_url?: string | null
          novo_valor?: number | null
          novo_vencimento?: string | null
          novos_boletos_asaas_ids?: string[]
          observacao?: string | null
          renegociacao_id?: string | null
          responsavel_id?: string | null
          status_negociacao?: string
          tipo_acao: string
          updated_at?: string
          valor_original?: number | null
          vencimento_original?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_payment_id_original?: string | null
          cancelamento_em?: string | null
          cancelamento_resposta?: Json | null
          cancelamento_status?: string
          cliente_cpf_cnpj?: string | null
          cliente_nome?: string | null
          cliente_user_id?: string | null
          cobranca_original_id?: string | null
          created_at?: string
          crm_action_id?: string
          id?: string
          invoice_original_id?: string | null
          motivo?: string
          negociacao_id?: string | null
          nova_cobranca_asaas_id?: string | null
          novo_boleto_url?: string | null
          novo_valor?: number | null
          novo_vencimento?: string | null
          novos_boletos_asaas_ids?: string[]
          observacao?: string | null
          renegociacao_id?: string | null
          responsavel_id?: string | null
          status_negociacao?: string
          tipo_acao?: string
          updated_at?: string
          valor_original?: number | null
          vencimento_original?: string | null
        }
        Relationships: []
      }
      cobrancas_vencidas: {
        Row: {
          asaas_customer_id: string | null
          asaas_payment_id: string
          bucket: string
          cliente_cpf_cnpj: string | null
          cliente_email: string | null
          cliente_nome: string | null
          cobranca_origem_id: string | null
          created_at: string
          crm_action_id: string | null
          data_vencimento: string | null
          descricao: string | null
          dias_atraso: number | null
          id: string
          negociacao_id: string | null
          originado_pelo_crm: boolean
          renegociacao_id: string | null
          status: string
          tratada_em: string | null
          tratada_por: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_payment_id: string
          bucket?: string
          cliente_cpf_cnpj?: string | null
          cliente_email?: string | null
          cliente_nome?: string | null
          cobranca_origem_id?: string | null
          created_at?: string
          crm_action_id?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          dias_atraso?: number | null
          id?: string
          negociacao_id?: string | null
          originado_pelo_crm?: boolean
          renegociacao_id?: string | null
          status?: string
          tratada_em?: string | null
          tratada_por?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_payment_id?: string
          bucket?: string
          cliente_cpf_cnpj?: string | null
          cliente_email?: string | null
          cliente_nome?: string | null
          cobranca_origem_id?: string | null
          created_at?: string
          crm_action_id?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          dias_atraso?: number | null
          id?: string
          negociacao_id?: string | null
          originado_pelo_crm?: boolean
          renegociacao_id?: string | null
          status?: string
          tratada_em?: string | null
          tratada_por?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      contract_attachments: {
        Row: {
          contract_id: string
          created_at: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          name: string
          uploaded_by: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          name: string
          uploaded_by?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          name?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_attachments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_comments: {
        Row: {
          content: string
          contract_id: string
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          content: string
          contract_id: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          contract_id?: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_comments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_notes: {
        Row: {
          content: string
          contract_id: string
          created_at: string
          created_by: string | null
          id: string
          updated_at: string
        }
        Insert: {
          content: string
          contract_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          content?: string
          contract_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_notes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_renewal_history: {
        Row: {
          contract_id: string
          id: string
          new_end_date: string | null
          new_value: number | null
          notes: string | null
          previous_end_date: string | null
          previous_value: number | null
          renewed_at: string
          renewed_by: string | null
        }
        Insert: {
          contract_id: string
          id?: string
          new_end_date?: string | null
          new_value?: number | null
          notes?: string | null
          previous_end_date?: string | null
          previous_value?: number | null
          renewed_at?: string
          renewed_by?: string | null
        }
        Update: {
          contract_id?: string
          id?: string
          new_end_date?: string | null
          new_value?: number | null
          notes?: string | null
          previous_end_date?: string | null
          previous_value?: number | null
          renewed_at?: string
          renewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_renewal_history_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_tasks: {
        Row: {
          assigned_to: string | null
          completed: boolean | null
          completed_at: string | null
          contract_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean | null
          completed_at?: string | null
          contract_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean | null
          completed_at?: string | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          content: string
          contract_type_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          content: string
          contract_type_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          content?: string
          contract_type_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_contract_type_id_fkey"
            columns: ["contract_type_id"]
            isOneToOne: false
            referencedRelation: "contract_types"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          asaas_payment_id: string | null
          blockchain_hash: string | null
          blockchain_network: string | null
          blockchain_proof: string | null
          blockchain_timestamp: string | null
          blockchain_tx_id: string | null
          client_signature_image: string | null
          contract_html: string | null
          contract_number: string | null
          contract_type: string | null
          contract_type_id: string | null
          contract_value: number | null
          contractor_signature_image: string | null
          created_at: string | null
          created_by: string | null
          custom_due_date: string | null
          description: string | null
          device_info: Json | null
          document_type: string | null
          end_date: string | null
          id: string
          ip_address: string | null
          lead_id: string | null
          manually_paid: boolean
          manually_paid_at: string | null
          manually_paid_by: string | null
          ots_file_url: string | null
          payment_method: string | null
          penalty_value: number | null
          plan_type: string | null
          process_id: string | null
          signatory_cnpj: string | null
          signatory_cpf: string | null
          signatory_name: string | null
          signature_expires_at: string | null
          signature_ip: string | null
          signature_status: string | null
          signature_token: string | null
          signature_user_agent: string | null
          signed_at: string | null
          start_date: string | null
          subject: string | null
          suggested_classes: Json | null
          template_id: string | null
          user_agent: string | null
          user_id: string | null
          visible_to_client: boolean | null
        }
        Insert: {
          asaas_payment_id?: string | null
          blockchain_hash?: string | null
          blockchain_network?: string | null
          blockchain_proof?: string | null
          blockchain_timestamp?: string | null
          blockchain_tx_id?: string | null
          client_signature_image?: string | null
          contract_html?: string | null
          contract_number?: string | null
          contract_type?: string | null
          contract_type_id?: string | null
          contract_value?: number | null
          contractor_signature_image?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_due_date?: string | null
          description?: string | null
          device_info?: Json | null
          document_type?: string | null
          end_date?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          manually_paid?: boolean
          manually_paid_at?: string | null
          manually_paid_by?: string | null
          ots_file_url?: string | null
          payment_method?: string | null
          penalty_value?: number | null
          plan_type?: string | null
          process_id?: string | null
          signatory_cnpj?: string | null
          signatory_cpf?: string | null
          signatory_name?: string | null
          signature_expires_at?: string | null
          signature_ip?: string | null
          signature_status?: string | null
          signature_token?: string | null
          signature_user_agent?: string | null
          signed_at?: string | null
          start_date?: string | null
          subject?: string | null
          suggested_classes?: Json | null
          template_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          visible_to_client?: boolean | null
        }
        Update: {
          asaas_payment_id?: string | null
          blockchain_hash?: string | null
          blockchain_network?: string | null
          blockchain_proof?: string | null
          blockchain_timestamp?: string | null
          blockchain_tx_id?: string | null
          client_signature_image?: string | null
          contract_html?: string | null
          contract_number?: string | null
          contract_type?: string | null
          contract_type_id?: string | null
          contract_value?: number | null
          contractor_signature_image?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_due_date?: string | null
          description?: string | null
          device_info?: Json | null
          document_type?: string | null
          end_date?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          manually_paid?: boolean
          manually_paid_at?: string | null
          manually_paid_by?: string | null
          ots_file_url?: string | null
          payment_method?: string | null
          penalty_value?: number | null
          plan_type?: string | null
          process_id?: string | null
          signatory_cnpj?: string | null
          signatory_cpf?: string | null
          signatory_name?: string | null
          signature_expires_at?: string | null
          signature_ip?: string | null
          signature_status?: string | null
          signature_token?: string | null
          signature_user_agent?: string | null
          signed_at?: string | null
          start_date?: string | null
          subject?: string | null
          suggested_classes?: Json | null
          template_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          visible_to_client?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_contract_type_id_fkey"
            columns: ["contract_type_id"]
            isOneToOne: false
            referencedRelation: "contract_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "brand_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          file_mime_type: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          is_read: boolean | null
          message_type: string
          read_at: string | null
          reply_to_id: string | null
          sender_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          file_mime_type?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          file_mime_type?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_online: boolean | null
          is_typing: boolean | null
          joined_at: string
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_online?: boolean | null
          is_typing?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_online?: boolean | null
          is_typing?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          title?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          contract_id: string | null
          created_at: string | null
          document_type: string | null
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          name: string
          process_id: string | null
          protocol: string | null
          uploaded_by: string | null
          user_id: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string | null
          document_type?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          name: string
          process_id?: string | null
          protocol?: string | null
          uploaded_by?: string | null
          user_id?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string | null
          document_type?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          name?: string
          process_id?: string | null
          protocol?: string | null
          uploaded_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "brand_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          assigned_to: string | null
          auto_reply_enabled: boolean
          created_at: string | null
          display_name: string | null
          email_address: string
          id: string
          imap_host: string | null
          imap_port: number | null
          is_default: boolean | null
          provider: string
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_user: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          auto_reply_enabled?: boolean
          created_at?: string | null
          display_name?: string | null
          email_address: string
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          is_default?: boolean | null
          provider?: string
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          auto_reply_enabled?: boolean
          created_at?: string | null
          display_name?: string | null
          email_address?: string
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          is_default?: boolean | null
          provider?: string
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_automations: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          steps: Json
          success_rate: number
          trigger_count: number
          trigger_event: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          steps?: Json
          success_rate?: number
          trigger_count?: number
          trigger_event?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          steps?: Json
          success_rate?: number
          trigger_count?: number
          trigger_event?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_inbox: {
        Row: {
          account_id: string | null
          attachments: Json | null
          body_fetched_at: string | null
          body_html: string | null
          body_text: string | null
          created_at: string | null
          folder: string
          from_email: string
          from_name: string | null
          has_attachments: boolean | null
          id: string
          imap_uid: number | null
          in_reply_to: string | null
          is_alias: boolean | null
          is_archived: boolean | null
          is_read: boolean | null
          is_starred: boolean | null
          message_id: string | null
          original_backup: Json | null
          parse_error: string | null
          parse_status: string
          parser_version: number
          raw_source: string | null
          received_at: string | null
          references_ids: string | null
          reprocessed_at: string | null
          snippet: string | null
          subject: string | null
          thread_id: string | null
          to_email: string
          to_name: string | null
        }
        Insert: {
          account_id?: string | null
          attachments?: Json | null
          body_fetched_at?: string | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          folder?: string
          from_email: string
          from_name?: string | null
          has_attachments?: boolean | null
          id?: string
          imap_uid?: number | null
          in_reply_to?: string | null
          is_alias?: boolean | null
          is_archived?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          message_id?: string | null
          original_backup?: Json | null
          parse_error?: string | null
          parse_status?: string
          parser_version?: number
          raw_source?: string | null
          received_at?: string | null
          references_ids?: string | null
          reprocessed_at?: string | null
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
          to_email: string
          to_name?: string | null
        }
        Update: {
          account_id?: string | null
          attachments?: Json | null
          body_fetched_at?: string | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          folder?: string
          from_email?: string
          from_name?: string | null
          has_attachments?: boolean | null
          id?: string
          imap_uid?: number | null
          in_reply_to?: string | null
          is_alias?: boolean | null
          is_archived?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          message_id?: string | null
          original_backup?: Json | null
          parse_error?: string | null
          parse_status?: string
          parser_version?: number
          raw_source?: string | null
          received_at?: string | null
          references_ids?: string | null
          reprocessed_at?: string | null
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
          to_email?: string
          to_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_inbox_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          attachments: Json
          bcc_emails: string[] | null
          body: string
          cc_emails: string[] | null
          client_id: string | null
          error_message: string | null
          from_email: string
          html_body: string | null
          id: string
          provider_message_id: string | null
          related_lead_id: string | null
          sent_at: string | null
          sent_by: string | null
          status: string | null
          subject: string
          template_id: string | null
          to_email: string
          trigger_type: string | null
        }
        Insert: {
          attachments?: Json
          bcc_emails?: string[] | null
          body: string
          cc_emails?: string[] | null
          client_id?: string | null
          error_message?: string | null
          from_email: string
          html_body?: string | null
          id?: string
          provider_message_id?: string | null
          related_lead_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject: string
          template_id?: string | null
          to_email: string
          trigger_type?: string | null
        }
        Update: {
          attachments?: Json
          bcc_emails?: string[] | null
          body?: string
          cc_emails?: string[] | null
          client_id?: string | null
          error_message?: string | null
          from_email?: string
          html_body?: string | null
          id?: string
          provider_message_id?: string | null
          related_lead_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject?: string
          template_id?: string | null
          to_email?: string
          trigger_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_repair_runs: {
        Row: {
          account_id: string | null
          created_at: string
          error: string | null
          examined: number
          failed: number
          finished_at: string | null
          id: string
          limit_count: number
          mode: string
          not_found: number
          processed: number
          repaired: number
          results: Json
          started_at: string
          started_by: string | null
          status: string
          unchanged: number
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          error?: string | null
          examined?: number
          failed?: number
          finished_at?: string | null
          id?: string
          limit_count?: number
          mode?: string
          not_found?: number
          processed?: number
          repaired?: number
          results?: Json
          started_at?: string
          started_by?: string | null
          status?: string
          unchanged?: number
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          error?: string | null
          examined?: number
          failed?: number
          finished_at?: string | null
          id?: string
          limit_count?: number
          mode?: string
          not_found?: number
          processed?: number
          repaired?: number
          results?: Json
          started_at?: string
          started_by?: string | null
          status?: string
          unchanged?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_repair_runs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_reprocess_queue: {
        Row: {
          account_id: string
          attempts: number
          created_at: string
          folder: string
          id: string
          imap_uid: number
          last_error: string | null
          next_attempt_at: string
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          attempts?: number
          created_at?: string
          folder: string
          id?: string
          imap_uid: number
          last_error?: string | null
          next_attempt_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          attempts?: number
          created_at?: string
          folder?: string
          id?: string
          imap_uid?: number
          last_error?: string | null
          next_attempt_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_reprocess_queue_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sync_runs: {
        Row: {
          account_id: string
          created_at: string
          error_code: string | null
          error_summary: string | null
          failed_count: number
          finished_at: string | null
          folders: Json
          id: string
          new_count: number
          recommended_action: string | null
          result: string
          started_at: string
          trigger_source: string
          updated_count: number
        }
        Insert: {
          account_id: string
          created_at?: string
          error_code?: string | null
          error_summary?: string | null
          failed_count?: number
          finished_at?: string | null
          folders?: Json
          id?: string
          new_count?: number
          recommended_action?: string | null
          result?: string
          started_at?: string
          trigger_source?: string
          updated_count?: number
        }
        Update: {
          account_id?: string
          created_at?: string
          error_code?: string | null
          error_summary?: string | null
          failed_count?: number
          finished_at?: string | null
          folders?: Json
          id?: string
          new_count?: number
          recommended_action?: string | null
          result?: string
          started_at?: string
          trigger_source?: string
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_sync_runs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sync_state: {
        Row: {
          account_id: string
          consecutive_errors: number | null
          folder: string
          last_error: string | null
          last_success_at: string | null
          last_synced_at: string
          last_uid: number
          locked_at: string | null
          status: string
          uidvalidity: number | null
        }
        Insert: {
          account_id: string
          consecutive_errors?: number | null
          folder: string
          last_error?: string | null
          last_success_at?: string | null
          last_synced_at?: string
          last_uid?: number
          locked_at?: string | null
          status?: string
          uidvalidity?: number | null
        }
        Update: {
          account_id?: string
          consecutive_errors?: number | null
          folder?: string
          last_error?: string | null
          last_success_at?: string | null
          last_synced_at?: string
          last_uid?: number
          locked_at?: string | null
          status?: string
          uidvalidity?: number | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string
          trigger_event: string | null
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          trigger_event?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          trigger_event?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          created_at: string
          errors: Json | null
          failed_records: number | null
          file_name: string | null
          id: string
          import_type: string
          imported_by: string | null
          imported_records: number | null
          total_records: number | null
        }
        Insert: {
          created_at?: string
          errors?: Json | null
          failed_records?: number | null
          file_name?: string | null
          id?: string
          import_type: string
          imported_by?: string | null
          imported_records?: number | null
          total_records?: number | null
        }
        Update: {
          created_at?: string
          errors?: Json | null
          failed_records?: number | null
          file_name?: string | null
          id?: string
          import_type?: string
          imported_by?: string | null
          imported_records?: number | null
          total_records?: number | null
        }
        Relationships: []
      }
      inpi_ai_call_logs: {
        Row: {
          case_id: string | null
          correlation_id: string
          created_at: string
          dedicated_model: boolean
          duration_ms: number | null
          error_kind: string | null
          http_status: number | null
          id: string
          input_tokens: number | null
          model: string
          operation: string
          output_tokens: number | null
          prompt_version: string | null
          reasoning_effort: string | null
          resource_type: string
          status: string
        }
        Insert: {
          case_id?: string | null
          correlation_id: string
          created_at?: string
          dedicated_model?: boolean
          duration_ms?: number | null
          error_kind?: string | null
          http_status?: number | null
          id?: string
          input_tokens?: number | null
          model: string
          operation: string
          output_tokens?: number | null
          prompt_version?: string | null
          reasoning_effort?: string | null
          resource_type: string
          status: string
        }
        Update: {
          case_id?: string | null
          correlation_id?: string
          created_at?: string
          dedicated_model?: boolean
          duration_ms?: number | null
          error_kind?: string | null
          http_status?: number | null
          id?: string
          input_tokens?: number | null
          model?: string
          operation?: string
          output_tokens?: number | null
          prompt_version?: string | null
          reasoning_effort?: string | null
          resource_type?: string
          status?: string
        }
        Relationships: []
      }
      inpi_case_approvals: {
        Row: {
          approval_kind: string
          approved_at: string
          approved_by: string
          case_id: string
          content_hash: string
          documents_hash: string | null
          draft_version_id: string
          id: string
          invalidated_at: string | null
          invalidation_reason: string | null
          notes: string | null
          orientation_hash: string | null
        }
        Insert: {
          approval_kind: string
          approved_at?: string
          approved_by: string
          case_id: string
          content_hash: string
          documents_hash?: string | null
          draft_version_id: string
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          notes?: string | null
          orientation_hash?: string | null
        }
        Update: {
          approval_kind?: string
          approved_at?: string
          approved_by?: string
          case_id?: string
          content_hash?: string
          documents_hash?: string | null
          draft_version_id?: string
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          notes?: string | null
          orientation_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inpi_case_approvals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "inpi_resource_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inpi_case_approvals_draft_version_id_fkey"
            columns: ["draft_version_id"]
            isOneToOne: false
            referencedRelation: "inpi_draft_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      inpi_case_documents: {
        Row: {
          byte_size: number | null
          case_id: string
          category: string
          conversion_notes: string | null
          conversion_status: string
          converted_page_count: number | null
          created_at: string
          declared_mime_type: string | null
          display_order: number
          doc_number: number
          extracted_text: string | null
          extraction_notes: string | null
          extraction_status: string
          file_name: string
          id: string
          interpreted_pages: number | null
          is_active: boolean
          mime_type: string | null
          page_count: number | null
          processing_confirmed_at: string | null
          receipt_status: string
          replaced_by: string | null
          review_status: string
          sha256: string | null
          sheet_names: string[] | null
          storage_path: string
          unreadable_pages: number | null
          updated_at: string
          uploaded_by: string | null
          version: number
          vision_model: string | null
          vision_notes: string | null
          vision_read_at: string | null
          vision_read_pages: number
        }
        Insert: {
          byte_size?: number | null
          case_id: string
          category: string
          conversion_notes?: string | null
          conversion_status?: string
          converted_page_count?: number | null
          created_at?: string
          declared_mime_type?: string | null
          display_order?: number
          doc_number?: number
          extracted_text?: string | null
          extraction_notes?: string | null
          extraction_status?: string
          file_name: string
          id?: string
          interpreted_pages?: number | null
          is_active?: boolean
          mime_type?: string | null
          page_count?: number | null
          processing_confirmed_at?: string | null
          receipt_status?: string
          replaced_by?: string | null
          review_status?: string
          sha256?: string | null
          sheet_names?: string[] | null
          storage_path: string
          unreadable_pages?: number | null
          updated_at?: string
          uploaded_by?: string | null
          version?: number
          vision_model?: string | null
          vision_notes?: string | null
          vision_read_at?: string | null
          vision_read_pages?: number
        }
        Update: {
          byte_size?: number | null
          case_id?: string
          category?: string
          conversion_notes?: string | null
          conversion_status?: string
          converted_page_count?: number | null
          created_at?: string
          declared_mime_type?: string | null
          display_order?: number
          doc_number?: number
          extracted_text?: string | null
          extraction_notes?: string | null
          extraction_status?: string
          file_name?: string
          id?: string
          interpreted_pages?: number | null
          is_active?: boolean
          mime_type?: string | null
          page_count?: number | null
          processing_confirmed_at?: string | null
          receipt_status?: string
          replaced_by?: string | null
          review_status?: string
          sha256?: string | null
          sheet_names?: string[] | null
          storage_path?: string
          unreadable_pages?: number | null
          updated_at?: string
          uploaded_by?: string | null
          version?: number
          vision_model?: string | null
          vision_notes?: string | null
          vision_read_at?: string | null
          vision_read_pages?: number
        }
        Relationships: [
          {
            foreignKeyName: "inpi_case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "inpi_resource_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inpi_case_documents_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "inpi_case_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      inpi_case_orientations: {
        Row: {
          case_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          documents_fingerprint: string | null
          editable_text: string | null
          human_edited: boolean
          id: string
          is_stale: boolean
          model: string | null
          sections: Json
          updated_at: string
          version: number
        }
        Insert: {
          case_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          documents_fingerprint?: string | null
          editable_text?: string | null
          human_edited?: boolean
          id?: string
          is_stale?: boolean
          model?: string | null
          sections?: Json
          updated_at?: string
          version: number
        }
        Update: {
          case_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          documents_fingerprint?: string | null
          editable_text?: string | null
          human_edited?: boolean
          id?: string
          is_stale?: boolean
          model?: string | null
          sections?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inpi_case_orientations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "inpi_resource_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      inpi_draft_reviews: {
        Row: {
          case_id: string
          content_hash: string
          created_at: string
          documents_hash: string | null
          findings: Json
          has_blocking: boolean
          id: string
          model: string | null
          prompt_version: string | null
          resource_id: string | null
          reviewed_by: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          case_id: string
          content_hash: string
          created_at?: string
          documents_hash?: string | null
          findings?: Json
          has_blocking?: boolean
          id?: string
          model?: string | null
          prompt_version?: string | null
          resource_id?: string | null
          reviewed_by?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string
          content_hash?: string
          created_at?: string
          documents_hash?: string | null
          findings?: Json
          has_blocking?: boolean
          id?: string
          model?: string | null
          prompt_version?: string | null
          resource_id?: string | null
          reviewed_by?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inpi_draft_reviews_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "inpi_resource_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      inpi_draft_versions: {
        Row: {
          case_id: string
          content: string
          content_hash: string
          created_at: string
          created_by: string | null
          documents_fingerprint: string | null
          id: string
          internal_report: string | null
          model: string | null
          orientation_version: number | null
          prompt_version: string | null
          version: number
        }
        Insert: {
          case_id: string
          content: string
          content_hash: string
          created_at?: string
          created_by?: string | null
          documents_fingerprint?: string | null
          id?: string
          internal_report?: string | null
          model?: string | null
          orientation_version?: number | null
          prompt_version?: string | null
          version: number
        }
        Update: {
          case_id?: string
          content?: string
          content_hash?: string
          created_at?: string
          created_by?: string | null
          documents_fingerprint?: string | null
          id?: string
          internal_report?: string | null
          model?: string | null
          orientation_version?: number | null
          prompt_version?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inpi_draft_versions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "inpi_resource_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      inpi_export_packages: {
        Row: {
          approval_id: string | null
          case_id: string | null
          content_hash: string | null
          created_at: string
          documents_hash: string | null
          draft_version_id: string | null
          failed_documents: Json
          file_name: string | null
          generated_by: string | null
          id: string
          is_complete: boolean
          is_draft_stamped: boolean
          manifest: Json
          resource_id: string | null
          total_annexes: number
          total_pages: number | null
          updated_at: string
        }
        Insert: {
          approval_id?: string | null
          case_id?: string | null
          content_hash?: string | null
          created_at?: string
          documents_hash?: string | null
          draft_version_id?: string | null
          failed_documents?: Json
          file_name?: string | null
          generated_by?: string | null
          id?: string
          is_complete?: boolean
          is_draft_stamped?: boolean
          manifest?: Json
          resource_id?: string | null
          total_annexes?: number
          total_pages?: number | null
          updated_at?: string
        }
        Update: {
          approval_id?: string | null
          case_id?: string | null
          content_hash?: string | null
          created_at?: string
          documents_hash?: string | null
          draft_version_id?: string | null
          failed_documents?: Json
          file_name?: string | null
          generated_by?: string | null
          id?: string
          is_complete?: boolean
          is_draft_stamped?: boolean
          manifest?: Json
          resource_id?: string | null
          total_annexes?: number
          total_pages?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inpi_export_packages_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "inpi_case_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inpi_export_packages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "inpi_resource_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inpi_export_packages_draft_version_id_fkey"
            columns: ["draft_version_id"]
            isOneToOne: false
            referencedRelation: "inpi_draft_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      inpi_generation_jobs: {
        Row: {
          agent_name: string | null
          agent_strategy: string | null
          attempt: number
          case_id: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          extracted_data: Json | null
          heartbeat_at: string | null
          id: string
          owner_id: string | null
          pass1_content: string | null
          prepared_files: Json | null
          resource_type: string
          result_content: string | null
          run_token: string | null
          stage: string
          status: string
          updated_at: string
          user_orientation: string | null
        }
        Insert: {
          agent_name?: string | null
          agent_strategy?: string | null
          attempt?: number
          case_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          extracted_data?: Json | null
          heartbeat_at?: string | null
          id?: string
          owner_id?: string | null
          pass1_content?: string | null
          prepared_files?: Json | null
          resource_type: string
          result_content?: string | null
          run_token?: string | null
          stage?: string
          status?: string
          updated_at?: string
          user_orientation?: string | null
        }
        Update: {
          agent_name?: string | null
          agent_strategy?: string | null
          attempt?: number
          case_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          extracted_data?: Json | null
          heartbeat_at?: string | null
          id?: string
          owner_id?: string | null
          pass1_content?: string | null
          prepared_files?: Json | null
          resource_type?: string
          result_content?: string | null
          run_token?: string | null
          stage?: string
          status?: string
          updated_at?: string
          user_orientation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inpi_generation_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "inpi_resource_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      inpi_knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          priority: number | null
          raw_html: string | null
          source_date: string | null
          source_url: string | null
          tags: string[] | null
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number | null
          raw_html?: string | null
          source_date?: string | null
          source_url?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          priority?: number | null
          raw_html?: string | null
          source_date?: string | null
          source_url?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      inpi_resource_cases: {
        Row: {
          agent_id: string
          agent_name: string
          brand_name: string | null
          client_id: string | null
          created_at: string
          current_draft_version: number
          current_orientation_version: number
          id: string
          is_homologation: boolean
          last_error: string | null
          next_document_number: number
          owner_id: string
          process_number: string | null
          resource_id: string | null
          resource_type: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          agent_name: string
          brand_name?: string | null
          client_id?: string | null
          created_at?: string
          current_draft_version?: number
          current_orientation_version?: number
          id?: string
          is_homologation?: boolean
          last_error?: string | null
          next_document_number?: number
          owner_id: string
          process_number?: string | null
          resource_id?: string | null
          resource_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          agent_name?: string
          brand_name?: string | null
          client_id?: string | null
          created_at?: string
          current_draft_version?: number
          current_orientation_version?: number
          id?: string
          is_homologation?: boolean
          last_error?: string | null
          next_document_number?: number
          owner_id?: string
          process_number?: string | null
          resource_id?: string | null
          resource_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inpi_resource_cases_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "inpi_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      inpi_resource_evidences: {
        Row: {
          caption: string | null
          created_at: string
          display_order: number
          id: string
          included: boolean
          kind: string
          mime_type: string
          ocr_text: string | null
          page_number: number | null
          party: string
          placement: string
          resource_id: string
          source_file_name: string | null
          storage_path: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          included?: boolean
          kind?: string
          mime_type?: string
          ocr_text?: string | null
          page_number?: number | null
          party?: string
          placement?: string
          resource_id: string
          source_file_name?: string | null
          storage_path: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          included?: boolean
          kind?: string
          mime_type?: string
          ocr_text?: string | null
          page_number?: number | null
          party?: string
          placement?: string
          resource_id?: string
          source_file_name?: string | null
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inpi_resource_evidences_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "inpi_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      inpi_resources: {
        Row: {
          adjustments_history: Json | null
          approved_at: string | null
          brand_name: string | null
          created_at: string
          draft_content: string | null
          examiner_or_opponent: string | null
          final_content: string | null
          final_pdf_path: string | null
          holder: string | null
          id: string
          legal_basis: string | null
          ncl_class: string | null
          original_pdf_path: string | null
          process_number: string | null
          resource_type: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          adjustments_history?: Json | null
          approved_at?: string | null
          brand_name?: string | null
          created_at?: string
          draft_content?: string | null
          examiner_or_opponent?: string | null
          final_content?: string | null
          final_pdf_path?: string | null
          holder?: string | null
          id?: string
          legal_basis?: string | null
          ncl_class?: string | null
          original_pdf_path?: string | null
          process_number?: string | null
          resource_type: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          adjustments_history?: Json | null
          approved_at?: string | null
          brand_name?: string | null
          created_at?: string
          draft_content?: string | null
          examiner_or_opponent?: string | null
          final_content?: string | null
          final_pdf_path?: string | null
          holder?: string | null
          id?: string
          legal_basis?: string | null
          ncl_class?: string | null
          original_pdf_path?: string | null
          process_number?: string | null
          resource_type?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      inpi_sync_logs: {
        Row: {
          categories_synced: string[] | null
          details: Json | null
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          items_created: number | null
          items_failed: number | null
          items_updated: number | null
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          categories_synced?: string[] | null
          details?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_created?: number | null
          items_failed?: number | null
          items_updated?: number | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Update: {
          categories_synced?: string[] | null
          details?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_created?: number | null
          items_failed?: number | null
          items_updated?: number | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      inpiknowledgebase: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          raw_html: string | null
          source_date: string | null
          source_url: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          id: string
          is_active?: boolean | null
          priority?: number | null
          raw_html?: string | null
          source_date?: string | null
          source_url?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          raw_html?: string | null
          source_date?: string | null
          source_url?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      intelligence_process_history: {
        Row: {
          ano_finalizacao: number | null
          classe: string | null
          created_at: string
          id: string
          process_id: string | null
          resultado_final: string | null
          tempo_total_dias: number | null
          teve_exigencia: boolean | null
          teve_oposicao: boolean | null
          teve_recurso: boolean | null
          tipo_marca: string | null
          updated_at: string
        }
        Insert: {
          ano_finalizacao?: number | null
          classe?: string | null
          created_at?: string
          id?: string
          process_id?: string | null
          resultado_final?: string | null
          tempo_total_dias?: number | null
          teve_exigencia?: boolean | null
          teve_oposicao?: boolean | null
          teve_recurso?: boolean | null
          tipo_marca?: string | null
          updated_at?: string
        }
        Update: {
          ano_finalizacao?: number | null
          classe?: string | null
          created_at?: string
          id?: string
          process_id?: string | null
          resultado_final?: string | null
          tempo_total_dias?: number | null
          teve_exigencia?: boolean | null
          teve_oposicao?: boolean | null
          teve_recurso?: boolean | null
          tipo_marca?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_process_history_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: true
            referencedRelation: "brand_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          acordo_id: string | null
          amount: number
          asaas_customer_id: string | null
          asaas_invoice_id: string | null
          asaas_status_raw: string | null
          boleto_code: string | null
          cancelado_em: string | null
          cancelado_por: string | null
          cancelamento_motivo: string | null
          cobranca_origem_id: string | null
          contract_id: string | null
          created_at: string | null
          crm_action_id: string | null
          description: string
          due_date: string
          id: string
          invoice_url: string | null
          negociacao_id: string | null
          origem: string
          originado_pelo_crm: boolean
          payment_date: string | null
          payment_link: string | null
          payment_method: string | null
          pix_code: string | null
          pix_payload: string | null
          pix_qr_code: string | null
          process_id: string | null
          removida_em: string | null
          renegociacao_id: string | null
          status: string | null
          sync_status: string
          ultima_sincronizacao_asaas: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          acordo_id?: string | null
          amount: number
          asaas_customer_id?: string | null
          asaas_invoice_id?: string | null
          asaas_status_raw?: string | null
          boleto_code?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelamento_motivo?: string | null
          cobranca_origem_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          crm_action_id?: string | null
          description: string
          due_date: string
          id?: string
          invoice_url?: string | null
          negociacao_id?: string | null
          origem?: string
          originado_pelo_crm?: boolean
          payment_date?: string | null
          payment_link?: string | null
          payment_method?: string | null
          pix_code?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          process_id?: string | null
          removida_em?: string | null
          renegociacao_id?: string | null
          status?: string | null
          sync_status?: string
          ultima_sincronizacao_asaas?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          acordo_id?: string | null
          amount?: number
          asaas_customer_id?: string | null
          asaas_invoice_id?: string | null
          asaas_status_raw?: string | null
          boleto_code?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelamento_motivo?: string | null
          cobranca_origem_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          crm_action_id?: string | null
          description?: string
          due_date?: string
          id?: string
          invoice_url?: string | null
          negociacao_id?: string | null
          origem?: string
          originado_pelo_crm?: boolean
          payment_date?: string | null
          payment_link?: string | null
          payment_method?: string | null
          pix_code?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          process_id?: string | null
          removida_em?: string | null
          renegociacao_id?: string | null
          status?: string | null
          sync_status?: string
          ultima_sincronizacao_asaas?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_acordo_id_fkey"
            columns: ["acordo_id"]
            isOneToOne: false
            referencedRelation: "acordos_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "brand_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: string
          admin_id: string | null
          content: string | null
          created_at: string
          id: string
          lead_id: string
        }
        Insert: {
          activity_type: string
          admin_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          lead_id: string
        }
        Update: {
          activity_type?: string
          admin_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_remarketing_campaigns: {
        Row: {
          body: string | null
          channels: string[] | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string | null
          target_origin: string[] | null
          target_status: string[] | null
          total_opened: number | null
          total_queued: number | null
          total_sent: number | null
          type: string
        }
        Insert: {
          body?: string | null
          channels?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          target_origin?: string[] | null
          target_status?: string[] | null
          total_opened?: number | null
          total_queued?: number | null
          total_sent?: number | null
          type?: string
        }
        Update: {
          body?: string | null
          channels?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          target_origin?: string[] | null
          target_status?: string[] | null
          total_opened?: number | null
          total_queued?: number | null
          total_sent?: number | null
          type?: string
        }
        Relationships: []
      }
      lead_remarketing_queue: {
        Row: {
          body: string | null
          campaign_id: string | null
          channel: string
          created_at: string
          error_message: string | null
          id: string
          lead_id: string
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          campaign_id?: string | null
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          campaign_id?: string | null
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_remarketing_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          assigned_to: string | null
          city: string | null
          company_name: string | null
          converted_at: string | null
          converted_to_client_id: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          email_opt_out: boolean | null
          estimated_value: number | null
          form_started_at: string | null
          full_name: string
          id: string
          last_activity_at: string | null
          last_reminder_sent_at: string | null
          lead_score: number | null
          lead_temperature: string | null
          notes: string | null
          origin: string | null
          phone: string | null
          remarketing_count: number | null
          state: string | null
          status: string
          tags: string[] | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          company_name?: string | null
          converted_at?: string | null
          converted_to_client_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          email_opt_out?: boolean | null
          estimated_value?: number | null
          form_started_at?: string | null
          full_name: string
          id?: string
          last_activity_at?: string | null
          last_reminder_sent_at?: string | null
          lead_score?: number | null
          lead_temperature?: string | null
          notes?: string | null
          origin?: string | null
          phone?: string | null
          remarketing_count?: number | null
          state?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          company_name?: string | null
          converted_at?: string | null
          converted_to_client_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          email_opt_out?: boolean | null
          estimated_value?: number | null
          form_started_at?: string | null
          full_name?: string
          id?: string
          last_activity_at?: string | null
          last_reminder_sent_at?: string | null
          lead_score?: number | null
          lead_temperature?: string | null
          notes?: string | null
          origin?: string | null
          phone?: string | null
          remarketing_count?: number | null
          state?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      login_history: {
        Row: {
          id: string
          ip_address: string | null
          login_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          ip_address?: string | null
          login_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          ip_address?: string | null
          login_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_ab_tests: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          created_by: string | null
          ended_at: string | null
          id: string
          started_at: string | null
          status: string | null
          test_name: string
          winner_variant: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          test_name: string
          winner_variant?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          test_name?: string
          winner_variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_ab_tests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_ab_variants: {
        Row: {
          clicks: number | null
          conversions: number | null
          cpl: number | null
          created_at: string | null
          ctr: number | null
          headline: string | null
          id: string
          impressions: number | null
          leads: number | null
          primary_text: string | null
          spend: number | null
          test_id: string
          updated_at: string | null
          variant_name: string
        }
        Insert: {
          clicks?: number | null
          conversions?: number | null
          cpl?: number | null
          created_at?: string | null
          ctr?: number | null
          headline?: string | null
          id?: string
          impressions?: number | null
          leads?: number | null
          primary_text?: string | null
          spend?: number | null
          test_id: string
          updated_at?: string | null
          variant_name: string
        }
        Update: {
          clicks?: number | null
          conversions?: number | null
          cpl?: number | null
          created_at?: string | null
          ctr?: number | null
          headline?: string | null
          id?: string
          impressions?: number | null
          leads?: number | null
          primary_text?: string | null
          spend?: number | null
          test_id?: string
          updated_at?: string | null
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_ab_variants_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "marketing_ab_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_ad_performance: {
        Row: {
          ad_id: string | null
          campaign_id: string | null
          clicks: number | null
          conversions: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          leads_count: number | null
          platform: string
          revenue: number | null
          spend: number | null
        }
        Insert: {
          ad_id?: string | null
          campaign_id?: string | null
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          leads_count?: number | null
          platform?: string
          revenue?: number | null
          spend?: number | null
        }
        Update: {
          ad_id?: string | null
          campaign_id?: string | null
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          leads_count?: number | null
          platform?: string
          revenue?: number | null
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_ad_performance_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "marketing_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_ad_performance_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_ads: {
        Row: {
          ad_name: string | null
          adset_name: string | null
          campaign_id: string | null
          clicks: number | null
          conversions: number | null
          cpc: number | null
          cpl: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          id: string
          impressions: number | null
          leads_count: number | null
          meta_ad_id: string | null
          meta_adset_id: string | null
          platform: string
          revenue: number | null
          spend: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ad_name?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          id?: string
          impressions?: number | null
          leads_count?: number | null
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          platform?: string
          revenue?: number | null
          spend?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ad_name?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          id?: string
          impressions?: number | null
          leads_count?: number | null
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          platform?: string
          revenue?: number | null
          spend?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_ads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_attribution: {
        Row: {
          attribution_model: string | null
          client_id: string | null
          contract_id: string | null
          converted_at: string | null
          created_at: string
          fbclid: string | null
          gclid: string | null
          id: string
          invoice_id: string | null
          landing_page: string | null
          lead_id: string | null
          meta_ad_id: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
          referrer: string | null
          revenue: number | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          attribution_model?: string | null
          client_id?: string | null
          contract_id?: string | null
          converted_at?: string | null
          created_at?: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          invoice_id?: string | null
          landing_page?: string | null
          lead_id?: string | null
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          referrer?: string | null
          revenue?: number | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          attribution_model?: string | null
          client_id?: string | null
          contract_id?: string | null
          converted_at?: string | null
          created_at?: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          invoice_id?: string | null
          landing_page?: string | null
          lead_id?: string | null
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          referrer?: string | null
          revenue?: number | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_attribution_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_attribution_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_audience_suggestions: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          description: string | null
          estimated_reach: string | null
          id: string
          is_applied: boolean | null
          name: string
          source: string | null
          suggestion_type: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          description?: string | null
          estimated_reach?: string | null
          id?: string
          is_applied?: boolean | null
          name: string
          source?: string | null
          suggestion_type?: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          description?: string | null
          estimated_reach?: string | null
          id?: string
          is_applied?: boolean | null
          name?: string
          source?: string | null
          suggestion_type?: string
        }
        Relationships: []
      }
      marketing_budget_alerts: {
        Row: {
          alert_type: string
          campaign_id: string | null
          created_at: string | null
          current_value: number | null
          id: string
          is_triggered: boolean | null
          resolved_at: string | null
          threshold_value: number
          triggered_at: string | null
          updated_at: string | null
        }
        Insert: {
          alert_type: string
          campaign_id?: string | null
          created_at?: string | null
          current_value?: number | null
          id?: string
          is_triggered?: boolean | null
          resolved_at?: string | null
          threshold_value: number
          triggered_at?: string | null
          updated_at?: string | null
        }
        Update: {
          alert_type?: string
          campaign_id?: string | null
          created_at?: string | null
          current_value?: number | null
          id?: string
          is_triggered?: boolean | null
          resolved_at?: string | null
          threshold_value?: number
          triggered_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_budget_alerts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          ad_name: string | null
          adset_name: string | null
          campaign_name: string
          clicks: number | null
          conversions: number | null
          cpc: number | null
          cpl: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          daily_budget: number | null
          id: string
          impressions: number | null
          leads_count: number | null
          meta_campaign_id: string | null
          monthly_budget_limit: number | null
          platform: string | null
          revenue: number | null
          roi: number | null
          spend: number | null
          status: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          ad_name?: string | null
          adset_name?: string | null
          campaign_name: string
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          daily_budget?: number | null
          id?: string
          impressions?: number | null
          leads_count?: number | null
          meta_campaign_id?: string | null
          monthly_budget_limit?: number | null
          platform?: string | null
          revenue?: number | null
          roi?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          ad_name?: string | null
          adset_name?: string | null
          campaign_name?: string
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          daily_budget?: number | null
          id?: string
          impressions?: number | null
          leads_count?: number | null
          meta_campaign_id?: string | null
          monthly_budget_limit?: number | null
          platform?: string | null
          revenue?: number | null
          roi?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_config: {
        Row: {
          budget_alert_enabled: boolean | null
          created_at: string
          google_ads_connected: boolean | null
          google_ads_customer_id: string | null
          id: string
          is_connected: boolean
          last_sync: string | null
          meta_business_id: string | null
          meta_pixel_id: string | null
          sync_interval_minutes: number | null
          updated_at: string
        }
        Insert: {
          budget_alert_enabled?: boolean | null
          created_at?: string
          google_ads_connected?: boolean | null
          google_ads_customer_id?: string | null
          id?: string
          is_connected?: boolean
          last_sync?: string | null
          meta_business_id?: string | null
          meta_pixel_id?: string | null
          sync_interval_minutes?: number | null
          updated_at?: string
        }
        Update: {
          budget_alert_enabled?: boolean | null
          created_at?: string
          google_ads_connected?: boolean | null
          google_ads_customer_id?: string | null
          id?: string
          is_connected?: boolean
          last_sync?: string | null
          meta_business_id?: string | null
          meta_pixel_id?: string | null
          sync_interval_minutes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_conversions: {
        Row: {
          ad_id: string | null
          attribution_model: string | null
          campaign_id: string | null
          client_id: string | null
          contract_id: string | null
          created_at: string | null
          event_name: string
          event_value: number | null
          fbclid: string | null
          gclid: string | null
          id: string
          invoice_id: string | null
          lead_id: string | null
          platform: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          ad_id?: string | null
          attribution_model?: string | null
          campaign_id?: string | null
          client_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          event_name: string
          event_value?: number | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          invoice_id?: string | null
          lead_id?: string | null
          platform?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          ad_id?: string | null
          attribution_model?: string | null
          campaign_id?: string | null
          client_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          event_name?: string
          event_value?: number | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          invoice_id?: string | null
          lead_id?: string | null
          platform?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_conversions_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "marketing_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_conversions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_generated_ads: {
        Row: {
          call_to_action: string | null
          campaign_name: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          generated_by: string | null
          headline: string
          id: string
          objective: string | null
          platform: string
          primary_text: string
          status: string | null
          target_audience: string | null
          updated_at: string | null
        }
        Insert: {
          call_to_action?: string | null
          campaign_name?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          generated_by?: string | null
          headline: string
          id?: string
          objective?: string | null
          platform?: string
          primary_text: string
          status?: string | null
          target_audience?: string | null
          updated_at?: string | null
        }
        Update: {
          call_to_action?: string | null
          campaign_name?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          generated_by?: string | null
          headline?: string
          id?: string
          objective?: string | null
          platform?: string
          primary_text?: string
          status?: string | null
          target_audience?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      meeting_participants: {
        Row: {
          id: string
          joined_at: string | null
          left_at: string | null
          meeting_id: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          left_at?: string | null
          meeting_id: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          left_at?: string | null
          meeting_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          conversation_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          google_event_id: string | null
          google_meet_link: string | null
          id: string
          meeting_type: string
          scheduled_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          meeting_type?: string
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          meeting_type?: string
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      negociacoes_devedor: {
        Row: {
          asaas_customer_id: string | null
          cliente_cpf_cnpj: string | null
          cliente_nome: string | null
          created_at: string
          created_by: string | null
          id: string
          motivo_cobranca: string | null
          observacao: string | null
          parcelas_originais_ids: string[] | null
          tipo: string
          valor_acrescimo: number
          valor_original_total: number
          valor_total: number
        }
        Insert: {
          asaas_customer_id?: string | null
          cliente_cpf_cnpj?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          motivo_cobranca?: string | null
          observacao?: string | null
          parcelas_originais_ids?: string[] | null
          tipo: string
          valor_acrescimo?: number
          valor_original_total?: number
          valor_total?: number
        }
        Update: {
          asaas_customer_id?: string | null
          cliente_cpf_cnpj?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          motivo_cobranca?: string | null
          observacao?: string | null
          parcelas_originais_ids?: string[] | null
          tipo?: string
          valor_acrescimo?: number
          valor_original_total?: number
          valor_total?: number
        }
        Relationships: []
      }
      notification_dispatch_logs: {
        Row: {
          attempts: number | null
          channel: string
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json | null
          recipient_email: string | null
          recipient_phone: string | null
          recipient_user_id: string | null
          response_body: string | null
          status: string
        }
        Insert: {
          attempts?: number | null
          channel: string
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          recipient_email?: string | null
          recipient_phone?: string | null
          recipient_user_id?: string | null
          response_body?: string | null
          status?: string
        }
        Update: {
          attempts?: number | null
          channel?: string
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          recipient_email?: string | null
          recipient_phone?: string | null
          recipient_user_id?: string | null
          response_body?: string | null
          status?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          channel: string
          error_message: string | null
          id: string
          notification_id: string | null
          recipient: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          channel: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          channel?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          message: string
          name: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message: string
          name: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message?: string
          name?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          channels: Json | null
          created_at: string | null
          id: string
          link: string | null
          message: string
          read: boolean | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          channels?: Json | null
          created_at?: string | null
          id?: string
          link?: string | null
          message: string
          read?: boolean | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          channels?: Json | null
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_devedor: {
        Row: {
          asaas_payment_id: string | null
          created_at: string
          crm_action_id: string | null
          data_vencimento: string
          id: string
          invoice_url: string | null
          link_boleto: string | null
          motivo_cobranca: string | null
          negociacao_id: string
          numero_parcela: number
          originado_pelo_crm: boolean
          status: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          asaas_payment_id?: string | null
          created_at?: string
          crm_action_id?: string | null
          data_vencimento: string
          id?: string
          invoice_url?: string | null
          link_boleto?: string | null
          motivo_cobranca?: string | null
          negociacao_id: string
          numero_parcela: number
          originado_pelo_crm?: boolean
          status?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          asaas_payment_id?: string | null
          created_at?: string
          crm_action_id?: string | null
          data_vencimento?: string
          id?: string
          invoice_url?: string | null
          link_boleto?: string | null
          motivo_cobranca?: string | null
          negociacao_id?: string
          numero_parcela?: number
          originado_pelo_crm?: boolean
          status?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_devedor_negociacao_id_fkey"
            columns: ["negociacao_id"]
            isOneToOne: false
            referencedRelation: "negociacoes_devedor"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_renegociadas: {
        Row: {
          asaas_payment_id: string | null
          created_at: string
          crm_action_id: string | null
          data_vencimento: string
          id: string
          invoice_url: string | null
          link_boleto: string | null
          motivo_cobranca: string
          numero_parcela: number
          originado_pelo_crm: boolean
          renegociacao_id: string
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          asaas_payment_id?: string | null
          created_at?: string
          crm_action_id?: string | null
          data_vencimento: string
          id?: string
          invoice_url?: string | null
          link_boleto?: string | null
          motivo_cobranca: string
          numero_parcela: number
          originado_pelo_crm?: boolean
          renegociacao_id: string
          status?: string
          updated_at?: string
          valor: number
        }
        Update: {
          asaas_payment_id?: string | null
          created_at?: string
          crm_action_id?: string | null
          data_vencimento?: string
          id?: string
          invoice_url?: string | null
          link_boleto?: string | null
          motivo_cobranca?: string
          numero_parcela?: number
          originado_pelo_crm?: boolean
          renegociacao_id?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_renegociadas_renegociacao_id_fkey"
            columns: ["renegociacao_id"]
            isOneToOne: false
            referencedRelation: "renegociacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_events: {
        Row: {
          created_at: string | null
          description: string | null
          event_date: string | null
          event_type: string
          id: string
          process_id: string | null
          rpi_number: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          event_type: string
          id?: string
          process_id?: string | null
          rpi_number?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          event_type?: string
          id?: string
          process_id?: string | null
          rpi_number?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_events_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "brand_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          additional_emails: string[]
          additional_phones: string[]
          address: string | null
          address_complement: string | null
          address_number: string | null
          asaas_customer_id: string | null
          assigned_to: string | null
          birth_date: string | null
          city: string | null
          client_funnel_type: string | null
          cnae: string | null
          cnpj: string | null
          company_name: string | null
          contract_value: number | null
          cpf: string | null
          cpf_cnpj: string | null
          created_at: string | null
          created_by: string | null
          email: string
          full_name: string | null
          id: string
          is_special_client: boolean
          last_contact: string | null
          negativado: boolean
          negativado_em: string | null
          negativado_total: number | null
          neighborhood: string | null
          opening_date: string | null
          origin: string | null
          phone: string | null
          priority: string | null
          registration_status: string | null
          share_capital: number | null
          state: string | null
          trade_name: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          additional_emails?: string[]
          additional_phones?: string[]
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          asaas_customer_id?: string | null
          assigned_to?: string | null
          birth_date?: string | null
          city?: string | null
          client_funnel_type?: string | null
          cnae?: string | null
          cnpj?: string | null
          company_name?: string | null
          contract_value?: number | null
          cpf?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          email: string
          full_name?: string | null
          id: string
          is_special_client?: boolean
          last_contact?: string | null
          negativado?: boolean
          negativado_em?: string | null
          negativado_total?: number | null
          neighborhood?: string | null
          opening_date?: string | null
          origin?: string | null
          phone?: string | null
          priority?: string | null
          registration_status?: string | null
          share_capital?: number | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          additional_emails?: string[]
          additional_phones?: string[]
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          asaas_customer_id?: string | null
          assigned_to?: string | null
          birth_date?: string | null
          city?: string | null
          client_funnel_type?: string | null
          cnae?: string | null
          cnpj?: string | null
          company_name?: string | null
          contract_value?: number | null
          cpf?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_special_client?: boolean
          last_contact?: string | null
          negativado?: boolean
          negativado_em?: string | null
          negativado_total?: number | null
          neighborhood?: string | null
          opening_date?: string | null
          origin?: string | null
          phone?: string | null
          priority?: string | null
          registration_status?: string | null
          share_capital?: number | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      promotion_expiration_logs: {
        Row: {
          contract_ids: Json | null
          contracts_updated: number | null
          executed_at: string | null
          id: string
          status: string | null
        }
        Insert: {
          contract_ids?: Json | null
          contracts_updated?: number | null
          executed_at?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          contract_ids?: Json | null
          contracts_updated?: number | null
          executed_at?: string | null
          id?: string
          status?: string | null
        }
        Relationships: []
      }
      publicacao_cobranca_schedule: {
        Row: {
          client_id: string | null
          client_responded_at: string | null
          created_at: string
          data_inicio: string
          id: string
          last_notif_at: string | null
          last_notif_bucket: string | null
          notif_1_at: string | null
          notif_1_channel: string | null
          notif_2_at: string | null
          notif_2_channel: string | null
          notif_3_at: string | null
          notif_3_channel: string | null
          publicacao_id: string
          responsavel_admin_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_responded_at?: string | null
          created_at?: string
          data_inicio?: string
          id?: string
          last_notif_at?: string | null
          last_notif_bucket?: string | null
          notif_1_at?: string | null
          notif_1_channel?: string | null
          notif_2_at?: string | null
          notif_2_channel?: string | null
          notif_3_at?: string | null
          notif_3_channel?: string | null
          publicacao_id: string
          responsavel_admin_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_responded_at?: string | null
          created_at?: string
          data_inicio?: string
          id?: string
          last_notif_at?: string | null
          last_notif_bucket?: string | null
          notif_1_at?: string | null
          notif_1_channel?: string | null
          notif_2_at?: string | null
          notif_2_channel?: string | null
          notif_3_at?: string | null
          notif_3_channel?: string | null
          publicacao_id?: string
          responsavel_admin_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publicacao_cobranca_schedule_publicacao_id_fkey"
            columns: ["publicacao_id"]
            isOneToOne: true
            referencedRelation: "publicacoes_marcas"
            referencedColumns: ["id"]
          },
        ]
      }
      publicacao_logs: {
        Row: {
          admin_email: string | null
          admin_id: string | null
          campo_alterado: string
          created_at: string
          id: string
          publicacao_id: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          admin_email?: string | null
          admin_id?: string | null
          campo_alterado: string
          created_at?: string
          id?: string
          publicacao_id: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          admin_email?: string | null
          admin_id?: string | null
          campo_alterado?: string
          created_at?: string
          id?: string
          publicacao_id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publicacao_logs_publicacao_id_fkey"
            columns: ["publicacao_id"]
            isOneToOne: false
            referencedRelation: "publicacoes_marcas"
            referencedColumns: ["id"]
          },
        ]
      }
      publicacoes_marcas: {
        Row: {
          admin_id: string | null
          brand_name_rpi: string | null
          client_id: string | null
          comentarios_internos: string | null
          created_at: string
          cumprimento_at: string | null
          cumprimento_by: string | null
          cumprimento_ok: boolean
          cumprimento_status: string | null
          data_certificado: string | null
          data_decisao: string | null
          data_deposito: string | null
          data_publicacao_rpi: string | null
          data_renovacao: string | null
          descricao_prazo: string | null
          documento_rpi_url: string | null
          id: string
          last_notification_sent_at: string | null
          linking_method: string | null
          ncl_class: string | null
          oposicao_data: string | null
          oposicao_protocolada: boolean | null
          prazo_oposicao: string | null
          process_id: string | null
          process_number_rpi: string | null
          proximo_prazo_critico: string | null
          rpi_entry_id: string | null
          rpi_link: string | null
          rpi_number: string | null
          stale_since: string | null
          status: string
          tipo_publicacao: string | null
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          brand_name_rpi?: string | null
          client_id?: string | null
          comentarios_internos?: string | null
          created_at?: string
          cumprimento_at?: string | null
          cumprimento_by?: string | null
          cumprimento_ok?: boolean
          cumprimento_status?: string | null
          data_certificado?: string | null
          data_decisao?: string | null
          data_deposito?: string | null
          data_publicacao_rpi?: string | null
          data_renovacao?: string | null
          descricao_prazo?: string | null
          documento_rpi_url?: string | null
          id?: string
          last_notification_sent_at?: string | null
          linking_method?: string | null
          ncl_class?: string | null
          oposicao_data?: string | null
          oposicao_protocolada?: boolean | null
          prazo_oposicao?: string | null
          process_id?: string | null
          process_number_rpi?: string | null
          proximo_prazo_critico?: string | null
          rpi_entry_id?: string | null
          rpi_link?: string | null
          rpi_number?: string | null
          stale_since?: string | null
          status?: string
          tipo_publicacao?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          brand_name_rpi?: string | null
          client_id?: string | null
          comentarios_internos?: string | null
          created_at?: string
          cumprimento_at?: string | null
          cumprimento_by?: string | null
          cumprimento_ok?: boolean
          cumprimento_status?: string | null
          data_certificado?: string | null
          data_decisao?: string | null
          data_deposito?: string | null
          data_publicacao_rpi?: string | null
          data_renovacao?: string | null
          descricao_prazo?: string | null
          documento_rpi_url?: string | null
          id?: string
          last_notification_sent_at?: string | null
          linking_method?: string | null
          ncl_class?: string | null
          oposicao_data?: string | null
          oposicao_protocolada?: boolean | null
          prazo_oposicao?: string | null
          process_id?: string | null
          process_number_rpi?: string | null
          proximo_prazo_critico?: string | null
          rpi_entry_id?: string | null
          rpi_link?: string | null
          rpi_number?: string | null
          stale_since?: string | null
          status?: string
          tipo_publicacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_marcas_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: true
            referencedRelation: "brand_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      renegociacoes: {
        Row: {
          asaas_customer_id: string | null
          cliente_cpf_cnpj: string | null
          cliente_nome: string | null
          created_at: string
          created_by: string | null
          id: string
          motivo_cobranca: string
          observacao: string | null
          parcelas_originais_ids: string[]
          valor_acrescimo: number
          valor_original_total: number
          valor_renegociado: number
        }
        Insert: {
          asaas_customer_id?: string | null
          cliente_cpf_cnpj?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          motivo_cobranca: string
          observacao?: string | null
          parcelas_originais_ids?: string[]
          valor_acrescimo: number
          valor_original_total: number
          valor_renegociado: number
        }
        Update: {
          asaas_customer_id?: string | null
          cliente_cpf_cnpj?: string | null
          cliente_nome?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          motivo_cobranca?: string
          observacao?: string | null
          parcelas_originais_ids?: string[]
          valor_acrescimo?: number
          valor_original_total?: number
          valor_renegociado?: number
        }
        Relationships: []
      }
      responsavel_atribuicao: {
        Row: {
          atribuido_em: string
          atribuido_por: string | null
          entidade: string
          entidade_id: string
          id: string
          updated_at: string
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          atribuido_em?: string
          atribuido_por?: string | null
          entidade: string
          entidade_id: string
          id?: string
          updated_at?: string
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          atribuido_em?: string
          atribuido_por?: string | null
          entidade?: string
          entidade_id?: string
          id?: string
          updated_at?: string
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: []
      }
      responsavel_historico: {
        Row: {
          acao: string
          created_at: string
          entidade: string
          entidade_id: string
          id: string
          observacao: string | null
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          entidade: string
          entidade_id: string
          id?: string
          observacao?: string | null
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          entidade?: string
          entidade_id?: string
          id?: string
          observacao?: string | null
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: []
      }
      rpi_enrichment_field_log: {
        Row: {
          applied_by: string | null
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          previous_value: string | null
          process_number: string
          rpi_entry_id: string
        }
        Insert: {
          applied_by?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          previous_value?: string | null
          process_number: string
          rpi_entry_id: string
        }
        Update: {
          applied_by?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          previous_value?: string | null
          process_number?: string
          rpi_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rpi_enrichment_field_log_rpi_entry_id_fkey"
            columns: ["rpi_entry_id"]
            isOneToOne: false
            referencedRelation: "rpi_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      rpi_enrichment_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          next_attempt_at: string
          process_number: string
          result: Json | null
          rpi_entry_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string
          process_number: string
          result?: Json | null
          rpi_entry_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string
          process_number?: string
          result?: Json | null
          rpi_entry_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rpi_enrichment_queue_rpi_entry_id_fkey"
            columns: ["rpi_entry_id"]
            isOneToOne: false
            referencedRelation: "rpi_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      rpi_entries: {
        Row: {
          apostila: string | null
          apresentacao: string | null
          attorney_name: string | null
          auto_link_source: string | null
          auto_linked_at: string | null
          brand_name: string | null
          concession_date: string | null
          created_at: string
          deposit_date: string | null
          dispatch_code: string | null
          dispatch_text: string | null
          dispatch_type: string | null
          dispatches: Json
          enrichment_status: string
          field_sources: Json
          holder_name: string | null
          id: string
          is_destituicao: boolean
          is_nomeacao: boolean
          is_substituicao: boolean
          last_reminder_sent_at: string | null
          linked_at: string | null
          match_candidates: Json
          matched_client_id: string | null
          matched_process_id: string | null
          natureza: string | null
          ncl_classes: string[] | null
          ncl_specifications: Json
          needs_human_review: boolean
          occurrences: Json
          occurrences_count: number
          process_block_hash: string | null
          process_number: string
          procurador_anterior: string | null
          procurador_novo: string | null
          procuradores: Json
          protocols: Json
          publication_date: string | null
          relation_confidence: number | null
          relation_primary: string | null
          relation_types: string[]
          requerentes: Json
          review_reason: string | null
          rpi_upload_id: string
          situacao_atual: string | null
          source_file_ref: string | null
          tag: string | null
          titulares: Json
          update_status: string | null
          updated_at: string | null
          updated_by: string | null
          validity_date: string | null
          vienna_classes: Json
        }
        Insert: {
          apostila?: string | null
          apresentacao?: string | null
          attorney_name?: string | null
          auto_link_source?: string | null
          auto_linked_at?: string | null
          brand_name?: string | null
          concession_date?: string | null
          created_at?: string
          deposit_date?: string | null
          dispatch_code?: string | null
          dispatch_text?: string | null
          dispatch_type?: string | null
          dispatches?: Json
          enrichment_status?: string
          field_sources?: Json
          holder_name?: string | null
          id?: string
          is_destituicao?: boolean
          is_nomeacao?: boolean
          is_substituicao?: boolean
          last_reminder_sent_at?: string | null
          linked_at?: string | null
          match_candidates?: Json
          matched_client_id?: string | null
          matched_process_id?: string | null
          natureza?: string | null
          ncl_classes?: string[] | null
          ncl_specifications?: Json
          needs_human_review?: boolean
          occurrences?: Json
          occurrences_count?: number
          process_block_hash?: string | null
          process_number: string
          procurador_anterior?: string | null
          procurador_novo?: string | null
          procuradores?: Json
          protocols?: Json
          publication_date?: string | null
          relation_confidence?: number | null
          relation_primary?: string | null
          relation_types?: string[]
          requerentes?: Json
          review_reason?: string | null
          rpi_upload_id: string
          situacao_atual?: string | null
          source_file_ref?: string | null
          tag?: string | null
          titulares?: Json
          update_status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          validity_date?: string | null
          vienna_classes?: Json
        }
        Update: {
          apostila?: string | null
          apresentacao?: string | null
          attorney_name?: string | null
          auto_link_source?: string | null
          auto_linked_at?: string | null
          brand_name?: string | null
          concession_date?: string | null
          created_at?: string
          deposit_date?: string | null
          dispatch_code?: string | null
          dispatch_text?: string | null
          dispatch_type?: string | null
          dispatches?: Json
          enrichment_status?: string
          field_sources?: Json
          holder_name?: string | null
          id?: string
          is_destituicao?: boolean
          is_nomeacao?: boolean
          is_substituicao?: boolean
          last_reminder_sent_at?: string | null
          linked_at?: string | null
          match_candidates?: Json
          matched_client_id?: string | null
          matched_process_id?: string | null
          natureza?: string | null
          ncl_classes?: string[] | null
          ncl_specifications?: Json
          needs_human_review?: boolean
          occurrences?: Json
          occurrences_count?: number
          process_block_hash?: string | null
          process_number?: string
          procurador_anterior?: string | null
          procurador_novo?: string | null
          procuradores?: Json
          protocols?: Json
          publication_date?: string | null
          relation_confidence?: number | null
          relation_primary?: string | null
          relation_types?: string[]
          requerentes?: Json
          review_reason?: string | null
          rpi_upload_id?: string
          situacao_atual?: string | null
          source_file_ref?: string | null
          tag?: string | null
          titulares?: Json
          update_status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          validity_date?: string | null
          vienna_classes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "rpi_entries_rpi_upload_id_fkey"
            columns: ["rpi_upload_id"]
            isOneToOne: false
            referencedRelation: "rpi_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      rpi_process_lookups: {
        Row: {
          brand_name: string | null
          class_status: string | null
          created_at: string
          current_status: string | null
          detail_status: string | null
          expiry_date: string | null
          filing_date: string | null
          grant_date: string | null
          holder: string | null
          id: string
          last_error_at: string | null
          last_error_code: string | null
          legal_representative: string | null
          lookup_status: string
          nature: string | null
          ncl_class: string | null
          presentation: string | null
          priority_date: string | null
          process_number: string
          queried_at: string | null
          source: string | null
          source_url: string | null
          specification: string | null
          updated_at: string
        }
        Insert: {
          brand_name?: string | null
          class_status?: string | null
          created_at?: string
          current_status?: string | null
          detail_status?: string | null
          expiry_date?: string | null
          filing_date?: string | null
          grant_date?: string | null
          holder?: string | null
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          legal_representative?: string | null
          lookup_status?: string
          nature?: string | null
          ncl_class?: string | null
          presentation?: string | null
          priority_date?: string | null
          process_number: string
          queried_at?: string | null
          source?: string | null
          source_url?: string | null
          specification?: string | null
          updated_at?: string
        }
        Update: {
          brand_name?: string | null
          class_status?: string | null
          created_at?: string
          current_status?: string | null
          detail_status?: string | null
          expiry_date?: string | null
          filing_date?: string | null
          grant_date?: string | null
          holder?: string | null
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          legal_representative?: string | null
          lookup_status?: string
          nature?: string | null
          ncl_class?: string | null
          presentation?: string | null
          priority_date?: string | null
          process_number?: string
          queried_at?: string | null
          source?: string | null
          source_url?: string | null
          specification?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rpi_uploads: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          is_preview: boolean
          parse_progress: Json
          parse_stats: Json
          processed_at: string | null
          rpi_date: string | null
          rpi_number: string | null
          source_file_url: string | null
          status: string
          summary: string | null
          total_clients_matched: number | null
          total_mentions: number | null
          total_processes_found: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          is_preview?: boolean
          parse_progress?: Json
          parse_stats?: Json
          processed_at?: string | null
          rpi_date?: string | null
          rpi_number?: string | null
          source_file_url?: string | null
          status?: string
          summary?: string | null
          total_clients_matched?: number | null
          total_mentions?: number | null
          total_processes_found?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          is_preview?: boolean
          parse_progress?: Json
          parse_stats?: Json
          processed_at?: string | null
          rpi_date?: string | null
          rpi_number?: string | null
          source_file_url?: string | null
          status?: string
          summary?: string | null
          total_clients_matched?: number | null
          total_mentions?: number | null
          total_processes_found?: number | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      signature_audit_log: {
        Row: {
          contract_id: string | null
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_audit_log_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      upsell_engine_config: {
        Row: {
          engine_enabled: boolean | null
          global_confidence: number | null
          id: string
          last_optimization: string | null
          last_recalculation: string | null
          mode: string | null
          stats: Json | null
          updated_at: string
        }
        Insert: {
          engine_enabled?: boolean | null
          global_confidence?: number | null
          id?: string
          last_optimization?: string | null
          last_recalculation?: string | null
          mode?: string | null
          stats?: Json | null
          updated_at?: string
        }
        Update: {
          engine_enabled?: boolean | null
          global_confidence?: number | null
          id?: string
          last_optimization?: string | null
          last_recalculation?: string | null
          mode?: string | null
          stats?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      upsell_engine_weights: {
        Row: {
          confidence_index: number | null
          created_at: string
          dimension: string
          dimension_value: string
          id: string
          is_premium: boolean | null
          peso: number
          taxa_aceite: number | null
          total_aceites: number | null
          total_sugestoes: number | null
          updated_at: string
        }
        Insert: {
          confidence_index?: number | null
          created_at?: string
          dimension: string
          dimension_value: string
          id?: string
          is_premium?: boolean | null
          peso?: number
          taxa_aceite?: number | null
          total_aceites?: number | null
          total_sugestoes?: number | null
          updated_at?: string
        }
        Update: {
          confidence_index?: number | null
          created_at?: string
          dimension?: string
          dimension_value?: string
          id?: string
          is_premium?: boolean | null
          peso?: number
          taxa_aceite?: number | null
          total_aceites?: number | null
          total_sugestoes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      upsell_monetization_logs: {
        Row: {
          aceitou: boolean | null
          classe_principal: string | null
          confidence_index: number | null
          created_at: string
          id: string
          justificativa: string | null
          score_comercial: number | null
          segmento: string | null
          upsell_sugerido: string
          upsell_tipo: string | null
          user_id: string | null
        }
        Insert: {
          aceitou?: boolean | null
          classe_principal?: string | null
          confidence_index?: number | null
          created_at?: string
          id?: string
          justificativa?: string | null
          score_comercial?: number | null
          segmento?: string | null
          upsell_sugerido: string
          upsell_tipo?: string | null
          user_id?: string | null
        }
        Update: {
          aceitou?: boolean | null
          classe_principal?: string | null
          confidence_index?: number | null
          created_at?: string
          id?: string
          justificativa?: string | null
          score_comercial?: number | null
          segmento?: string | null
          upsell_sugerido?: string
          upsell_tipo?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      viability_searches: {
        Row: {
          brand_name: string
          business_area: string
          created_at: string | null
          id: string
          ip_hash: string | null
          result_level: string | null
        }
        Insert: {
          brand_name: string
          business_area: string
          created_at?: string | null
          id?: string
          ip_hash?: string | null
          result_level?: string | null
        }
        Update: {
          brand_name?: string
          business_area?: string
          created_at?: string | null
          id?: string
          ip_hash?: string | null
          result_level?: string | null
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          api_key: string
          company_id: string | null
          created_at: string | null
          id: string
          instance_name: string | null
          is_active: boolean | null
          server_url: string | null
          updated_at: string | null
        }
        Insert: {
          api_key: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          instance_name?: string | null
          is_active?: boolean | null
          server_url?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          instance_name?: string | null
          is_active?: boolean | null
          server_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_admin_role: { Args: { target_user_id: string }; Returns: undefined }
      admin_asaas_accounts: {
        Args: { p_owner?: string }
        Returns: {
          asaas_customer_id: string
          cliente_nome: string
          cobrancas: number
        }[]
      }
      admin_billing_situation: {
        Args: {
          p_account?: string
          p_client?: string
          p_due_from?: string
          p_due_to?: string
          p_from?: string
          p_origin?: string
          p_owner?: string
          p_payment_from?: string
          p_payment_method?: string
          p_payment_to?: string
          p_to?: string
        }
        Returns: Json
      }
      admin_invoices_list: {
        Args: {
          p_dir?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_owner?: string
          p_search?: string
          p_sort?: string
          p_status?: string
          p_to?: string
        }
        Returns: {
          amount: number
          asaas_invoice_id: string
          classificacao: string
          cliente_email: string
          cliente_nome: string
          created_at: string
          description: string
          due_date: string
          id: string
          invoice_url: string
          origem: string
          payment_date: string
          payment_method: string
          pix_code: string
          status: string
          sync_status: string
          total_count: number
          user_id: string
        }[]
      }
      admin_invoices_list_filtered: {
        Args: {
          p_account?: string
          p_client?: string
          p_dir?: string
          p_due_from?: string
          p_due_to?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_origin?: string
          p_owner?: string
          p_payment_from?: string
          p_payment_method?: string
          p_payment_to?: string
          p_search?: string
          p_situation?: string
          p_sort?: string
          p_to?: string
        }
        Returns: {
          amount: number
          asaas_invoice_id: string
          classificacao: string
          cliente_email: string
          cliente_nome: string
          created_at: string
          description: string
          due_date: string
          id: string
          invoice_url: string
          origem: string
          payment_date: string
          payment_method: string
          pix_code: string
          status: string
          sync_status: string
          total_count: number
          user_id: string
        }[]
      }
      admin_invoices_totals: {
        Args: { p_from?: string; p_owner?: string; p_to?: string }
        Returns: Json
      }
      calculate_predictive_score: { Args: { p_classe?: string }; Returns: Json }
      classificar_cobranca: {
        Args: { p_due_date: string; p_status: string; p_sync_status: string }
        Returns: string
      }
      classificar_situacao_cobranca: {
        Args: { p_due_date: string; p_status: string; p_sync_status: string }
        Returns: string
      }
      get_annual_evolution: { Args: never; Returns: Json }
      get_auth_user_id_by_email: {
        Args: { lookup_email: string }
        Returns: string
      }
      get_class_ranking: { Args: never; Returns: Json }
      has_current_user_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      has_financial_permission: { Args: { _user_id: string }; Returns: boolean }
      has_inpi_resources_access: {
        Args: { _need_edit?: boolean; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_assigned_admin_of_current_user: {
        Args: { _admin_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_master_user: { Args: never; Returns: boolean }
      is_meeting_participant: {
        Args: { _meeting_id: string; _user_id: string }
        Returns: boolean
      }
      merge_duplicate_clients: {
        Args: { keep_id: string; merge_id: string }
        Returns: undefined
      }
      nome_ordenavel: { Args: { p: string }; Returns: string }
      only_digits: { Args: { s: string }; Returns: string }
      profiles_by_doc_digits: {
        Args: { p_doc: string }
        Returns: {
          id: string
        }[]
      }
      recalculate_upsell_weights: { Args: never; Returns: Json }
      recheck_cobranca_reentry: { Args: never; Returns: number }
      resolve_contract_user_id: {
        Args: {
          _signatory_cnpj: string
          _signatory_cpf: string
          _signatory_name: string
        }
        Returns: string
      }
      sync_intelligence_history: { Args: never; Returns: Json }
      verify_contract_by_hash: {
        Args: { p_hash: string }
        Returns: {
          blockchain_hash: string
          blockchain_network: string
          blockchain_timestamp: string
          blockchain_tx_id: string
          contract_number: string
          signed_at: string
          subject: string
        }[]
      }
      verify_contract_by_id: {
        Args: { p_contract_id: string }
        Returns: {
          blockchain_hash: string
          blockchain_network: string
          blockchain_timestamp: string
          blockchain_tx_id: string
          contract_number: string
          signed_at: string
          subject: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
