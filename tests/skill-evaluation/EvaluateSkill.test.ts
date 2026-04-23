import { describe, it, expect } from 'vitest';
import { EvaluateSkill } from '../../src/domain/core/skill-evaluation/EvaluateSkill.js';
import {
  passingDataset,
  mixedDataset,
  passingJudgeResponses,
  mixedJudgeResponses,
} from './EvaluateSkillScenario.js';
import { buildMediator } from './EvaluateSkillFactory.js';
import { SKILL_PATH, DATASET_PATH } from './EvaluateSkillScenario.js';

describe('EvaluateSkill', () => {
  describe('all-passing dataset', () => {
    it('returns a successful result with 100% pass rate', async () => {
      const mediator = buildMediator(passingDataset(), passingJudgeResponses());
      const result = await mediator.dispatch(new EvaluateSkill(SKILL_PATH, DATASET_PATH));

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.passRate).toBe(1);
      expect(result.value.passedCases).toBe(result.value.totalCases);
    });

    it('includes a result entry for each dataset case', async () => {
      const dataset = passingDataset();
      const mediator = buildMediator(dataset, passingJudgeResponses());
      const result = await mediator.dispatch(new EvaluateSkill(SKILL_PATH, DATASET_PATH));

      if (!result.ok) throw new Error('Expected success');

      expect(result.value.cases).toHaveLength(dataset.cases.length);
    });

    it('records skillPath and datasetPath on the result', async () => {
      const mediator = buildMediator(passingDataset(), passingJudgeResponses());
      const result = await mediator.dispatch(new EvaluateSkill(SKILL_PATH, DATASET_PATH));

      if (!result.ok) throw new Error('Expected success');

      expect(result.value.skillPath).toBe(SKILL_PATH);
      expect(result.value.datasetPath).toBe(DATASET_PATH);
    });
  });

  describe('mixed dataset', () => {
    it('computes the correct pass rate when some cases fail', async () => {
      const mediator = buildMediator(mixedDataset(), mixedJudgeResponses());
      const result = await mediator.dispatch(new EvaluateSkill(SKILL_PATH, DATASET_PATH));

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.passedCases).toBe(1);
      expect(result.value.totalCases).toBe(2);
      expect(result.value.passRate).toBeCloseTo(0.5, 5);
    });

    it('marks cases with score below threshold as failed', async () => {
      const mediator = buildMediator(mixedDataset(), mixedJudgeResponses());
      const result = await mediator.dispatch(new EvaluateSkill(SKILL_PATH, DATASET_PATH));

      if (!result.ok) throw new Error('Expected success');

      const failedCase = result.value.cases.find((c) => c.id === 'bad-case');
      expect(failedCase).toBeDefined();
      expect(failedCase?.passed).toBe(false);
      expect(failedCase?.score).toBeLessThan(70);
    });
  });

  describe('missing dataset', () => {
    it('returns failure when the dataset path does not exist', async () => {
      const mediator = buildMediator(passingDataset());
      const result = await mediator.dispatch(
        new EvaluateSkill(SKILL_PATH, '/nonexistent/dataset.json'),
      );

      expect(result.ok).toBe(false);
    });
  });
});
