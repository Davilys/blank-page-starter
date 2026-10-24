-- Cláusula 7 (inadimplência): rescisão imediata + débito não extinto. SOMENTE contract_templates (3 modelos), apenas contratos NOVOS.
-- Não toca contracts/contract_html (contratos gerados/assinados permanecem como estão).
-- Backup do texto anterior em contract_templates_backup_20261024 e UPDATE condicionado ao texto exato esperado (aborta se o modelo mudou).
CREATE TABLE IF NOT EXISTS public.contract_templates_backup_20261024 (
  id uuid PRIMARY KEY,
  name text,
  content text,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_templates_backup_20261024 ENABLE ROW LEVEL SECURITY;

INSERT INTO public.contract_templates_backup_20261024 (id, name, content)
SELECT id, name, content FROM public.contract_templates
WHERE id IN ('8053b151-01b8-4c90-b33e-4705fc7aee8b', 'b6cc7f83-b380-41ba-b387-54c942c27f1b', 'ab77127b-28fb-42f7-8fa9-3660348a376f')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  tid uuid;
  c text;
  old_d constant text := $t$d) Suspensão imediata dos serviços até a regularização do débito;$t$;
  new_d constant text := $t$d) Rescisão imediata do contrato por inadimplemento, nos termos da cláusula 7.2;$t$;
  e_line constant text := $t$e) Inscrição em cadastros de proteção ao crédito após 30 dias de inadimplência.$t$;
  extra constant text := $t$7.2 O inadimplemento de qualquer valor devido pela CONTRATANTE autoriza a CONTRATADA a rescindir imediatamente o presente contrato, de pleno direito, com o cancelamento da prestação dos serviços, mediante comunicação por escrito ao e-mail ou WhatsApp cadastrados. Esta hipótese de rescisão não se sujeita ao aviso prévio da cláusula 9.1.

7.3 A rescisão ou o cancelamento do contrato por inadimplência não extingue, não quita nem perdoa o débito em aberto. Permanecem integralmente devidos e exigíveis, inclusive por cobrança extrajudicial, protesto, inscrição em cadastros de proteção ao crédito e ação judicial: o valor principal em atraso, a multa de 10%, os juros de mora de 1% ao mês, a correção monetária pelo IGPM/FGV e a remuneração pelos serviços já prestados, iniciados ou colocados à disposição até a data da rescisão. A rescisão não importa renúncia da CONTRATADA a qualquer crédito.$t$;
BEGIN
  FOREACH tid IN ARRAY ARRAY['8053b151-01b8-4c90-b33e-4705fc7aee8b'::uuid, 'b6cc7f83-b380-41ba-b387-54c942c27f1b'::uuid, 'ab77127b-28fb-42f7-8fa9-3660348a376f'::uuid] LOOP
    SELECT content INTO c FROM public.contract_templates WHERE id = tid;
    IF c IS NULL THEN RAISE EXCEPTION 'template % não encontrado', tid; END IF;
    IF position('7.2 O inadimplemento de qualquer valor devido pela CONTRATANTE' in c) > 0 THEN CONTINUE; END IF; -- idempotente
    IF (length(c) - length(replace(c, old_d, ''))) <> length(old_d) THEN RAISE EXCEPTION 'template %: cláusula 7.1(d) esperada não encontrada exatamente uma vez', tid; END IF;
    IF (length(c) - length(replace(c, e_line, ''))) <> length(e_line) THEN RAISE EXCEPTION 'template %: item 7.1(e) esperado não encontrado exatamente uma vez', tid; END IF;
    c := replace(c, old_d, new_d);
    c := replace(c, e_line, e_line || E'\n\n' || extra);
    UPDATE public.contract_templates SET content = c, updated_at = now() WHERE id = tid;
  END LOOP;
END $$;
