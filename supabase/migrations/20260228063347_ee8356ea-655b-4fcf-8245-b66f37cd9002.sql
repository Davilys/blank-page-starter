
-- Permitir que usuarios autenticados leiam system_settings
CREATE POLICY "Authenticated users can read system settings"
ON public.system_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Inserir configuracao padrao do kanban do cliente
INSERT INTO public.system_settings (key, value)
VALUES ('client_kanban_stages', '{"stages":[{"id":"em_andamento","name":"Em Andamento","color":"#3B82F6"},{"id":"publicado_rpi","name":"Publicado RPI","color":"#8B5CF6"},{"id":"em_exame","name":"Em Exame","color":"#F59E0B"},{"id":"deferido","name":"Deferido","color":"#10B981"},{"id":"concedido","name":"Concedido","color":"#22C55E"},{"id":"indeferido","name":"Indeferido","color":"#EF4444"},{"id":"arquivado","name":"Arquivado","color":"#6B7280"}]}')
ON CONFLICT (key) DO NOTHING;
