
INSERT INTO public.email_automations (name, description, category, trigger_event, steps, is_active, trigger_count, success_rate)
VALUES
('Onboarding Automático',
 'Sequência completa de boas-vindas após assinatura de contrato',
 'onboarding', 'contract_signed',
 '[
   {"type":"action","action":"send_email","label":"Email: Boas-vindas","detail":"Template: Bem-vindo à WebMarcas"},
   {"type":"delay","action":"wait","label":"Aguardar 2 dias","detail":"2 dias"},
   {"type":"action","action":"send_email","label":"Email: Tutorial Portal","detail":"Template: Como acompanhar"}
 ]'::jsonb,
 true, 48, 94),
('Recuperação de Leads',
 'Reengajar leads que não converteram após 24h do formulário',
 'leads', 'form_abandoned',
 '[
   {"type":"condition","action":"check_condition","label":"SE: email_opt_out = false","detail":"Verificar consentimento LGPD"},
   {"type":"action","action":"send_email","label":"Email: Follow-up Personalizado","detail":"Template: Seguimento Lead"}
 ]'::jsonb,
 true, 124, 38),
('Alerta Exigência INPI',
 'Notificar cliente automaticamente quando INPI publica exigência',
 'juridico', 'inpi_status_change',
 '[
   {"type":"condition","action":"check_condition","label":"SE: Status = Exigência","detail":"Verificar tipo publicação RPI"},
   {"type":"action","action":"send_email","label":"Email: Exigência de Mérito","detail":"Template: Processual"},
   {"type":"action","action":"notify_admin","label":"Notificar Admin","detail":"Push + Email interno"}
 ]'::jsonb,
 true, 31, 97);
