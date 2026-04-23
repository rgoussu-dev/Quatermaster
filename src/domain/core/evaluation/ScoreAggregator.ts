import type { DimensionScore, DimensionId } from '../../contract/DimensionScore.js';
import type { Finding } from '../../contract/Finding.js';
import type { JudgeResponse } from '../../contract/ports/LLMJudge.js';
import type { DimensionAssessment } from './DeterministicScorer.js';

const WEIGHTS: Record<DimensionId, number> = {
  'claude-code-setup': 0.35,
  'project-structure': 0.25,
  'test-infrastructure': 0.25,
  documentation: 0.15,
};

const LABELS: Record<DimensionId, string> = {
  'claude-code-setup': 'Claude Code Setup',
  'project-structure': 'Project Structure',
  'test-infrastructure': 'Test Infrastructure',
  documentation: 'Documentation',
};

export interface AggregateInput {
  readonly dimension: DimensionId;
  readonly deterministicAssessment: DimensionAssessment;
  readonly judgeResponse: JudgeResponse;
}

function toGrade(s: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (s >= 80) return 'A';
  if (s >= 60) return 'B';
  if (s >= 40) return 'C';
  if (s >= 20) return 'D';
  return 'F';
}

/**
 * Combines deterministic (40%) and LLM (60%) scores into DimensionScore objects.
 * Also merges findings from both sources, with critical/warning findings from
 * deterministic checks taking precedence in the top-recommendations list.
 */
export function aggregate(inputs: readonly AggregateInput[]): DimensionScore[] {
  return inputs.map((input) => {
    const combined = Math.round(
      0.4 * input.deterministicAssessment.score + 0.6 * input.judgeResponse.llmScore,
    );

    const llmFindings: Finding[] = [
      ...input.judgeResponse.observations.map((obs) => ({
        description: obs,
        severity: 'info' as const,
        source: 'llm-judge',
      })),
      {
        description: input.judgeResponse.recommendation,
        severity: (combined < 60 ? 'warning' : 'info') as Finding['severity'],
        source: 'llm-judge:recommendation',
      },
    ];

    return {
      dimension: input.dimension,
      label: LABELS[input.dimension],
      weight: WEIGHTS[input.dimension],
      score: combined,
      grade: toGrade(combined),
      findings: [...input.deterministicAssessment.findings, ...llmFindings],
    };
  });
}

/** Extracts weighted overall score and grade from aggregated dimension scores. */
export function overallScore(dimensions: readonly DimensionScore[]): {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
} {
  const weighted = dimensions.reduce((acc, d) => acc + d.weight * d.score, 0);
  const s = Math.round(weighted);
  return { score: s, grade: toGrade(s) };
}

/** Picks top recommendations by severity from across all dimensions. */
export function topRecommendations(dimensions: readonly DimensionScore[], limit = 5): string[] {
  const criticals: string[] = [];
  const warnings: string[] = [];
  const infos: string[] = [];

  for (const dim of dimensions) {
    for (const f of dim.findings) {
      const prefixed = `[${dim.dimension}] ${f.description}`;
      if (f.severity === 'critical') criticals.push(prefixed);
      else if (f.severity === 'warning') warnings.push(prefixed);
      else infos.push(prefixed);
    }
  }

  return [...criticals, ...warnings, ...infos].slice(0, limit);
}
