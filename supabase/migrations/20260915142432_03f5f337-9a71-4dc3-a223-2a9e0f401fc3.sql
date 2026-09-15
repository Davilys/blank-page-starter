CREATE OR REPLACE FUNCTION public.classificar_situacao_cobranca(
  p_status text,
  p_due_date date,
  p_sync_status text
) RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(lower(trim(p_sync_status)), 'ativa') <> 'ativa' THEN NULL
    WHEN lower(trim(COALESCE(p_status, ''))) IN (
      'canceled','cancelled','deleted','removida_asaas','refunded','refund_requested',
      'refund_in_progress','chargeback','chargeback_requested','chargeback_dispute',
      'awaiting_chargeback_reversal'
    ) THEN NULL
    WHEN lower(trim(COALESCE(p_status, ''))) = 'confirmed' THEN 'confirmadas'
    WHEN lower(trim(COALESCE(p_status, ''))) IN (
      'received','received_in_cash','dunning_received','paid'
    ) THEN 'recebidas'
    WHEN lower(trim(COALESCE(p_status, ''))) IN ('overdue','dunning_requested')
      OR (p_due_date IS NOT NULL AND p_due_date < CURRENT_DATE) THEN 'vencidas'
    ELSE 'aguardando'
  END
$$;

REVOKE ALL ON FUNCTION public.classificar_situacao_cobranca(text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classificar_situacao_cobranca(text, date, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_billing_situation(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_owner uuid DEFAULT NULL,
  p_account text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_client uuid DEFAULT NULL,
  p_origin text DEFAULT NULL,
  p_due_from date DEFAULT NULL,
  p_due_to date DEFAULT NULL,
  p_payment_from date DEFAULT NULL,
  p_payment_to date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  WITH filtered AS (
    SELECT
      i.id,
      i.user_id,
      i.amount,
      i.payment_method,
      i.due_date,
      i.payment_date,
      public.classificar_situacao_cobranca(i.status, i.due_date, i.sync_status) AS situacao,
      CASE
        WHEN public.classificar_situacao_cobranca(i.status, i.due_date, i.sync_status) IN ('recebidas','confirmadas')
          THEN COALESCE(i.payment_date, i.due_date, i.created_at::date)
        ELSE COALESCE(i.due_date, i.created_at::date)
      END AS reference_date
    FROM public.invoices i
    LEFT JOIN public.profiles p ON p.id = i.user_id
    WHERE (p_owner IS NULL OR p.assigned_to = p_owner OR p.created_by = p_owner)
      AND (p_account IS NULL OR p_account = '' OR i.asaas_customer_id = p_account)
      AND (p_payment_method IS NULL OR p_payment_method = '' OR lower(COALESCE(i.payment_method, '')) = lower(p_payment_method))
      AND (p_client IS NULL OR i.user_id = p_client)
      AND (p_origin IS NULL OR p_origin = '' OR lower(COALESCE(i.origem, 'interna')) = lower(p_origin))
      AND (p_due_from IS NULL OR i.due_date >= p_due_from)
      AND (p_due_to IS NULL OR i.due_date <= p_due_to)
      AND (p_payment_from IS NULL OR i.payment_date >= p_payment_from)
      AND (p_payment_to IS NULL OR i.payment_date <= p_payment_to)
  ), valid AS (
    SELECT * FROM filtered
    WHERE situacao IS NOT NULL
      AND (p_from IS NULL OR reference_date >= p_from)
      AND (p_to IS NULL OR reference_date <= p_to)
  ), categories(situacao) AS (
    VALUES ('recebidas'::text), ('confirmadas'), ('aguardando'), ('vencidas')
  ), category_totals AS (
    SELECT
      c.situacao,
      COALESCE(sum(v.amount), 0)::numeric AS gross_amount,
      count(DISTINCT v.user_id)::bigint AS clients_count,
      count(v.id)::bigint AS invoices_count
    FROM categories c
    LEFT JOIN valid v ON v.situacao = c.situacao
    GROUP BY c.situacao
  ), composition AS (
    SELECT situacao,
      jsonb_agg(jsonb_build_object(
        'key', subdivision,
        'label', subdivision_label,
        'amount', amount,
        'count', invoice_count
      ) ORDER BY subdivision_order) AS items
    FROM (
      SELECT situacao,
        CASE
          WHEN situacao IN ('recebidas','confirmadas') THEN COALESCE(NULLIF(lower(payment_method), ''), 'nao_informado')
          WHEN situacao = 'aguardando' THEN CASE
            WHEN due_date = CURRENT_DATE THEN 'vence_hoje'
            WHEN due_date <= CURRENT_DATE + 7 THEN 'proximos_7_dias'
            ELSE 'mais_de_7_dias' END
          ELSE CASE
            WHEN CURRENT_DATE - due_date <= 30 THEN 'ate_30_dias'
            WHEN CURRENT_DATE - due_date <= 60 THEN '31_a_60_dias'
            WHEN CURRENT_DATE - due_date <= 90 THEN '61_a_90_dias'
            ELSE 'mais_de_90_dias' END
        END AS subdivision,
        CASE
          WHEN situacao IN ('recebidas','confirmadas') THEN CASE COALESCE(NULLIF(lower(payment_method), ''), 'nao_informado')
            WHEN 'pix' THEN 'Pix' WHEN 'boleto' THEN 'Boleto' WHEN 'credit_card' THEN 'Cartão'
            WHEN 'cartao' THEN 'Cartão' ELSE 'Não informado' END
          WHEN situacao = 'aguardando' THEN CASE
            WHEN due_date = CURRENT_DATE THEN 'Vence hoje'
            WHEN due_date <= CURRENT_DATE + 7 THEN 'Próximos 7 dias'
            ELSE 'Após 7 dias' END
          ELSE CASE
            WHEN CURRENT_DATE - due_date <= 30 THEN 'Até 30 dias'
            WHEN CURRENT_DATE - due_date <= 60 THEN '31 a 60 dias'
            WHEN CURRENT_DATE - due_date <= 90 THEN '61 a 90 dias'
            ELSE 'Mais de 90 dias' END
        END AS subdivision_label,
        CASE
          WHEN situacao IN ('recebidas','confirmadas') THEN CASE COALESCE(NULLIF(lower(payment_method), ''), 'nao_informado')
            WHEN 'pix' THEN 1 WHEN 'boleto' THEN 2 WHEN 'credit_card' THEN 3 WHEN 'cartao' THEN 3 ELSE 4 END
          WHEN situacao = 'aguardando' THEN CASE WHEN due_date = CURRENT_DATE THEN 1 WHEN due_date <= CURRENT_DATE + 7 THEN 2 ELSE 3 END
          ELSE CASE WHEN CURRENT_DATE - due_date <= 30 THEN 1 WHEN CURRENT_DATE - due_date <= 60 THEN 2 WHEN CURRENT_DATE - due_date <= 90 THEN 3 ELSE 4 END
        END AS subdivision_order,
        sum(amount)::numeric AS amount,
        count(*)::bigint AS invoice_count
      FROM valid
      GROUP BY situacao, subdivision, subdivision_label, subdivision_order
    ) grouped
    GROUP BY situacao
  ), series AS (
    SELECT reference_date AS day,
      sum(amount) FILTER (WHERE situacao = 'recebidas')::numeric AS recebidas,
      sum(amount) FILTER (WHERE situacao = 'confirmadas')::numeric AS confirmadas,
      sum(amount) FILTER (WHERE situacao = 'aguardando')::numeric AS aguardando,
      sum(amount) FILTER (WHERE situacao = 'vencidas')::numeric AS vencidas
    FROM valid
    GROUP BY reference_date
    ORDER BY reference_date
  )
  SELECT jsonb_build_object(
    'total', COALESCE((SELECT sum(gross_amount) FROM category_totals), 0),
    'net_available', false,
    'categories', (SELECT jsonb_object_agg(
      ct.situacao,
      jsonb_build_object(
        'gross_amount', ct.gross_amount,
        'net_amount', NULL,
        'clients_count', ct.clients_count,
        'invoices_count', ct.invoices_count,
        'composition', COALESCE(cp.items, '[]'::jsonb)
      )
    ) FROM category_totals ct LEFT JOIN composition cp USING (situacao)),
    'series', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'date', day,
      'recebidas', COALESCE(recebidas, 0),
      'confirmadas', COALESCE(confirmadas, 0),
      'aguardando', COALESCE(aguardando, 0),
      'vencidas', COALESCE(vencidas, 0)
    ) ORDER BY day) FROM series), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_billing_situation(date, date, uuid, text, text, uuid, text, date, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_billing_situation(date, date, uuid, text, text, uuid, text, date, date, date, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_invoices_list_filtered(
  p_search text DEFAULT NULL,
  p_situation text DEFAULT 'all',
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_owner uuid DEFAULT NULL,
  p_sort text DEFAULT 'cliente',
  p_dir text DEFAULT 'asc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_account text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_client uuid DEFAULT NULL,
  p_origin text DEFAULT NULL,
  p_due_from date DEFAULT NULL,
  p_due_to date DEFAULT NULL,
  p_payment_from date DEFAULT NULL,
  p_payment_to date DEFAULT NULL
) RETURNS TABLE(
  id uuid, description text, amount numeric, due_date date, status text,
  classificacao text, payment_date date, user_id uuid, invoice_url text,
  pix_code text, payment_method text, created_at timestamptz, sync_status text,
  origem text, asaas_invoice_id text, cliente_nome text, cliente_email text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dir text := CASE WHEN lower(COALESCE(p_dir, 'asc')) = 'desc' THEN 'DESC' ELSE 'ASC' END;
  v_order text;
  v_sql text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  v_order := CASE lower(COALESCE(p_sort, 'cliente'))
    WHEN 'descricao' THEN format('public.nome_ordenavel(f.description) %s, f.due_date ASC', v_dir)
    WHEN 'valor' THEN format('f.amount %s, f.nome_ord ASC', v_dir)
    WHEN 'metodo' THEN format('lower(COALESCE(f.payment_method, %L)) %s, f.nome_ord ASC', '', v_dir)
    WHEN 'vencimento' THEN format('f.due_date %s NULLS LAST, f.nome_ord ASC', v_dir)
    WHEN 'status' THEN format('f.classificacao %s, f.due_date ASC', v_dir)
    ELSE format('f.nome_ord %s, f.ordem_status ASC, f.due_date ASC', v_dir)
  END;

  v_sql := format($q$
    WITH base AS (
      SELECT i.id, i.description, i.amount, i.due_date, i.status, i.payment_date, i.user_id,
        i.invoice_url, i.pix_code, i.payment_method, i.created_at, i.sync_status, i.origem,
        i.asaas_invoice_id, p.full_name AS cliente_nome, p.email AS cliente_email,
        public.classificar_situacao_cobranca(i.status, i.due_date, i.sync_status) AS classificacao,
        public.nome_ordenavel(COALESCE(p.full_name, p.email, 'zzzz')) AS nome_ord,
        CASE public.classificar_situacao_cobranca(i.status, i.due_date, i.sync_status)
          WHEN 'vencidas' THEN 0 WHEN 'aguardando' THEN 1 WHEN 'confirmadas' THEN 2
          WHEN 'recebidas' THEN 3 ELSE 4 END AS ordem_status,
        CASE
          WHEN public.classificar_situacao_cobranca(i.status, i.due_date, i.sync_status) IN ('recebidas','confirmadas')
            THEN COALESCE(i.payment_date, i.due_date, i.created_at::date)
          ELSE COALESCE(i.due_date, i.created_at::date)
        END AS reference_date
      FROM public.invoices i
      LEFT JOIN public.profiles p ON p.id = i.user_id
      WHERE ($1 IS NULL OR p.assigned_to = $1 OR p.created_by = $1)
        AND ($2 IS NULL OR $2 = '' OR i.asaas_customer_id = $2)
        AND ($3 IS NULL OR $3 = '' OR lower(COALESCE(i.payment_method, '')) = lower($3))
        AND ($4 IS NULL OR i.user_id = $4)
        AND ($5 IS NULL OR $5 = '' OR lower(COALESCE(i.origem, 'interna')) = lower($5))
        AND ($6 IS NULL OR i.due_date >= $6) AND ($7 IS NULL OR i.due_date <= $7)
        AND ($8 IS NULL OR i.payment_date >= $8) AND ($9 IS NULL OR i.payment_date <= $9)
        AND ($10 IS NULL OR $10 = '' OR
          public.nome_ordenavel(p.full_name) LIKE '%%' || public.nome_ordenavel($10) || '%%' OR
          lower(COALESCE(p.email, '')) LIKE '%%' || lower($10) || '%%' OR
          public.nome_ordenavel(i.description) LIKE '%%' || public.nome_ordenavel($10) || '%%' OR
          lower(COALESCE(i.asaas_invoice_id, '')) LIKE '%%' || lower($10) || '%%' OR
          (regexp_replace($10, '[^0-9]', '', 'g') <> '' AND regexp_replace(COALESCE(p.cpf_cnpj, ''), '[^0-9]', '', 'g') LIKE '%%' || regexp_replace($10, '[^0-9]', '', 'g') || '%%'))
    ), f AS (
      SELECT * FROM base
      WHERE classificacao IS NOT NULL
        AND ($11 = 'all' OR classificacao = $11)
        AND ($12 IS NULL OR reference_date >= $12)
        AND ($13 IS NULL OR reference_date <= $13)
    )
    SELECT f.id, f.description, f.amount, f.due_date, f.status, f.classificacao,
      f.payment_date, f.user_id, f.invoice_url, f.pix_code, f.payment_method,
      f.created_at, f.sync_status, f.origem, f.asaas_invoice_id,
      f.cliente_nome, f.cliente_email, count(*) OVER() AS total_count
    FROM f ORDER BY %s LIMIT $14 OFFSET $15
  $q$, v_order);

  RETURN QUERY EXECUTE v_sql USING
    p_owner, p_account, p_payment_method, p_client, p_origin,
    p_due_from, p_due_to, p_payment_from, p_payment_to, p_search,
    COALESCE(p_situation, 'all'), p_from, p_to,
    GREATEST(COALESCE(p_limit, 50), 1), GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_invoices_list_filtered(text, text, date, date, uuid, text, text, integer, integer, text, text, uuid, text, date, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_invoices_list_filtered(text, text, date, date, uuid, text, text, integer, integer, text, text, uuid, text, date, date, date, date) TO authenticated, service_role;