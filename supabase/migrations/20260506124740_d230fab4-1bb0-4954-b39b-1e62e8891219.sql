
CREATE OR REPLACE FUNCTION public.only_digits(s text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(COALESCE(s,''), '[^0-9]', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.resolve_contract_user_id(
  _signatory_name text,
  _signatory_cpf text,
  _signatory_cnpj text
) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cpf text := only_digits(_signatory_cpf);
  v_cnpj text := only_digits(_signatory_cnpj);
  v_id uuid;
  v_count int;
BEGIN
  -- 1) CPF
  IF length(v_cpf) = 11 THEN
    SELECT COUNT(*) INTO v_count FROM profiles
      WHERE only_digits(cpf) = v_cpf OR only_digits(cpf_cnpj) = v_cpf;
    IF v_count = 1 THEN
      SELECT id INTO v_id FROM profiles
        WHERE only_digits(cpf) = v_cpf OR only_digits(cpf_cnpj) = v_cpf
        LIMIT 1;
      RETURN v_id;
    END IF;
  END IF;

  -- 2) CNPJ
  IF length(v_cnpj) = 14 THEN
    SELECT COUNT(*) INTO v_count FROM profiles
      WHERE only_digits(cnpj) = v_cnpj OR only_digits(cpf_cnpj) = v_cnpj;
    IF v_count = 1 THEN
      SELECT id INTO v_id FROM profiles
        WHERE only_digits(cnpj) = v_cnpj OR only_digits(cpf_cnpj) = v_cnpj
        LIMIT 1;
      RETURN v_id;
    END IF;
  END IF;

  -- 3) Nome (case-insensitive, único)
  IF _signatory_name IS NOT NULL AND length(trim(_signatory_name)) >= 3 THEN
    SELECT COUNT(*) INTO v_count FROM profiles
      WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(_signatory_name));
    IF v_count = 1 THEN
      SELECT id INTO v_id FROM profiles
        WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(_signatory_name))
        LIMIT 1;
      RETURN v_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

UPDATE contracts c
SET user_id = public.resolve_contract_user_id(c.signatory_name, c.signatory_cpf, c.signatory_cnpj)
WHERE c.user_id IS NULL
  AND public.resolve_contract_user_id(c.signatory_name, c.signatory_cpf, c.signatory_cnpj) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.contracts_auto_link_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := public.resolve_contract_user_id(NEW.signatory_name, NEW.signatory_cpf, NEW.signatory_cnpj);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contracts_auto_link_user ON public.contracts;
CREATE TRIGGER trg_contracts_auto_link_user
  BEFORE INSERT OR UPDATE OF signatory_name, signatory_cpf, signatory_cnpj, user_id
  ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.contracts_auto_link_user();
