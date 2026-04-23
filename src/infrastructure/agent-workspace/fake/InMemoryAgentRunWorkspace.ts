import type {
  AgentRunWorkspace,
  AgentRunRequest,
} from '../../../domain/contract/ports/AgentRunWorkspace.js';
import type { AgentRunOutcome } from '../../../domain/contract/AgentRunOutcome.js';

/**
 * Fake implementation of AgentRunWorkspace.
 * Returns preset outcomes keyed by `${skillPath}::${userPrompt}` or falls
 * back to an empty-success outcome — the canonical reference for tests.
 */
export class InMemoryAgentRunWorkspace implements AgentRunWorkspace {
  constructor(
    private readonly outcomes: Map<string, AgentRunOutcome> = new Map(),
    private readonly fallback: AgentRunOutcome = {
      stdout: 'Stub agent output',
      stderr: '',
      exitCode: 0,
      durationMs: 0,
      fileChanges: [],
      postRunFiles: new Map(),
      workspacePath: '/tmp/fake-workspace',
    },
  ) {}

  async run(request: AgentRunRequest): Promise<AgentRunOutcome> {
    const key = `${request.skillPath}::${request.userPrompt}`;
    return this.outcomes.get(key) ?? this.fallback;
  }
}
