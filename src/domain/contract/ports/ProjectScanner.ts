import type { ProjectSnapshot } from '../ProjectSnapshot.js';

/**
 * Secondary port — reads a target project's filesystem and produces
 * a serialisable snapshot for deterministic checks and the LLM judge.
 *
 * Adapters: FileSystemScanner (real), InMemoryProjectScanner (fake/test).
 */
export interface ProjectScanner {
  /**
   * Scans the project at `projectPath` and returns a snapshot.
   *
   * @throws {Error} when `projectPath` does not exist or is not readable.
   */
  scan(projectPath: string): Promise<ProjectSnapshot>;
}
