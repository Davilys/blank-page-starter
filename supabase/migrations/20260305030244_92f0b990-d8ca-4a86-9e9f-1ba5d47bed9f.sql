
-- Trigger 1: Auto-populate marketing_conversions when a lead is created
CREATE OR REPLACE FUNCTION public.on_lead_created_marketing_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO marketing_conversions (lead_id, event_name, platform, utm_source, utm_medium, utm_campaign, created_at)
  VALUES (NEW.id, 'LeadCreated', 'website', NULL, NULL, NULL, NOW());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_created_marketing_conversion
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.on_lead_created_marketing_conversion();

-- Trigger 2: Auto-populate marketing_conversions when a contract is signed
CREATE OR REPLACE FUNCTION public.on_contract_signed_marketing_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.signature_status = 'signed' AND (OLD.signature_status IS NULL OR OLD.signature_status != 'signed') THEN
    INSERT INTO marketing_conversions (contract_id, client_id, event_name, event_value, platform, created_at)
    VALUES (NEW.id, NEW.user_id, 'ContractSigned', NEW.contract_value, 'website', NOW());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contract_signed_marketing_conversion
AFTER UPDATE OF signature_status ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.on_contract_signed_marketing_conversion();

-- Trigger 3: Auto-populate marketing_conversions when an invoice is paid
CREATE OR REPLACE FUNCTION public.on_invoice_paid_marketing_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    INSERT INTO marketing_conversions (invoice_id, client_id, event_name, event_value, platform, created_at)
    VALUES (NEW.id, NEW.user_id, 'PaymentCompleted', NEW.amount, 'website', NOW());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_paid_marketing_conversion
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.on_invoice_paid_marketing_conversion();
