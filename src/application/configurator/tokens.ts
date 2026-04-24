import type Anthropic from '@anthropic-ai/sdk';
import type { AgentRunWorkspace } from '../../domain/contract/ports/AgentRunWorkspace.js';
import type { DatasetLoader } from '../../domain/contract/ports/DatasetLoader.js';
import type { EvaluationHistoryStore } from '../../domain/contract/ports/EvaluationHistoryStore.js';
import type { LLMJudge } from '../../domain/contract/ports/LLMJudge.js';
import type { ProjectScanner } from '../../domain/contract/ports/ProjectScanner.js';
import type { SkillJudge } from '../../domain/contract/ports/SkillJudge.js';
import type { SkillRunner } from '../../domain/contract/ports/SkillRunner.js';
import type { ProjectHistorySnapshot } from '../../domain/contract/ProjectHistorySnapshot.js';
import type { EvaluationHistorySnapshot } from '../../domain/contract/EvaluationHistorySnapshot.js';
import type { EvaluateProjectHandler } from '../../domain/core/evaluation/EvaluateProjectHandler.js';
import type { EvaluateSkillHandler } from '../../domain/core/skill-evaluation/EvaluateSkillHandler.js';
import { token, type Token } from './Token.js';

/** One shared Anthropic SDK client for every judge that hits the API. */
export const AnthropicClientToken: Token<Anthropic> = token<Anthropic>('AnthropicClient');

export const ProjectScannerToken: Token<ProjectScanner> = token<ProjectScanner>('ProjectScanner');
export const LLMJudgeToken: Token<LLMJudge> = token<LLMJudge>('LLMJudge');
export const SkillRunnerToken: Token<SkillRunner> = token<SkillRunner>('SkillRunner');
export const DatasetLoaderToken: Token<DatasetLoader> = token<DatasetLoader>('DatasetLoader');
export const SkillJudgeToken: Token<SkillJudge> = token<SkillJudge>('SkillJudge');

/**
 * Optional port: callers should prefer `Container.tryResolve(AgentRunWorkspaceToken)`
 * so the text-only skill-evaluation path still works when no workspace is wired.
 */
export const AgentRunWorkspaceToken: Token<AgentRunWorkspace> =
  token<AgentRunWorkspace>('AgentRunWorkspace');

export const ProjectHistoryStoreToken: Token<EvaluationHistoryStore<ProjectHistorySnapshot>> =
  token<EvaluationHistoryStore<ProjectHistorySnapshot>>('ProjectHistoryStore');
export const SkillHistoryStoreToken: Token<EvaluationHistoryStore<EvaluationHistorySnapshot>> =
  token<EvaluationHistoryStore<EvaluationHistorySnapshot>>('SkillHistoryStore');

export const EvaluateProjectHandlerToken: Token<EvaluateProjectHandler> =
  token<EvaluateProjectHandler>('EvaluateProjectHandler');
export const EvaluateSkillHandlerToken: Token<EvaluateSkillHandler> =
  token<EvaluateSkillHandler>('EvaluateSkillHandler');
