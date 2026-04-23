import type { DimensionScore } from './DimensionScore.js';

/**
 * The complete output of a project evaluation.
 * Overall score is the weighted sum of all dimension scores.
 */
export interface EvaluationResult {
  readonly projectPath: string;
  /** ISO 8601 timestamp of when the evaluation ran. */
  readonly evaluatedAt: string;
  /** Weighted score in [0, 100]. */
  readonly overallScore: number;
  readonly overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** One entry per DimensionId. */
  readonly dimensions: readonly DimensionScore[];
  /** Top actionable recommendations across all dimensions, ordered by impact. */
  readonly topRecommendations: readonly string[];
}
