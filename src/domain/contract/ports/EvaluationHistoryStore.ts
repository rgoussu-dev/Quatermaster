import type { EvaluationHistorySnapshot } from '../EvaluationHistorySnapshot.js';

/**
 * Secondary port — persists evaluation snapshots and loads the most recent
 * one for a given (skillPath, datasetPath) key so the reporter can show
 * per-metric and per-case deltas between runs.
 *
 * Adapters: FileSystemEvaluationHistoryStore (real, writes to
 * `.quatermaster/history/`), InMemoryEvaluationHistoryStore (fake/test).
 */
export interface EvaluationHistoryStore {
  /** Writes `snapshot` so it can be retrieved as the "previous" run next time. */
  save(snapshot: EvaluationHistorySnapshot): Promise<void>;

  /**
   * Returns the most recent prior snapshot for the given key, or `null`
   * when no history exists yet (first run of this skill+dataset pair).
   */
  loadLatest(
    skillPath: string,
    datasetPath: string,
  ): Promise<EvaluationHistorySnapshot | null>;
}
