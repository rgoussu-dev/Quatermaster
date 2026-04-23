import type { AgentRunOutcome } from '../AgentRunOutcome.js';

/** Inputs for a single sandboxed agent run. */
export interface AgentRunRequest {
  /** Absolute path to the skill / context markdown file to load. */
  readonly skillPath: string;
  /** The user task sent to the agent. */
  readonly userPrompt: string;
  /** Optional seed directory copied into the workspace before the run. */
  readonly seedRepoPath?: string;
}

/**
 * Secondary port — runs an agent in an isolated workspace and returns the
 * stdout plus the filesystem diff the agent produced.
 *
 * Adapters: FileSystemAgentRunWorkspace (real, tmp-dir based),
 * InMemoryAgentRunWorkspace (fake/test).
 */
export interface AgentRunWorkspace {
  run(request: AgentRunRequest): Promise<AgentRunOutcome>;
}
