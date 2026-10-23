voices_list(text, text, date, date, uuid, text, text, integer, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_invoices_totals(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_invoices_totals(date, date, uuid) TO authenticated, service_role;;

-- END MIGRATION 20260915134433

-- BEGIN MIGRATION 20260915134613 20260915134613_ceb0e543-d647-496a-88e5-e4b0986d2a68.sql sha256=e0309a62cc5619a9299d9c511e448302c30d4b813663199044041ff1306f68c1
CREATE OR REPLACE FUNCTION public.profiles_by_doc_digits(p_doc text)
RETURNS TABLE(id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.profiles p
  WHERE regexp_replace(COALESCE(p.cpf_cnpj, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(p_doc, ''), '[^0-9]', '', 'g')
    AND regexp_replace(COALESCE(p_doc, ''), '[^0-9]', '', 'g') <> ''
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.profiles_by_doc_digits(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profiles_by_doc_digits(text) TO service_role;;

-- END MIGRATION 20260915134613

-- BEGIN MIGRATION 20260915142432 20260915142432_03f5f337-9a71-4dc3-a223-2a9e0f401fc3.sql sha256=291d8d35f0424ec58eeebb63e91e73409a31761cba0e703899879ff1187b4225
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
GRANT EXECUTE ON FUNCTION public.admin_invoices_list_filtered(text, text, date, date, uuid, text, text, integer, integer, text, text, uuid, text, date, date, date, date) TO authenticated, service_role;;

-- END MIGRATION 20260915142432

-- BEGIN MIGRATION 20260915142750 20260915142750_82b21db0-a4f4-4ebe-9610-1a330181753d.sql sha256=fdfb271e19a33ef8402c57d6c9d882c30446079d8ebca3c67217dab66b8e1fac
REVOKE ALL ON FUNCTION public.classificar_situacao_cobranca(text, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.classificar_situacao_cobranca(text, date, text) TO service_role;

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
DECLARE v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  WITH filtered AS (
    SELECT i.id, i.user_id, i.amount, i.payment_method, i.due_date, i.payment_date,
      public.classificar_situacao_cobranca(i.status, i.due_date, i.sync_status) AS situacao,
      CASE WHEN public.classificar_situacao_cobranca(i.status, i.due_date, i.sync_status) IN ('recebidas','confirmadas')
        THEN COALESCE(i.payment_date, i.due_date, i.created_at::date) ELSE COALESCE(i.due_date, i.created_at::date) END AS reference_date
    FROM public.invoices i LEFT JOIN public.profiles p ON p.id = i.user_id
    WHERE (p_owner IS NULL OR p.assigned_to = p_owner OR p.created_by = p_owner)
      AND (p_account IS NULL OR p_account = '' OR i.asaas_customer_id = p_account)
      AND (p_payment_method IS NULL OR p_payment_method = '' OR lower(COALESCE(i.payment_method, '')) = lower(p_payment_method))
      AND (p_client IS NULL OR i.user_id = p_client)
      AND (p_origin IS NULL OR p_origin = '' OR lower(COALESCE(i.origem, 'interna')) = lower(p_origin))
      AND (p_due_from IS NULL OR i.due_date >= p_due_from) AND (p_due_to IS NULL OR i.due_date <= p_due_to)
      AND (p_payment_from IS NULL OR i.payment_date >= p_payment_from) AND (p_payment_to IS NULL OR i.payment_date <= p_payment_to)
  ), valid AS (
    SELECT * FROM filtered WHERE situacao IS NOT NULL AND (p_from IS NULL OR reference_date >= p_from) AND (p_to IS NULL OR reference_date <= p_to)
  ), categories(situacao) AS (VALUES ('recebidas'::text), ('confirmadas'), ('aguardando'), ('vencidas')),
  category_totals AS (
    SELECT c.situacao, COALESCE(sum(v.amount), 0)::numeric gross_amount, count(DISTINCT v.user_id)::bigint clients_count, count(v.id)::bigint invoices_count
    FROM categories c LEFT JOIN valid v ON v.situacao = c.situacao GROUP BY c.situacao
  ), composition AS (
    SELECT situacao, jsonb_agg(jsonb_build_object('key', subdivision, 'label', subdivision_label, 'amount', amount, 'count', invoice_count) ORDER BY subdivision_order) items
    FROM (
      SELECT situacao,
        CASE WHEN situacao IN ('recebidas','confirmadas') THEN COALESCE(NULLIF(lower(payment_method), ''), 'nao_informado')
          WHEN situacao = 'aguardando' THEN CASE WHEN due_date = CURRENT_DATE THEN 'vence_hoje' WHEN due_date <= CURRENT_DATE + 7 THEN 'proximos_7_dias' ELSE 'mais_de_7_dias' END
          ELSE CASE WHEN CURRENT_DATE - due_date <= 30 THEN 'ate_30_dias' WHEN CURRENT_DATE - due_date <= 60 THEN '31_a_60_dias' WHEN CURRENT_DATE - due_date <= 90 THEN '61_a_90_dias' ELSE 'mais_de_90_dias' END END subdivision,
        CASE WHEN situacao IN ('recebidas','confirmadas') THEN CASE COALESCE(NULLIF(lower(payment_method), ''), 'nao_informado') WHEN 'pix' THEN 'Pix' WHEN 'boleto' THEN 'Boleto' WHEN 'credit_card' THEN 'Cartão' WHEN 'cartao' THEN 'Cartão' ELSE 'Não informado' END
          WHEN situacao = 'aguardando' THEN CASE WHEN due_date = CURRENT_DATE THEN 'Vence hoje' WHEN due_date <= CURRENT_DATE + 7 THEN 'Próximos 7 dias' ELSE 'Após 7 dias' END
          ELSE CASE WHEN CURRENT_DATE - due_date <= 30 THEN 'Até 30 dias' WHEN CURRENT_DATE - due_date <= 60 THEN '31 a 60 dias' WHEN CURRENT_DATE - due_date <= 90 THEN '61 a 90 dias' ELSE 'Mais de 90 dias' END END subdivision_label,
        CASE WHEN situacao IN ('recebidas','confirmadas') THEN CASE COALESCE(NULLIF(lower(payment_method), ''), 'nao_informado') WHEN 'pix' THEN 1 WHEN 'boleto' THEN 2 WHEN 'credit_card' THEN 3 WHEN 'cartao' THEN 3 ELSE 4 END
          WHEN situacao = 'aguardando' THEN CASE WHEN due_date = CURRENT_DATE THEN 1 WHEN due_date <= CURRENT_DATE + 7 THEN 2 ELSE 3 END
          ELSE CASE WHEN CURRENT_DATE - due_date <= 30 THEN 1 WHEN CURRENT_DATE - due_date <= 60 THEN 2 WHEN CURRENT_DATE - due_date <= 90 THEN 3 ELSE 4 END END subdivision_order,
        sum(amount)::numeric amount, count(*)::bigint invoice_count FROM valid GROUP BY situacao, subdivision, subdivision_label, subdivision_order
    ) grouped GROUP BY situacao
  ), series AS (
    SELECT reference_date AS series_date, sum(amount) FILTER (WHERE situacao='recebidas')::numeric recebidas,
      sum(amount) FILTER (WHERE situacao='confirmadas')::numeric confirmadas, sum(amount) FILTER (WHERE situacao='aguardando')::numeric aguardando,
      sum(amount) FILTER (WHERE situacao='vencidas')::numeric vencidas FROM valid GROUP BY reference_date ORDER BY reference_date
  )
  SELECT jsonb_build_object('total', COALESCE((SELECT sum(gross_amount) FROM category_totals),0), 'net_available',false,
    'categories',(SELECT jsonb_object_agg(ct.situacao,jsonb_build_object('gross_amount',ct.gross_amount,'net_amount',NULL,'clients_count',ct.clients_count,'invoices_count',ct.invoices_count,'composition',COALESCE(cp.items,'[]'::jsonb))) FROM category_totals ct LEFT JOIN composition cp USING(situacao)),
    'series',COALESCE((SELECT jsonb_agg(jsonb_build_object('date',series_date,'recebidas',COALESCE(recebidas,0),'confirmadas',COALESCE(confirmadas,0),'aguardando',COALESCE(aguardando,0),'vencidas',COALESCE(vencidas,0)) ORDER BY series_date) FROM series),'[]'::jsonb)) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_billing_situation(date, date, uuid, text, text, uuid, text, date, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_billing_situation(date, date, uuid, text, text, uuid, text, date, date, date, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_invoices_list_filtered(
  p_search text DEFAULT NULL, p_situation text DEFAULT 'all', p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_owner uuid DEFAULT NULL, p_sort text DEFAULT 'cliente', p_dir text DEFAULT 'asc', p_limit integer DEFAULT 50, p_offset integer DEFAULT 0,
  p_account text DEFAULT NULL, p_payment_method text DEFAULT NULL, p_client uuid DEFAULT NULL, p_origin text DEFAULT NULL,
  p_due_from date DEFAULT NULL, p_due_to date DEFAULT NULL, p_payment_from date DEFAULT NULL, p_payment_to date DEFAULT NULL
) RETURNS TABLE(id uuid, description text, amount numeric, due_date date, status text, classificacao text, payment_date date, user_id uuid, invoice_url text, pix_code text, payment_method text, created_at timestamptz, sync_status text, origem text, asaas_invoice_id text, cliente_nome text, cliente_email text, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_dir text:=CASE WHEN lower(COALESCE(p_dir,'asc'))='desc' THEN 'DESC' ELSE 'ASC' END; v_order text; v_sql text;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
 v_order:=CASE lower(COALESCE(p_sort,'cliente')) WHEN 'descricao' THEN format('public.nome_ordenavel(f.description) %s, f.due_date ASC',v_dir) WHEN 'valor' THEN format('f.amount %s, f.nome_ord ASC',v_dir) WHEN 'metodo' THEN format('lower(COALESCE(f.payment_method,%L)) %s, f.nome_ord ASC','',v_dir) WHEN 'vencimento' THEN format('f.due_date %s NULLS LAST, f.nome_ord ASC',v_dir) WHEN 'status' THEN format('f.classificacao %s, f.due_date ASC',v_dir) ELSE format('f.nome_ord %s, f.ordem_status ASC, f.due_date ASC',v_dir) END;
 v_sql:=format($q$ WITH base AS (
  SELECT i.id,i.description,i.amount,i.due_date,i.status,i.payment_date,i.user_id,i.invoice_url,i.pix_code,i.payment_method,i.created_at,i.sync_status,i.origem,i.asaas_invoice_id,p.full_name cliente_nome,p.email cliente_email,
   public.classificar_situacao_cobranca(i.status,i.due_date,i.sync_status) classificacao,public.nome_ordenavel(COALESCE(p.full_name,p.email,'zzzz')) nome_ord,
   CASE public.classificar_situacao_cobranca(i.status,i.due_date,i.sync_status) WHEN 'vencidas' THEN 0 WHEN 'aguardando' THEN 1 WHEN 'confirmadas' THEN 2 WHEN 'recebidas' THEN 3 ELSE 4 END ordem_status,
   CASE WHEN public.classificar_situacao_cobranca(i.status,i.due_date,i.sync_status) IN ('recebidas','confirmadas') THEN COALESCE(i.payment_date,i.due_date,i.created_at::date) ELSE COALESCE(i.due_date,i.created_at::date) END reference_date
  FROM public.invoices i LEFT JOIN public.profiles p ON p.id=i.user_id WHERE ($1 IS NULL OR p.assigned_to=$1 OR p.created_by=$1) AND ($2 IS NULL OR $2='' OR i.asaas_customer_id=$2) AND ($3 IS NULL OR $3='' OR lower(COALESCE(i.payment_method,''))=lower($3)) AND ($4 IS NULL OR i.user_id=$4) AND ($5 IS NULL OR $5='' OR lower(COALESCE(i.origem,'interna'))=lower($5)) AND ($6 IS NULL OR i.due_date >= $6) AND ($7 IS NULL OR i.due_date <= $7) AND ($8 IS NULL OR i.payment_date >= $8) AND ($9 IS NULL OR i.payment_date <= $9) AND ($10 IS NULL OR $10='' OR public.nome_ordenavel(p.full_name) LIKE '%%'||public.nome_ordenavel($10)||'%%' OR lower(COALESCE(p.email,'')) LIKE '%%'||lower($10)||'%%' OR public.nome_ordenavel(i.description) LIKE '%%'||public.nome_ordenavel($10)||'%%' OR lower(COALESCE(i.asaas_invoice_id,'')) LIKE '%%'||lower($10)||'%%' OR (regexp_replace($10,'[^0-9]','','g')<>'' AND regexp_replace(COALESCE(p.cpf_cnpj,''),'[^0-9]','','g') LIKE '%%'||regexp_replace($10,'[^0-9]','','g')||'%%'))
 ), f AS (SELECT * FROM base WHERE classificacao IS NOT NULL AND ($11='all' OR classificacao=$11) AND ($12 IS NULL OR reference_date >= $12) AND ($13 IS NULL OR reference_date <= $13))
 SELECT f.id,f.description,f.amount,f.due_date,f.status,f.classificacao,f.payment_date,f.user_id,f.invoice_url,f.pix_code,f.payment_method,f.created_at,f.sync_status,f.origem,f.asaas_invoice_id,f.cliente_nome,f.cliente_email,count(*) OVER() total_count FROM f ORDER BY %s LIMIT $14 OFFSET $15 $q$,v_order);
 RETURN QUERY EXECUTE v_sql USING p_owner,p_account,p_payment_method,p_client,p_origin,p_due_from,p_due_to,p_payment_from,p_payment_to,p_search,COALESCE(p_situation,'all'),p_from,p_to,GREATEST(COALESCE(p_limit,50),1),GREATEST(COALESCE(p_offset,0),0);
END; $$;
REVOKE ALL ON FUNCTION public.admin_invoices_list_filtered(text, text, date, date, uuid, text, text, integer, integer, text, text, uuid, text, date, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_invoices_list_filtered(text, text, date, date, uuid, text, text, integer, integer, text, text, uuid, text, date, date, date, date) TO authenticated, service_role;;

-- END MIGRATION 20260915142750

-- BEGIN MIGRATION 20260915142924 20260915142924_ee663141-d5ae-449a-84c8-ef97a3b764f6.sql sha256=5abf7393ae3a7fc3280ec48a82a6c7949ed65edab6c81e8316e991bf83dbaf5e
CREATE OR REPLACE FUNCTION public.admin_invoices_list_filtered(
  p_search text DEFAULT NULL, p_situation text DEFAULT 'all', p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_owner uuid DEFAULT NULL, p_sort text DEFAULT 'cliente', p_dir text DEFAULT 'asc', p_limit integer DEFAULT 50, p_offset integer DEFAULT 0,
  p_account text DEFAULT NULL, p_payment_method text DEFAULT NULL, p_client uuid DEFAULT NULL, p_origin text DEFAULT NULL,
  p_due_from date DEFAULT NULL, p_due_to date DEFAULT NULL, p_payment_from date DEFAULT NULL, p_payment_to date DEFAULT NULL
) RETURNS TABLE(id uuid, description text, amount numeric, due_date date, status text, classificacao text, payment_date date, user_id uuid, invoice_url text, pix_code text, payment_method text, created_at timestamptz, sync_status text, origem text, asaas_invoice_id text, cliente_nome text, cliente_email text, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_dir text:=CASE WHEN lower(COALESCE(p_dir,'asc'))='desc' THEN 'DESC' ELSE 'ASC' END; v_order text; v_sql text;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
 v_order:=CASE lower(COALESCE(p_sort,'cliente')) WHEN 'descricao' THEN format('public.nome_ordenavel(f.description) %s, f.due_date ASC',v_dir) WHEN 'valor' THEN format('f.amount %s, f.nome_ord ASC',v_dir) WHEN 'metodo' THEN format('lower(COALESCE(f.payment_method,%L)) %s, f.nome_ord ASC','',v_dir) WHEN 'vencimento' THEN format('f.due_date %s NULLS LAST, f.nome_ord ASC',v_dir) WHEN 'status' THEN format('f.classificacao %s, f.due_date ASC',v_dir) ELSE format('f.nome_ord %s, f.ordem_status ASC, f.due_date ASC',v_dir) END;
 v_sql:=format($q$ WITH base AS (
  SELECT i.id,i.description,i.amount,i.due_date,i.status,i.payment_date,i.user_id,i.invoice_url,i.pix_code,i.payment_method,i.created_at,i.sync_status,i.origem,i.asaas_invoice_id,p.full_name cliente_nome,p.email cliente_email,
   COALESCE(public.classificar_situacao_cobranca(i.status,i.due_date,i.sync_status),'inativas') classificacao,public.nome_ordenavel(COALESCE(p.full_name,p.email,'zzzz')) nome_ord,
   CASE COALESCE(public.classificar_situacao_cobranca(i.status,i.due_date,i.sync_status),'inativas') WHEN 'vencidas' THEN 0 WHEN 'aguardando' THEN 1 WHEN 'confirmadas' THEN 2 WHEN 'recebidas' THEN 3 ELSE 4 END ordem_status,
   CASE WHEN public.classificar_situacao_cobranca(i.status,i.due_date,i.sync_status) IN ('recebidas','confirmadas') THEN COALESCE(i.payment_date,i.due_date,i.created_at::date) ELSE COALESCE(i.due_date,i.created_at::date) END reference_date
  FROM public.invoices i LEFT JOIN public.profiles p ON p.id=i.user_id WHERE ($1 IS NULL OR p.assigned_to=$1 OR p.created_by=$1) AND ($2 IS NULL OR $2='' OR i.asaas_customer_id=$2) AND ($3 IS NULL OR $3='' OR lower(COALESCE(i.payment_method,''))=lower($3)) AND ($4 IS NULL OR i.user_id=$4) AND ($5 IS NULL OR $5='' OR lower(COALESCE(i.origem,'interna'))=lower($5)) AND ($6 IS NULL OR i.due_date >= $6) AND ($7 IS NULL OR i.due_date <= $7) AND ($8 IS NULL OR i.payment_date >= $8) AND ($9 IS NULL OR i.payment_date <= $9) AND ($10 IS NULL OR $10='' OR public.nome_ordenavel(p.full_name) LIKE '%%'||public.nome_ordenavel($10)||'%%' OR lower(COALESCE(p.email,'')) LIKE '%%'||lower($10)||'%%' OR public.nome_ordenavel(i.description) LIKE '%%'||public.nome_ordenavel($10)||'%%' OR lower(COALESCE(i.asaas_invoice_id,'')) LIKE '%%'||lower($10)||'%%' OR (regexp_replace($10,'[^0-9]','','g')<>'' AND regexp_replace(COALESCE(p.cpf_cnpj,''),'[^0-9]','','g') LIKE '%%'||regexp_replace($10,'[^0-9]','','g')||'%%'))
 ), f AS (SELECT * FROM base WHERE ($11='all' OR classificacao=$11) AND ($12 IS NULL OR reference_date >= $12) AND ($13 IS NULL OR reference_date <= $13))
 SELECT f.id,f.description,f.amount,f.due_date,f.status,f.classificacao,f.payment_date,f.user_id,f.invoice_url,f.pix_code,f.payment_method,f.created_at,f.sync_status,f.origem,f.asaas_invoice_id,f.cliente_nome,f.cliente_email,count(*) OVER() total_count FROM f ORDER BY %s LIMIT $14 OFFSET $15 $q$,v_order);
 RETURN QUERY EXECUTE v_sql USING p_owner,p_account,p_payment_method,p_client,p_origin,p_due_from,p_due_to,p_payment_from,p_payment_to,p_search,COALESCE(p_situation,'all'),p_from,p_to,GREATEST(COALESCE(p_limit,50),1),GREATEST(COALESCE(p_offset,0),0);
END; $$;
REVOKE ALL ON FUNCTION public.admin_invoices_list_filtered(text, text, date, date, uuid, text, text, integer, integer, text, text, uuid, text, date, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_invoices_list_filtered(text, text, date, date, uuid, text, text, integer, integer, text, text, uuid, text, date, date, date, date) TO authenticated, service_role;;

-- END MIGRATION 20260915142924

-- BEGIN MIGRATION 20260915143004 20260915143004_05af9c55-8f43-4c84-b58a-8ab2a966e870.sql sha256=70e643d9d4cbc7d7e8ff04208bd4d1a2538ba670d6d182a24fe92d79cee48c82
CREATE OR REPLACE FUNCTION public.admin_asaas_accounts(p_owner uuid DEFAULT NULL)
RETURNS TABLE(asaas_customer_id text, cliente_nome text, cobrancas bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  RETURN QUERY
  SELECT i.asaas_customer_id,
         COALESCE(max(p.full_name), max(p.email), i.asaas_customer_id) AS cliente_nome,
         count(*)::bigint AS cobrancas
  FROM public.invoices i
  LEFT JOIN public.profiles p ON p.id = i.user_id
  WHERE i.asaas_customer_id IS NOT NULL
    AND trim(i.asaas_customer_id) <> ''
    AND (p_owner IS NULL OR p.assigned_to = p_owner OR p.created_by = p_owner)
  GROUP BY i.asaas_customer_id
  ORDER BY public.nome_ordenavel(COALESCE(max(p.full_name), max(p.email), i.asaas_customer_id));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_asaas_accounts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_asaas_accounts(uuid) TO authenticated, service_role;;

-- END MIGRATION 20260915143004

-- BEGIN MIGRATION 20260915165901 20260915165901_60e3c560-dc0b-4496-9d36-4014420e9eba.sql sha256=359836cdbc4835b48a9960ea47780e0327a2e616a32a1305eea52731cd344884

-- rpi_uploads: prévia, progresso e estatísticas
ALTER TABLE public.rpi_uploads
  ADD COLUMN IF NOT EXISTS is_preview boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parse_progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS parse_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_file_url text,
  ADD COLUMN IF NOT EXISTS total_mentions integer;

-- rpi_entries: auditoria de ocorrências e dados estruturais
ALTER TABLE public.rpi_entries
  ADD COLUMN IF NOT EXISTS occurrences_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS occurrences jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS relation_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS relation_primary text,
  ADD COLUMN IF NOT EXISTS relation_confidence numeric,
  ADD COLUMN IF NOT EXISTS is_destituicao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_nomeacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_substituicao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS procurador_anterior text,
  ADD COLUMN IF NOT EXISTS procurador_novo text,
  ADD COLUMN IF NOT EXISTS needs_human_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS deposit_date date,
  ADD COLUMN IF NOT EXISTS concession_date date,
  ADD COLUMN IF NOT EXISTS validity_date date,
  ADD COLUMN IF NOT EXISTS natureza text,
  ADD COLUMN IF NOT EXISTS apresentacao text,
  ADD COLUMN IF NOT EXISTS situacao_atual text,
  ADD COLUMN IF NOT EXISTS apostila text,
  ADD COLUMN IF NOT EXISTS titulares jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS requerentes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS procuradores jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dispatches jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS protocols jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ncl_specifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS vienna_classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS field_sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS match_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS process_block_hash text,
  ADD COLUMN IF NOT EXISTS source_file_ref text,
  ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'pendente';

CREATE UNIQUE INDEX IF NOT EXISTS rpi_entries_upload_process_uidx
  ON public.rpi_entries (rpi_upload_id, process_number);

CREATE INDEX IF NOT EXISTS rpi_entries_relation_primary_idx ON public.rpi_entries (relation_primary);
CREATE INDEX IF NOT EXISTS rpi_entries_enrichment_status_idx ON public.rpi_entries (enrichment_status);

-- Fila de complementação individual
CREATE TABLE IF NOT EXISTS public.rpi_enrichment_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rpi_entry_id uuid NOT NULL REFERENCES public.rpi_entries(id) ON DELETE CASCADE,
  process_number text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rpi_enrichment_queue_entry_uidx ON public.rpi_enrichment_queue (rpi_entry_id);
CREATE INDEX IF NOT EXISTS rpi_enrichment_queue_status_idx ON public.rpi_enrichment_queue (status, next_attempt_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rpi_enrichment_queue TO authenticated;
GRANT ALL ON public.rpi_enrichment_queue TO service_role;

ALTER TABLE public.rpi_enrichment_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam fila de enriquecimento"
  ON public.rpi_enrichment_queue FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rpi_enrichment_queue_updated_at
  BEFORE UPDATE ON public.rpi_enrichment_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
;

-- END MIGRATION 20260915165901

-- BEGIN MIGRATION 20260915180443 20260915180443_b4804e55-9a05-412d-aa86-4ba732827979.sql sha256=90b3e4adfe74be05739c4e57d146ef7fdc133c25172eccb2bda3e2c7b26f6214
CREATE TABLE public.rpi_process_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_number text NOT NULL UNIQUE,
  brand_name text,
  holder text,
  ncl_class text,
  current_status text,
  presentation text,
  nature text,
  class_status text,
  specification text,
  legal_representative text,
  priority_date text,
  filing_date text,
  grant_date text,
  expiry_date text,
  source_url text,
  source text,
  detail_status text,
  lookup_status text NOT NULL DEFAULT 'pending',
  queried_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rpi_process_lookups TO authenticated;
GRANT ALL ON public.rpi_process_lookups TO service_role;

ALTER TABLE public.rpi_process_lookups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view process lookups"
ON public.rpi_process_lookups FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rpi_process_lookups_updated_at
BEFORE UPDATE ON public.rpi_process_lookups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rpi_enrichment_field_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rpi_entry_id uuid NOT NULL REFERENCES public.rpi_entries(id) ON DELETE CASCADE,
  process_number text NOT NULL,
  field_name text NOT NULL,
  previous_value text,
  new_value text,
  applied_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rpi_enrichment_field_log_entry ON public.rpi_enrichment_field_log(rpi_entry_id);

GRANT SELECT ON public.rpi_enrichment_field_log TO authenticated;
GRANT ALL ON public.rpi_enrichment_field_log TO service_role;

ALTER TABLE public.rpi_enrichment_field_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view enrichment field log"
ON public.rpi_enrichment_field_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));;

-- END MIGRATION 20260915180443

-- BEGIN MIGRATION 20260915182529 20260915182529_31996f9f-f841-455d-b5d3-dea94a59092a.sql sha256=0daae8c524d54285cbd94f7f688303bf6f8d74a610a5124624ab271621cfe66d
ALTER TABLE public.rpi_entries ADD COLUMN IF NOT EXISTS auto_linked_at timestamptz;
ALTER TABLE public.rpi_entries ADD COLUMN IF NOT EXISTS auto_link_source text;
CREATE INDEX IF NOT EXISTS idx_brand_processes_process_number ON public.brand_processes (process_number);
CREATE INDEX IF NOT EXISTS idx_brand_processes_user_process ON public.brand_processes (user_id, process_number);;

-- END MIGRATION 20260915182529

-- BEGIN MIGRATION 20260915184437 20260915184437_521b02ee-9144-4966-aa12-5d2336c2215e.sql sha256=495b55ec139eefd868664892d688104e84b97a66aedff174b1b33937aca604da
-- Additive columns for message parsing/reprocessing
ALTER TABLE public.email_inbox
  ADD COLUMN IF NOT EXISTS raw_source text,
  ADD COLUMN IF NOT EXISTS thread_id text,
  ADD COLUMN IF NOT EXISTS in_reply_to text,
  ADD COLUMN IF NOT EXISTS references_ids text,
  ADD COLUMN IF NOT EXISTS parse_status text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS parse_error text,
  ADD COLUMN IF NOT EXISTS parser_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reprocessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_backup jsonb;

CREATE INDEX IF NOT EXISTS idx_email_inbox_thread ON public.email_inbox(account_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_email_inbox_account_folder_date ON public.email_inbox(account_id, folder, received_at DESC);

-- Sync state hardening
ALTER TABLE public.email_sync_state
  ADD COLUMN IF NOT EXISTS uidvalidity bigint,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz;

-- Per-account auto reply toggle (default true preserves current behaviour)
ALTER TABLE public.email_accounts
  ADD COLUMN IF NOT EXISTS auto_reply_enabled boolean NOT NULL DEFAULT true;

-- Sync run history
CREATE TABLE IF NOT EXISTS public.email_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  result text NOT NULL DEFAULT 'running',
  trigger_source text NOT NULL DEFAULT 'cron',
  new_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  folders jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_summary text,
  recommended_action text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_sync_runs TO authenticated;
GRANT ALL ON public.email_sync_runs TO service_role;
ALTER TABLE public.email_sync_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view email sync runs" ON public.email_sync_runs;
CREATE POLICY "Admins view email sync runs" ON public.email_sync_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_email_sync_runs_account ON public.email_sync_runs(account_id, started_at DESC);

-- Failed-message reprocess queue
CREATE TABLE IF NOT EXISTS public.email_reprocess_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  folder text NOT NULL,
  imap_uid bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, folder, imap_uid)
);
GRANT SELECT ON public.email_reprocess_queue TO authenticated;
GRANT ALL ON public.email_reprocess_queue TO service_role;
ALTER TABLE public.email_reprocess_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view email reprocess queue" ON public.email_reprocess_queue;
CREATE POLICY "Admins view email reprocess queue" ON public.email_reprocess_queue
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_email_reprocess_pending ON public.email_reprocess_queue(status, next_attempt_at);;

-- END MIGRATION 20260915184437

-- BEGIN MIGRATION 20260915190034 20260915190034_70997172-94e7-404f-9361-c84ec2786f94.sql sha256=748e209192498ff5b6e24976f847f435d59d96eb966b73acc0330d96a099d954
CREATE TABLE public.email_repair_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'preview',
  status text NOT NULL DEFAULT 'running',
  limit_count integer NOT NULL DEFAULT 30,
  examined integer NOT NULL DEFAULT 0,
  repaired integer NOT NULL DEFAULT 0,
  unchanged integer NOT NULL DEFAULT 0,
  not_found integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  started_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_repair_runs TO authenticated;
GRANT ALL ON public.email_repair_runs TO service_role;

ALTER TABLE public.email_repair_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email repair runs"
ON public.email_repair_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX email_repair_runs_single_running
ON public.email_repair_runs ((status)) WHERE status = 'running';

CREATE TRIGGER update_email_repair_runs_updated_at
BEFORE UPDATE ON public.email_repair_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;

-- END MIGRATION 20260915190034

-- BEGIN MIGRATION 20260915193314 20260915193314_5c825490-c6dd-4d48-b716-2e08f197227d.sql sha256=2a5df14105951bd87e669909e0c91f1904806ad76641614189aad10fab53f825
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_document_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_document_type_check CHECK (document_type = ANY (ARRAY['contract','signed_contract','contrato','anexo','outro','procuracao','invoice','receipt','identity','power_of_attorney','other','distrato','distrato_multa','distrato_sem_multa','taxa','busca_inpi','certificado','rpi','parecer','comprovante']));;

-- END MIGRATION 20260915193314

-- BEGIN MIGRATION 20260915224230 20260915224230_e142082a-1d92-425c-9375-096ab8816b85.sql sha256=bb52dc423fcbdcc19e8aef7cdd887493025c2ccc61e07dcbbe3267280aacf3c7
-- FASE 1 — Recursos I
