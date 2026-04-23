/** Kind of change observed on a single path after an agent run. */
export type FileChangeType = 'created' | 'modified' | 'deleted';

/**
 * A single file change captured from a sandboxed agent run.
 * Paths are relative to the workspace root.
 */
export interface FileDiff {
  readonly path: string;
  readonly changeType: FileChangeType;
  /** Content before the run. Undefined when `changeType === 'created'`. */
  readonly contentBefore?: string;
  /** Content after the run. Undefined when `changeType === 'deleted'`. */
  readonly contentAfter?: string;
}
