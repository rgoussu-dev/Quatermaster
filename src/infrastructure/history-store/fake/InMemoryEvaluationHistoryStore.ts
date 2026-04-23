import type { EvaluationHistoryStore } from '../../../domain/contract/ports/EvaluationHistoryStore.js';

/**
 * Fake implementation of EvaluationHistoryStore.
 * Keeps an in-memory list of snapshots per key; `loadLatest` returns the
 * last one saved. Canonical reference for tests.
 */
export class InMemoryEvaluationHistoryStore<T> implements EvaluationHistoryStore<T> {
  private readonly byKey = new Map<string, T[]>();

  async save(key: string, snapshot: T): Promise<void> {
    const existing = this.byKey.get(key) ?? [];
    this.byKey.set(key, [...existing, snapshot]);
  }

  async loadLatest(key: string): Promise<T | null> {
    const list = this.byKey.get(key) ?? [];
    return list[list.length - 1] ?? null;
  }

  /** Test helper — seeds the store with an initial snapshot. */
  seed(key: string, snapshot: T): this {
    void this.save(key, snapshot);
    return this;
  }
}
