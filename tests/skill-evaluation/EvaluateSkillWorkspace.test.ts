import { describe, it, expect } from 'vitest';
import { EvaluateSkill } from '../../src/domain/core/skill-evaluation/EvaluateSkill.js';
import { buildWorkspaceMediator } from './EvaluateSkillFactory.js';
import {
  DATASET_PATH,
  SKILL_PATH,
  workspaceDataset,
  workspaceOutcomes,
  workspaceJudgeResponses,
  similarityDataset,
  similarityOutcomes,
  similarityJudgeResponses,
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

  describe('diff-similarity metric', () => {
    it('emits diff-similarity and scores near-matches highly', async () => {
      const mediator = buildWorkspaceMediator(
        similarityDataset(),
        similarityOutcomes(),
        similarityJudgeResponses(),
      );
      const result = await mediator.dispatch(new EvaluateSkill(SKILL_PATH, DATASET_PATH));

      if (!result.ok) throw new Error('Expected success');

      const close = result.value.cases.find((c) => c.id === 'similarity-close');
      const sim = close?.metrics?.find((m) => m.metricId === 'diff-similarity');
      expect(sim).toBeDefined();
      expect(sim?.score).toBeGreaterThanOrEqual(60);
      expect(sim?.score).toBeLessThan(100);
    });

    it('penalises wildly-different artifacts even when the judge missed it', async () => {
      const mediator = buildWorkspaceMediator(
        similarityDataset(),
        similarityOutcomes(),
        similarityJudgeResponses(),
      );
      const result = await mediator.dispatch(new EvaluateSkill(SKILL_PATH, DATASET_PATH));

      if (!result.ok) throw new Error('Expected success');

      const far = result.value.cases.find((c) => c.id === 'similarity-far');
      const sim = far?.metrics?.find((m) => m.metricId === 'diff-similarity');
      expect(sim?.score).toBe(0);
    });

    it('does not emit diff-similarity when no artifact declares a golden', async () => {
      const mediator = buildWorkspaceMediator(
        workspaceDataset(),
        workspaceOutcomes(),
        workspaceJudgeResponses(),
      );
      const result = await mediator.dispatch(new EvaluateSkill(SKILL_PATH, DATASET_PATH));

      if (!result.ok) throw new Error('Expected success');

      for (const c of result.value.cases) {
        expect(c.metrics?.find((m) => m.metricId === 'diff-similarity')).toBeUndefined();
      }
    });
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

  it('does not crash on an invalid contentPattern regex', async () => {
    const dataset = workspaceDataset();
    const override = {
      ...dataset,
      cases: dataset.cases.map((c) =>
        c.id === 'artifact-ideal'
          ? {
              ...c,
              expectedArtifacts: [{ path: 'COMMIT_MSG', contentPattern: '[unclosed' }],
            }
          : c,
      ),
    };
    const mediator = buildWorkspaceMediator(
      override,
      workspaceOutcomes(),
      workspaceJudgeResponses(),
    );
    const result = await mediator.dispatch(new EvaluateSkill(SKILL_PATH, DATASET_PATH));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ideal = result.value.cases.find((c) => c.id === 'artifact-ideal');
    const artifactMetric = ideal?.metrics?.find((m) => m.metricId === 'artifact-presence');
    expect(artifactMetric?.score).toBe(0);
    expect(artifactMetric?.rationale).toMatch(/invalid content pattern/);
  });

  it('counts a seeded-but-unchanged file as present via postRunFiles', async () => {
    // Agent makes no file changes; the file is present only because the
    // workspace was seeded. The artifact-presence metric must still pass.
    const dataset = {
      cases: [
        {
          id: 'seeded',
          prompt: 'Leave the existing README alone.',
          expectedBehavior: 'README is unchanged.',
          threshold: 70,
          expectedArtifacts: [{ path: 'README.md' }],
        },
      ],
    };
    const outcomes = new Map([
      [
        `${SKILL_PATH}::${dataset.cases[0]!.prompt}`,
        {
          stdout: 'Nothing to do.',
          stderr: '',
          exitCode: 0,
          durationMs: 5,
          workspacePath: '/tmp/fake-seeded',
          fileChanges: [],
          postRunFiles: new Map([['README.md', '# seeded\n']]),
        },
      ],
    ]);
    const judgeResponses = new Map([['seeded', { score: 90, observations: ['left file alone'] }]]);

    const mediator = buildWorkspaceMediator(dataset, outcomes, judgeResponses);
    const result = await mediator.dispatch(new EvaluateSkill(SKILL_PATH, DATASET_PATH));

    if (!result.ok) throw new Error('Expected success');
    const c = result.value.cases[0];
    const presence = c?.metrics?.find((m) => m.metricId === 'artifact-presence');
    expect(presence?.score).toBe(100);
    expect(c?.passed).toBe(true);
  });
});
