-- 1) Tabela de execução da sincronização geral
CREATE TABLE IF NOT EXISTS public.asaas_full_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  executed_by uuid,
  cursor_offset integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_andamento',
  etapa text,
  total_clientes_asaas integer,
  clientes_processados integer NOT NULL DEFAULT 0,
  clientes_criados integer NOT NULL DEFAULT 0,
  clientes_vinculados integer NOT NULL DEFAULT 0,
  cobrancas_encontradas integer NOT NULL DEFAULT 0,
  criadas integer NOT NULL DEFAULT 0,
  atualizadas integer NOT NULL DEFAULT 0,
  removidas integer NOT NULL DEFAULT 0,
  ambiguidades jsonb NOT NULL DEFAULT '[]'::jsonb,
  ultimo_bloco_aplicado integer NOT NULL DEFAULT -1,
  erro text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

GRANT SELECT ON public.asaas_full_sync_runs TO authenticated;
GRANT ALL ON public.asaas_full_sync_runs TO service_role;

ALTER TABLE public.asaas_full_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem ver execucoes de sincronizacao" ON public.asaas_full_sync_runs;
CREATE POLICY "Admins podem ver execucoes de sincronizacao"
  ON public.asaas_full_sync_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_asaas_full_sync_runs_updated_at ON public.asaas_full_sync_runs;
CREATE TRIGGER update_asaas_full_sync_runs_updated_at
  BEFORE UPDATE ON public.asaas_full_sync_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS asaas_full_sync_runs_unico_em_andamento
  ON public.asaas_full_sync_runs ((status)) WHERE status = 'em_andamento';

-- 2) Regras únicas de classificação/ordenação
CREATE OR REPLACE FUNCTION public.classificar_cobranca(p_status text, p_due_date date, p_sync_status text)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN COALESCE(lower(btrim(p_sync_status)), 'ativa') <> 'ativa' THEN 'inativo'
    WHEN lower(COALESCE(p_status, '')) IN ('received','confirmed','received_in_cash','dunning_received','paid') THEN 'pago'
    WHEN lower(COALESCE(p_status, '')) IN ('canceled','cancelled','deleted','removida_asaas','refunded','refund_requested','refund_in_progress','chargeback','chargeback_requested','chargeback_dispute','awaiting_chargeback_reversal') THEN 'inativo'
    WHEN lower(COALESCE(p_status, '')) IN ('overdue','dunning_requested') THEN 'vencido'
    WHEN p_due_date IS NOT NULL AND p_due_date < CURRENT_DATE THEN 'vencido'
    ELSE 'a_vencer'
  END;
$$;

