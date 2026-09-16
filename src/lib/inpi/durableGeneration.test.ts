import { describe, expect, it, vi } from 'vitest';
import { advanceResponse, parseProviderResponse, type Checkpoint, type ResponseStore } from '../../../supabase/functions/process-inpi-resource/durableResponse';
import { documentsSignature } from '../../../supabase/functions/process-inpi-resource/runControl';

function memoryStore() {
  let value: Checkpoint | null = null;
  const store: ResponseStore = {
    read: async () => value && { ...value },
    reserve: async fingerprint => {
      if (value) return false;
      value = { fingerprint, created_at: new Date().toISOString() };
      return true;
    },
    save: async patch => { if (!value) throw Error('missing'); value = { ...value, ...patch }; },
  };
  return store;
}
const request = { model: 'configured-model', input: 'fixture, no customer data', max_output_tokens: 8000 };
const completed = { id: 'resp_fixture', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Peça de teste completa.' }] }] };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('durable provider generation', () => {
  it('survives a worker restart without another POST, then uses the saved result', async () => {
    const store = memoryStore();
    const fetcher = vi.fn().mockResolvedValueOnce(reply({ id: 'resp_fixture', status: 'queued' }))
      .mockResolvedValueOnce(reply({ id: 'resp_fixture', status: 'in_progress' }))
      .mockResolvedValueOnce(reply(completed));
    expect((await advanceResponse('test', request, store, fetcher)).errorKind).toBe('provider_pending');
    expect((await advanceResponse('test', request, store, fetcher)).errorKind).toBe('provider_pending');
    expect(await advanceResponse('test', request, store, fetcher)).toEqual({ content: 'Peça de teste completa.' });
    expect(await advanceResponse('test', request, store, fetcher)).toEqual({ content: 'Peça de teste completa.' });
    expect(fetcher.mock.calls.map(c => c[1].method)).toEqual(['POST', 'GET', 'GET']);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ background: true, stream: false, model: request.model });
  });
  it('two simultaneous workers buy only one generation', async () => {
    const fetcher = vi.fn(async () => reply({ id: 'resp_fixture', status: 'queued' }));
    const store = memoryStore();
    await Promise.all(Array.from({ length: 10 }, () => advanceResponse('test', request, store, fetcher)));
    expect(fetcher.mock.calls.filter((c: any) => c[1].method === 'POST')).toHaveLength(1);
  });
  it('does not resend after an ambiguous POST timeout', async () => {
    const store = memoryStore();
    const fetcher = vi.fn().mockRejectedValue(new Error('network disconnected after accept'));
    expect((await advanceResponse('test', request, store, fetcher)).errorKind).toBe('submission_unknown');
    expect((await advanceResponse('test', request, store, fetcher, Date.now() + 61000)).errorKind).toBe('submission_unknown');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not resubmit after checkpoint storage fails', async () => {
    const store = memoryStore();
    store.save = async () => { throw Error('database unavailable'); };
    const fetcher = vi.fn(async () => reply({ id: 'resp_fixture', status: 'queued' }));
    await expect(advanceResponse('test', request, store, fetcher)).rejects.toThrow('database unavailable');
    expect((await advanceResponse('test', request, store, fetcher, Date.now() + 61000)).errorKind).toBe('submission_unknown');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects changed inputs instead of mixing versions', async () => {
    const store = memoryStore();
    const fetcher = vi.fn(async () => reply({ id: 'resp_fixture', status: 'queued' }));
    await advanceResponse('test', request, store, fetcher);
    expect((await advanceResponse('test', { ...request, input: 'new evidence' }, store, fetcher)).errorKind).toBe('version_changed');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([429, 500, 503])('retries a GET failure %i using the same response', async status => {
    const store = memoryStore();
    const fetcher = vi.fn().mockResolvedValueOnce(reply({ id: 'resp_fixture', status: 'queued' }))
      .mockResolvedValueOnce(reply({}, status)).mockResolvedValueOnce(reply(completed));
    await advanceResponse('test', request, store, fetcher);
    expect((await advanceResponse('test', request, store, fetcher)).errorKind).toBe('provider_pending');
    expect((await advanceResponse('test', request, store, fetcher)).content).toBeTruthy();
    expect(fetcher.mock.calls.map(c => c[1].method)).toEqual(['POST', 'GET', 'GET']);
  });
  it('rejects a response belonging to another operation', async () => {
    const store = memoryStore();
    const fetcher = vi.fn().mockResolvedValueOnce(reply({ id: 'resp_fixture', status: 'queued' }))
      .mockResolvedValueOnce(reply({ ...completed, id: 'resp_other_case' }));
    await advanceResponse('test', request, store, fetcher);
    expect((await advanceResponse('test', request, store, fetcher)).errorKind).toBe('provider_invalid');
  });
  it.each(['failed', 'cancelled', 'incomplete', undefined])('never accepts partial text with status %s', status => {
    expect(parseProviderResponse({ ...completed, status }).error).toBeTruthy();
    expect(parseProviderResponse({ ...completed, status }).content).toBe('');
  });
  it('a refusal cannot be hidden by another text output', () => {
    expect(parseProviderResponse({ ...completed, output: [...completed.output, { type: 'message', content: [{ type: 'refusal' }] }] }).errorKind).toBe('refusal');
  });
  it('does not treat an empty completed response as a resource', () => {
    expect(parseProviderResponse({ id: 'resp_fixture', status: 'completed', output: [] }).errorKind).toBe('empty');
  });
  it('has a bounded provider deadline', async () => {
    const store = memoryStore();
    const fetcher = vi.fn(async () => reply({ id: 'resp_fixture', status: 'queued' }));
    await advanceResponse('test', request, store, fetcher);
    expect((await advanceResponse('test', request, store, fetcher, Date.now() + 31 * 60000)).errorKind).toBe('provider_timeout');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('recovers a completed response when the page reopens after the deadline', async () => {
    const store = memoryStore();
    const fetcher = vi.fn().mockResolvedValueOnce(reply({ id: 'resp_fixture', status: 'queued' }))
      .mockResolvedValueOnce(reply(completed));
    await advanceResponse('test', request, store, fetcher);
    expect((await advanceResponse('test', request, store, fetcher, Date.now() + 31 * 60000)).content).toBeTruthy();
  });
  it.each(['sha256', 'category', 'version', 'extracted_text'])('invalidates prepared evidence when %s changes', field => {
    const doc = { id: 'a', doc_number: 1, storage_path: 'same-path', sha256: 'a', category: 'proof', version: 1, extracted_text: 'old' };
    expect(documentsSignature([doc])).not.toBe(documentsSignature([{ ...doc, [field]: 'changed' }]));
  });
});
