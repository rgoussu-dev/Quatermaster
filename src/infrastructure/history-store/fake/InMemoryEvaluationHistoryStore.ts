import type { EvaluationHistoryStore } from '../../../domain/contract/ports/EvaluationHistoryStore.js';
import type { EvaluationHistorySnapshot } from '../../../domain/contract/EvaluationHistorySnapshot.js';

/**
 * Fake implementation of EvaluationHistoryStore.
 * Keeps an in-memory list of snapshots per `${skillPath}::${datasetPath}` key —
 * `loadLatest` returns the last one saved. Canonical reference for tests.
 */
export class InMemoryEvaluationHistoryStore implements EvaluationHistoryStore {
  private readonly byKey = new Map<string, EvaluationHistorySnapshot[]>();

  async save(snapshot: EvaluationHistorySnapshot): Promise<void> {
    const key = this.key(snapshot.skillPath, snapshot.datasetPath);
    const existing = this.byKey.get(key) ?? [];
    this.byKey.set(key, [...existing, snapshot]);
  }

  async loadLatest(
    skillPath: string,
    datasetPath: string,
  ): Promise<EvaluationHistorySnapshot | null> {
    const list = this.byKey.get(this.key(skillPath, datasetPath)) ?? [];
    return list[list.length - 1] ?? null;
  }

  /** Test helper — seeds the store with an initial snapshot. */
  seed(snapshot: EvaluationHistorySnapshot): this {
    void this.save(snapshot);
    return this;
  }

  private key(skillPath: string, datasetPath: string): string {
    return `${skillPath}::${datasetPath}`;
  }
}