CREATE OR REPLACE FUNCTION public.nome_ordenavel(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(btrim(translate(COALESCE(p, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')));
$$;

-- 3) Lista paginada do Financeiro
CREATE OR REPLACE FUNCTION public.admin_invoices_list(
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_owner uuid DEFAULT NULL,
  p_sort text DEFAULT 'cliente',
  p_dir text DEFAULT 'asc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, description text, amount numeric, due_date date, status text,
  classificacao text, payment_date date, user_id uuid, invoice_url text, pix_code text,
  payment_method text, created_at timestamptz, sync_status text, origem text,
  asaas_invoice_id text, cliente_nome text, cliente_email text, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dir text := CASE WHEN lower(COALESCE(p_dir, 'asc')) = 'desc' THEN 'DESC' ELSE 'ASC' END;
  v_order text;
  v_sql text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  v_order := CASE lower(COALESCE(p_sort, 'cliente'))
    WHEN 'descricao'  THEN format('public.nome_ordenavel(f.description) %s, f.due_date ASC', v_dir)
    WHEN 'valor'      THEN format('f.amount %s, f.nome_ord ASC', v_dir)
    WHEN 'metodo'     THEN format('lower(COALESCE(f.payment_method, %L)) %s, f.nome_ord ASC', '', v_dir)
    WHEN 'vencimento' THEN format('f.due_date %s NULLS LAST, f.nome_ord ASC', v_dir)
    WHEN 'status'     THEN format('f.classificacao %s, f.due_date ASC', v_dir)
    ELSE format('f.nome_ord %s, f.ordem_status ASC, f.due_date ASC', v_dir)
  END;

  v_sql := format($q$
    WITH base AS (
      SELECT i.id, i.description, i.amount, i.due_date, i.status, i.payment_date, i.user_id,
             i.invoice_url, i.pix_code, i.payment_method, i.created_at, i.sync_status, i.origem,
             i.asaas_invoice_id,
             p.full_name AS cliente_nome, p.email AS cliente_email,
             public.classificar_cobranca(i.status, i.due_date, i.sync_status) AS classificacao,
             public.nome_ordenavel(COALESCE(p.full_name, p.email, 'zzzz')) AS nome_ord,
             CASE public.classificar_cobranca(i.status, i.due_date, i.sync_status)
               WHEN 'vencido' THEN 0 WHEN 'a_vencer' THEN 1 WHEN 'pago' THEN 2 ELSE 3 END AS ordem_status
      FROM public.invoices i
      LEFT JOIN public.profiles p ON p.id = i.user_id
      WHERE ($1 IS NULL OR p.assigned_to = $1 OR p.created_by = $1)
        AND ($2 IS NULL OR COALESCE(i.created_at::date, i.due_date) >= $2)
        AND ($3 IS NULL OR COALESCE(i.created_at::date, i.due_date) <= $3)
        AND (
          $4 IS NULL OR $4 = '' OR
          public.nome_ordenavel(p.full_name) LIKE '%%' || public.nome_ordenavel($4) || '%%' OR
          lower(COALESCE(p.email, '')) LIKE '%%' || lower($4) || '%%' OR
          public.nome_ordenavel(i.description) LIKE '%%' || public.nome_ordenavel($4) || '%%' OR
          lower(COALESCE(i.asaas_invoice_id, '')) LIKE '%%' || lower($4) || '%%' OR
          (
            regexp_replace($4, '[^0-9]', '', 'g') <> '' AND
            regexp_replace(COALESCE(p.cpf_cnpj, ''), '[^0-9]', '', 'g') LIKE '%%' || regexp_replace($4, '[^0-9]', '', 'g') || '%%'
          )
        )
    ), f AS (
      SELECT * FROM base WHERE $5 = 'all' OR classificacao = $5
    )
    SELECT f.id, f.description, f.amount, f.due_date, f.status, f.classificacao, f.payment_date, f.user_id,
           f.invoice_url, f.pix_code, f.payment_method, f.created_at, f.sync_status, f.origem,
           f.asaas_invoice_id, f.cliente_nome, f.cliente_email, count(*) OVER() AS total_count
    FROM f
    ORDER BY %s
    LIMIT $6 OFFSET $7
  $q$, v_order);

  RETURN QUERY EXECUTE v_sql
    USING p_owner, p_from, p_to, p_search, COALESCE(p_status, 'all'),
          GREATEST(COALESCE(p_limit, 50), 1), GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

-- 4) Totais completos dos cartões
CREATE OR REPLACE FUNCTION public.admin_invoices_totals(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_owner uuid DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;

  WITH base AS (
    SELECT i.amount,
           public.classificar_cobranca(i.status, i.due_date, i.sync_status) AS c
    FROM public.invoices i
    LEFT JOIN public.profiles p ON p.id = i.user_id
    WHERE (p_owner IS NULL OR p.assigned_to = p_owner OR p.created_by = p_owner)
      AND (p_from IS NULL OR COALESCE(i.created_at::date, i.due_date) >= p_from)
      AND (p_to IS NULL OR COALESCE(i.created_at::date, i.due_date) <= p_to)
  )
  SELECT json_build_object(
    'pago', COALESCE(SUM(amount) FILTER (WHERE c = 'pago'), 0),
    'count_pago', COUNT(*) FILTER (WHERE c = 'pago'),
    'a_vencer', COALESCE(SUM(amount) FILTER (WHERE c = 'a_vencer'), 0),
    'count_a_vencer', COUNT(*) FILTER (WHERE c = 'a_vencer'),
    'vencido', COALESCE(SUM(amount) FILTER (WHERE c = 'vencido'), 0),
    'count_vencido', COUNT(*) FILTER (WHERE c = 'vencido'),
    'inativo', COALESCE(SUM(amount) FILTER (WHERE c = 'inativo'), 0),
    'count_inativo', COUNT(*) FILTER (WHERE c = 'inativo'),
    'total', COALESCE(SUM(amount) FILTER (WHERE c <> 'inativo'), 0),
    'count_total', COUNT(*) FILTER (WHERE c <> 'inativo')
  ) INTO v FROM base;

  RETURN v;
END;
$$;

-- 5) Índices de desempenho
CREATE INDEX IF NOT EXISTS idx_invoices_asaas_invoice_id ON public.invoices (asaas_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices (user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_sync_status ON public.invoices (sync_status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices (due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices (created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_asaas_customer_id ON public.profiles (asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_cpf_cnpj_digits ON public.profiles ((regexp_replace(COALESCE(cpf_cnpj, ''), '[^0-9]', '', 'g')));
CREATE INDEX IF NOT EXISTS idx_profiles_nome_ordenavel ON public.profiles (public.nome_ordenavel(full_name));