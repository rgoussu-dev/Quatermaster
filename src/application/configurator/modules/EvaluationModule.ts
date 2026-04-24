import { EvaluateProjectHandler } from '../../../domain/core/evaluation/EvaluateProjectHandler.js';
import type { Container } from '../Container.js';
import { EvaluateProjectHandlerToken, LLMJudgeToken, ProjectScannerToken } from '../tokens.js';

/**
 * Registers the project-evaluation handler. Depends on the profile having
 * already bound `ProjectScannerToken` and `LLMJudgeToken`.
 */
export function applyEvaluationModule(container: Container): void {
  container.bind(EvaluateProjectHandlerToken, (c) => {
    return new EvaluateProjectHandler(c.resolve(ProjectScannerToken), c.resolve(LLMJudgeToken));
  });
}
