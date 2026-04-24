import type { DimensionId } from '../../src/domain/contract/DimensionScore.js';
import type { JudgeResponse } from '../../src/domain/contract/ports/LLMJudge.js';
import type { ProjectSnapshot } from '../../src/domain/contract/ProjectSnapshot.js';
import { Mediator } from '../../src/domain/contract/kernel/Mediator.js';
import { InMemoryProjectScanner } from '../../src/infrastructure/project-scanner/fake/InMemoryProjectScanner.js';
import { StubLLMJudge } from '../../src/infrastructure/llm-judge/fake/StubLLMJudge.js';
import {
  buildTestContainer,
  EvaluateProjectHandlerToken,
  LLMJudgeToken,
  ProjectScannerToken,
} from '../../src/application/configurator/index.js';

/**
 * Wires an EvaluateProjectHandler via the test profile, overriding the
 * scanner and judge bindings with scenario-specific fakes. Returns a
 * ready-to-dispatch Mediator.
 */
export function buildMediator(
  snapshot: ProjectSnapshot,
  judgeResponses: Partial<Record<DimensionId, JudgeResponse>> = {},
): Mediator {
  const container = buildTestContainer();
  container.rebindValue(ProjectScannerToken, new InMemoryProjectScanner(snapshot));
  container.rebindValue(LLMJudgeToken, new StubLLMJudge(judgeResponses));
  return new Mediator([container.resolve(EvaluateProjectHandlerToken)]);
}
