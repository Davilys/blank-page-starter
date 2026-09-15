/**
 * Consulta individual de um processo de marca na base pública do INPI
 * (mesma API usada por servicos.busca.inpi.gov.br). Sem chave, sem captcha.
 * Uso: somente para completar campos ausentes, com retentativa progressiva.
 */

const ENDPOINT = 'https://api-servicos.busca.inpi.gov.br/api/trademarks/search';

const RESULT_FIELDS = [
  'mark_name', 'classification_code', 'dispatches', 'filing_date', 'grant_date',
  'holders', 'nature_text', 'presentation_text', 'process_number', 'procurator',
  'specifications', 'status', 'validity_date', 'vienna_classification',
];

export interface InpiProcessData {
  process_number: string;
  mark_name: string | null;
  status: string | null;
  filing_date: string | null;
  grant_date: string | null;
  validity_date: string | null;
  nature_text: string | null;
  presentation_text: string | null;
  holders: Array<{ name: string; cnpj: string | null; person_type: string | null }>;
  procurator: string | null;
  dispatches: unknown[];
  specifications: Array<{ nice_class_code: string | null; text: string | null }>;
  vienna_classification: Array<{ code: string | null; description: string | null }>;
  fetched_at: string;
}

function buildBody(processNumber: string) {
  return {
    state: {
      current: 1,
      filters: [{ field: 'process_number', values: [processNumber], type: 'all' }],
      resultsPerPage: 1,
      searchTerm: '',
      sortDirection: '',
      sortField: '',
      sortList: [],
    },
    queryConfig: {
      search_fields: { registration_number: {} },
      result_fields: Object.fromEntries(RESULT_FIELDS.map((f) => [f, { raw: {} }])),
      facets: {},
    },
  };
}

const raw = (r: Record<string, any>, key: string) => (r?.[key]?.raw ?? null);
const isoDate = (v: unknown) => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null);

export async function fetchInpiProcess(
  processNumber: string,
  opts: { attempts?: number; timeoutMs?: number } = {},
): Promise<{ ok: true; data: InpiProcessData | null } | { ok: false; error: string; retryable: boolean }> {
  const attempts = opts.attempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 45_000;
  let lastError = 'desconhecido';
  let retryable = true;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
          'referer': 'https://servicos.busca.inpi.gov.br/',
        },
        body: JSON.stringify(buildBody(processNumber)),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) {
        lastError = `HTTP ${resp.status}`;
        retryable = [404, 408, 429, 500, 502, 503, 504].includes(resp.status);
        await resp.text().catch(() => {});
        if (!retryable) break;
      } else {
        const json = await resp.json();
        const result = (json?.results ?? [])[0];
        if (!result) return { ok: true, data: null };
        const holders = (raw(result, 'holders') ?? []) as any[];
        const procurator = raw(result, 'procurator') as any;
        return {
          ok: true,
          data: {
            process_number: String(raw(result, 'process_number') ?? processNumber),
            mark_name: raw(result, 'mark_name'),
            status: raw(result, 'status'),
            filing_date: isoDate(raw(result, 'filing_date')),
            grant_date: isoDate(raw(result, 'grant_date')),
            validity_date: isoDate(raw(result, 'validity_date')),
            nature_text: raw(result, 'nature_text'),
            presentation_text: raw(result, 'presentation_text'),
            holders: holders.map((h) => ({
              name: h?.name ?? '',
              cnpj: h?.cnpj ?? null,
              person_type: h?.person_type ?? null,
            })).filter((h) => h.name),
            procurator: procurator?.name ?? null,
            dispatches: (raw(result, 'dispatches') ?? []) as unknown[],
            specifications: ((raw(result, 'specifications') ?? []) as any[]).map((s) => ({
              nice_class_code: s?.nice_class_code ?? null,
              text: s?.text ?? null,
            })),
            vienna_classification: ((raw(result, 'vienna_classification') ?? []) as any[]).map((v) => ({
              code: v?.code ?? null,
              description: v?.description ?? null,
            })),
            fetched_at: new Date().toISOString(),
          },
        };
      }
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err.message : String(err);
      retryable = true;
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, 1500 * attempt));
  }

  return { ok: false, error: lastError, retryable };
}
