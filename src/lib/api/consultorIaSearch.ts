/**
 * Busca de viabilidade da Central Inteligente (admin).
 *
 * Contrato do gerador canônico (edge webmarcas-inpi-search, projeto
 * scpbqsvwojhbxihyqbdz): POST action:"status" com job_id determinístico
 * site-<sha256(brand|activity em NFC minúsculo)[:40]> + brand + activity.
 * A resposta traz job.pdf_base64 com o laudo oficial pronto — esta interface
 * apenas exibe/baixa, NUNCA renderiza laudo próprio.
 *
 * model_incomplete=true (ou sem PDF): o ramo não tem perfil aprovado e o laudo
 * fica indisponível até a equipe confirmar as classes — a UI mostra aviso
 * honesto, sem PDF e sem texto alternativo de laudo.
 *
 * Prévia isolada: VITE_CONSULTOR_IA_MOCK=1 devolve fixtures locais sem rede
 * (caso escolhido por ?cia_mock=zero|found|blocked|error|loading).
 */

const FUNCTION_NAME = 'webmarcas-inpi-search';
const CLIENT_TIMEOUT_MS = 60_000;

export interface ConsultorIaRecord {
  process: string;
  brand: string;
  status: string;
  holder: string | null;
  nice: string | null;
}

export interface ConsultorIaSearchOk {
  ok: true;
  jobId: string;
  brand: string;
  activity: string;
  total: number;
  conclusion: string | null;
  records: ConsultorIaRecord[];
  pdfBase64: string | null;
  pdfFailed: boolean;
  modelIncomplete: boolean;
  /** Data de atualização declarada pela base do INPI (result.searches[0].source_timestamp). */
  baseUpdatedAt: string | null;
}

export interface ConsultorIaSearchErr {
  ok: false;
  error: { code: string; message: string };
}

export type ConsultorIaSearchResult = ConsultorIaSearchOk | ConsultorIaSearchErr;

