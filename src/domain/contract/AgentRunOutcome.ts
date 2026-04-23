import type { FileDiff } from './FileDiff.js';

/**
 * Outcome of running an agent against a prompt inside an isolated workspace.
 * Captures both the textual reply and the filesystem state the agent left
 * behind.
 *
 * `fileChanges` is a delta view (what changed during the run — used by the
 * reporter and history snapshots). `postRunFiles` is the authoritative
 * presence/content map of all files that exist after the run, so metrics
 * can correctly score seeded-but-unchanged artifacts as present without
 * having to guess from the diff.
 */
export interface AgentRunOutcome {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly fileChanges: readonly FileDiff[];
  /** Path → content for every file present in the workspace after the run. */
  readonly postRunFiles: ReadonlyMap<string, string>;
  /** Absolute path to the workspace directory used for the run. */
  readonly workspacePath: string;
}
