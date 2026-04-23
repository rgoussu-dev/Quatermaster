import { describe, it, expect } from 'vitest';
import { EvaluateSkill } from '../../src/domain/core/skill-evaluation/EvaluateSkill.js';
import { buildWorkspaceMediator } from './EvaluateSkillFactory.js';
import {
  DATASET_PATH,
  SKILL_PATH,
  workspaceDataset,
  workspaceOutcomes,
  workspaceJudgeResponses,
} from './EvaluateSkillScenario.js';

describe('EvaluateSkill (workspace + fitness)', () => {
  it('passes the artifact-ideal case when all expected files are produced', async () => {
    const mediator = buildWorkspaceMediator(
      workspaceDataset(),
      workspaceOutcomes(),
      workspaceJudgeResponses(),
    );
    const result = await mediator.dispatch(new EvaluateSkill(SKILL_PATH, DATASET_PATH));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ideal = result.value.cases.find((c) => c.id === 'artifact-ideal');
    expect(ideal?.passed).toBe(true);
    expect(ideal?.metrics?.find((m) => m.metricId === 'artifact-presence')?.score).toBe(100);
  });

  it('fails the artifact-missing case even with a high LLM judge score', async () => {
    const mediator = buildWorkspaceMediator(
      workspaceDataset(),
      workspaceOutcomes(),
      workspaceJudgeResponses(),
    );
    const result = await mediator.dispatch(new EvaluateSkill(SKILL_PATH, DATASET_PATH));

    if (!result.ok) throw new Error('Expected success');

    const missing = result.value.cases.find((c) => c.id === 'artifact-missing');
    expect(missing?.passed).toBe(false);
    const artifactMetric = missing?.metrics?.find((m) => m.metricId === 'artifact-presence');
    expect(artifactMetric?.score).toBe(0);
    const llmMetric = missing?.metrics?.find((m) => m.metricId === 'llm-judge');
    expect(llmMetric?.score).toBe(85);
  });

  it('records file changes on the case result', async () => {
    const mediator = buildWorkspaceMediator(
      workspaceDataset(),
      workspaceOutcomes(),
      workspaceJudgeResponses(),
    );
    const result = await mediator.dispatch(new EvaluateSkill(SKILL_PATH, DATASET_PATH));

    if (!result.ok) throw new Error('Expected success');

    const ideal = result.value.cases.find((c) => c.id === 'artifact-ideal');
    expect(ideal?.fileChanges).toHaveLength(1);
    expect(ideal?.fileChanges?.[0]).toMatchObject({
      path: 'COMMIT_MSG',
      changeType: 'created',
    });
  });

  it('produces a scenario breakdown when cases are tagged', async () => {
    const mediator = buildWorkspaceMediator(
      workspaceDataset(),
      workspaceOutcomes(),
      workspaceJudgeResponses(),
    );
    const result = await mediator.dispatch(new EvaluateSkill(SKILL_PATH, DATASET_PATH));

    if (!result.ok) throw new Error('Expected success');

    expect(result.value.scenarioBreakdown).toBeDefined();
    expect(result.value.scenarioBreakdown?.ideal).toEqual({ total: 1, passed: 1 });
    expect(result.value.scenarioBreakdown?.realistic).toEqual({ total: 1, passed: 0 });
    expect(result.value.scenarioBreakdown?.adversarial).toEqual({ total: 1, passed: 1 });
  });

  it('honours per-case metricWeights overrides', async () => {
    const dataset = workspaceDataset();
    const override = {
      ...dataset,
      cases: dataset.cases.map((c) =>
        c.id === 'artifact-missing'
          ? { ...c, metricWeights: { 'artifact-presence': 0, 'llm-judge': 1, 'exit-code': 0 } }
          : c,
      ),
    };
    const mediator = buildWorkspaceMediator(
      override,
      workspaceOutcomes(),
      workspaceJudgeResponses(),
    );
    const result = await mediator.dispatch(new EvaluateSkill(SKILL_PATH, DATASET_PATH));

    if (!result.ok) throw new Error('Expected success');

    const missing = result.value.cases.find((c) => c.id === 'artifact-missing');
    // With artifact weight zeroed out, the case should pass on the high judge score.
    expect(missing?.score).toBe(85);
    expect(missing?.passed).toBe(true);
  });
});
