/**
 * Exponential-backoff retry helper for transient Anthropic API failures
 * (rate-limits, gateway/overloaded errors). Non-retryable errors and
 * permanent client errors surface on the first attempt.
 *
 * Pure — takes a sleep function so tests can run without wall-clock waits.
 */

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);

/** Options exposed so callers can tune or stub the backoff. */
export interface RetryOptions {
  /** Max total attempts including the first. Default 4. */
  readonly maxAttempts?: number;
  /** Initial backoff in ms. Default 500. Doubles on each retry. */
  readonly baseDelayMs?: number;
  /** Injectable sleep — defaults to setTimeout. */
  readonly sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  const status = (err as { status?: unknown }).status;
  if (typeof status === 'number' && RETRYABLE_STATUS.has(status)) return true;
  // The Anthropic SDK uses error names like APIConnectionError / RateLimitError.
  const name = (err as { name?: unknown }).name;
  if (typeof name === 'string' && /rate.?limit|overloaded|connection|timeout/i.test(name)) {
    return true;
  }
  return false;
}

/**
 * Runs `fn` with exponential backoff on retryable errors. Re-throws the
 * last error once attempts are exhausted.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseDelay = opts.baseDelayMs ?? 500;
  const sleep = opts.sleep ?? defaultSleep;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !isRetryable(err)) throw err;
      await sleep(baseDelay * 2 ** (attempt - 1));
    }
  }
  throw lastErr;
}
