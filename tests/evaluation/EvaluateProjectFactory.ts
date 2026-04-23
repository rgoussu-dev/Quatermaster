import type { DimensionId } from '../../src/domain/contract/DimensionScore.js';
import type { JudgeResponse } from '../../src/domain/contract/ports/LLMJudge.js';
import type { ProjectSnapshot } from '../../src/domain/contract/ProjectSnapshot.js';
import { EvaluateProjectHandler } from '../../src/domain/core/evaluation/EvaluateProjectHandler.js';
import { InMemoryProjectScanner } from '../../src/infrastructure/project-scanner/fake/InMemoryProjectScanner.js';
import { StubLLMJudge } from '../../src/infrastructure/llm-judge/fake/StubLLMJudge.js';
import { Mediator } from '../../src/domain/contract/kernel/Mediator.js';

/**
 * Wires an EvaluateProjectHandler with the fake scanner and judge,
 * returns a ready-to-dispatch Mediator.
 */
export function buildMediator(
  snapshot: ProjectSnapshot,
  judgeResponses: Partial<Record<DimensionId, JudgeResponse>> = {},
): Mediator {
  const scanner = new InMemoryProjectScanner(snapshot);
  const judge = new StubLLMJudge(judgeResponses);
  const handler = new EvaluateProjectHandler(scanner, judge);
  return new Mediator([handler]);
}
