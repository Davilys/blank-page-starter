import { describe, expect, it, vi } from 'vitest';
import { validateReview } from '../../../supabase/functions/_shared/inpiReviewValidation';
import { inpiAdminAccess } from '../../../supabase/functions/_shared/inpiAdminAccess';
import { summarizePackage, type AnnexDoc } from './packageBuilder';

describe('review fails closed', () => {
  it.each([{}, null, { resumo: 'ok' }, { resumo: '', apontamentos: [] }, { resumo: 'ok', apontamentos: [null] }])('rejects malformed review %j', value => {
    expect(() => validateReview(value)).toThrow();
  });
  it('accepts an explicit complete review with no findings', () => {
    expect(validateReview({ resumo: 'Conferência concluída.', apontamentos: [] }).apontamentos).toEqual([]);
  });
  it('does not allow model to downgrade an unsupported fact', () => {
    const review = validateReview({ resumo: 'Revisão', apontamentos: [{
      tipo: 'fato_sem_lastro', bloqueante: false, trecho: 'Fato', trecho_fonte: '',
      problema: 'Sem documento', sugestao: 'Remover', fontes: [], conferencia_externa_necessaria: false,
    }] });
    expect(review.apontamentos[0].bloqueante).toBe(true);
  });
});

describe('real user required for private evidence and legal chat', () => {
  const client = (user: unknown, role: boolean, error: unknown = null) => ({
    auth: { getUser: vi.fn(async () => ({ data: { user }, error })) },
    rpc: vi.fn(async () => ({ data: role, error: null })),
  });
  it('rejects missing authorization before user lookup', async () => {
    const db = client({ id: 'admin' }, true);
    expect(await inpiAdminAccess(db, null)).toBe(401);
    expect(db.auth.getUser).not.toHaveBeenCalled();
  });
  it('rejects API keys that do not identify a user', async () => {
    expect(await inpiAdminAccess(client(null, true), 'Bearer public-key')).toBe(401);
  });
  it('rejects an authenticated user without module permission', async () => {
    expect(await inpiAdminAccess(client({ id: 'ordinary' }, false), 'Bearer fixture')).toBe(403);
  });
  it('rejects a failed permission lookup', async () => {
    const db = client({ id: 'ordinary' }, true);
    db.rpc.mockResolvedValue({ data: true, error: { message: 'db down' } } as any);
    expect(await inpiAdminAccess(db, 'Bearer fixture')).toBe(403);
  });
  it('allows read permission to be checked without requesting edit', async () => {
    const db = client({ id: 'viewer' }, true);
    expect(await inpiAdminAccess(db, 'Bearer fixture', false)).toBeNull();
    expect(db.rpc).toHaveBeenCalledWith('has_inpi_resources_access', { _user_id: 'viewer', _need_edit: false });
  });
  it('accepts an authenticated user with server-confirmed module permission', async () => {
    const db = client({ id: 'admin' }, true);
    expect(await inpiAdminAccess(db, 'Bearer fixture')).toBeNull();
    expect(db.rpc).toHaveBeenCalledWith('has_inpi_resources_access', { _user_id: 'admin', _need_edit: true });
  });
});

describe('no false complete PDF package', () => {
  const doc = { id: 'fixture', status: 'convertido', pageEstimate: 1, images: [], textBlocks: ['Conteúdo'] } as AnnexDoc;
  it.each(['pendente', 'convertendo', 'parcial', 'falha'])('rejects %s annex', status => {
    expect(summarizePackage([{ ...doc, status } as AnnexDoc]).isComplete).toBe(false);
  });
  it('rejects nominal conversion with no content', () => {
    expect(summarizePackage([{ ...doc, textBlocks: [] }]).isComplete).toBe(false);
  });
  it('accepts converted nonempty annexes', () => {
    expect(summarizePackage([doc]).isComplete).toBe(true);
  });
});
