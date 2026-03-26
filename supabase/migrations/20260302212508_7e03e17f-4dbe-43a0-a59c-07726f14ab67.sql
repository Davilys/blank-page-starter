-- Migrate existing publicacoes_marcas status values to match juridico kanban stages
UPDATE public.publicacoes_marcas SET status = '003' WHERE status = 'depositada';
UPDATE public.publicacoes_marcas SET status = 'publicada' WHERE status = 'publicada';
UPDATE public.publicacoes_marcas SET status = 'oposicao' WHERE status = 'oposicao';
UPDATE public.publicacoes_marcas SET status = 'exigencia_merito' WHERE status = 'publicada';
UPDATE public.publicacoes_marcas SET status = 'deferimento' WHERE status = 'deferida';
UPDATE public.publicacoes_marcas SET status = 'certificado' WHERE status = 'certificada';
UPDATE public.publicacoes_marcas SET status = 'indeferimento' WHERE status = 'indeferida';
UPDATE public.publicacoes_marcas SET status = 'arquivado' WHERE status = 'arquivada';
UPDATE public.publicacoes_marcas SET status = 'renovacao' WHERE status = 'renovacao_pendente';
