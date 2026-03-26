/**
 * Centralized network resilience utilities.
 * Provides timeout, retry with exponential backoff, and connectivity error classification.
 */

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 800;

/** Classify whether an error is a transient connectivity issue */
export function isConnectivityError(error: unknown): boolean {
  const message = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : (error as { message?: string })?.message ?? '';

  const normalized = message.toLowerCase();
  return (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('load failed') ||
    normalized.includes('network request failed') ||
    normalized.includes('timeout') ||
    normalized.includes('upstream request timeout') ||
    normalized.includes('context deadline exceeded') ||
    normalized.includes('aborted') ||
    normalized.includes('err_network') ||
    normalized.includes('net::err')
  );
}

/** Race a promise against a timeout */
export function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('request timeout')), ms)
    ),
  ]);
}

/** Wait for a given number of milliseconds */
export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  timeoutMs?: number;
  /** Called before each retry — return false to abort */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/**
 * Execute an async operation with automatic retry on connectivity errors.
 * Returns { data, error } — never throws for transient failures.
 */
export async function resilientCall<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<{ data: T | null; error: Error | null; wasConnectivityError: boolean }> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelay = DEFAULT_BASE_DELAY_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    shouldRetry,
  } = options;

  let lastError: Error | null = null;
  let wasConnectivity = false;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await withTimeout(fn(), timeoutMs);
      return { data: result, error: null, wasConnectivityError: false };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      wasConnectivity = isConnectivityError(lastError);

      // Only retry on connectivity errors
      if (!wasConnectivity || attempt === maxRetries) {
        break;
      }

      if (shouldRetry && !shouldRetry(lastError, attempt)) {
        break;
      }

      // Exponential backoff with jitter
      const jitter = Math.floor(Math.random() * 200);
      await wait(baseDelay * attempt + jitter);
    }
  }

  return { data: null, error: lastError, wasConnectivityError: wasConnectivity };
}

/**
 * Friendly user-facing error message for connectivity issues.
 */
export function getConnectivityErrorMessage(error: unknown): string {
  if (isConnectivityError(error)) {
    return 'Falha de conexão com o servidor. Verifique sua internet e tente novamente.';
  }
  return error instanceof Error ? error.message : 'Erro inesperado. Tente novamente.';
}

/**
 * React-Query retry function that only retries on connectivity errors.
 * Use as: { retry: connectivityRetry, retryDelay: connectivityRetryDelay }
 */
export function connectivityRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 3 && isConnectivityError(error);
}

export function connectivityRetryDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt - 1), 8000);
}
