-- Distratos (com e sem multa): Cláusula Terceira passa a "Da quitação e da preservação da imagem". SOMENTE contract_templates (2 modelos), apenas distratos NOVOS.
-- Não toca contracts/contract_html. Backup em contract_templates_backup_distrato_20261024. Aborta se o texto esperado não bater; idempotente.
-- Recomenda-se revisão por advogado antes de aplicar (multa de R$ 10.000 sujeita a redução equitativa, CC art. 413).
CREATE TABLE IF NOT EXISTS public.contract_templates_backup_distrato_20261024 (
  id uuid PRIMARY KEY, name text, content text, backed_up_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_templates_backup_distrato_20261024 ENABLE ROW LEVEL SECURITY;

INSERT INTO public.contract_templates_backup_distrato_20261024 (id, name, content)
SELECT id, name, content FROM public.contract_templates
WHERE id IN ('6c823215-c802-408a-a454-868eea9223ce', '1b9289e7-7839-4b40-af78-f82e10c3efcd')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  tid uuid; c text; s int; e int; old_block text;
  m3 constant text := $t$CLÁUSULA TERCEIRA – DA VEDAÇÃO A RECLAMAÇÕES E MEDIDAS ADVERSAS$t$;
  m4 constant text := $t$CLÁUSULA QUARTA – DA CONFIDENCIALIDADE$t$;
  new_block constant text := $t$CLÁUSULA TERCEIRA – DA QUITAÇÃO E DA PRESERVAÇÃO DA IMAGEM

3.1. Com a assinatura deste distrato, a CONTRATANTE declara ter recebido da CONTRATADA todos os serviços prestados até esta data, dá plena, geral e irrevogável quitação quanto ao Contrato Original e renuncia a pretensões de qualquer natureza relativas a ele, ressalvadas as obrigações previstas neste instrumento. Ficam ressalvados os direitos que a lei não permite renunciar e o direito de ação por fatos posteriores à assinatura.

3.2. A CONTRATANTE obriga-se a não divulgar, em redes sociais, sites de reclamação, imprensa, aplicativos de mensagens em grupo ou qualquer outro meio público, conteúdo ofensivo, injurioso, difamatório ou que impute à CONTRATADA, a seus sócios ou prepostos fatos inverídicos relacionados ao Contrato Original ou a este distrato.

3.3. O descumprimento do item 3.2, comprovado, sujeita a CONTRATANTE ao pagamento de multa de R$ 10.000,00 (dez mil reais), a título de cláusula penal pelos danos à imagem e à reputação da CONTRATADA, sem prejuízo da remoção do conteúdo em até 48 (quarenta e oito) horas da notificação. As partes reconhecem a multa como proporcional à finalidade desta cláusula, ficando ressalvada a redução equitativa prevista em lei.

3.4. Esta cláusula não impede o acesso da CONTRATANTE ao Poder Judiciário, a órgãos de defesa do consumidor ou a autoridades, nem a divulgação de informação verdadeira e não ofensiva.

$t$;
BEGIN
  FOREACH tid IN ARRAY ARRAY['6c823215-c802-408a-a454-868eea9223ce'::uuid, '1b9289e7-7839-4b40-af78-f82e10c3efcd'::uuid] LOOP
    SELECT content INTO c FROM public.contract_templates WHERE id = tid;
    IF c IS NULL THEN RAISE EXCEPTION 'template % não encontrado', tid; END IF;
    IF position('DA QUITAÇÃO E DA PRESERVAÇÃO DA IMAGEM' in c) > 0 THEN CONTINUE; END IF;
    IF (length(c) - length(replace(c, m3, ''))) <> length(m3) THEN RAISE EXCEPTION 'template %: título da cláusula terceira esperado não encontrado exatamente uma vez', tid; END IF;
    IF (length(c) - length(replace(c, m4, ''))) <> length(m4) THEN RAISE EXCEPTION 'template %: título da cláusula quarta esperado não encontrado exatamente uma vez', tid; END IF;
    s := position(m3 in c); e := position(m4 in c);
    IF e <= s THEN RAISE EXCEPTION 'template %: ordem das cláusulas inesperada', tid; END IF;
    old_block := substr(c, s, e - s);
    IF position('3.1. A CONTRATANTE, ao assinar o presente instrumento' in old_block) = 0
       OR position('3.2. A CONTRATANTE se compromete a abster-se' in old_block) = 0
       OR length(old_block) > 3000 THEN RAISE EXCEPTION 'template %: conteúdo atual da cláusula terceira não é o esperado', tid; END IF;
    c := substr(c, 1, s - 1) || new_block || substr(c, e);
    UPDATE public.contract_templates SET content = c, updated_at = now() WHERE id = tid;
  END LOOP;
END $$;
