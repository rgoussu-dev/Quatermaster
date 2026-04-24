import Anthropic from '@anthropic-ai/sdk';
import { FileSystemAgentRunWorkspace } from '../../../infrastructure/agent-workspace/real/FileSystemAgentRunWorkspace.js';
import { FileSystemDatasetLoader } from '../../../infrastructure/dataset-loader/real/FileSystemDatasetLoader.js';
import { FileSystemEvaluationHistoryStore } from '../../../infrastructure/history-store/real/FileSystemEvaluationHistoryStore.js';
import {
  validateProjectSnapshot,
  validateSkillSnapshot,
} from '../../../infrastructure/history-store/real/snapshotSchemas.js';
import { ClaudeCodeJudge } from '../../../infrastructure/llm-judge/claude-cli/ClaudeCodeJudge.js';
import { AnthropicLLMJudge } from '../../../infrastructure/llm-judge/real/AnthropicLLMJudge.js';
import { FileSystemScanner } from '../../../infrastructure/project-scanner/real/FileSystemScanner.js';
import { ClaudeCodeSkillJudge } from '../../../infrastructure/skill-judge/claude-cli/ClaudeCodeSkillJudge.js';
import { AnthropicSkillJudge } from '../../../infrastructure/skill-judge/real/AnthropicSkillJudge.js';
import { ClaudeCodeSkillRunner } from '../../../infrastructure/skill-runner/real/ClaudeCodeSkillRunner.js';
import type { Container } from '../Container.js';
import {
  AgentRunWorkspaceToken,
  AnthropicClientToken,
  DatasetLoaderToken,
  LLMJudgeToken,
  ProjectHistoryStoreToken,
  ProjectScannerToken,
  SkillHistoryStoreToken,
  SkillJudgeToken,
  SkillRunnerToken,
} from '../tokens.js';

/** Backend for both LLMJudge and SkillJudge. */
export type JudgeMode = 'api' | 'claude-cli';

/** Options the CLI (or another entrypoint) passes to the production profile. */
export interface ProductionProfileOptions {
  readonly judge: JudgeMode;
  /** Absolute path where `.quatermaster/history` lives. */
  readonly historyDir: string;
  /** When true, also binds the workspace-backed agent runner. */
  readonly enableWorkspace?: boolean;
  /** Only honoured when `enableWorkspace` is true. */
  readonly keepWorkspace?: boolean;
}

/**
 * Binds every production adapter. Missing `ANTHROPIC_API_KEY` is surfaced
 * lazily — only the tokens that need the client will trigger the failure,
 * so `--judge claude-cli` works without an env var.
 */
export function applyProductionProfile(
  container: Container,
  options: ProductionProfileOptions,
): void {
  container.bind(AnthropicClientToken, () => {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for --judge api.');
    }
    return new Anthropic({ apiKey });
  });

  container.bind(ProjectScannerToken, () => new FileSystemScanner());
  container.bind(SkillRunnerToken, () => new ClaudeCodeSkillRunner());
  container.bind(DatasetLoaderToken, () => new FileSystemDatasetLoader());

  container.bind(LLMJudgeToken, (c) =>
    options.judge === 'api'
      ? new AnthropicLLMJudge(c.resolve(AnthropicClientToken))
      : new ClaudeCodeJudge(),
  );
  container.bind(SkillJudgeToken, (c) =>
    options.judge === 'api'
      ? new AnthropicSkillJudge(c.resolve(AnthropicClientToken))
      : new ClaudeCodeSkillJudge(),
  );

  if (options.enableWorkspace) {
    const keepWorkspace = options.keepWorkspace === true;
    container.bind(
      AgentRunWorkspaceToken,
      () => new FileSystemAgentRunWorkspace({ keepWorkspace }),
    );
  }

  container.bind(
    ProjectHistoryStoreToken,
    () => new FileSystemEvaluationHistoryStore(options.historyDir, validateProjectSnapshot),
  );
  container.bind(
    SkillHistoryStoreToken,
    () => new FileSystemEvaluationHistoryStore(options.historyDir, validateSkillSnapshot),
  );
}
