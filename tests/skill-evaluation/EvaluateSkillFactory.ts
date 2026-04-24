import { Mediator } from '../../src/domain/contract/kernel/Mediator.js';
import { InMemorySkillRunner } from '../../src/infrastructure/skill-runner/fake/InMemorySkillRunner.js';
import { InMemoryAgentRunWorkspace } from '../../src/infrastructure/agent-workspace/fake/InMemoryAgentRunWorkspace.js';
import { InMemoryDatasetLoader } from '../../src/infrastructure/dataset-loader/fake/InMemoryDatasetLoader.js';
import { StubSkillJudge } from '../../src/infrastructure/skill-judge/fake/StubSkillJudge.js';
import type { SkillDataset } from '../../src/domain/contract/ports/DatasetLoader.js';
import type { SkillJudgeResponse } from '../../src/domain/contract/ports/SkillJudge.js';
import type { AgentRunOutcome } from '../../src/domain/contract/AgentRunOutcome.js';
import {
  AgentRunWorkspaceToken,
  buildTestContainer,
  DatasetLoaderToken,
  EvaluateSkillHandlerToken,
  SkillJudgeToken,
  SkillRunnerToken,
} from '../../src/application/configurator/index.js';
import { DATASET_PATH, runnerOutputs } from './EvaluateSkillScenario.js';

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

  const container = buildTestContainer();
  container.rebindValue(SkillRunnerToken, new InMemorySkillRunner(outputs));
  container.rebindValue(DatasetLoaderToken, new InMemoryDatasetLoader(datasets));

  const defaultResponse: SkillJudgeResponse = { score: 70, observations: ['Stub observation'] };
  container.rebindValue(
    SkillJudgeToken,
    new RoutingStubJudge(dataset, judgeResponses, defaultResponse),
  );

  return new Mediator([container.resolve(EvaluateSkillHandlerToken)]);
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

  override async judge(request: {
    actualOutput: string;
    expectedBehavior: string;
  }): Promise<SkillJudgeResponse> {
    for (const c of this.dataset.cases) {
      if (request.actualOutput.includes(c.prompt)) {
        return this.responses.get(c.id) ?? this.fallback;
      }
    }
    return this.fallback;
  }
}

/**
 * Builds a Mediator wired with a workspace-backed skill runner. Outcomes are
 * keyed by `${SKILL_PATH}::${prompt}`; judge responses are routed by expected
 * behaviour, since the workspace-mode stdout need not contain the prompt.
 */
export function buildWorkspaceMediator(
  dataset: SkillDataset,
  outcomes: Map<string, AgentRunOutcome>,
  judgeResponses: Map<string, SkillJudgeResponse> = new Map(),
): Mediator {
  const datasets = new Map([[DATASET_PATH, dataset]]);

  const container = buildTestContainer();
  container.rebind(AgentRunWorkspaceToken, () => new InMemoryAgentRunWorkspace(outcomes));
  container.rebindValue(SkillRunnerToken, new InMemorySkillRunner());
  container.rebindValue(DatasetLoaderToken, new InMemoryDatasetLoader(datasets));

  const defaultResponse: SkillJudgeResponse = { score: 70, observations: ['Stub observation'] };
  container.rebindValue(
    SkillJudgeToken,
    new BehaviorRoutingJudge(dataset, judgeResponses, defaultResponse),
  );

  return new Mediator([container.resolve(EvaluateSkillHandlerToken)]);
}

/** Routes by matching `expectedBehavior` against the case's expectedBehavior. */
class BehaviorRoutingJudge extends StubSkillJudge {
  constructor(
    private readonly dataset: SkillDataset,
    private readonly responses: Map<string, SkillJudgeResponse>,
    private readonly fallback: SkillJudgeResponse,
  ) {
    super();
  }

  override async judge(request: {
    actualOutput: string;
    expectedBehavior: string;
  }): Promise<SkillJudgeResponse> {
    for (const c of this.dataset.cases) {
      if (c.expectedBehavior === request.expectedBehavior) {
        return this.responses.get(c.id) ?? this.fallback;
      }
    }
    return this.fallback;
  }
}
