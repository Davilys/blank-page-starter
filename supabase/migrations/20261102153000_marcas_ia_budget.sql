-- Marcas IA (BrandBot): budget duro de US$10 total com reserva atômica.
-- Regras (grant usuário 02/11 15:23): reserva usa LIMITE SUPERIOR de tokens
-- (input+output+imagem+retries), inteiro em centavos arredondado para cima,
-- reserva de chamada que falha NÃO é devolvida, enforcement atômico.

CREATE TABLE IF NOT EXISTS public.marcas_ia_budget (
  id boolean PRIMARY KEY DEFAULT true CONSTRAINT marcas_ia_budget_single CHECK (id),
  spent_cents integer NOT NULL DEFAULT 0 CHECK (spent_cents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.marcas_ia_budget (id, spent_cents)
VALUES (true, 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.marcas_ia_spend_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id text NOT NULL,
  action text NOT NULL,
  reserved_cents integer NOT NULL CHECK (reserved_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Reserva atômica: UM único UPDATE condicional por escopo, sob lock de linha.
-- Retorna ok=false quando o limite (total ou sessão) seria excedido — nenhum
-- centavo é debitado nesse caso. Concorrência: o UPDATE ... WHERE serialized
-- pelo row lock garante que dois chamadores simultâneos não ultrapassem o cap.
DROP FUNCTION IF EXISTS public.marcas_ia_spend(integer, text, integer, integer);

CREATE OR REPLACE FUNCTION public.marcas_ia_spend(
  p_amount_cents integer,
  p_session_id text,
  p_action text,
  p_cap_total_cents integer,
  p_cap_session_cents integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_total integer;
  v_session_spent integer;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;

  -- Lock da linha única do budget + débito condicional atômico.
  UPDATE public.marcas_ia_budget
     SET spent_cents = spent_cents + p_amount_cents,
         updated_at = now()
   WHERE id = true
     AND spent_cents + p_amount_cents <= p_cap_total_cents
  RETURNING spent_cents INTO v_new_total;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cap_total');
  END IF;

  -- Cap por sessão (soma inclui a reserva recém-debitada; em caso de estouro,
  -- estorna a reserva total — falha ANTES de qualquer chamada paga, sem
  -- ambiguidade de refund porque nada foi gasto de fato).
  SELECT COALESCE(SUM(reserved_cents), 0) INTO v_session_spent
    FROM public.marcas_ia_spend_log
   WHERE session_id = p_session_id;

  IF v_session_spent + p_amount_cents > p_cap_session_cents THEN
    UPDATE public.marcas_ia_budget
       SET spent_cents = spent_cents - p_amount_cents,
           updated_at = now()
     WHERE id = true;
    RETURN jsonb_build_object('ok', false, 'reason', 'cap_session');
  END IF;

  INSERT INTO public.marcas_ia_spend_log (session_id, action, reserved_cents)
  VALUES (p_session_id, left(coalesce(p_action, ''), 32), p_amount_cents);

  RETURN jsonb_build_object('ok', true, 'spent_cents', v_new_total, 'cap_total_cents', p_cap_total_cents);
END;
$$;

REVOKE ALL ON FUNCTION public.marcas_ia_spend(integer, text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marcas_ia_spend(integer, text, text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.marcas_ia_spend(integer, text, text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.marcas_ia_spend(integer, text, text, integer, integer) TO service_role;

REVOKE ALL ON TABLE public.marcas_ia_budget FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.marcas_ia_spend_log FROM PUBLIC, anon, authenticated;
