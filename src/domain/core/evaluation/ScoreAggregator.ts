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

/**
 * Finding sources that represent neutral/positive LLM observations rather
 * than actionable recommendations. Excluded from `topRecommendations` so
 * praise like "CLAUDE.md is comprehensive" doesn't crowd out real fixes.
 */
const OBSERVATION_SOURCES: ReadonlySet<string> = new Set(['llm-judge']);

/**
 * Extracts actionable recommendations across dimensions. Filters out
 * neutral LLM observations, dedupes by normalised description, and within
 * each severity bucket prefers findings from higher-weighted dimensions.
 */
export function topRecommendations(dimensions: readonly DimensionScore[], limit = 5): string[] {
  const buckets: Record<Finding['severity'], { text: string; weight: number }[]> = {
    critical: [],
    warning: [],
    info: [],
  };
  const seen = new Set<string>();

  for (const dim of dimensions) {
    for (const f of dim.findings) {
      if (OBSERVATION_SOURCES.has(f.source)) continue;
      const key = normaliseKey(f.description);
      if (seen.has(key)) continue;
      seen.add(key);
      buckets[f.severity].push({
        text: `[${dim.dimension}] ${f.description}`,
        weight: dim.weight,
      });
    }
  }

  for (const sev of ['critical', 'warning', 'info'] as const) {
    buckets[sev].sort((a, b) => b.weight - a.weight);
  }

  return [...buckets.critical, ...buckets.warning, ...buckets.info]
    .slice(0, limit)
    .map((b) => b.text);
}

function normaliseKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/[.,;:!?()'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
