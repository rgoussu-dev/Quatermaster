import { Mediator } from '../../src/domain/contract/kernel/Mediator.js';
import { EvaluateSkillHandler } from '../../src/domain/core/skill-evaluation/EvaluateSkillHandler.js';
import { InMemorySkillRunner } from '../../src/infrastructure/skill-runner/fake/InMemorySkillRunner.js';
import { InMemoryDatasetLoader } from '../../src/infrastructure/dataset-loader/fake/InMemoryDatasetLoader.js';
import { StubSkillJudge } from '../../src/infrastructure/skill-judge/fake/StubSkillJudge.js';
import type { SkillDataset } from '../../src/domain/contract/ports/DatasetLoader.js';
import type { SkillJudgeResponse } from '../../src/domain/contract/ports/SkillJudge.js';
import { DATASET_PATH, SKILL_PATH, runnerOutputs } from './EvaluateSkillScenario.js';

/**
 * Builds a Mediator wired with fakes for skill evaluation tests.
 * `judgeResponses` is a map from case id to the preset response.
 */
export function buildMediator(
  dataset: SkillDataset,
  judgeResponses: Map<string, SkillJudgeResponse> = new Map(),
): Mediator {
  const datasets = new Map([[DATASET_PATH, dataset]]);
  const outputs = runnerOutputs(dataset);

  const skillRunner = new InMemorySkillRunner(outputs);
  const datasetLoader = new InMemoryDatasetLoader(datasets);

  // Route each case to its preset judge response by matching against actual output content
  const defaultResponse: SkillJudgeResponse = { score: 70, observations: ['Stub observation'] };
  const stubJudge = new RoutingStubJudge(dataset, judgeResponses, defaultResponse);

  const handler = new EvaluateSkillHandler(skillRunner, datasetLoader, stubJudge);
  return new Mediator([handler]);
}

/** Delegates judge calls to per-case preset responses based on matching actual output. */
class RoutingStubJudge extends StubSkillJudge {
  constructor(
    private readonly dataset: SkillDataset,
    private readonly responses: Map<string, SkillJudgeResponse>,
    private readonly fallback: SkillJudgeResponse,
  ) {
    super();
  }

  override async judge(request: { actualOutput: string; expectedBehavior: string }): Promise<SkillJudgeResponse> {
    // Match by finding the case whose output appears in actualOutput
    for (const c of this.dataset.cases) {
      if (request.actualOutput.includes(c.prompt)) {
        return this.responses.get(c.id) ?? this.fallback;
      }
    }
    return this.fallback;
  }
}
