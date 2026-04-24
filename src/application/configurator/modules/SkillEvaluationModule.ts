import { EvaluateSkillHandler } from '../../../domain/core/skill-evaluation/EvaluateSkillHandler.js';
import type { Container } from '../Container.js';
import {
  AgentRunWorkspaceToken,
  DatasetLoaderToken,
  EvaluateSkillHandlerToken,
  SkillJudgeToken,
  SkillRunnerToken,
} from '../tokens.js';

/**
 * Registers the skill-evaluation handler. The workspace port is optional —
 * when `AgentRunWorkspaceToken` is unbound the handler falls back to the
 * text-only path driven by `SkillRunnerToken`.
 */
export function applySkillEvaluationModule(container: Container): void {
  container.bind(EvaluateSkillHandlerToken, (c) => {
    const workspace = c.tryResolve(AgentRunWorkspaceToken);
    return new EvaluateSkillHandler(
      c.resolve(SkillRunnerToken),
      c.resolve(DatasetLoaderToken),
      c.resolve(SkillJudgeToken),
      workspace,
    );
  });
}
