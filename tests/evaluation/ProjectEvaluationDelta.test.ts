import { describe, it, expect } from 'vitest';
import { computeProjectEvaluationDelta } from '../../src/domain/core/evaluation/computeProjectEvaluationDelta.js';
import { toProjectHistorySnapshot } from '../../src/domain/core/evaluation/toProjectHistorySnapshot.js';
import type { ProjectHistorySnapshot } from '../../src/domain/contract/ProjectHistorySnapshot.js';
import type { EvaluationResult } from '../../src/domain/contract/EvaluationResult.js';

const PROJECT = '/home/me/some-project';

function snap(
  evaluatedAt: string,
  overallScore: number,
  dims: ProjectHistorySnapshot['dimensions'],
): ProjectHistorySnapshot {
  return {
    projectPath: PROJECT,
    evaluatedAt,
    overallScore,
    overallGrade: gradeFor(overallScore),
    dimensions: dims,
  };
}

function gradeFor(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

describe('computeProjectEvaluationDelta', () => {
  it('reports zero changes for identical snapshots', () => {
    const base = snap('2026-04-22T00:00:00Z', 50, [
      { id: 'claude-code-setup', label: 'Claude Code Setup', weight: 0.35, score: 30, grade: 'D' },
      { id: 'project-structure', label: 'Project Structure', weight: 0.25, score: 80, grade: 'A' },
    ]);
    const delta = computeProjectEvaluationDelta(base, base);

    expect(delta.overallScoreChange).toBe(0);
    expect(delta.dimensions.every((d) => d.scoreChange === 0)).toBe(true);
  });

  it('computes overall and per-dimension score changes', () => {
    const prev = snap('2026-04-22T00:00:00Z', 42, [
      { id: 'claude-code-setup', label: 'Claude Code Setup', weight: 0.35, score: 1, grade: 'F' },
      { id: 'documentation', label: 'Documentation', weight: 0.15, score: 7, grade: 'F' },
    ]);
    const cur = snap('2026-04-23T00:00:00Z', 75, [
      { id: 'claude-code-setup', label: 'Claude Code Setup', weight: 0.35, score: 80, grade: 'A' },
      { id: 'documentation', label: 'Documentation', weight: 0.15, score: 60, grade: 'B' },
    ]);

    const delta = computeProjectEvaluationDelta(prev, cur);
    expect(delta.overallScoreChange).toBe(33);

    const byId = new Map(delta.dimensions.map((d) => [d.id, d]));
    expect(byId.get('claude-code-setup')?.scoreChange).toBe(79);
    expect(byId.get('claude-code-setup')?.previousGrade).toBe('F');
    expect(byId.get('claude-code-setup')?.currentGrade).toBe('A');
    expect(byId.get('documentation')?.scoreChange).toBe(53);
  });

  it('omits dimensions that exist only in one snapshot', () => {
    const prev = snap('2026-04-22T00:00:00Z', 50, [
      { id: 'claude-code-setup', label: 'A', weight: 0.35, score: 30, grade: 'D' },
    ]);
    const cur = snap('2026-04-23T00:00:00Z', 60, [
      { id: 'claude-code-setup', label: 'A', weight: 0.35, score: 30, grade: 'D' },
      { id: 'project-structure', label: 'B', weight: 0.25, score: 80, grade: 'A' },
    ]);

    const delta = computeProjectEvaluationDelta(prev, cur);
    expect(delta.dimensions.map((d) => d.id)).toEqual(['claude-code-setup']);
  });
});

describe('toProjectHistorySnapshot', () => {
  it('drops findings and topRecommendations', () => {
    const result: EvaluationResult = {
      projectPath: PROJECT,
      evaluatedAt: '2026-04-23T00:00:00Z',
      overallScore: 42,
      overallGrade: 'C',
      dimensions: [
        {
          dimension: 'claude-code-setup',
          label: 'Claude Code Setup',
          weight: 0.35,
          score: 1,
          grade: 'F',
          findings: [
            { description: 'Missing CLAUDE.md', severity: 'critical', source: 'deterministic' },
          ],
        },
      ],
      topRecommendations: ['Add CLAUDE.md'],
    };

    const snapshot = toProjectHistorySnapshot(result);
    expect(snapshot.dimensions[0]?.id).toBe('claude-code-setup');
    expect(snapshot.dimensions[0]?.score).toBe(1);
    expect((snapshot.dimensions[0] as unknown as { findings?: unknown }).findings).toBeUndefined();
    expect(
      (snapshot as unknown as { topRecommendations?: unknown }).topRecommendations,
    ).toBeUndefined();
  });
});
