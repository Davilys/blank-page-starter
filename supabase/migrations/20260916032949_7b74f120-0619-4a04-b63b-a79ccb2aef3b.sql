BEGIN;
LOCK TABLE public.inpi_case_documents IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.inpi_case_documents ADD COLUMN doc_number integer;
WITH numbered AS (
  SELECT id, row_number() OVER (
    PARTITION BY case_id ORDER BY display_order, created_at, id
  )::integer AS n FROM public.inpi_case_documents
)
UPDATE public.inpi_case_documents d SET doc_number = numbered.n
FROM numbered WHERE numbered.id = d.id;
ALTER TABLE public.inpi_case_documents ALTER COLUMN doc_number SET NOT NULL;
ALTER TABLE public.inpi_case_documents ADD CONSTRAINT inpi_document_number_positive CHECK (doc_number > 0);
CREATE UNIQUE INDEX inpi_document_number_unique ON public.inpi_case_documents(case_id, doc_number);
ALTER TABLE public.inpi_resource_cases ADD COLUMN next_document_number integer NOT NULL DEFAULT 1;
UPDATE public.inpi_resource_cases c SET next_document_number = x.n + 1
FROM (SELECT case_id, max(doc_number) n FROM public.inpi_case_documents GROUP BY case_id) x
WHERE x.case_id = c.id;

CREATE FUNCTION public.assign_inpi_document_number() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.doc_number IS DISTINCT FROM OLD.doc_number OR NEW.case_id IS DISTINCT FROM OLD.case_id THEN
      RAISE EXCEPTION 'Document identity cannot be reassigned';
    END IF;
    RETURN NEW;
  END IF;
  UPDATE public.inpi_resource_cases
    SET next_document_number = next_document_number + 1
    WHERE id = NEW.case_id
    RETURNING next_document_number - 1 INTO NEW.doc_number;
  IF NEW.doc_number IS NULL THEN RAISE EXCEPTION 'Case unavailable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER assign_inpi_document_number BEFORE INSERT OR UPDATE ON public.inpi_case_documents
FOR EACH ROW EXECUTE FUNCTION public.assign_inpi_document_number();
COMMIT;