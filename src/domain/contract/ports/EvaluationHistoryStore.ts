/**
 * Secondary port — persists evaluation snapshots keyed by a stable string
 * and loads the most recent one so the reporter can show deltas between
 * runs. Generic over snapshot type so the same store implementation works
 * for skill-eval and project-eval.
 *
 * Adapters: FileSystemEvaluationHistoryStore (real, writes to
 * `.quatermaster/history/<key>/<iso>.json`),
 * InMemoryEvaluationHistoryStore (fake/test).
 *
 * The `key` is opaque to the port — callers derive it (e.g. skill+dataset
 * basenames for skill eval, sanitised projectPath for project eval).
 */
export interface EvaluationHistoryStore<T> {
  /** Writes `snapshot` under `key` so it can be retrieved on the next run. */
  save(key: string, snapshot: T): Promise<void>;

  /**
   * Returns the most recent prior snapshot for `key`, or `null` when no
   * history exists yet.
   */
  loadLatest(key: string): Promise<T | null>;
}
