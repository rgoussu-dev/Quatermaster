import type { FileDiff } from './FileDiff.js';

/**
 * Outcome of running an agent against a prompt inside an isolated workspace.
 * Captures both the textual reply and the filesystem changes the agent made.
 */
export interface AgentRunOutcome {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly fileChanges: readonly FileDiff[];
  /** Absolute path to the workspace directory used for the run. */
  readonly workspacePath: string;
}