function normalizeTerm(value: string, max: number): string {
  return (value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Mesma regra da edge: sha256 de "brand|activity" em minúsculas NFC, 40 hex. */
async function siteJobId(brand: string, activity: string): Promise<string> {
  const key = `${brand.toLowerCase().normalize('NFC')}|${activity.toLowerCase().normalize('NFC')}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `site-${hex.slice(0, 40)}`;
}

function getSearchSessionId(): string {
  try {
    const KEY = 'wm_search_session';
    const existing = sessionStorage.getItem(KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

// ─── Fixtures da prévia isolada (sem rede, sem banco) ───────────────────────

// PDF mínimo válido só para a prévia exibir o estado com laudo disponível.
const MOCK_PDF_BASE64 =
  'JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNTk1IDg0Ml0vQ29udGVudHMgNCAwIFIvUmVzb3VyY2VzPDwvRm9udDw8L0YxIDUgMCBSPj4+Pj4+ZW5kb2JqCjQgMCBvYmo8PC9MZW5ndGggOTA+PnN0cmVhbQpCVCAvRjEgMTQgVGYgNzIgNzcwIFRkIChMYXVkbyBkZSB2aWFiaWxpZGFkZSAtIFBSRVZJQSAoZGFkb3MgZGUgZXhlbXBsbykpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iajw8L1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYT4+ZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKdHJhaWxlcjw8L1NpemUgNi9Sb290IDEgMCBSPj4KJSVFT0Y=';

function mockCase(): string {
  try {
    return new URLSearchParams(window.location.search).get('cia_mock') || 'found';
  } catch {
    return 'found';
  }
}

async function runMock(brand: string, activity: string): Promise<ConsultorIaSearchResult> {
  const jobId = await siteJobId(brand.toLowerCase(), activity.toLowerCase());
  const base = { jobId, brand, activity, baseUpdatedAt: '07/07/2026' as string | null };
  switch (mockCase()) {
    case 'loading':
      return new Promise(() => {});
    case 'error':
      return { ok: false, error: { code: 'network', message: 'Falha de conexão ao iniciar a consulta.' } };
    case 'blocked':
      return { ...base, ok: true, total: 0, conclusion: 'inconclusive', records: [], pdfBase64: null, pdfFailed: false, modelIncomplete: true };
    case 'zero':
      return { ...base, ok: true, total: 0, conclusion: 'no_matches_in_searched_terms', records: [], pdfBase64: MOCK_PDF_BASE64, pdfFailed: false, modelIncomplete: false };
    default:
      return {
        ...base,
        ok: true,
        total: 2,
        conclusion: 'matches_found',
        records: [
          { process: '923456789', brand: brand.toUpperCase(), status: 'Registro de marca deferido', holder: 'Titular Exemplo Ltda', nice: '35' },
          { process: '923456790', brand: `${brand.toUpperCase()} EXPRESS`, status: 'Pedido de registro em exame', holder: 'Outro Titular SA', nice: '41' },
        ],
        pdfBase64: MOCK_PDF_BASE64,
        pdfFailed: false,
        modelIncomplete: false,
      };
  }
}

// ─── Normalização defensiva da resposta real ────────────────────────────────

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function normalizeRecords(raw: unknown): ConsultorIaRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: ConsultorIaRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const process = str(r.process) ?? str(r.processo);
    const brand = str(r.brand) ?? str(r.marca);
    if (!process && !brand) continue;
    out.push({
      process: process ?? '',
      brand: brand ?? '',
      status: str(r.status) ?? str(r.situacao) ?? '',
      holder: str(r.holder) ?? str(r.titular),
      nice: str(r.nice) ?? str(r.classe),
    });
  }
  return out;
}

// ─── Chamada real à edge (somente leitura: action="status" não grava lead) ──

export async function runConsultorIaSearch(brandInput: string, activityInput: string): Promise<ConsultorIaSearchResult> {
  const brand = normalizeTerm(brandInput, 120);
  const activity = normalizeTerm(activityInput, 200);
  if (brand.length < 2 || !activity) {
    return { ok: false, error: { code: 'invalid_input', message: 'Preencha o nome da marca e o ramo de atividade.' } };
  }

  if (import.meta.env.VITE_CONSULTOR_IA_MOCK === '1') {
    return runMock(brand, activity);
  }

  const jobId = await siteJobId(brand, activity);
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/functions/v1/${FUNCTION_NAME}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'x-wm-session': getSearchSessionId(),
      },
      body: JSON.stringify({ action: 'status', job_id: jobId, brand, activity }),
      signal: controller.signal,
    });

    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    if (!res.ok) {
      const p = (payload ?? {}) as { error?: { code?: string; message?: string } };
      return {
        ok: false,
        error: {
          code: str(p.error?.code) ?? (res.status === 429 ? 'rate_limited' : 'unknown'),
          message: str(p.error?.message) ?? 'Não foi possível concluir a consulta agora.',
        },
      };
    }

    const p = (payload ?? {}) as { ok?: boolean; job?: unknown; error?: { code?: string; message?: string } };
    if (p.ok === false) {
      return {
        ok: false,
        error: {
          code: str(p.error?.code) ?? 'unknown',
          message: str(p.error?.message) ?? 'Não foi possível concluir a consulta agora.',
        },
      };
    }

    const job = (p.job ?? {}) as Record<string, unknown>;
    const result = (job.result ?? {}) as Record<string, unknown>;
    const records = normalizeRecords(result.records);
    const searches = Array.isArray(result.searches) ? result.searches : [];
    const totalFromSearches = searches.reduce((acc, s) => {
      const t = (s as Record<string, unknown>)?.total;
      return acc + (typeof t === 'number' && Number.isFinite(t) ? t : 0);
    }, 0);
    const baseUpdatedAt = str((searches[0] as Record<string, unknown> | undefined)?.source_timestamp);
    const pdfRaw = str(job.pdf_base64);
    const pdfBase64 = pdfRaw && pdfRaw.length <= 16_000_000 && /^[A-Za-z0-9+/=]+$/.test(pdfRaw) ? pdfRaw : null;

    return {
      ok: true,
      jobId: str(job.job_id) ?? jobId,
      brand,
      activity,
      total: totalFromSearches || records.length,
      conclusion: str(result.conclusion),
      records,
      pdfBase64,
      pdfFailed: job.pdf_failed === true,
      modelIncomplete: job.model_incomplete === true || result.model_incomplete === true,
      baseUpdatedAt: baseUpdatedAt ?? null,
    };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    return {
      ok: false,
      error: {
        code: aborted ? 'timeout' : 'network',
        message: aborted
          ? 'A consulta demorou mais do que o esperado para responder.'
          : 'Falha de conexão ao iniciar a consulta.',
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
