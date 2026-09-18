ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check CHECK (status = ANY (ARRAY[
  'pending','paid','confirmed','received','received_in_cash','overdue','refunded','canceled','cancelled','deleted',
  'awaiting_risk_analysis','approved_by_risk_analysis','reproved_by_risk_analysis','authorized',
  'refund_requested','refund_in_progress','chargeback_requested','chargeback_dispute','awaiting_chargeback_reversal',
  'dunning_requested','dunning_received','awaiting_cash_payment','payment_deleted','removida_asaas','partially_refunded'
]));