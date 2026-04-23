import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../src/infrastructure/llm-judge/retry.js';

const noSleep = () => Promise.resolve();

describe('withRetry', () => {
  it('returns immediately on first success', async () => {
    const fn = vi.fn(async () => 'ok');
    const result = await withRetry(fn, { sleep: noSleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on a 429 and eventually succeeds', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw Object.assign(new Error('rate limit'), { status: 429 });
      return 'ok';
    });
    const result = await withRetry(fn, { sleep: noSleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry a non-retryable error', async () => {
    const fn = vi.fn(async () => {
      throw Object.assign(new Error('bad request'), { status: 400 });
    });
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts and rethrows the last error', async () => {
    const fn = vi.fn(async () => {
      throw Object.assign(new Error('overloaded'), { status: 529 });
    });
    await expect(withRetry(fn, { maxAttempts: 2, sleep: noSleep })).rejects.toThrow('overloaded');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
