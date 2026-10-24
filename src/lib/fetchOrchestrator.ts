// Orchestrates mount-init, in-flight guarding and debounced realtime refetch
// for heavy admin list pages. Plain TS (no React) so behavior is unit-testable.
//
// Guarantees:
// - tryInit() returns true exactly once until resetInit() (dedupes double mount paths,
//   e.g. onAuthStateChange INITIAL_SESSION + getSession).
// - A fetch request while another fetch is in flight is NEVER dropped: it is queued
//   as exactly one follow-up run (manual refresh stays responsive).
// - scheduleRefetch() collapses bursts into one run after `debounceMs`, but never
//   postpones a refetch beyond `maxWaitMs` under continuous events.
export interface FetchOrchestrator {
  tryInit(): boolean;
  resetInit(): void;
  requestFetch(): void;
  scheduleRefetch(now?: number): void;
  /** Rearms after dispose (next effect mount, e.g. StrictMode remount). */
  activate(): void;
  /** Cancels the pending timer AND drops a queued follow-up; disarms until activate(). */
  dispose(): void;
}

export function createFetchOrchestrator(
  fetchFn: () => void | Promise<void>,
  opts: { debounceMs?: number; maxWaitMs?: number } = {},
): FetchOrchestrator {
  const debounceMs = opts.debounceMs ?? 8000;
  const maxWaitMs = opts.maxWaitMs ?? 30000;
  let initialized = false;
  let fetching = false;
  let pending = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstEventTs: number | null = null;

  const run = () => {
    if (disposed) return;
    if (fetching) {
      pending = true;
      return;
    }
    fetching = true;
    Promise.resolve()
      .then(() => fetchFn())
      .catch(() => {
        // fetchFn owns its error handling; the orchestrator must not break the queue
      })
      .finally(() => {
        fetching = false;
        if (pending && !disposed) {
          pending = false;
          run();
        }
        pending = false;
      });
  };

  return {
    tryInit() {
      if (initialized) return false;
      initialized = true;
      return true;
    },
    resetInit() {
      initialized = false;
    },
    requestFetch() {
      run();
    },
    scheduleRefetch(now: number = Date.now()) {
      if (disposed) return;
      if (firstEventTs === null) firstEventTs = now;
      const waited = now - firstEventTs;
      if (timer) clearTimeout(timer);
      const delay = Math.min(debounceMs, Math.max(0, maxWaitMs - waited));
      timer = setTimeout(() => {
        timer = null;
        firstEventTs = null;
        run();
      }, delay);
    },
    activate() {
      disposed = false;
    },
    dispose() {
      disposed = true;
      pending = false;
      if (timer) clearTimeout(timer);
      timer = null;
      firstEventTs = null;
    },
  };
}
