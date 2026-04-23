import { describe, it, expect } from 'vitest';
import { EvaluateProject } from '../../src/domain/core/evaluation/EvaluateProject.js';
import {
  wellConfiguredSnapshot,
  minimalSnapshot,
  wellConfiguredJudgeResponses,
  minimalJudgeResponses,
} from './EvaluateProjectScenario.js';
import { buildMediator } from './EvaluateProjectFactory.js';

describe('EvaluateProject', () => {
  describe('well-configured project', () => {
    it('returns a successful result with a high overall score', async () => {
      const mediator = buildMediator(wellConfiguredSnapshot(), wellConfiguredJudgeResponses());
      const result = await mediator.dispatch(new EvaluateProject('/test/well-configured'));

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.overallScore).toBeGreaterThan(60);
      expect(['A', 'B']).toContain(result.value.overallGrade);
      expect(result.value.dimensions).toHaveLength(4);
      expect(result.value.topRecommendations.length).toBeGreaterThan(0);
    });

    it('returns all four dimension scores', async () => {
      const mediator = buildMediator(wellConfiguredSnapshot(), wellConfiguredJudgeResponses());
      const result = await mediator.dispatch(new EvaluateProject('/test/well-configured'));

      if (!result.ok) throw new Error('Expected success');

      const dimensionIds = result.value.dimensions.map((d) => d.dimension);
      expect(dimensionIds).toContain('claude-code-setup');
      expect(dimensionIds).toContain('project-structure');
      expect(dimensionIds).toContain('test-infrastructure');
      expect(dimensionIds).toContain('documentation');
    });

    it('dimension weights sum to 1', async () => {
      const mediator = buildMediator(wellConfiguredSnapshot(), wellConfiguredJudgeResponses());
      const result = await mediator.dispatch(new EvaluateProject('/test/well-configured'));

      if (!result.ok) throw new Error('Expected success');

      const totalWeight = result.value.dimensions.reduce((acc, d) => acc + d.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 5);
    });
  });

  describe('minimal project', () => {
    it('returns a successful result with a low overall score', async () => {
      const mediator = buildMediator(minimalSnapshot(), minimalJudgeResponses());
      const result = await mediator.dispatch(new EvaluateProject('/test/minimal'));

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.overallScore).toBeLessThan(40);
      expect(['D', 'F']).toContain(result.value.overallGrade);
    });

    it('surfaces critical findings for a missing CLAUDE.md and README', async () => {
      const mediator = buildMediator(minimalSnapshot(), minimalJudgeResponses());
      const result = await mediator.dispatch(new EvaluateProject('/test/minimal'));

      if (!result.ok) throw new Error('Expected success');

      const allFindings = result.value.dimensions.flatMap((d) => d.findings);
      const criticals = allFindings.filter((f) => f.severity === 'critical');
      expect(criticals.length).toBeGreaterThan(0);
    });
  });

  describe('Mediator', () => {
    it('returns failure for an unregistered action type', async () => {
      const mediator = buildMediator(minimalSnapshot());

      class UnknownAction {
        readonly _resultType = undefined;
      }

      const result = await mediator.dispatch(new UnknownAction() as never);
      expect(result.ok).toBe(false);
    });
  });
});
