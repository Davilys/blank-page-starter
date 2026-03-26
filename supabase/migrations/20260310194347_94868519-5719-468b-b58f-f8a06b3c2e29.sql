-- Remove orphan publicações (no client linked) — these should never exist in the Kanban
DELETE FROM publicacoes_marcas WHERE client_id IS NULL;