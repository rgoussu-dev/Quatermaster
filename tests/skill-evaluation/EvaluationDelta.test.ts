import { describe, it, expect } from 'vitest';
import { computeEvaluationDelta } from '../../src/domain/core/skill-evaluation/computeEvaluationDelta.js';
import { toHistorySnapshot } from '../../src/domain/core/skill-evaluation/toHistorySnapshot.js';
import type { EvaluationHistorySnapshot } from '../../src/domain/contract/EvaluationHistorySnapshot.js';
import type { SkillEvaluationResult } from '../../src/domain/contract/SkillEvaluationResult.js';

const SKILL = '/skills/x.md';
const DATASET = '/data/x.json';

function snapshot(
  evaluatedAt: string,
  cases: EvaluationHistorySnapshot['cases'],
): EvaluationHistorySnapshot {
  const passed = cases.filter((c) => c.passed).length;
  return {
    skillPath: SKILL,
    datasetPath: DATASET,
    evaluatedAt,
    totalCases: cases.length,
    passedCases: passed,
    passRate: cases.length === 0 ? 0 : passed / cases.length,
    cases,
  };
}

describe('computeEvaluationDelta', () => {
  it('reports zero changes for identical snapshots', () => {
    const base = snapshot('2026-04-22T00:00:00Z', [
      { id: 'a', score: 80, passed: true },
      { id: 'b', score: 50, passed: false },
    ]);
    const delta = computeEvaluationDelta(base, base);

    expect(delta.passRatePointsChange).toBe(0);
    expect(delta.cases.every((c) => c.scoreChange === 0)).toBe(true);
    expect(delta.newCases).toHaveLength(0);
    expect(delta.removedCases).toHaveLength(0);
  });

  it('classifies per-case status transitions', () => {
    const prev = snapshot('2026-04-22T00:00:00Z', [
      { id: 'a', score: 80, passed: true },
      { id: 'b', score: 50, passed: false },
      { id: 'c', score: 90, passed: true },
      { id: 'd', score: 40, passed: false },
    ]);
    const cur = snapshot('2026-04-23T00:00:00Z', [
      { id: 'a', score: 85, passed: true },
      { id: 'b', score: 75, passed: true },
      { id: 'c', score: 60, passed: false },
      { id: 'd', score: 20, passed: false },
    ]);

    const delta = computeEvaluationDelta(prev, cur);
    const byId = new Map(delta.cases.map((c) => [c.caseId, c]));

    expect(byId.get('a')?.statusChange).toBe('still-passing');
    expect(byId.get('b')?.statusChange).toBe('newly-passing');
    expect(byId.get('c')?.statusChange).toBe('newly-failing');
    expect(byId.get('d')?.statusChange).toBe('still-failing');
  });

  it('computes per-metric deltas when both snapshots carry metrics', () => {
    const prev = snapshot('2026-04-22T00:00:00Z', [
      {
        id: 'a',
        score: 60,
        passed: false,
        metrics: [
          { metricId: 'artifact-presence', score: 40 },
          { metricId: 'llm-judge', score: 80 },
        ],
      },
    ]);
    const cur = snapshot('2026-04-23T00:00:00Z', [
      {
        id: 'a',
        score: 90,
        passed: true,
        metrics: [
          { metricId: 'artifact-presence', score: 100 },
          { metricId: 'llm-judge', score: 80 },
        ],
      },
    ]);

    const delta = computeEvaluationDelta(prev, cur);
    const metricsById = new Map(delta.cases[0]?.metricDeltas.map((m) => [m.metricId, m]) ?? []);

    expect(metricsById.get('artifact-presence')?.change).toBe(60);
    expect(metricsById.get('llm-judge')?.change).toBe(0);
  });

  it('identifies new and removed cases across runs', () => {
    const prev = snapshot('2026-04-22T00:00:00Z', [
      { id: 'a', score: 80, passed: true },
      { id: 'gone', score: 50, passed: false },
    ]);
    const cur = snapshot('2026-04-23T00:00:00Z', [
      { id: 'a', score: 80, passed: true },
      { id: 'fresh', score: 70, passed: true },
    ]);

    const delta = computeEvaluationDelta(prev, cur);

    expect(delta.newCases).toEqual(['fresh']);
    expect(delta.removedCases).toEqual(['gone']);
    expect(delta.cases.map((c) => c.caseId)).toEqual(['a']);
  });

  it('converts pass-rate change to percentage points', () => {
    const prev = snapshot('2026-04-22T00:00:00Z', [
      { id: 'a', score: 50, passed: false },
      { id: 'b', score: 50, passed: false },
    ]);
    const cur = snapshot('2026-04-23T00:00:00Z', [
      { id: 'a', score: 80, passed: true },
      { id: 'b', score: 50, passed: false },
    ]);

    expect(computeEvaluationDelta(prev, cur).passRatePointsChange).toBe(50);
  });
});

describe('toHistorySnapshot', () => {
  it('strips verbose fields and keeps per-metric scores', () => {
    const result: SkillEvaluationResult = {
      skillPath: SKILL,
      datasetPath: DATASET,
      evaluatedAt: '2026-04-23T00:00:00Z',
      totalCases: 1,
      passedCases: 1,
      passRate: 1,
      cases: [
        {
          id: 'a',
          prompt: 'do the thing',
          actualOutput: 'a very long stdout blob we do not want to persist',
          score: 90,
          passed: true,
          observations: ['looks good'],
          scenarioType: 'ideal',
          metrics: [
            {
              metricId: 'artifact-presence',
              label: 'Artifact presence',
              score: 100,
              weight: 0.4,
              rationale: 'all files present',
            },
          ],
          fileChanges: [{ path: 'x.txt', changeType: 'created', contentAfter: 'hello' }],
        },
      ],
    };

    const snap = toHistorySnapshot(result);

    expect(snap.cases[0]?.id).toBe('a');
    expect(snap.cases[0]?.score).toBe(90);
    expect(snap.cases[0]?.scenarioType).toBe('ideal');
    expect(snap.cases[0]?.metrics).toEqual([{ metricId: 'artifact-presence', score: 100 }]);
    // Verbose fields must not leak.
    expect((snap.cases[0] as unknown as { actualOutput?: unknown }).actualOutput).toBeUndefined();
    expect((snap.cases[0] as unknown as { fileChanges?: unknown }).fileChanges).toBeUndefined();
  });
});
